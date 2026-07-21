@echo off
REM ============================================================
REM  Abre GCM Tickets en el navegador al iniciar sesion.
REM  Espera a que el frontend (Next.js) responda antes de abrir,
REM  para no mostrar una pagina de error mientras PM2 termina de
REM  levantar el servidor tras el arranque.
REM ============================================================

:: Leer el puerto real desde api\.env (WEB_PORT) en vez de asumir uno fijo
set WEB_PORT_VAL=8081
for /f "usebackq tokens=1,2 delims==" %%a in ("%~dp0api\.env") do (
    if "%%a"=="WEB_PORT" set WEB_PORT_VAL=%%b
)

:esperar
timeout /t 3 /nobreak >nul
powershell -NoProfile -Command "try { Invoke-WebRequest -Uri http://localhost:%WEB_PORT_VAL%/admin -UseBasicParsing -TimeoutSec 2 | Out-Null; exit 0 } catch { exit 1 }"
if errorlevel 1 goto esperar

start "" http://localhost:%WEB_PORT_VAL%/admin
