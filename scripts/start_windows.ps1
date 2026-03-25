$ErrorActionPreference = "Stop"

$ImageName = "finally"
$ContainerName = "finally"
$Port = 8000
$VolumeName = "finally-data"
$EnvFile = ".env"

# Move to project root (parent of scripts/)
Set-Location (Split-Path -Parent $PSScriptRoot)

# Check for .env file
if (-not (Test-Path $EnvFile)) {
    Write-Host "Error: $EnvFile not found." -ForegroundColor Red
    Write-Host "Copy .env.example to .env and fill in your API keys:"
    Write-Host "  Copy-Item .env.example .env"
    exit 1
}

# Build image if --build flag passed or image doesn't exist
$existingImage = docker images -q $ImageName 2>$null
if ($args -contains "--build" -or -not $existingImage) {
    Write-Host "Building Docker image '$ImageName'..."
    docker build -t $ImageName .
}

# Stop and remove existing container if running
$existingContainer = docker ps -a --format '{{.Names}}' | Where-Object { $_ -eq $ContainerName }
if ($existingContainer) {
    Write-Host "Stopping existing container '$ContainerName'..."
    docker stop $ContainerName 2>$null | Out-Null
    docker rm $ContainerName 2>$null | Out-Null
}

# Run the container
Write-Host "Starting FinAlly..."
docker run -d `
    --name $ContainerName `
    -v "${VolumeName}:/app/db" `
    -p "${Port}:${Port}" `
    --env-file $EnvFile `
    $ImageName

# Wait for health check (max 30 seconds)
Write-Host "Waiting for server to be ready..."
for ($i = 1; $i -le 30; $i++) {
    try {
        $response = Invoke-WebRequest -Uri "http://localhost:$Port/api/health" -UseBasicParsing -TimeoutSec 2 -ErrorAction SilentlyContinue
        if ($response.StatusCode -eq 200) {
            Write-Host "FinAlly is running at http://localhost:$Port" -ForegroundColor Green
            Start-Process "http://localhost:$Port"
            exit 0
        }
    } catch {
        # Server not ready yet
    }
    Start-Sleep -Seconds 1
}

Write-Host "Warning: Server did not respond within 30 seconds." -ForegroundColor Yellow
Write-Host "Check logs with: docker logs $ContainerName"
exit 1
