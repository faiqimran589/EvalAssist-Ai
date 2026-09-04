$ErrorActionPreference = 'Continue'
$projectRoot = $PSScriptRoot

Write-Host "============================================" -ForegroundColor Cyan
Write-Host "  EvalAssist AI Platform - Mobile Mode" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""

# Ensure frontend\.env.local exists
$envLocalPath = Join-Path $projectRoot "frontend\.env.local"
if (-not (Test-Path $envLocalPath)) {
    Set-Content -Path $envLocalPath -Value "NEXT_PUBLIC_API_URL=http://localhost:8001/api/v1" -Encoding UTF8
}

# 1. Determine Python Executable
$pythonExe = Join-Path $projectRoot "backend\venv\Scripts\python.exe"
if (-not (Test-Path $pythonExe)) {
    $pythonExe = "python"
}

# 2. Determine cloudflared launcher
$cfCmd = "cloudflared"
try {
    $null = Get-Command "cloudflared" -ErrorAction Stop
} catch {
    Write-Host "[Info] 'cloudflared' binary not found in PATH, using 'npx -y cloudflared'..." -ForegroundColor Yellow
    $cfCmd = "npx"
}

# 3. Start Backend Execution
Write-Host "[1/4] Starting Backend Server (python run_backend.py)..." -ForegroundColor Cyan
Start-Process cmd -ArgumentList "/k", "cd /d `"$projectRoot`" && `"$pythonExe`" run_backend.py"

Start-Sleep -Seconds 3

# Helper function to start cloudflared and capture trycloudflare URL
function Get-CloudflaredUrl($port, $logFile) {
    if (Test-Path $logFile) { Remove-Item $logFile -Force }
    
    if ($cfCmd -eq "npx") {
        $proc = Start-Process cmd -ArgumentList "/c npx -y cloudflared tunnel --url http://localhost:$port" -RedirectStandardError $logFile -NoNewWindow -PassThru
    } else {
        $proc = Start-Process cloudflared -ArgumentList "tunnel --url http://localhost:$port" -RedirectStandardError $logFile -NoNewWindow -PassThru
    }
    
    $url = $null
    $timeout = 35
    $elapsed = 0
    while ($elapsed -lt $timeout) {
        Start-Sleep -Seconds 1
        $elapsed++
        if (Test-Path $logFile) {
            $content = Get-Content $logFile -Raw -ErrorAction SilentlyContinue
            if ($content -match 'https://[a-zA-Z0-9-]+\.trycloudflare\.com') {
                $url = $matches[0]
                break
            }
        }
    }
    return @{ Process = $proc; Url = $url }
}

# 4. Backend Tunnel & Environment Update
Write-Host "[2/4] Establishing Backend Cloudflare Tunnel..." -ForegroundColor Cyan
$tempBackendLog = [System.IO.Path]::GetTempFileName()
$backendTunnel = Get-CloudflaredUrl -port 8001 -logFile $tempBackendLog

if (-not $backendTunnel.Url) {
    Write-Host "ERROR: Failed to obtain Backend Cloudflare Tunnel URL within timeout." -ForegroundColor Red
    if (Test-Path $tempBackendLog) { Get-Content $tempBackendLog }
    Read-Host "Press Enter to exit..."
    return
}

$backendUrl = $backendTunnel.Url
Write-Host "Backend Tunnel URL: $backendUrl" -ForegroundColor Green

$apiUrl = "$backendUrl/api/v1"
Set-Content -Path $envLocalPath -Value "NEXT_PUBLIC_API_URL=$apiUrl" -Encoding UTF8
Write-Host "Updated frontend\.env.local with NEXT_PUBLIC_API_URL=$apiUrl" -ForegroundColor Yellow

# 5. Frontend Execution
Write-Host "[3/4] Starting Frontend Dev Server (npx next dev -H 0.0.0.0 -p 3001)..." -ForegroundColor Cyan
$frontendDir = Join-Path $projectRoot "frontend"
Start-Process cmd -ArgumentList "/k", "cd /d `"$frontendDir`" && npx next dev -H 0.0.0.0 -p 3001"

Start-Sleep -Seconds 5

# 6. Frontend Tunnel & Summary Display
Write-Host "[4/4] Establishing Frontend Cloudflare Tunnel..." -ForegroundColor Cyan
$tempFrontendLog = [System.IO.Path]::GetTempFileName()
$frontendTunnel = Get-CloudflaredUrl -port 3001 -logFile $tempFrontendLog

if (-not $frontendTunnel.Url) {
    Write-Host "ERROR: Failed to obtain Frontend Cloudflare Tunnel URL within timeout." -ForegroundColor Red
    if (Test-Path $tempFrontendLog) { Get-Content $tempFrontendLog }
    Read-Host "Press Enter to exit..."
    return
}

$frontendUrl = $frontendTunnel.Url

Write-Host ""
Write-Host "====================================================" -ForegroundColor Green
Write-Host "   EvalAssist Mobile Access Ready!" -ForegroundColor Green
Write-Host "   Local Frontend:  http://localhost:3001" -ForegroundColor White
Write-Host "   Mobile Web Link: $frontendUrl" -ForegroundColor Yellow
Write-Host "   Backend API:     $apiUrl" -ForegroundColor Gray
Write-Host "====================================================" -ForegroundColor Green
Write-Host ""
Write-Host "Open the Mobile Web Link on your mobile device to test." -ForegroundColor Cyan
Write-Host "Keep this window open to maintain the Cloudflare tunnels." -ForegroundColor Gray
Write-Host ""
Read-Host "Press Enter to stop tunnels and close launcher..."
