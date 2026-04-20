$proc = Get-NetTCPConnection -LocalPort 8765 -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess
if ($proc) {
    Write-Host "Killing process on 8765: $proc"
    Stop-Process -Id $proc -Force
} else {
    Write-Host "No process found on 8765"
}

Write-Host "Starting Uvicorn..."
Start-Process uvicorn -ArgumentList "backend.main:app", "--reload", "--port", "8765"
