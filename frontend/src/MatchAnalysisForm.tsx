/// <reference types="vite/client" />
import React, { useEffect, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Chip,
  Container,
  TextField,
  Typography,
  CircularProgress,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Select,
  MenuItem,
  Stack,
  Divider,
  InputAdornment,
} from "@mui/material";
import { translateBackendText, useI18n } from "./i18n";
import BarrierIcon from "../assets/Barrier_HD.png";
import ClarityIcon from "../assets/Clarity_HD.png";
import CleanseIcon from "../assets/Cleanse_HD.png";
import ExhaustIcon from "../assets/Exhaust_HD.png";
import FlashIcon from "../assets/Flash_HD.png";
import GhostIcon from "../assets/Ghost_HD.png";
import HealIcon from "../assets/Heal_HD.png";
import IgniteIcon from "../assets/Ignite_HD.png";
import SmiteIcon from "../assets/Smite_HD.png";
import TeleportIcon from "../assets/Teleport_HD.png";

const SUMMONER_SPELL_ICONS: Record<number, { name: string; icon: string }> = {
  1: { name: "Cleanse", icon: CleanseIcon },
  3: { name: "Exhaust", icon: ExhaustIcon },
  4: { name: "Flash", icon: FlashIcon },
  6: { name: "Ghost", icon: GhostIcon },
  7: { name: "Heal", icon: HealIcon },
  11: { name: "Smite", icon: SmiteIcon },
  12: { name: "Teleport", icon: TeleportIcon },
  13: { name: "Clarity", icon: ClarityIcon },
  14: { name: "Ignite", icon: IgniteIcon },
  21: { name: "Barrier", icon: BarrierIcon },
};

type PlayerInfo = {
  name: string;
  champion: string;
  role: string;
  summonerSpellIds: [number, number];
  kda: string;
  gold: number;
  feedscore: number;
  opscore: number;
};

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

const normalizeRole = (role?: string) => {
  const normalized = String(role ?? "").trim().toUpperCase();
  switch (normalized) {
    case "TOP":
      return "TOP";
    case "JUNGLE":
      return "JUNGLE";
    case "MID":
    case "MIDDLE":
      return "MIDDLE";
    case "BOT":
    case "ADC":
    case "BOTTOM":
      return "BOTTOM";
    case "SUPPORT":
    case "UTILITY":
      return "UTILITY";
    default:
      return "UNKNOWN";
  }
};

const ROLE_MULTIPLIERS: Record<string, Record<string, number>> = {
  TOP: { kda: 1.1, economy: 1.05, map_awareness: 0.9, utility: 0.6, damage: 1.15, tanking: 1.0, objectives: 1.2, early_game: 1.05 },
  JUNGLE: { kda: 1.2, economy: 0.7, map_awareness: 1.4, utility: 0.8, damage: 1.0, tanking: 0.8, objectives: 1.4, early_game: 1.3 },
  MIDDLE: { kda: 1.0, economy: 1.1, map_awareness: 1.2, utility: 1.0, damage: 1.05, tanking: 0.8, objectives: 1.0, early_game: 1.1 },
  BOTTOM: { kda: 1.2, economy: 1.3, map_awareness: 1.1, utility: 0.7, damage: 1.4, tanking: 0.6, objectives: 0.9, early_game: 1.0 },
  UTILITY: { kda: 0.7, economy: 0.4, map_awareness: 1.8, utility: 1.8, damage: 0.5, tanking: 1.1, objectives: 0.7, early_game: 0.8 },
  UNKNOWN: { kda: 1.0, economy: 1.0, map_awareness: 1.0, utility: 1.0, damage: 1.0, tanking: 1.0, objectives: 1.0, early_game: 1.0 },
};

const DEATH_TOLERANCE: Record<string, number> = {
  TOP: 1.0,
  JUNGLE: 1.05,
  MIDDLE: 1.0,
  BOTTOM: 1.15,
  UTILITY: 0.8,
  UNKNOWN: 1.0,
};

const computeMatchScores = (participant: any, gameDurationRaw: number) => {
  const challenges = participant?.challenges ?? {};
  const gameDurationMinutes =
    gameDurationRaw > 100000 ? Math.max(1, gameDurationRaw / 60000) : Math.max(1, gameDurationRaw / 60);
  const role = normalizeRole(participant?.teamPosition);
  const efficiency = clamp((participant?.goldSpent ?? 0) / Math.max(1, participant?.goldEarned ?? 0), 0.5, 1.0);

  const artifacts = {
    kda: (participant?.kills ?? 0) + (participant?.assists ?? 0) * 0.965 - (participant?.deaths ?? 0) * 0.25,
    economy: ((participant?.goldEarned ?? 0) / gameDurationMinutes) / 10 + efficiency * 0.5,
    map_awareness:
      (participant?.visionScore ?? 0) * 0.15 +
      (participant?.wardsPlaced ?? 0) * 0.05 +
      (participant?.detectorWardsPlaced ?? 0) * 0.04 +
      (participant?.wardsKilled ?? 0) * 0.08 +
      ((participant?.controlWardsPlaced ?? 0) || (challenges?.controlWardsPlaced ?? 0)) * 0.06,
    utility:
      (challenges?.enemyChampionImmobilizations ?? 0) * 0.08 +
      (participant?.totalDamageShieldedOnTeammates ?? 0) * 0.001 +
      (participant?.totalHeal ?? 0) * 0.001 +
      ((challenges?.damageSelfMitigated ?? 0) || (participant?.damageSelfMitigated ?? 0)) * 0.002 +
      ((challenges?.timeCCingOthers ?? 0) || (participant?.timeCCingOthers ?? 0)) * 0.01,
    damage:
      ((participant?.physicalDamageDealtToChampions ?? 0) +
        (participant?.magicDamageDealtToChampions ?? 0) +
        (participant?.trueDamageDealtToChampions ?? 0)) /
      1000 *
      0.2,
    tanking: ((participant?.totalDamageTaken ?? 0) / gameDurationMinutes) * 0.05,
    objectives:
      (participant?.damageDealtToBuildings ?? 0) * 0.002 +
      (participant?.turretTakedowns ?? 0) * 0.25 +
      (participant?.inhibitorTakedowns ?? 0) * 0.5 +
      (challenges?.turretPlatesTaken ?? 0) * 0.03 +
      (participant?.damageDealtToTurrets ?? 0) * 0.001,
    early_game:
      (participant?.firstBloodKill ? 1 : 0) * 0.5 +
      (participant?.firstBloodAssist ? 1 : 0) * 0.2 +
      (participant?.firstTowerKill ? 1 : 0) * 0.3 +
      (participant?.firstTowerAssist ? 1 : 0) * 0.1 +
      (challenges?.laneMinionsFirst10Minutes ?? 0) / 50,
  };

  const multipliers = ROLE_MULTIPLIERS[role] ?? ROLE_MULTIPLIERS.UNKNOWN;
  const adjustedArtifacts = Object.entries(artifacts).reduce<Record<string, number>>((accumulator, [key, value]) => {
    accumulator[key] = value * multipliers[key];
    return accumulator;
  }, {});

  return {
    role,
    feedscore:
      (participant?.deaths ?? 0) * (DEATH_TOLERANCE[role] ?? DEATH_TOLERANCE.UNKNOWN) -
      ((participant?.kills ?? 0) + (participant?.assists ?? 0)) * 0.35,
    opscore: Object.values(adjustedArtifacts).reduce((sum, value) => sum + value, 0),
  };
};

const renderSummonerSpellIcons = (spellIds: [number, number]) => (
  <Stack direction="row" spacing={1} sx={{ mt: 0.75, mb: 0.75 }}>
    {spellIds.map((spellId, index) => {
      const spell = SUMMONER_SPELL_ICONS[spellId];

      return (
        <Box
          key={`${spellId}-${index}`}
          sx={{
            width: 32,
            height: 32,
            borderRadius: 1.25,
            overflow: "hidden",
            border: "1px solid rgba(148, 163, 184, 0.35)",
            background: spell ? "rgba(15, 23, 42, 0.92)" : "rgba(30, 41, 59, 0.92)",
            display: "grid",
            placeItems: "center",
            boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.04)",
          }}
          title={spell ? spell.name : `Unknown spell ${spellId}`}
        >
          {spell ? (
            <Box
              component="img"
              src={spell.icon}
              alt={spell.name}
              sx={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
            />
          ) : (
            <Typography sx={{ fontSize: "0.72rem", fontWeight: 700, color: "text.secondary" }}>
              {spellId}
            </Typography>
          )}
        </Box>
      );
    })}
  </Stack>
);

type MatchData = {
  matchId: string;
  blueTeam: PlayerInfo[];
  redTeam: PlayerInfo[];
  topFeederPuuid: string; // top feeder azonosítója (puuid) megjelöléshez
};

type RuntimeKeyStatus = {
  keyName: "RIOT_API_KEY" | "OPENROUTER_API_KEY";
  isSet: boolean;
  maskedPreview: string | null;
  storage: string;
};

async function fetchBackendJson<T>(url: string): Promise<T> {
  const response = await fetch(url);
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload.status?.message || payload.error || payload.message || "Backend request failed.");
  }
  return payload as T;
}

const MatchAnalysisForm = () => {
  const { language, t } = useI18n();
  const [name, setName] = useState("");
  const [tag, setTag] = useState("");
  const [count, setCount] = useState("2");
  const [loading, setLoading] = useState(false);
  const [output, setOutput] = useState<MatchData[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [queueType, setQueueType] = useState("all");
  const [start, setStart] = useState(0);
  const [riotApiReady, setRiotApiReady] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;

    const loadRuntimeKeyStatus = async () => {
      try {
        const payload = await fetchBackendJson<{ keys: RuntimeKeyStatus[] }>("http://localhost:3001/api/runtime-keys");
        const riotKey = payload.keys.find((entry) => entry.keyName === "RIOT_API_KEY");
        if (!cancelled) {
          setRiotApiReady(riotKey?.isSet ?? false);
        }
      } catch (runtimeKeyError) {
        console.error("Failed to load runtime key status:", runtimeKeyError);
        if (!cancelled) {
          setRiotApiReady(null);
        }
      }
    };

    void loadRuntimeKeyStatus();

    return () => {
      cancelled = true;
    };
  }, []);

  const handleSubmit = async () => {
    if (!name || !tag || !count) return;

    setLoading(true);
    setOutput([]);
    setError(null);

    try {
      // Lekérjük a puuid-t a Riot ID alapján
      const puuidData = await fetchBackendJson<{ puuid: string }>(
        `http://localhost:3001/api/riot/account/by-riot-id/${encodeURIComponent(name)}/${encodeURIComponent(tag)}`,
      );
      const puuid = puuidData.puuid;
      let queueParam = "";
      if (queueType === "solo") {
        queueParam = "&queue=420";
      } else if (queueType === "flex") {
        queueParam = "&queue=440";
      } else if (queueType === "normal") {
        queueParam = "&queue=430";
      } else if (queueType === "all") {
        queueParam = "";
      }
      const matchIds: string[] = await fetchBackendJson(
        `http://localhost:3001/api/riot/matches/by-puuid/${encodeURIComponent(puuid)}/ids?start=${start}&count=${count}${queueParam}`,
      );

      const matches: MatchData[] = [];
      const matchDetails: any[] = [];
      for (const matchId of matchIds) {
        const matchData = await fetchBackendJson<any>(
          `http://localhost:3001/api/riot/matches/${encodeURIComponent(matchId)}`,
        );
        matchDetails.push(matchData);

        const participants = matchData.info.participants;
        const gameDuration = matchData.info.gameDuration;
        const allPlayers: PlayerInfo[] = participants.map((p: any) => {
          const name = `${p.riotIdGameName || "?"}#${p.riotIdTagline || "?"}`;
          const scores = computeMatchScores(p, gameDuration);
          return {
            name,
            champion: p.championName,
            role: scores.role,
            summonerSpellIds: [p.summoner1Id, p.summoner2Id],
            kda: `${p.kills}/${p.deaths}/${p.assists}`,
            gold: p.goldEarned,
            feedscore: scores.feedscore,
            opscore: scores.opscore,
          };
        });

        interface MinimalPlayer {
          name: string;
          kda: string;
          feedscore: number;
          opscore: number;
        }

        interface SavePlayerResponse {
          message?: string;
          [key: string]: any;
        }

        const saveAllPlayers = async (allPlayers: PlayerInfo[]): Promise<SavePlayerResponse[]> => {
          try {
            const savePromises = allPlayers.map((player: PlayerInfo) => {
              const minimalPlayer: MinimalPlayer = {
                name: player.name,
                kda: player.kda,
                feedscore: player.feedscore,
                opscore: player.opscore,
              };

              return fetch("http://localhost:3001/api/save-player", {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                },
                body: JSON.stringify(minimalPlayer),
              })
                .then((response: Response) => {
                  if (!response.ok) {
                    throw new Error(`Failed to save player ${player.name}: ${response.statusText}`);
                  }
                  return response.json() as Promise<SavePlayerResponse>;
                });
            });

            const results = await Promise.all(savePromises);
            console.log(`Successfully saved ${results.length} players`);
            return results;
          } catch (error) {
            console.error("Error saving players:", error);
            throw error;
          }
        };
        try {
          await saveAllPlayers(allPlayers);
          console.log("All players have been processed");
        } catch (error) {
          console.error("Failed to save players:", error);
        }

        const topFeeder = allPlayers.reduce((maxP, curr) =>
          curr.feedscore > maxP.feedscore ? curr : maxP
        );
        const blueTeam = allPlayers.filter((p, i) => participants[i].teamId === 100);
        const redTeam = allPlayers.filter((p, i) => participants[i].teamId === 200);

        matches.push({
          matchId,
          blueTeam,
          redTeam,
          topFeederPuuid: topFeeder.name,
        });
      }

      setOutput(matches);
    } catch (err: any) {
      setError(translateBackendText(language, err.message || t.matchAnalysis.errors.generic));
      setOutput([]);
    } finally {
      setLoading(false);
    }
  };
  return (
    <Container maxWidth={false} sx={{ py: 4 }}>
      <Box sx={{ maxWidth: "1360px", mx: "auto", display: "grid", gap: 3 }}>
        <Paper sx={{ p: { xs: 2.5, md: 3.5 }, display: "grid", gap: 2.5 }}>
          <Box sx={{ display: "grid", gap: 1 }}>
            <Typography sx={{ color: "text.secondary", fontSize: "0.78rem", textTransform: "uppercase", letterSpacing: "0.14em", fontWeight: 700 }}>
              Match Intelligence
            </Typography>
            <Typography variant="h3" sx={{ fontSize: "clamp(2rem, 4vw, 3.2rem)" }}>
              {t.matchAnalysis.title}
            </Typography>
            <Typography color="text.secondary" sx={{ maxWidth: "72ch" }}>
              Pull recent matches by Riot ID, persist the payload to the backend, and inspect team-by-team feedscore and opscore output inside one unified analyzer view.
            </Typography>
          </Box>

          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: { xs: "1fr", md: "repeat(2, minmax(0, 1fr))", xl: "repeat(3, minmax(0, 1fr))" },
              gap: 2,
            }}
          >
            <TextField
              label={t.matchAnalysis.riotId}
              variant="filled"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <TextField
              label={t.matchAnalysis.tag}
              variant="filled"
              value={tag}
              onChange={(e) => setTag(e.target.value)}
            />
            <TextField
              label={t.matchAnalysis.matchCount}
              variant="filled"
              type="number"
              inputProps={{ min: 1, max: 20 }}
              value={count}
              onChange={(e) => setCount(e.target.value)}
            />
            <TextField
              label={t.matchAnalysis.startIndex}
              variant="filled"
              type="number"
              inputProps={{ min: 0 }}
              value={start}
              onChange={(e) => setStart(Number(e.target.value))}
              InputProps={{
                endAdornment: <InputAdornment position="end">idx</InputAdornment>,
              }}
            />
            <Select value={queueType} variant="filled" onChange={(e) => setQueueType(e.target.value)}>
              <MenuItem value="all">{t.matchAnalysis.queueAll}</MenuItem>
              <MenuItem value="solo">{t.matchAnalysis.queueSolo}</MenuItem>
              <MenuItem value="flex">{t.matchAnalysis.queueFlex}</MenuItem>
              <MenuItem value="normal">{t.matchAnalysis.queueNormal}</MenuItem>
            </Select>
            <Button variant="contained" onClick={handleSubmit} disabled={loading} sx={{ minHeight: 56 }}>
              {loading ? <CircularProgress size={24} color="inherit" /> : t.matchAnalysis.submit}
            </Button>
          </Box>

          <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
            <Chip label={`${t.matchAnalysis.queueAll} / solo / flex / normal`} variant="outlined" />
            <Chip
              label={`API ${riotApiReady === null ? "unknown" : riotApiReady ? "ready" : "missing"}`}
              color={riotApiReady === null ? "default" : riotApiReady ? "success" : "error"}
              variant="outlined"
            />
            <Chip label={`${output.length} matches loaded`} variant="outlined" />
          </Stack>

          {error ? <Alert severity="error">{error}</Alert> : null}
        </Paper>

        {output.length > 0 ? (
          <Paper sx={{ p: { xs: 2, md: 3 }, display: "grid", gap: 2.5 }}>
            <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 2, flexWrap: "wrap" }}>
              <Box>
                <Typography sx={{ color: "text.secondary", fontSize: "0.78rem", textTransform: "uppercase", letterSpacing: "0.14em", fontWeight: 700 }}>
                  Match Breakdown
                </Typography>
                <Typography variant="h5">Recent Match Results</Typography>
              </Box>
              <Chip label={`${output.length} matches`} color="primary" variant="outlined" />
            </Box>

            {output.map((match, matchIndex) => (
              <Box key={match.matchId} sx={{ display: "grid", gap: 1.5 }}>
                {matchIndex > 0 ? <Divider /> : null}
                <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 2, flexWrap: "wrap" }}>
                  <Typography variant="h6">
                    {t.matchAnalysis.matchId}: {match.matchId}
                  </Typography>
                  <Chip label={`Top feeder: ${match.topFeederPuuid}`} variant="outlined" />
                </Box>
                <TableContainer component={Paper} sx={{ background: "rgba(8, 15, 23, 0.82)" }}>
                  <Table sx={{ minWidth: 760 }} aria-label="match table">
                    <TableHead>
                      <TableRow>
                        <TableCell>{t.matchAnalysis.blueTeam}</TableCell>
                        <TableCell>{t.matchAnalysis.redTeam}</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {Array.from({ length: 5 }).map((_, i) => {
                        const bluePlayer = match.blueTeam[i];
                        const redPlayer = match.redTeam[i];
                        return (
                          <TableRow key={i}>
                            <TableCell sx={{ color: "text.primary", fontFamily: "var(--font-mono)", verticalAlign: "top" }}>
                              <strong>{bluePlayer?.name}</strong>
                              {bluePlayer?.name === match.topFeederPuuid ? ` ⭐ ` : ""}
                              <br />
                              {bluePlayer?.champion} <br />
                              {bluePlayer?.role} <br />
                              {bluePlayer ? renderSummonerSpellIcons(bluePlayer.summonerSpellIds) : null}
                              {t.matchAnalysis.kda}: {bluePlayer?.kda} <br />
                              {t.matchAnalysis.gold}: {bluePlayer?.gold} <br />
                              {t.matchAnalysis.feedScore}: {bluePlayer?.feedscore.toFixed(2)} <br />
                              {t.matchAnalysis.usefulScore}: {bluePlayer?.opscore.toFixed(2)}
                            </TableCell>
                            <TableCell sx={{ color: "text.primary", fontFamily: "var(--font-mono)", verticalAlign: "top" }}>
                              <strong>{redPlayer?.name}</strong>
                              {redPlayer?.name === match.topFeederPuuid ? ` ⭐ ` : ""}
                              <br />
                              {redPlayer?.champion} <br />
                              {redPlayer?.role} <br />
                              {redPlayer ? renderSummonerSpellIcons(redPlayer.summonerSpellIds) : null}
                              {t.matchAnalysis.kda}: {redPlayer?.kda} <br />
                              {t.matchAnalysis.gold}: {redPlayer?.gold} <br />
                              {t.matchAnalysis.feedScore}: {redPlayer?.feedscore.toFixed(2)} <br />
                              {t.matchAnalysis.usefulScore}: {redPlayer?.opscore.toFixed(2)}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </TableContainer>
              </Box>
            ))}
          </Paper>
        ) : null}

      </Box>
    </Container>

  );
};

export default MatchAnalysisForm;
