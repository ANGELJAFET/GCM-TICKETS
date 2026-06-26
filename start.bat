@echo off
:: Ir a la carpeta donde esta este archivo
cd /d "%~dp0"

title GCM Tickets — Grupo Milcien
color 0A
echo.
echo  ========================================
echo   GCM TICKETS — Grupo Milcien S.A. de C.V.
echo  ========================================
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

:: Primera instalacion: instalar dependencias y configurar base de datos
if not exist "node_modules" (
    echo  Primera instalacion detectada.
    echo.
    echo  [1/2] Instalando dependencias...
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
    echo  [2/2] Configurando base de datos ^(tablas y procedimientos^)...
    echo.
    node setup.js
    if %errorlevel% neq 0 (
        color 0C
        echo.
        echo  ERROR: No se pudo configurar la base de datos.
        echo  Verifica que SQL Server este activo y los datos de conexion.
        echo.
        pause
        exit /b 1
    )
    echo.
)

:: Liberar puerto 3000 si ya esta en uso
for /f "tokens=5" %%p in ('netstat -ano ^| findstr ":3000 " ^| findstr "LISTENING"') do (
    echo  Puerto 3000 ocupado. Cerrando proceso anterior ^(PID %%p^)...
    taskkill /PID %%p /F >nul 2>&1
    timeout /t 2 /nobreak >nul
)

:: Iniciar servidor
echo  Servidor iniciando...
echo  NO cierres esta ventana mientras uses el sistema.
echo.
node server.js
if %errorlevel% neq 0 (
    color 0C
    echo.
    echo  ERROR: El servidor se detuvo inesperadamente.
    echo  Revisa los mensajes de error arriba.
    echo.
)

pause
