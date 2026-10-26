param([ValidateRange(1,120)][int]$Minutes=120)
$ErrorActionPreference='Stop'
$repoPath=Split-Path -Parent $PSScriptRoot
$projectPath=Split-Path -Parent (Split-Path -Parent $repoPath)
$reportPath=Join-Path $projectPath '03-Testare-si-capturi/tests/artifacts-emulator-soak-20261026/run'
New-Item -ItemType Directory -Path $reportPath -Force | Out-Null
Add-Type @'
using System;
using System.Runtime.InteropServices;
public static class MeteoSoakWake {
    [DllImport("kernel32.dll")] public static extern uint SetThreadExecutionState(uint flags);
}
'@
# This request expires with this process; no Windows power plan is modified.
$previousFlags=[MeteoSoakWake]::SetThreadExecutionState([uint32]2147483649)
if ($previousFlags -eq 0) {throw 'Could not acquire the temporary no-sleep request'}
@{temporarySystemWake=$true;displayMayTurnOff=$true;powerPlanChanged=$false} | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $reportPath 'power-request.json') -Encoding utf8
$resultCode=1
try {
    Set-Location -LiteralPath $repoPath
    & 'C:/Users/ediba/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node.exe' 'tests/emulator-soak.cjs' "--minutes=$Minutes" '--interval=180'
    $resultCode=$LASTEXITCODE
} finally {
    [void][MeteoSoakWake]::SetThreadExecutionState($previousFlags)
}
exit $resultCode
