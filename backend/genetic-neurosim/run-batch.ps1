param(
    [int]$Runs = 5,
    [uint64]$Seed = 42,
    [string]$BackendUrl = "http://localhost:3001",
    [string]$DatasetId = "",   # "flexset" or "soloq" — empty = active dataset
    [switch]$Synthetic
)

$SimBin   = "$PSScriptRoot\backend\target\release\neurosim-backend.exe"
$WorkDir  = "$PSScriptRoot\backend"
$LogsDir  = "$PSScriptRoot\backend\logs"

if (-not (Test-Path $SimBin)) {
    Write-Error "Binary not found: $SimBin — run 'cargo build --release' first"
    exit 1
}

New-Item -ItemType Directory -Force -Path $LogsDir | Out-Null

$exportFlag  = if ($Synthetic) { "--clusters 64" } else { "--use-dataset-export --require-dataset-export" }
$datasetKey  = if ($Synthetic) { "synthetic" } elseif ($DatasetId) { $DatasetId } else { "active" }
$datasetLabel = if ($Synthetic) { "synthetic" } elseif ($DatasetId) { "dataset=$DatasetId" } else { "dataset=active" }

Write-Host "Launching $Runs runs | seed=$Seed | $datasetLabel"
Write-Host "Logs: $LogsDir"
Write-Host "Pattern: neurosim-$Seed-$datasetKey-*.jsonl"
Write-Host ""

# Snapshot existing log names so we only pick up files created this run
$startTime = Get-Date
$before = Get-ChildItem "$LogsDir\neurosim-$Seed-$datasetKey-*.jsonl" -ErrorAction SilentlyContinue |
    Select-Object -ExpandProperty Name

$jobs = 1..$Runs | ForEach-Object {
    $runIndex = $_
    Start-Job -Name "neurosim-run-$runIndex" -ScriptBlock {
        param($bin, $workDir, $seed, $url, $datasetId, $flag)
        Set-Location $workDir
        $env:PREMADEGRAPH_URL = $url
        if ($datasetId -and $datasetId -ne "active") {
            $env:PREMADEGRAPH_DATASET_ID = $datasetId
        }
        & $bin --cli-run --seed $seed $flag.Split(" ")
    } -ArgumentList $SimBin, $WorkDir, $Seed, $BackendUrl, $DatasetId, $exportFlag
}

Write-Host "Jobs started: $($jobs.Count)"
Write-Host "Waiting for all runs to complete (this may take several minutes)..."
Write-Host ""

$jobs | Wait-Job | Out-Null

# Show any job errors
$jobs | ForEach-Object {
    $err = Receive-Job $_ -ErrorAction SilentlyContinue 2>&1 | Where-Object { $_ -match "error|Error|ERRO" }
    if ($err) { Write-Warning "Job $($_.Name): $err" }
}

Write-Host "=== RESULTS ==="
Write-Host ""

# Only read files created during this run
$newFiles = Get-ChildItem "$LogsDir\neurosim-$Seed-$datasetKey-*.jsonl" -ErrorAction SilentlyContinue |
    Where-Object { $_.Name -notin $before -and $_.LastWriteTime -ge $startTime } |
    Sort-Object LastWriteTime

if (-not $newFiles) {
    Write-Warning "No log files found matching neurosim-$Seed-$datasetKey-*.jsonl"
    Write-Host "Check job output:"
    $jobs | Receive-Job -Keep
    exit 1
}

$results = $newFiles | ForEach-Object {
    $file = $_
    $line = Get-Content $file.FullName |
        Where-Object { $_ -match '"type"\s*:\s*"final_summary"' } |
        Select-Object -Last 1
    if ($line) {
        $json = $line | ConvertFrom-Json
        $w    = $json.winner
        $s    = $json.summary
        if ($w) {
            [PSCustomObject]@{
                File           = $file.Name
                Dataset        = $datasetKey
                Seed           = $Seed
                FinishedTick   = $s.tick
                TribeId        = $w.tribe_id
                ClusterId      = $w.cluster_id
                PolityTier     = $w.polity_tier
                PolityBehavior = $w.polity_behavior
                Population     = $w.population
                Territory      = $w.territory_tiles
                TicksAlive     = $w.ticks_alive
                A_Combat       = [math]::Round($w.a_combat, 3)
                A_Resource     = [math]::Round($w.a_resource, 3)
                A_Risk         = [math]::Round($w.a_risk, 3)
                A_MapObj       = [math]::Round($w.a_map_objective, 3)
                A_Team         = [math]::Round($w.a_team, 3)
                WarsWon        = $w.wars_won
                WarsLost       = $w.wars_lost
            }
        } else {
            [PSCustomObject]@{
                File = $file.Name; Dataset = $datasetKey; Seed = $Seed
                TribeId = "NO WINNER (all extinct)"; ClusterId = "—"
            }
        }
    } else {
        [PSCustomObject]@{
            File = $file.Name; Dataset = $datasetKey; Seed = $Seed
            TribeId = "INCOMPLETE (no final_summary)"; ClusterId = "—"
        }
    }
}

$results | Format-Table -AutoSize

Write-Host ""
Write-Host "=== WINNER DISTRIBUTION ($datasetLabel, seed=$Seed) ==="
$results | Group-Object PolityBehavior | Sort-Object Count -Descending |
    ForEach-Object { Write-Host "  $($_.Name): $($_.Count)/$Runs" }

Write-Host ""
Write-Host "Raw logs in: $LogsDir"
