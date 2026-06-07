# MES 工业智能助手

基于 Hermes Agent + MCP 的智能生产助手，支持自然语言查询工单、生产、质量和设备信息。

## 架构

```
用户界面     Agent 层        工具层         数据层
+---------+   +-----------+   +----------+   +----------+
| React   |-->| Hermes    |-->| MCP      |-->| FastAPI  |
| 前端    |   | Agent     |   | Server   |   | Mock MES |
| :5175   |<--| Gateway   |<--| :8001/mcp|<--| :8000    |
+---------+   +-----------+   +----------+   +----------+
```

## 项目结构

```
mes-industrial-agent/
├── backend/           # FastAPI Mock MES + Gateway + Feishu Bridge
│   ├── gateway.py     # OpenAI 兼容的 SSE 流式网关
│   ├── main.py        # Mock MES 数据 API
│   └── feishu_bridge.py  # 飞书 WebSocket 对接
├── frontend/          # React + Vite + TypeScript
│   └── src/
│       ├── components/  # ChatPanel, TracePanel, ResultRenderer
│       ├── hooks/       # useSSE 流式 SSE Hook
│       └── services/    # Hermes API 客户端
├── mcp-server/        # MCP Server (5 个 MES 工具)
│   └── server.py
├── skills/            # Hermes Agent Skills
│   ├── mes_workorder.md
│   ├── mes_production.md
│   ├── mes_quality.md
│   ├── mes_equipment.md
│   └── mes_daily_report.md
├── config/            # Hermes 配置
└── scripts/           # 启动脚本
```

## 快速启动

### 1. 启动 Mock MES API

```bash
python -m uvicorn backend.main:app --host 0.0.0.0 --port 8000
```

### 2. 启动 MCP Server

```bash
# stdio 模式 (默认)
python mcp-server/server.py

# 或 HTTP 模式
python mcp-server/server.py --http --port 8001
```

### 3. 启动 Hermes Gateway

```bash
# 需要先配置 hermes_config.yaml 中的 API Key
hermes serve --config config/hermes_config.yaml
```

### 4. 启动前端

```bash
cd frontend
npm install
npm run dev
```

访问 http://localhost:5175

## 功能

- **工单查询**：查询工单状态、完成率、延期情况
- **生产查询**：查产量、OEE、达成率
- **质量分析**：不良率、缺陷分布、风险等级
- **设备诊断**：设备状态、报警信息
- **日报生成**：一键生成生产日报

## 飞书接入

项目支持通过 WebSocket 接入飞书，无需公网回调地址：

```bash
# 配置飞书 App ID / Secret
set FEISHU_APP_ID=cli_xxxxx
set FEISHU_APP_SECRET=xxxxx

# 启动飞书桥接服务
python -m uvicorn backend.feishu_bridge:app --host 0.0.0.0 --port 9000
```

## 连接 Cherry Studio

在 Cherry Studio 中添加 MCP 服务器：

- **类型**：stdio
- **命令**：`python`
- **参数**：`D:\path\to\mes-industrial-agent\mcp-server\server.py`

## 技术栈

- **前端**：React 18 + Vite + TypeScript + Recharts
- **后端**：FastAPI + Uvicorn + SSE
- **Agent**：Hermes Agent + MCP Protocol
- **AI 模型**：DeepSeek V4
