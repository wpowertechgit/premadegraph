param(
    [int]$Runs = 1,
    [Alias('Seed')]
    [uint64[]]$Seeds = @((Get-Random -Count 100 -InputObject (1..10000) | Sort-Object)),
    [string]$BackendUrl = "http://localhost:3001",
    [string]$DatasetId = "",   # "flexset" or "soloq" — empty = active dataset
    [switch]$Synthetic
)

$SimBin   = "$PSScriptRoot\backend\target\release\neurosim-backend.exe"
$WorkDir  = "$PSScriptRoot\backend"
$LogsDir  = "$PSScriptRoot\backend\logs"

function Get-RoleLabel {
    param($Winner)

    if (-not $Winner) {
        return "Unknown"
    }

    $scores = @(
        [PSCustomObject]@{ Label = "Warband";    Value = [double]$Winner.a_combat },
        [PSCustomObject]@{ Label = "Supply";     Value = [double]$Winner.a_resource },
        [PSCustomObject]@{ Label = "Pathfinders";Value = [double]$Winner.a_map_objective },
        [PSCustomObject]@{ Label = "Vanguard";   Value = [double]$Winner.a_risk },
        [PSCustomObject]@{ Label = "Council";    Value = [double]$Winner.a_team }
    )

    return ($scores |
        Sort-Object @{ Expression = "Value"; Descending = $true }, @{ Expression = "Label"; Descending = $false } |
        Select-Object -First 1 -ExpandProperty Label)
}

if (-not (Test-Path $SimBin)) {
    Write-Error "Binary not found: $SimBin — run 'cargo build --release' first"
    exit 1
}

New-Item -ItemType Directory -Force -Path $LogsDir | Out-Null

$exportFlag  = if ($Synthetic) { "--clusters 64" } else { "--use-dataset-export --require-dataset-export" }
$datasetKey  = if ($Synthetic) { "synthetic" } elseif ($DatasetId) { $DatasetId } else { "active" }
$datasetLabel = if ($Synthetic) { "synthetic" } elseif ($DatasetId) { "dataset=$DatasetId" } else { "dataset=active" }

$seedList = @($Seeds)
$seedCount = $seedList.Count

for ($seedIndex = 0; $seedIndex -lt $seedCount; $seedIndex++) {
    $seed = $seedList[$seedIndex]

    if ($seedCount -gt 1) {
        Write-Host "=== SEED [$($seedIndex + 1)/$seedCount] $seed ==="
    }

    Write-Host "Launching $Runs runs | seed=$seed | $datasetLabel"
    Write-Host "Logs: $LogsDir"
    Write-Host "Pattern: neurosim-$seed-$datasetKey-*.jsonl"
    Write-Host ""

    $startTime = Get-Date
    $before = Get-ChildItem "$LogsDir\neurosim-$seed-$datasetKey-*.jsonl" -ErrorAction SilentlyContinue |
        Select-Object -ExpandProperty Name

    $jobs = 1..$Runs | ForEach-Object {
        $runIndex = $_
        Start-Job -Name "neurosim-run-$seed-$runIndex" -ScriptBlock {
            param($bin, $workDir, $localSeed, $url, $datasetId, $flag)
            Set-Location $workDir
            $env:PREMADEGRAPH_URL = $url
            if ($datasetId -and $datasetId -ne "active") {
                $env:PREMADEGRAPH_DATASET_ID = $datasetId
            }
            & $bin --cli-run --seed $localSeed $flag.Split(" ")
        } -ArgumentList $SimBin, $WorkDir, $seed, $BackendUrl, $DatasetId, $exportFlag
    }

    Write-Host "Jobs started: $($jobs.Count)"
    Write-Host "Waiting for all runs to complete (this may take several minutes)..."
    Write-Host ""

    $jobs | Wait-Job | Out-Null

    $jobs | ForEach-Object {
        $err = Receive-Job $_ -ErrorAction SilentlyContinue 2>&1 | Where-Object { $_ -match "error|Error|ERRO" }
        if ($err) { Write-Warning "Job $($_.Name): $err" }
    }

    Write-Host "=== RESULTS ==="
    Write-Host ""

    $newFiles = Get-ChildItem "$LogsDir\neurosim-$seed-$datasetKey-*.jsonl" -ErrorAction SilentlyContinue |
        Where-Object { $_.Name -notin $before -and $_.LastWriteTime -ge $startTime } |
        Sort-Object LastWriteTime

    if (-not $newFiles) {
        Write-Warning "No log files found matching neurosim-$seed-$datasetKey-*.jsonl"
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
                    Seed           = $seed
                    FinishedTick   = $s.tick
                    TribeId        = $w.tribe_id
                    ClusterId      = $w.cluster_id
                    PolityTier     = $w.polity_tier
                    PolityBehavior = Get-RoleLabel $w
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
                    File = $file.Name; Dataset = $datasetKey; Seed = $seed
                    TribeId = "NO WINNER (all extinct)"; ClusterId = "—"
                }
            }
        } else {
            [PSCustomObject]@{
                File = $file.Name; Dataset = $datasetKey; Seed = $seed
                TribeId = "INCOMPLETE (no final_summary)"; ClusterId = "—"
            }
        }
    }

    $results | Format-Table -AutoSize

    Write-Host ""
    Write-Host "=== WINNER DISTRIBUTION ($datasetLabel, seed=$seed) ==="
    $results | Group-Object PolityBehavior | Sort-Object Count -Descending |
        ForEach-Object { Write-Host "  $($_.Name): $($_.Count)/$Runs" }

    Write-Host ""
    Write-Host "Raw logs in: $LogsDir"
    Write-Host ""
}
