@echo off
rem build.cmd - dvojklikovy build .github\ z kanonu (profil doma, sada thin) + --verify
rem Pouziti: po kazde oprave kanonu (IT-ANALYSIS\Skilly nebo Skilly\_vscode) spustit dvojklikem.
rem Vystup v okne + kopie do docs\e2e-vscode\build-doma-last.log (prepisuje se; prvni build = build-doma.log).
rem Nikdy needitovat .github\ rucne - opravy jdou do kanonu, pak tento build. Viz docs\BUILD-VSCODE.md.
setlocal
cd /d "%~dp0.."
set KANON=C:\Users\milos\CLAUDE\IT-ANALYSIS\Skilly
set LOG=docs\e2e-vscode\build-doma-last.log

where python >nul 2>nul
if errorlevel 1 (
  set PY=py -3
) else (
  set PY=python
)

echo ============================================================
echo  EA File Bridge - build .github\ (profil doma, sada thin)
echo  kanon: %KANON%
echo  repo:  %CD%
echo ============================================================
echo.
%PY% tools\build-vscode.py --kanon "%KANON%" --profile doma --set thin --log "%LOG%"
if errorlevel 1 (
  echo.
  echo *** BUILD SELHAL - .github\ se nezmenilo. Cti vypis vyse ^(FAIL radky^). ***
  goto :konec
)
echo.
echo ------------------------------------------------------------
echo  --verify ^(sha256 proti manifestu, sweep, pocty^)
echo ------------------------------------------------------------
%PY% tools\build-vscode.py --profile doma --verify
if errorlevel 1 (
  echo.
  echo *** VERIFY SELHAL ***
  goto :konec
)
echo.
echo OK - build i verify prosly. Dalsi krok: git status, commit "chore(skills): build vscode doma thin <datum>".

:konec
echo.
pause
endlocal
