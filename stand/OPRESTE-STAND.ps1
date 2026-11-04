$ErrorActionPreference = 'Stop'
$standPidFile = Join-Path $PSScriptRoot '.runtime\server.pid'
$expectedScript = Join-Path $PSScriptRoot 'server.py'
if (Test-Path -LiteralPath $standPidFile) {
    $standProcessId = [int](Get-Content -LiteralPath $standPidFile -Raw)
    $processInfo = Get-CimInstance Win32_Process -Filter "ProcessId = $standProcessId"
    if ($processInfo -and $processInfo.Name -match '^python(w)?\.exe$' -and $processInfo.CommandLine.Contains($expectedScript)) {
        Stop-Process -Id $standProcessId
        Write-Host 'Dashboardul local a fost oprit.'
    } elseif ($processInfo) {
        throw 'Procesul nu mai corespunde dashboardului; nu a fost oprit.'
    }
    Remove-Item -LiteralPath $standPidFile
}
