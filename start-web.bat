@echo off
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

:: Liberar puerto 3001 si ya esta en uso
for /f "tokens=5" %%p in ('netstat -ano ^| findstr ":3001 " ^| findstr "LISTENING"') do (
    echo  Puerto 3001 ocupado. Cerrando proceso anterior ^(PID %%p^)...
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

:: Iniciar frontend
echo  Frontend iniciando en el puerto 3001...
echo  NO cierres esta ventana mientras uses el sistema.
echo.
call npm run start
if %errorlevel% neq 0 (
    color 0C
    echo.
    echo  ERROR: El frontend se detuvo inesperadamente.
    echo  Revisa los mensajes de error arriba.
    echo.
)

pause
