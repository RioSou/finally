$ErrorActionPreference = "Stop"

$ContainerName = "finally"

Write-Host "Stopping FinAlly..."

$existingContainer = docker ps -a --format '{{.Names}}' | Where-Object { $_ -eq $ContainerName }
if ($existingContainer) {
    docker stop $ContainerName 2>$null | Out-Null
    docker rm $ContainerName 2>$null | Out-Null
    Write-Host "Container '$ContainerName' stopped and removed."
    Write-Host "Data volume 'finally-data' preserved (your portfolio data is safe)."
} else {
    Write-Host "Container '$ContainerName' is not running."
}
