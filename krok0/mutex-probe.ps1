# mutex-probe.ps1 - izolovany test W3 single-instance mutexu (bez EA, bez vratneho)
# Dukaz mechanismu dle W3-mutex-reap-navrh.md par. 5.1. Spustit ve
# WINDOWS PowerShell 5.1 (powershell.exe, NIKDY pwsh - stejny pin jako vratny).
# Stejne schema jmena jako FB_Gatekeeper: Local\EAFB_Gatekeeper_v1_<REPOKEY>.
#
# Postup (dve konzole A/B):
#   A> powershell.exe -ExecutionPolicy Bypass -File mutex-probe.ps1 EAEXAMPLE.QEA
#      -> MUTEX ZISKAN ... - drzi, ceka na Enter
#   B> powershell.exe -ExecutionPolicy Bypass -File mutex-probe.ps1 EAEXAMPLE.QEA
#      -> MUTEX OBSAZEN - druha instance se odmita, exit 2   (= W3, akc. krit. 5)
#   A> Enter -> MUTEX UVOLNEN, exit 0
#   B> spustit znovu -> MUTEX ZISKAN (cisty konec uvolnil mutex)
#   B drzi; A s jinym repem (EMR_PROD) -> ZISKAN (per-repo nezavislost)
#   B zavrit KRIZKEM (necisty konec); A EAEXAMPLE.QEA -> PREVZAT PO NECISTEM KONCI
param([string]$RepoId = "EAEXAMPLE.QEA")
$key = ($RepoId.ToUpper() -replace '[^A-Z0-9]', '_')
if ($key.Length -gt 32) {
    $m5 = [System.Security.Cryptography.MD5]::Create()
    $key = ([BitConverter]::ToString($m5.ComputeHash([Text.Encoding]::UTF8.GetBytes($RepoId.ToUpper()))) -replace '-', '').Substring(0, 8)
}
$mutexName = "Local\EAFB_Gatekeeper_v1_$key"
$mutex = New-Object System.Threading.Mutex($false, $mutexName)
$acquired = $false
try { $acquired = $mutex.WaitOne(0) }
catch [System.Threading.AbandonedMutexException] {
    $acquired = $true
    Write-Host "PREVZAT PO NECISTEM KONCI (abandoned) - $mutexName"
}
if ($acquired) {
    Write-Host "MUTEX ZISKAN ($mutexName) - drzim, Enter uvolni a ukonci"
    Read-Host | Out-Null
    $mutex.ReleaseMutex(); $mutex.Dispose()
    Write-Host "MUTEX UVOLNEN"; exit 0
} else {
    Write-Host "MUTEX OBSAZEN ($mutexName) - druha instance se odmita"
    exit 2
}
