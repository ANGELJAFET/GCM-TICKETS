# ================================================================
# setup-servidor.ps1
# Configura GCM Tickets como servicio permanente en Windows Server
# Ejecutar como Administrador en PowerShell
# ================================================================

$AppPath = "C:\Users\Administrador\SistemaApp"
$AppPort = 3000

Write-Host ""
Write-Host "================================================" -ForegroundColor Cyan
Write-Host "  GCM TICKETS - CONFIGURACION DE SERVIDOR" -ForegroundColor Cyan
Write-Host "================================================" -ForegroundColor Cyan
Write-Host ""

# ── 1. Verificar Node.js ─────────────────────────────────────────
Write-Host "[1/6] Verificando Node.js..." -ForegroundColor Yellow
try {
    $nodeVersion = node --version 2>&1
    Write-Host "      Node.js instalado: $nodeVersion" -ForegroundColor Green
} catch {
    Write-Host "      ERROR: Node.js no encontrado. Instala Node.js primero." -ForegroundColor Red
    exit 1
}

# ── 2. Instalar PM2 globalmente ──────────────────────────────────
Write-Host "[2/6] Instalando PM2 (gestor de procesos)..." -ForegroundColor Yellow
npm install -g pm2 2>&1 | Out-Null
$pm2Check = pm2 --version 2>&1
if ($LASTEXITCODE -eq 0) {
    Write-Host "      PM2 instalado: v$pm2Check" -ForegroundColor Green
} else {
    Write-Host "      ERROR: No se pudo instalar PM2." -ForegroundColor Red
    exit 1
}

# ── 3. Crear carpeta de logs ─────────────────────────────────────
Write-Host "[3/6] Creando carpeta de logs..." -ForegroundColor Yellow
$logsPath = "$AppPath\logs"
if (-not (Test-Path $logsPath)) {
    New-Item -ItemType Directory -Path $logsPath | Out-Null
}
Write-Host "      Logs en: $logsPath" -ForegroundColor Green

# ── 4. Iniciar la app con PM2 ────────────────────────────────────
Write-Host "[4/6] Iniciando GCM Tickets con PM2..." -ForegroundColor Yellow
Set-Location $AppPath

# Detener instancia previa si existe
pm2 delete gcm-tickets 2>&1 | Out-Null

# Iniciar con el ecosystem config
pm2 start ecosystem.config.js 2>&1
pm2 save 2>&1 | Out-Null

Write-Host "      App iniciada con PM2." -ForegroundColor Green

# ── 5. Configurar PM2 para arrancar con Windows (Task Scheduler) ──
Write-Host "[5/6] Configurando arranque automatico con Windows..." -ForegroundColor Yellow

$taskName = "PM2-GCM-Tickets"
$nodePath = (Get-Command node).Source
$pm2Path  = (Get-Command pm2 -ErrorAction SilentlyContinue).Source

if (-not $pm2Path) {
    # Buscar pm2.cmd en npm global
    $npmRoot = npm root -g 2>&1
    $pm2Path = "$((npm config get prefix 2>&1))\pm2.cmd"
}

# Crear tarea programada para que PM2 arranque al iniciar Windows
$action  = New-ScheduledTaskAction -Execute "cmd.exe" -Argument "/c `"pm2 resurrect`""
$trigger = New-ScheduledTaskTrigger -AtStartup
$settings = New-ScheduledTaskSettingsSet -ExecutionTimeLimit (New-TimeSpan -Minutes 5) -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 1)
$principal = New-ScheduledTaskPrincipal -UserId "SYSTEM" -LogonType ServiceAccount -RunLevel Highest

# Eliminar tarea anterior si existe
Unregister-ScheduledTask -TaskName $taskName -Confirm:$false -ErrorAction SilentlyContinue

Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Settings $settings -Principal $principal -Description "Inicia GCM Tickets al arrancar Windows" | Out-Null

Write-Host "      Tarea programada '$taskName' creada." -ForegroundColor Green

# ── 6. Abrir Puerto en Firewall de Windows ───────────────────────
Write-Host "[6/6] Abriendo puerto $AppPort en el Firewall de Windows..." -ForegroundColor Yellow

$ruleName = "GCM-Tickets-Puerto-$AppPort"

# Eliminar regla anterior si existe
Remove-NetFirewallRule -DisplayName $ruleName -ErrorAction SilentlyContinue

New-NetFirewallRule `
    -DisplayName $ruleName `
    -Direction Inbound `
    -Protocol TCP `
    -LocalPort $AppPort `
    -Action Allow `
    -Profile Any `
    -Description "Permite acceso externo a GCM Tickets en puerto $AppPort" | Out-Null

Write-Host "      Puerto $AppPort abierto en firewall." -ForegroundColor Green

# ── Verificar SQL Server ─────────────────────────────────────────
Write-Host ""
Write-Host "  Verificando SQL Server..." -ForegroundColor Yellow
$sqlServices = Get-Service | Where-Object { $_.Name -like "MSSQL*" -or $_.DisplayName -like "*SQL Server*" }

if ($sqlServices) {
    foreach ($svc in $sqlServices) {
        if ($svc.StartType -ne 'Automatic') {
            Set-Service -Name $svc.Name -StartupType Automatic
            Write-Host "      $($svc.DisplayName): configurado en Automatico" -ForegroundColor Green
        } else {
            Write-Host "      $($svc.DisplayName): ya esta en Automatico" -ForegroundColor Green
        }
        if ($svc.Status -ne 'Running') {
            Start-Service -Name $svc.Name
            Write-Host "      $($svc.DisplayName): iniciado" -ForegroundColor Green
        } else {
            Write-Host "      $($svc.DisplayName): ya esta ejecutandose" -ForegroundColor Green
        }
    }
} else {
    Write-Host "      ADVERTENCIA: No se encontro SQL Server instalado." -ForegroundColor Red
}

# ── Mostrar IPs disponibles ──────────────────────────────────────
Write-Host ""
Write-Host "================================================" -ForegroundColor Cyan
Write-Host "  CONFIGURACION COMPLETADA" -ForegroundColor Green
Write-Host "================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "  La app se iniciara automaticamente con Windows." -ForegroundColor White
Write-Host ""
Write-Host "  Acceso desde esta maquina:" -ForegroundColor White
Write-Host "    http://localhost:$AppPort/admin.html" -ForegroundColor Yellow
Write-Host ""
Write-Host "  Acceso desde la red local (IP de este servidor):" -ForegroundColor White

$ips = Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.IPAddress -ne "127.0.0.1" -and $_.PrefixOrigin -ne "WellKnown" }
foreach ($ip in $ips) {
    Write-Host "    http://$($ip.IPAddress):$AppPort/admin.html" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "  Estado de PM2 (procesos activos):" -ForegroundColor White
pm2 list
Write-Host ""
Write-Host "  Comandos utiles de PM2:" -ForegroundColor White
Write-Host "    pm2 logs gcm-tickets     <- Ver logs en tiempo real" -ForegroundColor Gray
Write-Host "    pm2 restart gcm-tickets  <- Reiniciar la app" -ForegroundColor Gray
Write-Host "    pm2 stop gcm-tickets     <- Detener la app" -ForegroundColor Gray
Write-Host "    pm2 monit               <- Monitor visual" -ForegroundColor Gray
Write-Host ""
Write-Host "================================================" -ForegroundColor Cyan
