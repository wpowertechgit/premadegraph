import React, { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Chip,
  Container,
  Divider,
  MenuItem,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { useI18n } from "./i18n";

type CollectorConfigResponse = {
  defaults: CollectorStartPayload;
  activeDataset: ActiveDatasetSummary;
};

type ActiveDatasetSummary = {
  id: string;
  name: string;
  description: string;
  matchCount: number;
  refinedPlayerCount: number;
  rawPlayerCount: number;
  canUseStrengthenMode: boolean;
};

type CollectorStartPayload = {
  collectorMode: "standard" | "strengthen-graph";
  mode: "random" | "specific-puuid";
  specificPuuid: string;
  matchesPerPlayer: number;
  maxIterations: number;
  queueType: string;
  requestsPerSecond: number;
  requestsPer2Min: number;
  probeMatchCount: number;
  minimumPremadeRepeats: number;
};

type CollectorStatusResponse = {
  status: "idle" | "running" | "stopping" | "completed" | "stopped" | "failed";
  jobId: string | null;
  datasetId: string | null;
  config: CollectorStartPayload | null;
  currentStage: string;
  progress: {
    playersProcessed: number;
    maxIterations: number;
    matchesSaved: number;
    apiCallsMade: number;
    currentPlayerName: string | null;
    currentPlayerPuuid: string | null;
    currentMatchId: string | null;
    startedAt: string | null;
    stopRequested: boolean;
  };
  summary: Record<string, unknown> | null;
  logs: Array<{ timestamp: string; level: string; message: string }>;
  selectionSummary: {
    candidatesTried: number;
    candidatesSkippedNoPremade: number;
    candidatesPromoted: number;
    currentCandidatePuuid: string | null;
    currentCandidateProbeSummary?: {
      analyzedMatches?: number;
      repeatedTeammates?: number;
      strongestRepeatCount?: number;
    } | null;
  };
  error: string | null;
  activeDataset?: ActiveDatasetSummary;
};

const EMPTY_STATUS: CollectorStatusResponse = {
  status: "idle",
  jobId: null,
  datasetId: null,
  config: null,
  currentStage: "idle",
  progress: {
    playersProcessed: 0,
    maxIterations: 0,
    matchesSaved: 0,
    apiCallsMade: 0,
    currentPlayerName: null,
    currentPlayerPuuid: null,
    currentMatchId: null,
    startedAt: null,
    stopRequested: false,
  },
  summary: null,
  logs: [],
  selectionSummary: {
    candidatesTried: 0,
    candidatesSkippedNoPremade: 0,
    candidatesPromoted: 0,
    currentCandidatePuuid: null,
    currentCandidateProbeSummary: null,
  },
  error: null,
};

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload.error || payload.message || "Request failed.");
  }
  return payload as T;
}

export default function MatchCollectorPage() {
  const { language, t } = useI18n();
  const copy = useMemo(() => (
    language === "hu"
      ? {
          label: "Match Collector",
          title: "Adathalmaz-epites premade-fokuszu erositesi moddal",
          description: "Ez az oldal a Python collector frontendes vezerlesehez keszult. A strengthen-graph mod olcso 5 meccses probaval kiszuri a lone wolf jelolteket, es a rate limitet azokra a jatekosokra kolti, akiknel mar latszik valamilyen ismetlodo premade struktura.",
          activeDataset: "Aktiv adathalmaz",
          strengthenHint: "A strengthen-graph mod csak akkor engedelyezett, ha az aktiv adathalmaz mar tartalmaz jatekosokat.",
          collectorMode: "Collector mod",
          crawlMode: "Kivalasztasi mod",
          standard: "Standard",
          strengthen: "Strengthen Graph",
          random: "Veletlen jeloltek",
          specific: "Egy konkret PUUID",
          specificPuuid: "Celjatekos PUUID",
          matchesPerPlayer: "Meccsek / jatekos",
          maxIterations: "Iteraciok",
          queueType: "Queue szuro",
          requestsPerSecond: "Keresek / mp",
          requestsPer2Min: "Keresek / 2 perc",
          probeMatchCount: "Probe meccsek szama",
          minimumPremadeRepeats: "Minimum ismetelt csapattars",
          queueAll: "Osszes queue",
          queueSolo: "SoloQ",
          queueFlex: "Flex",
          queueNormal: "Normal",
          start: "Collector inditasa",
          stop: "Leallitas",
          running: "Folyamatban",
          config: "Konfiguracio",
          status: "Futas allapota",
          logs: "Legutobbi logok",
          progress: "Progress",
          currentPlayer: "Aktiv jatekos",
          currentMatch: "Aktiv meccs",
          playersProcessed: "Feldolgozott jatekosok",
          matchesSaved: "Mentett meccsek",
          apiCalls: "API hivasok",
          candidatesTried: "Probalt jeloltek",
          candidatesSkipped: "Kiesett lone wolfok",
          candidatesPromoted: "Tovabbengedett jeloltek",
          probeSummary: "Probe eredmeny",
          repeatedTeammates: "Ismetelt csapattarsak",
          strongestRepeat: "Legerosebb ismetles",
          datasetPlayers: "raw DB jatekosok",
          datasetMatches: "mentett meccsek",
          datasetRefined: "refined jatekosok",
        }
      : {
          label: "Match Collector",
          title: "Dataset population with a graph-strengthening collector mode",
          description: "This page is the frontend control surface for the Python match collector. Strengthen-graph mode runs a cheap 5-match probe, skips lone-wolf candidates, and spends the API budget on players that already show repeated teammate structure.",
          activeDataset: "Active dataset",
          strengthenHint: "Strengthen-graph mode is only available when the active dataset already contains players.",
          collectorMode: "Collector mode",
          crawlMode: "Candidate mode",
          standard: "Standard",
          strengthen: "Strengthen Graph",
          random: "Random candidates",
          specific: "Specific PUUID",
          specificPuuid: "Target PUUID",
          matchesPerPlayer: "Matches per player",
          maxIterations: "Iterations",
          queueType: "Queue filter",
          requestsPerSecond: "Requests / sec",
          requestsPer2Min: "Requests / 2 min",
          probeMatchCount: "Probe match count",
          minimumPremadeRepeats: "Minimum repeated teammate count",
          queueAll: "All queues",
          queueSolo: "SoloQ",
          queueFlex: "Flex",
          queueNormal: "Normal",
          start: "Start collector",
          stop: "Stop collector",
          running: "Running",
          config: "Configuration",
          status: "Run status",
          logs: "Recent logs",
          progress: "Progress",
          currentPlayer: "Current player",
          currentMatch: "Current match",
          playersProcessed: "Players processed",
          matchesSaved: "Matches saved",
          apiCalls: "API calls",
          candidatesTried: "Candidates tried",
          candidatesSkipped: "Candidates skipped",
          candidatesPromoted: "Candidates promoted",
          probeSummary: "Probe summary",
          repeatedTeammates: "Repeated teammates",
          strongestRepeat: "Strongest repeat",
          datasetPlayers: "raw DB players",
          datasetMatches: "saved matches",
          datasetRefined: "refined players",
        }
  ), [language]);

  const [configResponse, setConfigResponse] = useState<CollectorConfigResponse | null>(null);
  const [statusResponse, setStatusResponse] = useState<CollectorStatusResponse>(EMPTY_STATUS);
  const [form, setForm] = useState<CollectorStartPayload>({
    collectorMode: "standard",
    mode: "random",
    specificPuuid: "",
    matchesPerPlayer: 10,
    maxIterations: 1,
    queueType: "",
    requestsPerSecond: 15,
    requestsPer2Min: 90,
    probeMatchCount: 5,
    minimumPremadeRepeats: 2,
  });
  const [loading, setLoading] = useState(true);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadConfig = async () => {
    const [config, status] = await Promise.all([
      fetchJson<CollectorConfigResponse>("http://localhost:3001/api/match-collector/config"),
      fetchJson<CollectorStatusResponse>("http://localhost:3001/api/match-collector/status"),
    ]);
    setConfigResponse(config);
    setStatusResponse(status);
    setForm((current) => ({
      ...config.defaults,
      ...current,
    }));
  };

  useEffect(() => {
    setLoading(true);
    void loadConfig()
      .catch((loadError) => {
        setError(loadError instanceof Error ? loadError.message : "Failed to load match collector.");
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const interval = window.setInterval(() => {
      void fetchJson<CollectorStatusResponse>("http://localhost:3001/api/match-collector/status")
        .then((status) => setStatusResponse(status))
        .catch(() => undefined);
    }, statusResponse.status === "running" || statusResponse.status === "stopping" ? 1500 : 4000);

    return () => window.clearInterval(interval);
  }, [statusResponse.status]);

  const activeDataset = configResponse?.activeDataset ?? statusResponse.activeDataset;
  const strengthenAllowed = activeDataset?.canUseStrengthenMode ?? false;
  const activeRun = statusResponse.status === "running" || statusResponse.status === "stopping";

  const handleStart = async () => {
    setSubmitLoading(true);
    setError(null);
    try {
      const payload: CollectorStartPayload = {
        ...form,
        mode: form.collectorMode === "strengthen-graph" ? "random" : form.mode,
      };
      const response = await fetchJson<CollectorStatusResponse>("http://localhost:3001/api/match-collector/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      setStatusResponse(response);
    } catch (startError) {
      setError(startError instanceof Error ? startError.message : "Failed to start collector.");
    } finally {
      setSubmitLoading(false);
    }
  };

  const handleStop = async () => {
    setSubmitLoading(true);
    setError(null);
    try {
      const response = await fetchJson<CollectorStatusResponse>("http://localhost:3001/api/match-collector/stop", {
        method: "POST",
      });
      setStatusResponse(response);
    } catch (stopError) {
      setError(stopError instanceof Error ? stopError.message : "Failed to stop collector.");
    } finally {
      setSubmitLoading(false);
    }
  };

  if (loading) {
    return <div className="app-route-fallback">{t.common.loading}</div>;
  }

  return (
    <Container maxWidth={false} sx={{ py: 4 }}>
      <Box sx={{ maxWidth: "1360px", mx: "auto", display: "grid", gap: 3 }}>
        <Paper sx={{ p: { xs: 2.5, md: 3.5 }, display: "grid", gap: 2.5 }}>
          <Box sx={{ display: "grid", gap: 1 }}>
            <Typography sx={{ color: "text.secondary", fontSize: "0.78rem", textTransform: "uppercase", letterSpacing: "0.14em", fontWeight: 700 }}>
              {copy.label}
            </Typography>
            <Typography variant="h3" sx={{ fontSize: "clamp(2rem, 4vw, 3.2rem)" }}>
              {copy.title}
            </Typography>
            <Typography color="text.secondary" sx={{ maxWidth: "80ch" }}>
              {copy.description}
            </Typography>
          </Box>

          {error ? <Alert severity="error">{error}</Alert> : null}
          {!strengthenAllowed ? <Alert severity="info">{copy.strengthenHint}</Alert> : null}

          <Paper variant="outlined" sx={{ p: 2, backgroundColor: "rgba(15, 23, 42, 0.04)" }}>
            <Typography variant="h6" sx={{ mb: 1 }}>{copy.activeDataset}</Typography>
            <Stack direction={{ xs: "column", md: "row" }} spacing={1.5} useFlexGap flexWrap="wrap">
              <Chip label={`${activeDataset?.name || "Unknown"} (${activeDataset?.id || "n/a"})`} />
              <Chip label={`${activeDataset?.rawPlayerCount ?? 0} ${copy.datasetPlayers}`} />
              <Chip label={`${activeDataset?.refinedPlayerCount ?? 0} ${copy.datasetRefined}`} />
              <Chip label={`${activeDataset?.matchCount ?? 0} ${copy.datasetMatches}`} />
            </Stack>
          </Paper>

          <Divider />

          <Typography variant="h5">{copy.config}</Typography>
          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "repeat(2, minmax(0, 1fr))", xl: "repeat(3, minmax(0, 1fr))" }, gap: 2 }}>
            <TextField
              select
              label={copy.collectorMode}
              value={form.collectorMode}
              onChange={(event) => setForm((current) => ({
                ...current,
                collectorMode: event.target.value as CollectorStartPayload["collectorMode"],
                mode: event.target.value === "strengthen-graph" ? "random" : current.mode,
              }))}
              disabled={activeRun}
            >
              <MenuItem value="standard">{copy.standard}</MenuItem>
              <MenuItem value="strengthen-graph" disabled={!strengthenAllowed}>{copy.strengthen}</MenuItem>
            </TextField>

            <TextField
              select
              label={copy.crawlMode}
              value={form.collectorMode === "strengthen-graph" ? "random" : form.mode}
              onChange={(event) => setForm((current) => ({ ...current, mode: event.target.value as CollectorStartPayload["mode"] }))}
              disabled={activeRun || form.collectorMode === "strengthen-graph"}
            >
              <MenuItem value="random">{copy.random}</MenuItem>
              <MenuItem value="specific-puuid">{copy.specific}</MenuItem>
            </TextField>

            {form.collectorMode !== "strengthen-graph" && form.mode === "specific-puuid" ? (
              <TextField
                label={copy.specificPuuid}
                value={form.specificPuuid}
                onChange={(event) => setForm((current) => ({ ...current, specificPuuid: event.target.value }))}
                disabled={activeRun}
              />
            ) : null}

            <TextField
              type="number"
              label={copy.matchesPerPlayer}
              value={form.matchesPerPlayer}
              onChange={(event) => setForm((current) => ({ ...current, matchesPerPlayer: Number(event.target.value) }))}
              disabled={activeRun}
            />
            <TextField
              type="number"
              label={copy.maxIterations}
              value={form.maxIterations}
              onChange={(event) => setForm((current) => ({ ...current, maxIterations: Number(event.target.value) }))}
              disabled={activeRun}
            />
            <TextField
              select
              label={copy.queueType}
              value={form.queueType}
              onChange={(event) => setForm((current) => ({ ...current, queueType: event.target.value }))}
              disabled={activeRun}
            >
              <MenuItem value="">{copy.queueAll}</MenuItem>
              <MenuItem value="420">{copy.queueSolo}</MenuItem>
              <MenuItem value="440">{copy.queueFlex}</MenuItem>
              <MenuItem value="430">{copy.queueNormal}</MenuItem>
            </TextField>
            <TextField
              type="number"
              label={copy.requestsPerSecond}
              value={form.requestsPerSecond}
              onChange={(event) => setForm((current) => ({ ...current, requestsPerSecond: Number(event.target.value) }))}
              disabled={activeRun}
            />
            <TextField
              type="number"
              label={copy.requestsPer2Min}
              value={form.requestsPer2Min}
              onChange={(event) => setForm((current) => ({ ...current, requestsPer2Min: Number(event.target.value) }))}
              disabled={activeRun}
            />

            {form.collectorMode === "strengthen-graph" ? (
              <>
                <TextField
                  type="number"
                  label={copy.probeMatchCount}
                  value={form.probeMatchCount}
                  onChange={(event) => setForm((current) => ({ ...current, probeMatchCount: Number(event.target.value) }))}
                  disabled={activeRun}
                />
                <TextField
                  type="number"
                  label={copy.minimumPremadeRepeats}
                  value={form.minimumPremadeRepeats}
                  onChange={(event) => setForm((current) => ({ ...current, minimumPremadeRepeats: Number(event.target.value) }))}
                  disabled={activeRun}
                />
              </>
            ) : null}
          </Box>

          <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
            <Button
              variant="contained"
              size="large"
              onClick={() => void handleStart()}
              disabled={submitLoading || activeRun || (form.collectorMode === "strengthen-graph" && !strengthenAllowed) || (form.mode === "specific-puuid" && !form.specificPuuid.trim())}
            >
              {submitLoading ? t.common.loading : copy.start}
            </Button>
            <Button
              variant="outlined"
              size="large"
              onClick={() => void handleStop()}
              disabled={submitLoading || !activeRun}
            >
              {submitLoading ? t.common.loading : copy.stop}
            </Button>
          </Stack>
        </Paper>

        <Box sx={{ display: "grid", gap: 3, gridTemplateColumns: { xs: "1fr", xl: "1.2fr 0.8fr" } }}>
          <Paper sx={{ p: { xs: 2.5, md: 3.5 }, display: "grid", gap: 2 }}>
            <Typography variant="h5">{copy.status}</Typography>
            <Stack direction={{ xs: "column", md: "row" }} spacing={1.5} useFlexGap flexWrap="wrap">
              <Chip color={activeRun ? "primary" : statusResponse.status === "failed" ? "error" : "default"} label={`${statusResponse.status} / ${statusResponse.currentStage}`} />
              {statusResponse.jobId ? <Chip label={`Job ${statusResponse.jobId}`} /> : null}
              {statusResponse.progress.startedAt ? <Chip label={statusResponse.progress.startedAt} /> : null}
            </Stack>

            <Divider />

            <Typography variant="h6">{copy.progress}</Typography>
            <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "repeat(2, minmax(0, 1fr))" }, gap: 1.5 }}>
              <Chip label={`${copy.playersProcessed}: ${statusResponse.progress.playersProcessed}/${statusResponse.progress.maxIterations || form.maxIterations}`} />
              <Chip label={`${copy.matchesSaved}: ${statusResponse.progress.matchesSaved}`} />
              <Chip label={`${copy.apiCalls}: ${statusResponse.progress.apiCallsMade}`} />
              <Chip label={`${copy.currentPlayer}: ${statusResponse.progress.currentPlayerName || statusResponse.progress.currentPlayerPuuid || "-"}`} />
              <Chip label={`${copy.currentMatch}: ${statusResponse.progress.currentMatchId || "-"}`} />
            </Box>

            {statusResponse.config?.collectorMode === "strengthen-graph" || form.collectorMode === "strengthen-graph" ? (
              <>
                <Divider />
                <Typography variant="h6">{copy.probeSummary}</Typography>
                <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "repeat(2, minmax(0, 1fr))" }, gap: 1.5 }}>
                  <Chip label={`${copy.candidatesTried}: ${statusResponse.selectionSummary.candidatesTried}`} />
                  <Chip label={`${copy.candidatesSkipped}: ${statusResponse.selectionSummary.candidatesSkippedNoPremade}`} />
                  <Chip label={`${copy.candidatesPromoted}: ${statusResponse.selectionSummary.candidatesPromoted}`} />
                  <Chip label={`${copy.repeatedTeammates}: ${statusResponse.selectionSummary.currentCandidateProbeSummary?.repeatedTeammates ?? 0}`} />
                  <Chip label={`${copy.strongestRepeat}: ${statusResponse.selectionSummary.currentCandidateProbeSummary?.strongestRepeatCount ?? 0}`} />
                </Box>
              </>
            ) : null}
          </Paper>

          <Paper sx={{ p: { xs: 2.5, md: 3.5 }, display: "grid", gap: 2 }}>
            <Typography variant="h5">{copy.logs}</Typography>
            <Stack spacing={1}>
              {statusResponse.logs.length ? statusResponse.logs.slice().reverse().map((entry, index) => (
                <Box key={`${entry.timestamp}-${index}`} sx={{ borderRadius: 2, p: 1.25, backgroundColor: "rgba(15,23,42,0.05)" }}>
                  <Typography sx={{ fontSize: "0.74rem", color: "text.secondary", mb: 0.5 }}>
                    {entry.timestamp} • {entry.level}
                  </Typography>
                  <Typography sx={{ fontFamily: "ui-monospace, SFMono-Regular, Consolas, monospace", fontSize: "0.86rem" }}>
                    {entry.message}
                  </Typography>
                </Box>
              )) : (
                <Typography color="text.secondary">No collector logs yet.</Typography>
              )}
            </Stack>
          </Paper>
        </Box>
      </Box>
    </Container>
  );
}
