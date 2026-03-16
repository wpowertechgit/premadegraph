/// <reference types="vite/client" />
import React, { useState , useEffect} from "react";
import {
  Box,
  Button,
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
} from "@mui/material";
import { translateBackendText, useI18n } from "./i18n";

type PlayerInfo = {
  name: string;
  champion: string;
  summonerSpells: string;
  kda: string;
  gold: number;
  feedscore: number;
  opscore: number;
  country: string;
};

type MatchData = {
  matchId: string;
  blueTeam: PlayerInfo[];
  redTeam: PlayerInfo[];
  topFeederPuuid: string; // top feeder azonosítója (puuid) megjelöléshez
  topFeederCountry?: string;
};
const saveMatchToBackend = async (matchData: any) => {
  try {
    const response = await fetch("http://localhost:3001/api/save-match", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(matchData),
    });

    const result = await response.json();
    console.log(`Match ${matchData.metadata.matchId} save result:`, result.message);
  } catch (error) {
    console.error("Failed to save match to backend:", error);
  }
};

const feedermap: Record<string, number> = {};
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

 const apiKey = import.meta.env.VITE_API_KEY;
  
  useEffect(() => {
    if (!apiKey) {
      console.error('API key not found');
      return;
    }
    
    // Use your API key here
    console.log('API Key loaded:', apiKey);
  }, [apiKey]);
  const handleSubmit = async () => {
    if (!name || !tag || !count) return;

    setLoading(true);
    setOutput([]);
    setError(null);

    try {
      // Lekérjük a puuid-t a Riot ID alapján
      const puuidRes = await fetch(
        `https://europe.api.riotgames.com/riot/account/v1/accounts/by-riot-id/${encodeURIComponent(
          name
        )}/${encodeURIComponent(tag)}`,
        {
          headers: {
            "X-Riot-Token": apiKey,
          },
        }
      );

      if (!puuidRes.ok) {
        const errorData = await puuidRes.json();
          throw new Error(errorData.status?.message || t.matchAnalysis.errors.riotIdNotFound);
      }

      const puuidData = await puuidRes.json();
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
      const matchIdsRes = await fetch(
        `https://europe.api.riotgames.com/lol/match/v5/matches/by-puuid/${puuid}/ids?start=${start}&count=${count}${queueParam}`,
        {
          headers: {
            "X-Riot-Token": apiKey,
          },
        }
      );

      if (!matchIdsRes.ok) {
        const errorData = await matchIdsRes.json();
        throw new Error(errorData.status?.message || t.matchAnalysis.errors.matchIdsFailed);
      }

      const matchIds: string[] = await matchIdsRes.json();

      const matches: MatchData[] = [];
      const matchDetails: any[] = [];
      for (const matchId of matchIds) {
        const matchRes = await fetch(
          `https://europe.api.riotgames.com/lol/match/v5/matches/${matchId}`,
          {
            headers: {
              "X-Riot-Token": apiKey,
            },
          }
        );

        if (!matchRes.ok) {
          const errorData = await matchRes.json();
          throw new Error(errorData.status?.message || `${t.matchAnalysis.errors.matchFetchFailed}: ${matchId}`);
        }

        const matchData = await matchRes.json();
        matchDetails.push(matchData);
        await saveMatchToBackend(matchData);

        const participants = matchData.info.participants;
        const players = participants.map((p: any, i: number) => ({
          id: `player${i + 1}`,
          name: `${p.riotIdGameName || "?"}#${p.riotIdTagline || "?"}`,
        }));
        // const countries = await fetchCountriesByPlayers(players);
        const countries: Record<string, string> = {};
        const allPlayers: PlayerInfo[] = participants.map((p: any, i: number) => {
          const playerId = `player${i + 1}`;
          const name = `${p.riotIdGameName || "?"}#${p.riotIdTagline || "?"}`;
          const feedscore = p.deaths - (p.kills + p.assists) * 0.5;
          const opscore = p.kills + p.assists * 0.965 + p.goldEarned / 500;
          const country = countries[playerId] || t.matchAnalysis.unknownCountry;
          return {
            name,
            champion: p.championName,
            summonerSpells: `${p.summoner1Id}/${p.summoner2Id}`,
            kda: `${p.kills}/${p.deaths}/${p.assists}`,
            gold: p.goldEarned,
            kills: p.kills,
            deaths: p.deaths,
            assists: p.assists,
            feedscore,
            opscore,
            country,
          };
        });

        interface MinimalPlayer {
          name: string;
          kda: string;
          feedscore: number;
          opscore: number;
          country: string;
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
          country: player.country,
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
        const topFeederCountry = topFeeder.country;
        feedermap[topFeederCountry] = (feedermap[topFeederCountry] || 0) + 1;
        const blueTeam = allPlayers.filter((p, i) => participants[i].teamId === 100);
        const redTeam = allPlayers.filter((p, i) => participants[i].teamId === 200);

        matches.push({
          matchId,
          blueTeam,
          redTeam,
          topFeederPuuid: topFeeder.name,
          topFeederCountry, // megjelölésre használjuk a nevet
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
    <Container maxWidth="md" sx={{ mt: 4 }}>
      <Paper sx={{ p: 4, backgroundColor: "rgba(100,100,100)", color: "#fff" }} elevation={3}>
        <Typography variant="h5" align="center" gutterBottom>
          {t.matchAnalysis.title}
        </Typography>

        <Box display="flex" justifyContent="center" gap={2} flexWrap="wrap" mb={3}>
          <TextField
            label={t.matchAnalysis.riotId}
            variant="filled"
            value={name}
            onChange={(e) => setName(e.target.value)}
            sx={{ input: { color: "#fff" } }}
          />
          <TextField
            label={t.matchAnalysis.tag}
            variant="filled"
            value={tag}
            onChange={(e) => setTag(e.target.value)}
            sx={{ input: { color: "#fff" } }}
          />
          <TextField
            label={t.matchAnalysis.matchCount}
            variant="filled"
            type="number"
            inputProps={{ min: 1, max: 20 }}
            value={count}
            onChange={(e) => setCount(e.target.value)}
            sx={{ input: { color: "#fff" } }}
          />
          <Button variant="contained" onClick={handleSubmit} disabled={loading}>
            {loading ? <CircularProgress size={24} color="inherit" /> : t.matchAnalysis.submit}
          </Button>
          <TextField
            label={t.matchAnalysis.startIndex}
            variant="filled"
            type="number"
            inputProps={{ min: 0 }}
            value={start}
            onChange={(e) => setStart(Number(e.target.value))}
            sx={{ input: { color: "#fff" } }}
          />
          <Select value={queueType} sx={{ color: "white", fontWeight: "bold" }} onChange={(e) => setQueueType(e.target.value)} >
            <MenuItem value="all">{t.matchAnalysis.queueAll}</MenuItem>
            <MenuItem value="solo">{t.matchAnalysis.queueSolo}</MenuItem>
            <MenuItem value="flex">{t.matchAnalysis.queueFlex}</MenuItem>
            <MenuItem value="normal">{t.matchAnalysis.queueNormal}</MenuItem>
          </Select>

        </Box>

        {error && (
          <Typography color="error" align="center" mb={2}>
            {error}
          </Typography>
        )}

        {output.length > 0 &&
          output.map((match) => (
            <Box key={match.matchId} mb={4}>
              <Typography variant="h6" mb={1} color="white" textAlign="center">
                {t.matchAnalysis.matchId}: {match.matchId}
              </Typography>
              <TableContainer component={Paper} sx={{ backgroundColor: "#1e1e1e" }}>
                <Table sx={{ minWidth: 650 }} aria-label="match table">
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ color: "white", fontWeight: "bold" }}>{t.matchAnalysis.blueTeam}</TableCell>
                      <TableCell sx={{ color: "white", fontWeight: "bold" }}>{t.matchAnalysis.redTeam}</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {Array.from({ length: 5 }).map((_, i) => {
                      const bluePlayer = match.blueTeam[i];
                      const redPlayer = match.redTeam[i];
                      return (
                        <TableRow key={i}>
                          <TableCell sx={{ color: "white", fontFamily: "monospace" }}>
                            {bluePlayer?.name} {bluePlayer?.country}
                            {bluePlayer?.name === match.topFeederPuuid ? ` ⭐ ` : ""}
                            <br />
                            {bluePlayer?.champion} <br />
                            {bluePlayer?.summonerSpells} <br />
                            {t.matchAnalysis.kda}: {bluePlayer?.kda} <br />
                            {t.matchAnalysis.gold}: {bluePlayer?.gold} <br />
                            {t.matchAnalysis.feedScore}: {bluePlayer?.feedscore.toFixed(2)} <br />
                            {t.matchAnalysis.usefulScore}: {bluePlayer?.opscore.toFixed(2)}
                          </TableCell>
                          <TableCell sx={{ color: "white", fontFamily: "monospace" }}>
                            {redPlayer?.name} {redPlayer?.country}
                            {redPlayer?.name === match.topFeederPuuid ? ` ⭐ ` : ""}
                            <br />
                            {redPlayer?.champion} <br />
                            {redPlayer?.summonerSpells} <br />
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
      <Box>
        <div>
          <h4>{t.matchAnalysis.countrySummary}</h4>
          <ul>
            {Object.entries(feedermap).map(([country, count]) => (
              <li key={country}>{country}: {count}</li>
            ))}
          </ul>
        </div>
      </Box>
    </Container>

  );
};

export default MatchAnalysisForm;
