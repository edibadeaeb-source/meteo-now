param([switch]$NoBrowser)
$ErrorActionPreference = 'Stop'
$standPort = 8765
$standUrl = "http://127.0.0.1:$standPort"
$serverPath = Join-Path $PSScriptRoot 'server.py'
$runtimePath = Join-Path $PSScriptRoot '.runtime'

function Test-StandReady {
    try {
        $health = Invoke-RestMethod -Uri "$standUrl/health" -TimeoutSec 2
        return $health.app -eq 'METEO-NOW-STAND' -and $health.version -eq 2
    } catch { return $false }
}

if (-not (Test-StandReady)) {
    if (Test-Path -LiteralPath (Join-Path $runtimePath 'server.pid')) {
        & (Join-Path $PSScriptRoot 'OPRESTE-STAND.ps1')
    }
    $pythonCandidates = @(
        (Join-Path $env:USERPROFILE 'scoop\apps\python313\current\python.exe'),
        (Join-Path $env:LOCALAPPDATA 'Programs\Python\Python313\python.exe')
    )
    $pythonPath = $pythonCandidates | Where-Object { Test-Path -LiteralPath $_ } | Select-Object -First 1
    if (-not $pythonPath) {
        $pythonCommand = Get-Command python.exe -ErrorAction SilentlyContinue
        if ($pythonCommand -and $pythonCommand.Source -notlike '*WindowsApps*') { $pythonPath = $pythonCommand.Source }
    }
    if (-not $pythonPath) { throw 'Python nu a fost gasit. Dashboardul necesita Python 3.10 sau mai nou.' }
    New-Item -ItemType Directory -Path $runtimePath -Force | Out-Null
    $serverArguments = '"{0}" --port {1}' -f $serverPath, $standPort
    $standProcess = Start-Process -FilePath $pythonPath -ArgumentList $serverArguments -WorkingDirectory $PSScriptRoot -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $runtimePath 'server-out.txt') -RedirectStandardError (Join-Path $runtimePath 'server-error.txt')
    $standProcess.Id | Set-Content -LiteralPath (Join-Path $runtimePath 'server.pid')
    for ($attempt = 0; $attempt -lt 20; $attempt++) {
        if (Test-StandReady) { break }
        if ($standProcess.HasExited) { throw 'Serverul nu a pornit. Verifica .runtime\server-error.txt; portul 8765 poate fi ocupat.' }
        Start-Sleep -Milliseconds 250
    }
    if (-not (Test-StandReady)) { throw 'Dashboardul nu raspunde inca. Verifica .runtime\server-error.txt.' }
}
if (-not $NoBrowser) { Start-Process $standUrl }
