# 启动 MCP Server
Write-Host "Starting MCP Server on port 8001..." -ForegroundColor Green
python -m mcp_server.server
# 或使用 MCP CLI:
# mcp run server.py --port 8001
