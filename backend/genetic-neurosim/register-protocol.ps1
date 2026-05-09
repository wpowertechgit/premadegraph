#Requires -Version 5.1
<#
.SYNOPSIS
  Registers the neurosim:// custom URI scheme so that clicking the
  "Tribal NeuroSim" button in the web frontend launches the MonoGame
  desktop client on this machine.

.DESCRIPTION
  Writes HKCU\Software\Classes\neurosim\... registry keys.
  No admin rights required (HKCU).

  Run once after each fresh build or if the exe path changes.
#>

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

# --- locate the exe relative to this script -----------------------------------
$scriptDir  = $PSScriptRoot
$clientRoot = Join-Path $scriptDir "client-monogame"

$candidates = @(
    (Join-Path $clientRoot "bin\Debug\net8.0\win-x64\TribalNeuroSim.Client.exe"),
    (Join-Path $clientRoot "bin\Debug\net8.0\TribalNeuroSim.Client.exe"),
    (Join-Path $clientRoot "bin\Release\net8.0\win-x64\TribalNeuroSim.Client.exe"),
    (Join-Path $clientRoot "bin\Release\net8.0\TribalNeuroSim.Client.exe")
)

$exePath = $candidates | Where-Object { Test-Path $_ } |
    Sort-Object { (Get-Item $_).LastWriteTime } -Descending |
    Select-Object -First 1

if (-not $exePath) {
    Write-Error @"
MonoGame client exe not found. Build it first:
  dotnet build "$clientRoot"
Searched:
$($candidates -join "`n")
"@
    exit 1
}

Write-Host "Registering neurosim:// -> $exePath"

# --- write registry keys ------------------------------------------------------
$base = "HKCU:\Software\Classes\neurosim"

# Root key
if (-not (Test-Path $base)) { New-Item -Path $base -Force | Out-Null }
Set-ItemProperty -Path $base -Name "(Default)"     -Value "URL:TribalNeuroSim Protocol"
Set-ItemProperty -Path $base -Name "URL Protocol"  -Value ""

# shell\open\command
$cmdKey = "$base\shell\open\command"
if (-not (Test-Path $cmdKey)) { New-Item -Path $cmdKey -Force | Out-Null }
Set-ItemProperty -Path $cmdKey -Name "(Default)" -Value "`"$exePath`" `"%1`""

Write-Host "Done. neurosim:// is now registered for this user account."
Write-Host "Click 'Tribal NeuroSim' in the web UI to launch the desktop client."
