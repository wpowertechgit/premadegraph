import argparse
import json
import os
import random
import re
import sqlite3
import sys
import time
from collections import Counter, deque
from datetime import datetime, timedelta

import requests
from dotenv import load_dotenv

load_dotenv()

EVENT_PREFIX = "@@MATCH_COLLECTOR@@"
QUEUE_IDS = {
    "RANKED_SOLO_5x5": "420",
    "RANKED_FLEX_SR": "440",
    "NORMAL_DRAFT": "430",
}
LEAGUE_QUEUES = {
    "420": "RANKED_SOLO_5x5",
    "440": "RANKED_FLEX_SR",
}
TIER_ORDER = {
    "IRON": 0,
    "BRONZE": 1,
    "SILVER": 2,
    "GOLD": 3,
    "PLATINUM": 4,
    "EMERALD": 5,
    "DIAMOND": 6,
    "MASTER": 7,
    "GRANDMASTER": 8,
    "CHALLENGER": 9,
}
REQUIRED_PARTICIPANT_FIELDS = [
    "puuid",
    "teamId",
    "kills",
    "deaths",
    "assists",
    "goldEarned",
    "visionScore",
    "teamPosition",
]


def emit_event(payload):
    sys.stdout.write(f"{EVENT_PREFIX}{json.dumps(payload, ensure_ascii=True)}\n")
    sys.stdout.flush()


def expand_env_placeholders(value):
    if isinstance(value, str) and value.startswith("${") and value.endswith("}"):
        return os.getenv(value[2:-1], "")
    return value


def resolve_backend_path(*parts):
    return os.path.abspath(os.path.join(os.path.dirname(__file__), *parts))


def utc_now():
    return datetime.utcnow().isoformat() + "Z"


class APIKeyRotator:
    def __init__(self, keys, requests_per_second, requests_per_2min, logger):
        self.keys = [key for key in keys if key.get("value")]
        self.requests_per_second = max(float(requests_per_second), 0.1)
        self.requests_per_2min = max(int(requests_per_2min), 1)
        self.logger = logger
        self.current_index = 0
        self.state = {
            key["id"]: {
                "oneSecond": deque(),
                "twoMinute": deque(),
                "limitedUntil": 0.0,
            }
            for key in self.keys
        }

    def describe(self):
        return [key["id"] for key in self.keys]

    def get_next_key(self):
        if not self.keys:
            raise ValueError("No Riot API keys are configured.")
        key = self.keys[self.current_index]
        self.current_index = (self.current_index + 1) % len(self.keys)
        return key

    def prune(self, key_id, now):
        state = self.state[key_id]
        while state["oneSecond"] and now - state["oneSecond"][0] >= 1:
            state["oneSecond"].popleft()
        while state["twoMinute"] and now - state["twoMinute"][0] >= 120:
            state["twoMinute"].popleft()

    def wait_if_needed(self, key):
        key_id = key["id"]
        while True:
            now = time.time()
            self.prune(key_id, now)
            state = self.state[key_id]
            waits = []
            if state["limitedUntil"] > now:
                waits.append(state["limitedUntil"] - now)
            if len(state["oneSecond"]) >= self.requests_per_second:
                waits.append(1 - (now - state["oneSecond"][0]))
            if len(state["twoMinute"]) >= self.requests_per_2min:
                waits.append(120 - (now - state["twoMinute"][0]))
            wait_time = max([wait for wait in waits if wait > 0], default=0)
            if wait_time <= 0:
                state["oneSecond"].append(now)
                state["twoMinute"].append(now)
                return
            self.logger(f"Key {key_id} is waiting {wait_time:.1f}s for rate-limit budget.", "warning")
            time.sleep(wait_time + 0.05)

    def mark_rate_limited(self, key, retry_after):
        key_id = key["id"]
        retry_seconds = max(float(retry_after or 30), 1.0)
        self.state[key_id]["limitedUntil"] = time.time() + retry_seconds
        self.logger(f"Rate limit hit on key {key_id}; retry-after {retry_seconds:.1f}s.", "warning")


class MatchCollector:
    def __init__(self, config):
        self.config = self.normalize_config(config)
        self.raw_db_path = self.config["rawDbPath"]
        self.matches_dir = self.config["matchesDir"]
        self.cache_dir = self.config.get("cacheDir") or resolve_backend_path("data", "cache", self.config.get("datasetId") or "default")
        self.api_keys = self.config["apiKeys"]
        self.api_key = self.api_keys[0]["value"]
        self.stop_signal_path = self.config.get("stopSignalPath")
        self.dataset_id = self.config.get("datasetId")
        self.collector_mode = self.config.get("collectorMode", "standard")
        self.mode = self.config.get("mode", "random")
        self.specific_puuid = self.config.get("specificPuuid")
        self.queue_type = str(self.config.get("queueType", ""))
        self.matches_per_player = int(self.config.get("matchesPerPlayer", 10))
        self.initial_matches_per_seed = int(self.config.get("initialMatchesPerSeed", self.matches_per_player))
        self.max_iterations = int(self.config.get("maxIterations", 1))
        self.max_players = int(self.config.get("maxPlayers", self.max_iterations))
        self.max_matches = int(self.config.get("maxMatches", 10**9))
        self.requests_per_second = max(float(self.config.get("requestsPerSecond", 15)), 0.1)
        self.requests_per_2min = max(int(self.config.get("requestsPer2Min", 90)), 1)
        self.probe_match_count = max(int(self.config.get("probeMatchCount", 5)), 1)
        self.minimum_premade_repeats = max(int(self.config.get("minimumPremadeRepeats", 2)), 1)
        self.platform_routing = self.config.get("platformRouting", "eun1").lower()
        self.regional_routing = self.config.get("regionalRouting", "europe").lower()
        self.seed_players = list(self.config.get("seedPlayers", []))
        self.seed_count = int(self.config.get("seedCount", len(self.seed_players) or 1))
        self.discovery = self.config.get("discovery", {})
        self.constraints = self.config.get("constraints", {})
        self.strict_constraints = bool(self.constraints.get("strict", True))
        self.min_tier = str(self.constraints.get("minTier", "")).upper()
        self.allowed_tiers = {
            str(tier).upper()
            for tier in self.constraints.get("allowedTiers", [])
        }
        self.min_lp = self.constraints.get("minLeaguePoints")
        self.max_lp = self.constraints.get("maxLeaguePoints")
        self.require_rank_validation = bool(self.constraints.get("requireRankValidation", False))
        self.reject_premade_repeats_at = self.constraints.get("rejectPremadeRepeatAt")
        self.require_complete_participant_fields = bool(
            self.constraints.get("requireCompleteParticipantFields", False)
        )
        self.max_match_age_days = self.constraints.get("maxMatchAgeDays")
        self.persist_metadata = bool(self.config.get("persistMetadata", True))
        self.resume_from_checkpoint = bool(self.config.get("resumeFromCheckpoint", True))
        self.checkpoint_every_matches = max(int(self.config.get("checkpointEveryMatches", 5)), 1)
        self.checkpoint_path = self.config.get("checkpointPath") or os.path.join(
            self.cache_dir,
            "collector-checkpoint.json",
        )
        self.last_checkpoint_match_count = 0
        self.current_frontier_item_is_seed = False
        self.active_frontier = deque()

        self.random = random.Random(self.config.get("randomSeed"))
        self.session = requests.Session()
        self.key_rotator = APIKeyRotator(
            self.api_keys,
            self.requests_per_second,
            self.requests_per_2min,
            self.log,
        )

        self.processed_players = set()
        self.queued_players = set()
        self.invalid_puuids = set()
        self.rank_cache = {}
        self.total_matches_saved = 0
        self.total_matches_seen = 0
        self.total_api_calls = 0
        self.requests_in_current_2min = 0
        self.two_min_window_start = time.time()
        self.run_started_at = utc_now()
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
            "frontierSize": 0,
            "rankRejected": 0,
            "constraintRejectedMatches": 0,
            "discoveredPlayers": 0,
        }

        os.makedirs(os.path.dirname(self.raw_db_path), exist_ok=True)
        os.makedirs(self.matches_dir, exist_ok=True)
        os.makedirs(self.cache_dir, exist_ok=True)
        self.initialize_raw_database()
        self.log(f"Riot API key mode: {len(self.api_keys)} key(s): {', '.join(self.key_rotator.describe())}.")

    def normalize_config(self, config):
        normalized = dict(config)
        api_keys = []
        configured_keys = normalized.get("apiKeys") if isinstance(normalized.get("apiKeys"), list) else []
        for key in configured_keys:
            value = expand_env_placeholders(key.get("value"))
            if value:
                api_keys.append({
                    "id": key.get("id") or f"key-{len(api_keys) + 1}",
                    "value": value,
                })

        legacy_key = expand_env_placeholders(normalized.get("apiKey")) or os.getenv("RIOT_API_KEY")
        if legacy_key and all(existing["value"] != legacy_key for existing in api_keys):
            api_keys.append({"id": "riot", "value": legacy_key})

        normalized["apiKeys"] = api_keys
        normalized["apiKey"] = api_keys[0]["value"] if api_keys else ""
        dataset_id = normalized.get("datasetId")
        if dataset_id:
            normalized.setdefault("rawDbPath", resolve_backend_path("data", "databases", dataset_id, "players.db"))
            normalized.setdefault("matchesDir", resolve_backend_path("data", "matches", dataset_id))
            normalized.setdefault("cacheDir", resolve_backend_path("data", "cache", dataset_id))
        if "rawDbPath" in normalized:
            normalized["rawDbPath"] = os.path.abspath(normalized["rawDbPath"])
        if "matchesDir" in normalized:
            normalized["matchesDir"] = os.path.abspath(normalized["matchesDir"])
        if "cacheDir" in normalized:
            normalized["cacheDir"] = os.path.abspath(normalized["cacheDir"])
        if not normalized.get("rawDbPath") or not normalized.get("matchesDir"):
            raise ValueError("Collector config requires datasetId, or both rawDbPath and matchesDir.")
        if not normalized.get("apiKey"):
            raise ValueError("RIOT_API_KEY is not configured.")
        if normalized.get("queueType") in QUEUE_IDS:
            normalized["queueType"] = QUEUE_IDS[normalized["queueType"]]
        return normalized

    def initialize_raw_database(self):
        with self.connect_db() as connection:
            connection.execute(
                """
                CREATE TABLE IF NOT EXISTS players (
                    puuid TEXT PRIMARY KEY,
                    names TEXT,
                    feedscore REAL,
                    opscore REAL,
                    country TEXT,
                    match_count INTEGER DEFAULT 0
                )
                """
            )

    def log(self, message, level="info"):
        emit_event({"type": "log", "level": level, "message": message, "timestamp": utc_now()})

    def emit_progress(self):
        emit_event({
            "type": "progress",
            "currentStage": self.current_stage,
            "progress": {
                "playersProcessed": len(self.processed_players),
                "maxIterations": self.max_players,
                "matchesSaved": self.total_matches_saved,
                "apiCallsMade": self.total_api_calls,
                "currentPlayerName": self.current_player_name,
                "currentPlayerPuuid": self.current_player_puuid,
                "currentMatchId": self.current_match_id,
                "startedAt": self.run_started_at,
                "stopRequested": self.stop_requested,
            },
            "selectionSummary": self.selection_summary,
            "summary": self.build_summary(),
        })

    def emit_status(self, status, error=None):
        emit_event({
            "type": "status",
            "status": status,
            "currentStage": self.current_stage,
            "summary": {**self.build_summary(), "finishedAt": utc_now()},
            "error": error,
        })

    def build_summary(self):
        return {
            "datasetId": self.dataset_id,
            "collectorMode": self.collector_mode,
            "mode": self.mode,
            "iterationsCompleted": self.iterations_completed,
            "playersProcessed": len(self.processed_players),
            "matchesSaved": self.total_matches_saved,
            "matchesSeen": self.total_matches_seen,
            "apiCallsMade": self.total_api_calls,
            "invalidPuuids": len(self.invalid_puuids),
        }

    def frontier_to_json(self, frontier):
        return [
            {"puuid": puuid, "name": name, "isSeed": is_seed}
            for puuid, name, is_seed in frontier
            if puuid not in self.invalid_puuids
        ]

    def frontier_from_json(self, items):
        frontier = deque()
        for item in items or []:
            puuid = item.get("puuid")
            if not puuid or puuid in self.invalid_puuids:
                continue
            frontier.append((puuid, item.get("name") or "Checkpoint Player", bool(item.get("isSeed"))))
        return frontier

    def mark_invalid_puuid(self, puuid, reason="invalid Riot identifier"):
        if not puuid or puuid in self.invalid_puuids:
            return
        self.invalid_puuids.add(puuid)
        self.processed_players.discard(puuid)
        self.queued_players.discard(puuid)
        self.rank_cache.pop(puuid, None)
        self.log(f"Quarantined invalid PUUID-like value {puuid[:20]}... ({reason}).", "warning")

    def is_collectable_puuid(self, puuid):
        return bool(puuid) and puuid not in self.invalid_puuids

    def build_checkpoint_payload(self, frontier=None, status="running"):
        checkpoint_frontier = self.active_frontier if frontier is None else frontier
        current_player = None
        if (
            self.current_player_puuid
            and self.current_player_puuid not in self.processed_players
            and self.current_player_puuid not in self.invalid_puuids
        ):
            current_player = {
                "puuid": self.current_player_puuid,
                "name": self.current_player_name or "Checkpoint Player",
                "isSeed": self.current_frontier_item_is_seed,
            }
        return {
            "version": 1,
            "status": status,
            "datasetId": self.dataset_id,
            "collectorMode": self.collector_mode,
            "mode": self.mode,
            "updatedAt": utc_now(),
            "runStartedAt": self.run_started_at,
            "summary": self.build_summary(),
            "selectionSummary": self.selection_summary,
            "processedPlayers": sorted(self.processed_players),
            "queuedPlayers": sorted(self.queued_players),
            "invalidPuuids": sorted(self.invalid_puuids),
            "frontier": self.frontier_to_json(checkpoint_frontier),
            "currentPlayer": current_player,
        }

    def write_checkpoint(self, frontier=None, force=False, status="running"):
        if not self.resume_from_checkpoint and status == "running":
            return
        if (
            not force
            and self.total_matches_saved - self.last_checkpoint_match_count < self.checkpoint_every_matches
        ):
            return
        os.makedirs(os.path.dirname(self.checkpoint_path), exist_ok=True)
        temp_path = f"{self.checkpoint_path}.tmp"
        with open(temp_path, "w", encoding="utf-8") as handle:
            json.dump(self.build_checkpoint_payload(frontier, status), handle, indent=2)
        os.replace(temp_path, self.checkpoint_path)
        self.last_checkpoint_match_count = self.total_matches_saved
        self.log(f"Checkpoint written after {self.total_matches_saved} saved matches.")

    def load_checkpoint(self):
        if not self.resume_from_checkpoint or not os.path.exists(self.checkpoint_path):
            return None
        with open(self.checkpoint_path, "r", encoding="utf-8") as handle:
            checkpoint = json.load(handle)
        if checkpoint.get("datasetId") != self.dataset_id or checkpoint.get("collectorMode") != self.collector_mode:
            self.log("Checkpoint ignored because dataset or collector mode does not match.", "warning")
            return None
        if checkpoint.get("status") == "completed":
            self.log("Previous collector checkpoint is marked completed; starting a fresh run.")
            return None

        self.invalid_puuids = set(checkpoint.get("invalidPuuids") or [])
        self.processed_players = set(checkpoint.get("processedPlayers") or []) - self.invalid_puuids
        self.queued_players = set(checkpoint.get("queuedPlayers") or []) - self.invalid_puuids
        summary = checkpoint.get("summary") or {}
        self.total_matches_saved = int(summary.get("matchesSaved") or self.total_matches_saved)
        self.total_matches_seen = int(summary.get("matchesSeen") or self.total_matches_seen)
        self.iterations_completed = int(summary.get("iterationsCompleted") or len(self.processed_players))
        self.selection_summary = {
            **self.selection_summary,
            **(checkpoint.get("selectionSummary") or {}),
        }
        frontier = self.frontier_from_json(checkpoint.get("frontier") or [])
        current = checkpoint.get("currentPlayer")
        if (
            current
            and current.get("puuid") not in self.processed_players
            and current.get("puuid") not in self.invalid_puuids
        ):
            frontier.appendleft((
                current.get("puuid"),
                current.get("name") or "Checkpoint Player",
                bool(current.get("isSeed")),
            ))
            self.queued_players.add(current.get("puuid"))
        self.last_checkpoint_match_count = self.total_matches_saved
        self.log(
            f"Resumed checkpoint with {len(self.processed_players)} processed players, "
            f"{len(frontier)} queued frontier players, and {self.total_matches_saved} saved matches.",
            "warning",
        )
        return frontier

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

    def upsert_player_stub(self, puuid, name="Unknown Player"):
        if not puuid:
            return
        with self.connect_db() as conn:
            row = conn.execute("SELECT names, match_count FROM players WHERE puuid = ?", (puuid,)).fetchone()
            if row:
                names = self.merge_names(row["names"], name)
                conn.execute(
                    "UPDATE players SET names = ?, match_count = COALESCE(match_count, 0) + 1 WHERE puuid = ?",
                    (json.dumps(names), puuid),
                )
            else:
                conn.execute(
                    "INSERT INTO players (puuid, names, match_count) VALUES (?, ?, 1)",
                    (puuid, json.dumps([name] if name else [])),
                )

    def merge_names(self, names_value, next_name):
        names = []
        if names_value:
            try:
                parsed = json.loads(names_value)
                if isinstance(parsed, list):
                    names = [str(item) for item in parsed if item]
            except Exception:
                names = [str(names_value)]
        if next_name and next_name not in names:
            names.append(next_name)
        return names[-8:]

    def get_candidate_player(self):
        if self.mode == "specific-puuid":
            return self.get_specific_player_info(self.specific_puuid)

        with self.connect_db() as conn:
            cursor = conn.cursor()
            if self.processed_players:
                placeholders = ",".join(["?"] * len(self.processed_players))
                cursor.execute(
                    f"""
                    SELECT puuid, names
                    FROM players
                    WHERE puuid IS NOT NULL
                      AND puuid != ''
                      AND puuid NOT IN ({placeholders})
                    ORDER BY RANDOM()
                    LIMIT 50
                    """,
                    list(self.processed_players),
                )
            else:
                cursor.execute(
                    """
                    SELECT puuid, names
                    FROM players
                    WHERE puuid IS NOT NULL
                      AND puuid != ''
                    ORDER BY RANDOM()
                    LIMIT 50
                    """
                )

            candidates = cursor.fetchall()
            if not candidates:
                return None, None
            choice = self.random.choice(candidates)
            return choice["puuid"], self.get_latest_name(choice["names"])

    def get_specific_player_info(self, puuid):
        with self.connect_db() as conn:
            row = conn.execute("SELECT puuid, names FROM players WHERE puuid = ?", (puuid,)).fetchone()
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
            return None, None
        key = self.key_rotator.get_next_key()
        self.key_rotator.wait_if_needed(key)
        response = self.session.get(
            url,
            params=params,
            headers={"X-Riot-Token": key["value"]},
            timeout=20,
        )
        self.total_api_calls += 1
        self.emit_progress()
        return response, key

    def get_json(self, url, params=None, retry_429=True):
        response, key = self.make_api_request(url, params)
        if response is None:
            return None
        if response.status_code == 200:
            return response.json()
        if response.status_code == 404:
            return None
        if response.status_code == 429 and retry_429:
            self.key_rotator.mark_rate_limited(key, response.headers.get("Retry-After") or 30)
            return self.get_json(url, params, retry_429=False)
        detail = (response.text or "").strip()
        if len(detail) > 500:
            detail = detail[:500] + "..."
        request_url = getattr(response, "url", url)
        self.log(
            f"Riot API request failed: HTTP {response.status_code} for {request_url}; "
            f"params={params or {}}; body={detail or '<empty>'}",
            "error",
        )
        if response.status_code == 400 and "Exception decrypting" in detail:
            match = re.search(r"Exception decrypting ([A-Za-z0-9_-]+)", detail)
            if match:
                self.mark_invalid_puuid(match.group(1), "Riot API could not decrypt it as a PUUID")
        return None

    def fetch_match_ids(self, puuid, count):
        if not self.is_collectable_puuid(puuid):
            self.log(f"Skipping invalid or quarantined PUUID-like value {str(puuid)[:20]}...", "warning")
            return []
        url = f"https://{self.regional_routing}.api.riotgames.com/lol/match/v5/matches/by-puuid/{puuid}/ids"
        params = {"start": 0, "count": count}
        if self.queue_type:
            params["queue"] = self.queue_type

        self.log(f"Fetching up to {count} match ids for {puuid[:20]}...")
        payload = self.get_json(url, params)
        return payload if isinstance(payload, list) else []

    def fetch_match_data(self, match_id):
        url = f"https://{self.regional_routing}.api.riotgames.com/lol/match/v5/matches/{match_id}"
        self.current_match_id = match_id
        self.emit_progress()
        return self.get_json(url)

    def fetch_summoner_by_id(self, encrypted_summoner_id):
        if not encrypted_summoner_id:
            return None
        url = f"https://{self.platform_routing}.api.riotgames.com/lol/summoner/v4/summoners/{encrypted_summoner_id}"
        return self.get_json(url)

    def fetch_rank_entries(self, puuid):
        if not self.is_collectable_puuid(puuid):
            return []
        if puuid in self.rank_cache:
            return self.rank_cache[puuid]
        url = f"https://{self.platform_routing}.api.riotgames.com/lol/league/v4/entries/by-puuid/{puuid}"
        payload = self.get_json(url)
        entries = payload if isinstance(payload, list) else []
        self.rank_cache[puuid] = entries
        return entries

    def fetch_league_seed_entries(self):
        league_queue = LEAGUE_QUEUES.get(self.queue_type)
        if not league_queue:
            raise ValueError("Automatic seed discovery requires queueType 420 or 440.")

        tiers = ["CHALLENGER", "GRANDMASTER", "MASTER"]
        entries = []
        for tier in tiers:
            endpoint = tier.lower() + "leagues"
            url = f"https://{self.platform_routing}.api.riotgames.com/lol/league/v4/{endpoint}/by-queue/{league_queue}"
            payload = self.get_json(url)
            if not payload:
                continue
            for entry in payload.get("entries", []):
                normalized = {
                    **entry,
                    "tier": tier,
                    "queueType": league_queue,
                }
                if self.rank_entry_allowed(normalized):
                    entries.append(normalized)
        self.random.shuffle(entries)
        return entries

    def rank_entry_allowed(self, entry):
        tier = str(entry.get("tier", "")).upper()
        lp = int(entry.get("leaguePoints") or 0)
        if self.allowed_tiers and tier not in self.allowed_tiers:
            return False
        if self.min_tier and TIER_ORDER.get(tier, -1) < TIER_ORDER.get(self.min_tier, 999):
            return False
        if self.min_lp is not None and tier == self.min_tier and lp < int(self.min_lp):
            return False
        if self.max_lp is not None and tier == self.min_tier and lp > int(self.max_lp):
            return False
        return True

    def candidate_rank_allowed(self, participant):
        if not self.require_rank_validation:
            return True
        entries = self.fetch_rank_entries(participant.get("puuid"))
        queue_name = LEAGUE_QUEUES.get(self.queue_type)
        for entry in entries:
            if queue_name and entry.get("queueType") != queue_name:
                continue
            if self.rank_entry_allowed(entry):
                return True
        self.selection_summary["rankRejected"] += 1
        return False

    def discover_seed_players(self):
        if self.seed_players:
            return [(puuid, "Configured Seed") for puuid in self.seed_players]

        self.current_stage = "discovering-seeds"
        self.emit_progress()
        entries = self.fetch_league_seed_entries()
        seeds = []
        for entry in entries[: max(self.seed_count * 3, self.seed_count)]:
            if len(seeds) >= self.seed_count:
                break
            summoner = self.fetch_summoner_by_id(entry.get("summonerId"))
            if not summoner or not summoner.get("puuid"):
                continue
            name = entry.get("summonerName") or summoner.get("name") or f"{entry.get('tier')} seed"
            seeds.append((summoner["puuid"], name))
        if len(seeds) < self.seed_count and self.strict_constraints:
            raise ValueError(f"Only discovered {len(seeds)} seeds, but seedCount is {self.seed_count}.")
        return seeds

    def match_allowed(self, match_data):
        info = match_data.get("info", {})
        if self.queue_type and str(info.get("queueId")) != str(self.queue_type):
            self.selection_summary["constraintRejectedMatches"] += 1
            return False, "queueId mismatch"
        if self.max_match_age_days is not None:
            cutoff = datetime.utcnow() - timedelta(days=int(self.max_match_age_days))
            game_creation = info.get("gameCreation")
            if game_creation and datetime.utcfromtimestamp(game_creation / 1000) < cutoff:
                self.selection_summary["constraintRejectedMatches"] += 1
                return False, "match older than configured window"
        participants = info.get("participants")
        if not isinstance(participants, list) or len(participants) < 10:
            self.selection_summary["constraintRejectedMatches"] += 1
            return False, "incomplete participant list"
        if self.require_complete_participant_fields:
            for participant in participants:
                missing = [field for field in REQUIRED_PARTICIPANT_FIELDS if participant.get(field) in (None, "")]
                if missing:
                    self.selection_summary["constraintRejectedMatches"] += 1
                    return False, f"participant missing fields: {', '.join(missing)}"
        return True, "ok"

    def save_match_data(self, match_data):
        match_id = match_data.get("metadata", {}).get("matchId")
        if not match_id:
            return False, "Missing matchId"

        allowed, reason = self.match_allowed(match_data)
        if not allowed:
            return False, f"Rejected by constraints: {reason}"

        file_path = os.path.join(self.matches_dir, f"{match_id}.json")
        if os.path.exists(file_path):
            return False, "Match already exists"

        with open(file_path, "w", encoding="utf-8") as handle:
            json.dump(match_data, handle, ensure_ascii=False, indent=2)
        self.total_matches_saved += 1
        self.write_checkpoint()
        self.emit_progress()
        return True, "Match saved"

    def analyze_premade_signal(self, candidate_puuid, match_cache):
        teammate_counts = Counter()
        analyzed_matches = 0

        for match_data in match_cache.values():
            participants = match_data.get("info", {}).get("participants", [])
            candidate = next((p for p in participants if p.get("puuid") == candidate_puuid), None)
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
                f"and strongest repeat {summary['strongestRepeatCount']}."
            )
            self.emit_progress()
            return True, match_cache, summary

        self.selection_summary["candidatesSkippedNoPremade"] += 1
        self.log(f"Candidate {names} skipped after probe found no repeated teammates.", "warning")
        self.emit_progress()
        return False, match_cache, summary

    def extract_candidate_participants(self, match_data, source_puuid):
        participants = match_data.get("info", {}).get("participants", [])
        if self.collector_mode == "soloq-radial":
            excluded = {source_puuid, *self.processed_players, *self.queued_players}
            candidates = [
                p for p in participants
                if self.is_collectable_puuid(p.get("puuid")) and p.get("puuid") not in excluded
            ]
            candidates = [p for p in candidates if self.candidate_rank_allowed(p)]
            self.random.shuffle(candidates)
            min_pick = int(self.discovery.get("randomPlayersPerMatchMin", 1))
            max_pick = int(self.discovery.get("randomPlayersPerMatchMax", 2))
            pick_count = self.random.randint(min_pick, max(min_pick, max_pick))
            return candidates[:pick_count]

        source = next((p for p in participants if p.get("puuid") == source_puuid), None)
        if not source:
            return []
        relation = self.discovery.get("includeParticipants", "all")
        candidates = []
        for participant in participants:
            puuid = participant.get("puuid")
            if (
                not self.is_collectable_puuid(puuid)
                or puuid == source_puuid
                or puuid in self.processed_players
                or puuid in self.queued_players
            ):
                continue
            same_team = participant.get("teamId") == source.get("teamId")
            if relation == "teammates" and not same_team:
                continue
            if relation == "opponents" and same_team:
                continue
            if self.candidate_rank_allowed(participant):
                candidates.append(participant)
        return candidates

    def process_player(self, puuid, names, prefetched_matches=None, match_count=None):
        self.current_stage = "collecting-player"
        self.current_player_puuid = puuid
        self.current_player_name = names
        self.current_match_id = None
        self.emit_progress()

        self.log(f"Processing player {names} ({puuid}).")
        self.upsert_player_stub(puuid, names)
        match_ids = self.fetch_match_ids(puuid, match_count or self.matches_per_player)
        if not match_ids:
            self.log("No match ids found for the selected player.", "warning")
            return [], 0

        prefetched_matches = prefetched_matches or {}
        saved_for_player = 0
        processed_matches = []

        for match_id in match_ids:
            if self.check_stop_requested() or self.total_matches_saved >= self.max_matches:
                break

            match_data = prefetched_matches.get(match_id)
            if match_data is None:
                match_data = self.fetch_match_data(match_id)
            if not match_data:
                continue
            self.total_matches_seen += 1

            saved, message = self.save_match_data(match_data)
            if saved:
                saved_for_player += 1
                processed_matches.append(match_data)
                self.log(f"{match_id}: {message}")
            else:
                self.log(f"{match_id}: {message}")

        self.iterations_completed += 1
        self.current_match_id = None
        self.emit_progress()
        self.log(f"Player summary for {names}: {saved_for_player} new matches saved.")
        return processed_matches, saved_for_player

    def run_queue_expansion(self):
        frontier = self.load_checkpoint()
        if frontier is None:
            seeds = self.discover_seed_players()
            frontier = deque()
            for puuid, name in seeds:
                if puuid and puuid not in self.queued_players:
                    frontier.append((puuid, name, True))
                    self.queued_players.add(puuid)
            self.active_frontier = frontier
            self.write_checkpoint(frontier, force=True)
        else:
            self.active_frontier = frontier

        while frontier and len(self.processed_players) < self.max_players:
            if self.check_stop_requested() or self.total_matches_saved >= self.max_matches:
                break
            self.selection_summary["frontierSize"] = len(frontier)
            puuid, name, is_seed = frontier.popleft()
            self.active_frontier = frontier
            self.current_frontier_item_is_seed = is_seed
            if puuid in self.processed_players:
                continue
            if not self.is_collectable_puuid(puuid):
                self.log(f"Skipping quarantined frontier entry {str(puuid)[:20]}...", "warning")
                continue

            prefetched_matches = {}
            if self.collector_mode == "strengthen-graph":
                promoted, prefetched_matches, _summary = self.probe_candidate(puuid, name)
                if not promoted:
                    self.processed_players.add(puuid)
                    self.write_checkpoint(frontier, force=True)
                    continue
            if self.collector_mode == "soloq-radial" and self.reject_premade_repeats_at:
                promoted, prefetched_matches, summary = self.probe_candidate(puuid, name)
                if summary.get("strongestRepeatCount", 0) >= int(self.reject_premade_repeats_at):
                    self.log(
                        f"Candidate {name} rejected by SoloQ premade cap "
                        f"({summary['strongestRepeatCount']} repeats).",
                        "warning",
                    )
                    self.processed_players.add(puuid)
                    self.write_checkpoint(frontier, force=True)
                    continue

            match_count = self.initial_matches_per_seed if is_seed else self.matches_per_player
            matches, _saved = self.process_player(puuid, name, prefetched_matches, match_count)
            self.processed_players.add(puuid)

            for match_data in matches:
                for participant in self.extract_candidate_participants(match_data, puuid):
                    next_puuid = participant.get("puuid")
                    if (
                        not self.is_collectable_puuid(next_puuid)
                        or next_puuid in self.queued_players
                        or next_puuid in self.processed_players
                    ):
                        continue
                    next_name = participant.get("riotIdGameName") or participant.get("summonerName") or "Discovered Player"
                    frontier.append((next_puuid, next_name, False))
                    self.queued_players.add(next_puuid)
                    self.upsert_player_stub(next_puuid, next_name)
                    self.selection_summary["discoveredPlayers"] += 1
            self.current_frontier_item_is_seed = False
            self.active_frontier = frontier
            self.write_checkpoint(frontier, force=True)

    def run_legacy_selection(self):
        while len(self.processed_players) < self.max_players:
            if self.check_stop_requested() or self.total_matches_saved >= self.max_matches:
                break

            puuid, names = self.get_candidate_player()
            if not puuid:
                self.log("No eligible players remain in the active dataset.", "warning")
                break
            if puuid in self.processed_players:
                continue
            if not self.is_collectable_puuid(puuid):
                self.log(f"Skipping quarantined player {str(puuid)[:20]}...", "warning")
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

    def write_metadata(self):
        if not self.persist_metadata:
            return
        metadata_path = os.path.join(os.path.dirname(self.matches_dir), self.dataset_id or "dataset", "collection_metadata.json")
        os.makedirs(os.path.dirname(metadata_path), exist_ok=True)
        with open(metadata_path, "w", encoding="utf-8") as handle:
            json.dump(
                {
                    "datasetId": self.dataset_id,
                    "collectorMode": self.collector_mode,
                    "mode": self.mode,
                    "startedAt": self.run_started_at,
                    "updatedAt": utc_now(),
                    "summary": self.build_summary(),
                    "selectionSummary": self.selection_summary,
                    "constraints": self.constraints,
                    "config": {k: v for k, v in self.config.items() if k != "apiKey"},
                },
                handle,
                indent=2,
            )

    def run(self):
        self.current_stage = "starting"
        self.log(f"Starting match collector for dataset {self.dataset_id or 'unknown'}.")
        self.emit_status("running")
        self.emit_progress()

        if self.collector_mode == "strengthen-graph" and self.mode != "random":
            raise ValueError("strengthen-graph mode supports random candidate selection only.")
        if self.mode == "specific-puuid" and not self.specific_puuid:
            raise ValueError("specific-puuid mode requires specificPuuid.")

        if self.collector_mode in {"seed-expansion", "soloq-radial"}:
            self.run_queue_expansion()
        else:
            self.run_legacy_selection()

        self.current_stage = "stopped" if self.stop_requested else "completed"
        final_status = "stopped" if self.stop_requested else "completed"
        self.write_checkpoint(self.active_frontier, force=True, status=final_status)
        self.write_metadata()
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
        config["apiKey"] = expand_env_placeholders(config.get("apiKey")) or os.getenv("RIOT_API_KEY")
        collector = MatchCollector(config)
        collector.run()
    except KeyboardInterrupt:
        emit_event({
            "type": "status",
            "status": "stopped",
            "currentStage": "stopped",
            "summary": {"finishedAt": utc_now()},
            "error": None,
        })
        sys.exit(0)
    except Exception as error:
        emit_event({
            "type": "log",
            "level": "error",
            "message": str(error),
            "timestamp": utc_now(),
        })
        emit_event({
            "type": "status",
            "status": "failed",
            "currentStage": "failed",
            "summary": {"finishedAt": utc_now()},
            "error": str(error),
        })
        sys.exit(1)
