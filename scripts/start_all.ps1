# 启动所有服务（开发模式）
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  MES 工业智能助手 - 开发环境启动脚本" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# 启动后端
$backendJob = Start-Job -ScriptBlock {
    Set-Location $using:PWD
    uvicorn backend.main:app --host 0.0.0.0 --port 8000 --reload
}
Write-Host "[1/3] MES Mock API started (port 8000)" -ForegroundColor Green

Start-Sleep -Seconds 1

# 启动 MCP Server
$mcpJob = Start-Job -ScriptBlock {
    Set-Location $using:PWD
    python -c "import sys; sys.path.insert(0, '.'); exec(open('mcp-server/server.py').read())"
}
Write-Host "[2/3] MCP Server started (port 8001)" -ForegroundColor Green

Start-Sleep -Seconds 1

# 启动前端
$frontendJob = Start-Job -ScriptBlock {
    Set-Location (Join-Path $using:PWD "frontend")
    npm run dev
}
Write-Host "[3/3] Frontend started (port 5174)" -ForegroundColor Green

Write-Host ""
Write-Host "Services:" -ForegroundColor Cyan
Write-Host "  Backend API:  http://localhost:8000"
Write-Host "  MCP Server:   http://localhost:8001/mcp"
Write-Host "  Frontend:     http://localhost:5174"
Write-Host "  Hermes:       http://localhost:8642"
Write-Host ""
Write-Host "Press Ctrl+C to stop all services" -ForegroundColor Yellow

# 等待
while ($true) {
    Start-Sleep -Seconds 1
    $running = @($backendJob, $mcpJob, $frontendJob) | Where-Object { $_.State -eq "Running" }
    if ($running.Count -lt 3) {
        Write-Host "A service has stopped. Exiting..." -ForegroundColor Red
        $backendJob, $mcpJob, $frontendJob | Where-Object { $_.State -eq "Running" } | Stop-Job
        break
    }
}

$backendJob, $mcpJob, $frontendJob | Receive-Job
