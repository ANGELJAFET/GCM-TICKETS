# ================================================================
# backup.ps1  — Backup diario de BD + uploads
# Se ejecuta automaticamente via Task Scheduler (creado por setup-servidor.ps1)
# ================================================================

$BackupRoot = "C:\Backups\GCM-Tickets"
$AppUploads = "C:\Users\Administrador\SistemaApp\api\uploads"
$EnvFile    = "C:\Users\Administrador\SistemaApp\api\.env"
$Date       = Get-Date -Format "yyyy-MM-dd"
$BackupDir  = "$BackupRoot\$Date"
$KeepDays   = 7

# Lee DB_USER / DB_PASSWORD de api\.env — nunca hardcodear credenciales aqui
$envVars = @{}
if (Test-Path $EnvFile) {
    Get-Content $EnvFile | ForEach-Object {
        if ($_ -match '^\s*([A-Z_]+)\s*=\s*(.*)\s*$') {
            $envVars[$matches[1]] = $matches[2]
        }
    }
}
$DbUser = if ($envVars.DB_USER) { $envVars.DB_USER } else { "sa" }
$DbPass = $envVars.DB_PASSWORD
if (-not $DbPass) {
    Write-Host "$(Get-Date -Format 'HH:mm:ss') ERROR: No se encontro DB_PASSWORD en $EnvFile" -ForegroundColor Red
    exit 1
}

# Crear carpeta del dia
New-Item -ItemType Directory -Force -Path $BackupDir | Out-Null

# ── 1. Backup SQL Server ─────────────────────────────────────────
$sqlBackup = "$BackupDir\gcm_tickets_$Date.bak"
$sqlQuery  = "BACKUP DATABASE [gcm_tickets] TO DISK = N'$sqlBackup' WITH NOFORMAT, NOINIT, COMPRESSION, STATS = 10"

sqlcmd -S localhost -U $DbUser -P $DbPass -Q $sqlQuery -C 2>&1 | Out-Null

if (Test-Path $sqlBackup) {
    $size = [math]::Round((Get-Item $sqlBackup).Length / 1MB, 1)
    Write-Host "$(Get-Date -Format 'HH:mm:ss') BD backup OK: $sqlBackup ($size MB)" -ForegroundColor Green
} else {
    Write-Host "$(Get-Date -Format 'HH:mm:ss') ERROR: Backup de BD fallido." -ForegroundColor Red
}

# ── 2. Backup de uploads (archivos/imagenes) ─────────────────────
if (Test-Path $AppUploads) {
    $uploadsZip = "$BackupDir\uploads_$Date.zip"
    Compress-Archive -Path $AppUploads -DestinationPath $uploadsZip -Force
    $size = [math]::Round((Get-Item $uploadsZip).Length / 1MB, 1)
    Write-Host "$(Get-Date -Format 'HH:mm:ss') Uploads backup OK: $uploadsZip ($size MB)" -ForegroundColor Green
}

# ── 3. Eliminar backups mas viejos de $KeepDays dias ────────────
$cutoff = (Get-Date).AddDays(-$KeepDays)
Get-ChildItem $BackupRoot -Directory | Where-Object { $_.CreationTime -lt $cutoff } | ForEach-Object {
    Remove-Item $_.FullName -Recurse -Force
    Write-Host "$(Get-Date -Format 'HH:mm:ss') Backup antiguo eliminado: $($_.Name)" -ForegroundColor Gray
}

Write-Host "$(Get-Date -Format 'HH:mm:ss') Backup completado. Guardado en: $BackupDir" -ForegroundColor Cyan
