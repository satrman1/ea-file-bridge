# ============================================================================
# Test P7 - PowerShell jako alternativa WSH pumpy (EA File Bridge)
# Overuje na dane stanici tri veci najednou:
#   0. ze spousteni .ps1 souboru neni blokovane (AppLocker/ExecutionPolicy)
#   1. ze PowerShell NENI v Constrained Language Mode (ten zakazuje COM
#      objekty -> PS pumpa by nesla)
#   2. ze jde COM attach na bezici EA (zaklad pumpy)
#
# SPUSTENI: pravym tlacitkem na tento soubor -> "Run with PowerShell"
#   (dvojklik soubor jen otevre v editoru - to NENI vysledek testu).
#   Pouzij Windows PowerShell (5.1) - kontextove menu ho pouziva samo;
#   v PowerShell 7 test 2 hlasi chybu metody, to neni vypovidajici.
# Pro test 2 musi bezet EA s otevrenym projektem.
# Skript nic neinstaluje a nic nezapisuje - jen cte a vypisuje.
# ============================================================================

Write-Host "=== Test P7: PowerShell misto WSH (EA File Bridge) ==="
Write-Host ""

# 0) kdyz vidis tenhle radek, spousteni .ps1 na stanici funguje
Write-Host "[OK]   0. Soubor .ps1 se spustil - AppLocker/ExecutionPolicy neblokuje."

# 1) language mode
$lm = $ExecutionContext.SessionState.LanguageMode
if ($lm -eq "FullLanguage") {
    Write-Host "[OK]   1. LanguageMode = FullLanguage - COM objekty jsou povolene."
} else {
    Write-Host "[FAIL] 1. LanguageMode = $lm - COM objekty jsou ZAKAZANE."
    Write-Host "          PS pumpa na teto stanici NEPUJDE (konec testu, bod 2 selze taky)."
}

# 2) COM attach na bezici EA
try {
    $ea = [System.Runtime.InteropServices.Marshal]::GetActiveObject("EA.App")
    $cs = $ea.Repository.ConnectionString
    Write-Host "[OK]   2. COM attach na EA funguje. Pripojeny repozitar:"
    Write-Host "          $cs"
} catch {
    Write-Host "[FAIL] 2. COM attach selhal: $($_.Exception.Message)"
    Write-Host "          (Pokud EA nebezi nebo nema otevreny projekt, je FAIL ocekavany -"
    Write-Host "           spust EA a zopakuj. Jinak je to nalez.)"
}

# 3) verze - informativne do zaznamu
Write-Host ""
Write-Host ("PowerShell: " + $PSVersionTable.PSVersion + " | Edice: " + $PSVersionTable.PSEdition)
Write-Host ""
Write-Host "Vysledek vyfot' nebo nadiktuj do protokolu (P7)."
Read-Host "Enter pro zavreni"
