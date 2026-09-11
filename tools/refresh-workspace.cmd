@echo off
rem refresh-workspace.cmd - dvojklikovy refresh WORKSPACE REPA METODIKY (C:\GIT\ai-transfer)
rem z tohoto repa bridge: build .github\ (profil doma, sada full) + vendorovana pumpa pump.wsf
rem + PUMP-VERSION + skeleton slozek, pak --verify. Viz docs\WORKSPACE-METODIKY.md.
rem Obsah zadani\, requests\, responses\ ve workspace se nemeni. Commit ve workspace = rucne (Milos).
setlocal
cd /d "%~dp0.."
set WORKSPACE=C:\GIT\ai-transfer
set KANON=C:\Users\milos\CLAUDE\IT-ANALYSIS\Skilly
set PROFILE=doma
set SADA=full
set LOG=docs\e2e-vscode\refresh-workspace-last.log

where python >nul 2>nul
if errorlevel 1 (
  set PY=py -3
) else (
  set PY=python
)

echo ============================================================
echo  EA File Bridge - refresh workspace metodiky
echo  workspace: %WORKSPACE%
echo  kanon:     %KANON%
echo  profil:    %PROFILE%   sada: %SADA%
echo  bridge:    %CD%
echo ============================================================
echo.
%PY% tools\refresh-workspace.py --workspace "%WORKSPACE%" --profile %PROFILE% --set %SADA% --kanon "%KANON%" --log "%LOG%"
if errorlevel 1 (
  echo.
  echo *** REFRESH SELHAL - cti vypis vyse ^(FAIL radky^). Workspace .github\ se pri chybe buildu nemeni. ***
  goto :konec
)
echo.
echo ------------------------------------------------------------
echo  --verify ^(sha256 .github\ proti manifestu, sweep, PUMP-VERSION, skeleton^)
echo ------------------------------------------------------------
%PY% tools\refresh-workspace.py --workspace "%WORKSPACE%" --profile %PROFILE% --verify
if errorlevel 1 (
  echo.
  echo *** VERIFY SELHAL ***
  goto :konec
)
echo.
echo OK - refresh i verify prosly. Dalsi krok: ve workspace git status, commit "chore(workspace): refresh z bridge <datum>".

:konec
echo.
pause
endlocal
