import argparse
import json
import os
import random
import sqlite3
import sys
import time
from collections import Counter
from datetime import datetime

import requests
from dotenv import load_dotenv

load_dotenv()

EVENT_PREFIX = "@@MATCH_COLLECTOR@@"


def emit_event(payload):
    sys.stdout.write(f"{EVENT_PREFIX}{json.dumps(payload, ensure_ascii=True)}\n")
    sys.stdout.flush()


class MatchCollector:
    def __init__(self, config):
        self.config = config
        self.raw_db_path = config["rawDbPath"]
        self.matches_dir = config["matchesDir"]
        self.api_key = config["apiKey"]
        self.stop_signal_path = config.get("stopSignalPath")
        self.dataset_id = config.get("datasetId")
        self.collector_mode = config.get("collectorMode", "standard")
        self.mode = config.get("mode", "random")
        self.specific_puuid = config.get("specificPuuid")
        self.queue_type = config.get("queueType", "")
        self.matches_per_player = int(config.get("matchesPerPlayer", 10))
        self.max_iterations = int(config.get("maxIterations", 1))
        self.requests_per_second = max(float(config.get("requestsPerSecond", 15)), 0.1)
        self.requests_per_2min = max(int(config.get("requestsPer2Min", 90)), 1)
        self.probe_match_count = max(int(config.get("probeMatchCount", 5)), 1)
        self.minimum_premade_repeats = max(int(config.get("minimumPremadeRepeats", 2)), 2)

        self.random = random.Random(config.get("randomSeed"))
        self.session = requests.Session()
        self.session.headers.update({"X-Riot-Token": self.api_key})

        self.processed_players = set()
        self.total_matches_saved = 0
        self.total_api_calls = 0
        self.requests_in_current_2min = 0
        self.two_min_window_start = time.time()
        self.run_started_at = datetime.utcnow().isoformat() + "Z"
        self.current_stage = "idle"
        self.current_player_name = None
        self.current_player_puuid = None
        self.current_match_id = None
        self.stop_requested = False
        self.iterations_completed = 0
        self.selection_summary = {
            "candidatesTried": 0,
            "candidatesSkippedNoPremade": 0,
            "candidatesPromoted": 0,
            "currentCandidatePuuid": None,
            "currentCandidateProbeSummary": None,
        }

        os.makedirs(self.matches_dir, exist_ok=True)

    def log(self, message, level="info"):
        emit_event({"type": "log", "level": level, "message": message, "timestamp": datetime.utcnow().isoformat() + "Z"})

    def emit_progress(self):
        emit_event({
            "type": "progress",
            "currentStage": self.current_stage,
            "progress": {
                "playersProcessed": len(self.processed_players),
                "maxIterations": self.max_iterations,
                "matchesSaved": self.total_matches_saved,
                "apiCallsMade": self.total_api_calls,
                "currentPlayerName": self.current_player_name,
                "currentPlayerPuuid": self.current_player_puuid,
                "currentMatchId": self.current_match_id,
                "startedAt": self.run_started_at,
                "stopRequested": self.stop_requested,
            },
            "selectionSummary": self.selection_summary,
            "summary": {
                "datasetId": self.dataset_id,
                "collectorMode": self.collector_mode,
                "mode": self.mode,
                "iterationsCompleted": self.iterations_completed,
                "playersProcessed": len(self.processed_players),
                "matchesSaved": self.total_matches_saved,
                "apiCallsMade": self.total_api_calls,
            },
        })

    def emit_status(self, status, error=None):
        emit_event({
            "type": "status",
            "status": status,
            "currentStage": self.current_stage,
            "summary": {
                "datasetId": self.dataset_id,
                "collectorMode": self.collector_mode,
                "mode": self.mode,
                "iterationsCompleted": self.iterations_completed,
                "playersProcessed": len(self.processed_players),
                "matchesSaved": self.total_matches_saved,
                "apiCallsMade": self.total_api_calls,
                "finishedAt": datetime.utcnow().isoformat() + "Z",
            },
            "error": error,
        })

    def check_stop_requested(self):
        if self.stop_requested:
            return True
        if self.stop_signal_path and os.path.exists(self.stop_signal_path):
            self.stop_requested = True
            self.log("Stop requested. Finishing the current step before exiting.", "warning")
            self.emit_progress()
            return True
        return False

    def connect_db(self):
        connection = sqlite3.connect(self.raw_db_path)
        connection.row_factory = sqlite3.Row
        return connection

    def get_candidate_player(self):
        if self.mode == "specific-puuid":
            return self.get_specific_player_info(self.specific_puuid)

        with self.connect_db() as conn:
            cursor = conn.cursor()
            if self.processed_players:
                placeholders = ",".join(["?"] * len(self.processed_players))
                query = f"""
                    SELECT puuid, names
                    FROM players
                    WHERE puuid IS NOT NULL
                      AND puuid != ''
                      AND puuid NOT IN ({placeholders})
                    ORDER BY RANDOM()
                    LIMIT 50
                """
                cursor.execute(query, list(self.processed_players))
            else:
                cursor.execute("""
                    SELECT puuid, names
                    FROM players
                    WHERE puuid IS NOT NULL
                      AND puuid != ''
                    ORDER BY RANDOM()
                    LIMIT 50
                """)

            candidates = cursor.fetchall()
            if not candidates:
                return None, None

            choice = self.random.choice(candidates)
            return choice["puuid"], self.get_latest_name(choice["names"])

    def get_specific_player_info(self, puuid):
        with self.connect_db() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT puuid, names FROM players WHERE puuid = ?", (puuid,))
            row = cursor.fetchone()
            if row:
                return row["puuid"], self.get_latest_name(row["names"])
        return puuid, "Unknown Player"

    def get_latest_name(self, names_value):
        if not names_value:
            return "Unknown Player"
        try:
            parsed = json.loads(names_value)
            if isinstance(parsed, list) and parsed:
                return str(parsed[-1])
        except Exception:
            pass
        return str(names_value)

    def check_rate_limits(self):
        current_time = time.time()
        if current_time - self.two_min_window_start >= 120:
            self.two_min_window_start = current_time
            self.requests_in_current_2min = 0

        if self.requests_in_current_2min >= self.requests_per_2min:
            wait_time = 120 - (current_time - self.two_min_window_start)
            if wait_time > 0:
                self.log(f"Approaching 2-minute rate limit. Waiting {wait_time:.1f}s.", "warning")
                time.sleep(wait_time + 1)
                self.two_min_window_start = time.time()
                self.requests_in_current_2min = 0

        time.sleep(1.0 / self.requests_per_second)

    def make_api_request(self, url, params=None):
        if self.check_stop_requested():
            return None
        self.check_rate_limits()
        response = self.session.get(url, params=params, timeout=20)
        self.total_api_calls += 1
        self.requests_in_current_2min += 1
        self.emit_progress()
        return response

    def fetch_match_ids(self, puuid, count):
        url = f"https://europe.api.riotgames.com/lol/match/v5/matches/by-puuid/{puuid}/ids"
        params = {"start": 0, "count": count}
        if self.queue_type:
            params["queue"] = self.queue_type

        self.log(f"Fetching up to {count} match ids for {puuid[:20]}...")
        response = self.make_api_request(url, params)
        if response is None:
            return []

        if response.status_code == 200:
            return response.json()
        if response.status_code == 429:
            self.log("Riot API rate-limited the collector while fetching match ids. Waiting 30s.", "warning")
            time.sleep(30)
            return self.fetch_match_ids(puuid, count)

        self.log(f"Failed to fetch match ids: HTTP {response.status_code}", "error")
        return []

    def fetch_match_data(self, match_id):
        url = f"https://europe.api.riotgames.com/lol/match/v5/matches/{match_id}"
        self.current_match_id = match_id
        self.emit_progress()
        response = self.make_api_request(url)
        if response is None:
            return None

        if response.status_code == 200:
            return response.json()
        if response.status_code == 429:
            self.log(f"Riot API rate-limited the collector while fetching {match_id}. Waiting 30s.", "warning")
            time.sleep(30)
            return self.fetch_match_data(match_id)

        self.log(f"Failed to fetch match {match_id}: HTTP {response.status_code}", "error")
        return None

    def save_match_data(self, match_data):
        match_id = match_data.get("metadata", {}).get("matchId")
        if not match_id:
            return False, "Missing matchId"

        file_path = os.path.join(self.matches_dir, f"{match_id}.json")
        if os.path.exists(file_path):
            return False, "Match already exists"

        with open(file_path, "w", encoding="utf-8") as handle:
            json.dump(match_data, handle, ensure_ascii=False, indent=2)
        self.total_matches_saved += 1
        self.emit_progress()
        return True, "Match saved"

    def analyze_premade_signal(self, candidate_puuid, match_cache):
        teammate_counts = Counter()
        analyzed_matches = 0

        for match_data in match_cache.values():
            try:
                participants = match_data["info"]["participants"]
            except KeyError:
                continue

            candidate = None
            for participant in participants:
                if participant.get("puuid") == candidate_puuid:
                    candidate = participant
                    break
            if not candidate:
                continue

            analyzed_matches += 1
            team_id = candidate.get("teamId")
            for participant in participants:
                teammate_puuid = participant.get("puuid")
                if teammate_puuid == candidate_puuid:
                    continue
                if participant.get("teamId") == team_id and teammate_puuid:
                    teammate_counts[teammate_puuid] += 1

        repeated = {puuid: count for puuid, count in teammate_counts.items() if count >= self.minimum_premade_repeats}
        summary = {
            "analyzedMatches": analyzed_matches,
            "distinctTeammates": len(teammate_counts),
            "repeatedTeammates": len(repeated),
            "strongestRepeatCount": max(repeated.values()) if repeated else 0,
            "topRepeatedTeammates": sorted(
                [{"puuid": puuid, "repeatCount": count} for puuid, count in repeated.items()],
                key=lambda item: (-item["repeatCount"], item["puuid"]),
            )[:5],
        }
        return repeated, summary

    def probe_candidate(self, puuid, names):
        self.current_stage = "probing-candidate"
        self.selection_summary["candidatesTried"] += 1
        self.selection_summary["currentCandidatePuuid"] = puuid
        self.current_player_puuid = puuid
        self.current_player_name = names
        self.current_match_id = None
        self.emit_progress()

        match_ids = self.fetch_match_ids(puuid, self.probe_match_count)
        if not match_ids:
            summary = {
                "analyzedMatches": 0,
                "distinctTeammates": 0,
                "repeatedTeammates": 0,
                "strongestRepeatCount": 0,
                "topRepeatedTeammates": [],
            }
            self.selection_summary["currentCandidateProbeSummary"] = summary
            self.selection_summary["candidatesSkippedNoPremade"] += 1
            self.emit_progress()
            return False, {}, summary

        match_cache = {}
        for match_id in match_ids:
            if self.check_stop_requested():
                break
            match_data = self.fetch_match_data(match_id)
            if match_data:
                match_cache[match_id] = match_data

        repeated, summary = self.analyze_premade_signal(puuid, match_cache)
        self.selection_summary["currentCandidateProbeSummary"] = summary

        if repeated:
            self.selection_summary["candidatesPromoted"] += 1
            self.log(
                f"Candidate {names} promoted with {summary['repeatedTeammates']} repeated teammates "
                f"and strongest repeat {summary['strongestRepeatCount']}.",
            )
            self.emit_progress()
            return True, match_cache, summary

        self.selection_summary["candidatesSkippedNoPremade"] += 1
        self.log(f"Candidate {names} skipped after the 5-match probe found no repeated teammates.", "warning")
        self.emit_progress()
        return False, match_cache, summary

    def process_player(self, puuid, names, prefetched_matches=None):
        self.current_stage = "collecting-player"
        self.current_player_puuid = puuid
        self.current_player_name = names
        self.current_match_id = None
        self.emit_progress()

        self.log(f"Processing player {names} ({puuid}).")
        match_ids = self.fetch_match_ids(puuid, self.matches_per_player)
        if not match_ids:
            self.log("No match ids found for the selected player.", "warning")
            return 0

        prefetched_matches = prefetched_matches or {}
        saved_for_player = 0

        for match_id in match_ids:
            if self.check_stop_requested():
                break

            match_data = prefetched_matches.get(match_id)
            if match_data is None:
                match_data = self.fetch_match_data(match_id)

            if not match_data:
                continue

            saved, message = self.save_match_data(match_data)
            if saved:
                saved_for_player += 1
                self.log(f"{match_id}: {message}")
            else:
                self.log(f"{match_id}: {message}")

        self.iterations_completed += 1
        self.current_match_id = None
        self.emit_progress()
        self.log(f"Player summary for {names}: {saved_for_player} new matches saved.")
        return saved_for_player

    def run(self):
        self.current_stage = "starting"
        self.log(f"Starting match collector for dataset {self.dataset_id or 'unknown'}.")
        self.emit_status("running")
        self.emit_progress()

        if self.collector_mode == "strengthen-graph" and self.mode != "random":
            raise ValueError("strengthen-graph mode supports random candidate selection only.")

        if self.mode == "specific-puuid" and not self.specific_puuid:
            raise ValueError("specific-puuid mode requires specificPuuid.")

        while len(self.processed_players) < self.max_iterations:
            if self.check_stop_requested():
                break

            candidate = self.get_candidate_player()
            puuid, names = candidate
            if not puuid:
                self.log("No eligible players remain in the active dataset.", "warning")
                break

            if puuid in self.processed_players:
                continue

            prefetched_matches = {}
            if self.collector_mode == "strengthen-graph":
                promoted, prefetched_matches, _summary = self.probe_candidate(puuid, names)
                if not promoted:
                    self.processed_players.add(puuid)
                    continue

            self.process_player(puuid, names, prefetched_matches)
            self.processed_players.add(puuid)

            if self.mode == "specific-puuid":
                break

        self.current_stage = "stopped" if self.stop_requested else "completed"
        final_status = "stopped" if self.stop_requested else "completed"
        self.emit_progress()
        self.emit_status(final_status)


def load_config():
    parser = argparse.ArgumentParser(description="Dataset-aware Riot match collector")
    parser.add_argument("--config-file", type=str, help="Path to a collector config JSON file")
    parser.add_argument("--config-json", type=str, help="Inline collector config JSON")
    args = parser.parse_args()

    if args.config_file:
        with open(args.config_file, "r", encoding="utf-8") as handle:
            return json.load(handle)
    if args.config_json:
        return json.loads(args.config_json)
    raise ValueError("Either --config-file or --config-json must be provided.")


if __name__ == "__main__":
    try:
        config = load_config()
        api_key = config.get("apiKey") or os.getenv("RIOT_API_KEY")
        if not api_key:
            raise ValueError("RIOT_API_KEY is not configured.")
        config["apiKey"] = api_key

        collector = MatchCollector(config)
        collector.run()
    except KeyboardInterrupt:
        emit_event({
            "type": "status",
            "status": "stopped",
            "currentStage": "stopped",
            "summary": {"finishedAt": datetime.utcnow().isoformat() + "Z"},
            "error": None,
        })
        sys.exit(0)
    except Exception as error:
        emit_event({
            "type": "log",
            "level": "error",
            "message": str(error),
            "timestamp": datetime.utcnow().isoformat() + "Z",
        })
        emit_event({
            "type": "status",
            "status": "failed",
            "currentStage": "failed",
            "summary": {"finishedAt": datetime.utcnow().isoformat() + "Z"},
            "error": str(error),
        })
        sys.exit(1)
