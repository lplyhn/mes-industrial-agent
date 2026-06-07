# 启动 MES Mock API
Write-Host "Starting MES Mock API on port 8000..." -ForegroundColor Green
uvicorn backend.main:app --host 0.0.0.0 --port 8000 --reload
