@echo off
:: ============================================================
::  Arranque del frontend (Next.js) en Windows, para uso manual
::  (doble clic). Requiere que start.bat (backend) ya este
::  corriendo en otra ventana. En la primera ejecucion instala
::  dependencias npm; en las siguientes compila (npm run build)
::  y arranca con npm run start en el puerto WEB_PORT (leido de
::  api\.env). Libera automaticamente ese puerto si ya esta en uso.
:: ============================================================
:: Ir a la carpeta donde esta este archivo
cd /d "%~dp0\web"

title GCM Tickets — Frontend (Next.js)
color 0B
echo.
echo  ========================================
echo   GCM TICKETS — Frontend Next.js
echo  ========================================
echo.
echo  IMPORTANTE: el backend (start.bat) debe estar corriendo
echo  en otra ventana para que este frontend funcione.
echo.

:: Verificar si Node.js esta instalado
where node >nul 2>&1
if %errorlevel% neq 0 (
    color 0C
    echo  ERROR: Node.js no esta instalado.
    echo  Descargalo en: https://nodejs.org
    echo.
    pause
    exit /b 1
)

echo  Node.js detectado correctamente.
echo.

:: Primera instalacion: instalar dependencias
if not exist "node_modules" (
    echo  Primera instalacion detectada.
    echo.
    echo  Instalando dependencias...
    echo  Esto puede tardar 1-2 minutos, espera...
    echo.
    npm install
    if %errorlevel% neq 0 (
        color 0C
        echo.
        echo  ERROR: No se pudieron instalar las dependencias.
        echo  Verifica tu conexion a internet e intenta de nuevo.
        echo.
        pause
        exit /b 1
    )
    echo.
)

:: Leer el puerto real desde ..\api\.env (WEB_PORT) en vez de asumir uno fijo
set WEB_PORT_VAL=8081
for /f "usebackq tokens=1,2 delims==" %%a in ("..\api\.env") do (
    if "%%a"=="WEB_PORT" set WEB_PORT_VAL=%%b
)

:: Liberar el puerto del frontend si ya esta en uso
for /f "tokens=5" %%p in ('netstat -ano ^| findstr ":%WEB_PORT_VAL% " ^| findstr "LISTENING"') do (
    echo  Puerto %WEB_PORT_VAL% ocupado. Cerrando proceso anterior ^(PID %%p^)...
    taskkill /PID %%p /F >nul 2>&1
    timeout /t 2 /nobreak >nul
)

:: Compilar Next.js antes de iniciar
echo  Compilando frontend...
call npm run build
if %errorlevel% neq 0 (
    color 0C
    echo.
    echo  ERROR: No se pudo compilar el frontend ^(Next.js^).
    echo  Revisa los mensajes de error arriba.
    echo.
    pause
    exit /b 1
)
echo.

:: Iniciar frontend — PORT como variable de entorno real: Next.js no lee
:: .env.local para elegir su propio puerto (se carga despues de que el CLI
:: ya escogio), asi que hay que exportarla aqui.
echo  Frontend iniciando en el puerto %WEB_PORT_VAL%...
echo  NO cierres esta ventana mientras uses el sistema.
echo.
set PORT=%WEB_PORT_VAL%
call npm run start
if %errorlevel% neq 0 (
    color 0C
    echo.
    echo  ERROR: El frontend se detuvo inesperadamente.
    echo  Revisa los mensajes de error arriba.
    echo.
)

pause
