@echo off
rem Kontrola parametru po nasazeni (NAVOD-NASAZENI-KLIKACI kap. 4a) - dvojklik v bance.
rem Spousti docs\e2e-nasazeni\ready-generalka\params-check.py nad responses\res-banka-kontrola-parametru.json a src\.
rem Vyzaduje Python 3.12 pro stanici (python v PATH); zadne interni hodnoty se nevypisuji (jen jmena operaci a parametru).
setlocal
set KORP=%~dp0..\..\..
python "%KORP%\docs\e2e-nasazeni\ready-generalka\params-check.py" "%KORP%\responses\res-banka-kontrola-parametru.json" "%KORP%\src"
if errorlevel 1 echo CHYBA: skript neprobehl - pouzij prompt pro Copilota (PLAN-NASAZENI-2026-10-16.md krok D5).
pause
