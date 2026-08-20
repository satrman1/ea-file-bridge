# run-gatekeeper-manual.ps1 - DIAGNOSTICKY beh vratneho MIMO launcher.
# Ucel: overit LOGIKU vratneho (stavove okno, schranka, FB_Process stouch,
# confirm kanal okno, mutex, reap) doma, ODDELENE od otazky "smi EA spustit
# powershell" (Norton IDP.HELU.CMD / CMD:Powershell-AP [Drp] = R5/EDR optika).
# Spousti ho UZIVATEL z vlastni PowerShell konzole - ne EA - takze
# command-line/parent heuristiky na "EA rodi powershell" se nespusti.
#
# NENI to produkcni cesta (ta = menu "Zapnout AI import rezim", launcher
# spousti kanon inline z EA). Tohle je jen domaci test harness logiky.
#
# Spusteni (Windows PowerShell 5.1, ktere je defaultne STA):
#   powershell.exe -STA -ExecutionPolicy Bypass -File "C:\GIT\ea-file-bridge\krok0\run-gatekeeper-manual.ps1"
# EA s otevrenym eaexample musi bezet; pumpa NE (nesmi se potkat nad requests\).
# Add-in Search "FB_Process" musi byt v modelu zalozene (deploy + restart EA).

$RepoId = "EAExample.qea"
$BaseDir = "C:\GIT\ea-file-bridge"
$DlDir = "$env:USERPROFILE\Downloads"
$SessionInfo = "rucni diagnosticky beh (mimo launcher; session baseline dozene FB_Process pri prvnim stouchnuti, W8)"
$ReapTimeoutMin = 10
$ReattachSec = 10
$HealthSec = 15
$ReapGraceSec = 30
$StuckSec = 20

# kanon vratneho = tyz zdroj, ktery launcher tahá z modelu (FB_Gatekeeper)
. "$PSScriptRoot\..\src\gatekeeper.ps1"
