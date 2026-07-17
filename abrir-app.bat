@echo off
REM ============================================================
REM  Abre GCM Tickets en el navegador al iniciar sesion.
REM  Espera a que el frontend (Next.js, puerto 3001) responda
REM  antes de abrir, para no mostrar una pagina de error mientras
REM  PM2 termina de levantar el servidor tras el arranque.
REM ============================================================

:esperar
timeout /t 3 /nobreak >nul
powershell -NoProfile -Command "try { Invoke-WebRequest -Uri http://localhost:3001/admin -UseBasicParsing -TimeoutSec 2 | Out-Null; exit 0 } catch { exit 1 }"
if errorlevel 1 goto esperar

start "" http://localhost:3001/admin
