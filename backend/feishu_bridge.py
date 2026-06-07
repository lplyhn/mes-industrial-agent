"""
飞书 MES 智能助手 - 基于 WebSocket 事件订阅
无需公网回调地址，通过 WebSocket 长连接接收飞书消息
"""
import asyncio
import json
import logging
import os
import sys

import httpx
import websockets
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    stream=sys.stdout,
)
logger = logging.getLogger(__name__)

app = FastAPI(title="MES Feishu Bridge", version="3.0.0")

MES_GATEWAY = "http://localhost:8642/v1/chat/completions"
FEISHU_BASE = "https://open.feishu.cn/open-apis"

FEISHU_APP_ID = os.environ.get("FEISHU_APP_ID", "")
FEISHU_APP_SECRET = os.environ.get("FEISHU_APP_SECRET", "")

# Token 缓存
_token: dict = {"token": "", "expires_at": 0}


async def get_tenant_token() -> str:
    """获取 tenant_access_token"""
    import time
    now = time.time()
    if _token["token"] and now < _token["expires_at"] - 60:
        return _token["token"]
    if not FEISHU_APP_ID or not FEISHU_APP_SECRET:
        return ""
    async with httpx.AsyncClient(timeout=10) as c:
        r = await c.post(
            f"{FEISHU_BASE}/auth/v3/tenant_access_token/internal",
            json={"app_id": FEISHU_APP_ID, "app_secret": FEISHU_APP_SECRET},
        )
        d = r.json()
        if d.get("code") == 0:
            _token["token"] = d["tenant_access_token"]
            _token["expires_at"] = now + d.get("expire", 7200)
            return _token["token"]
        logger.error(f"Token error: {d}")
        return ""


async def register_ws() -> str:
    """注册 WebSocket 事件订阅，返回 WebSocket URL"""
    token = await get_tenant_token()
    if not token:
        return ""
    async with httpx.AsyncClient(timeout=10) as c:
        r = await c.post(
            f"{FEISHU_BASE}/ws/v1/ws/register_token",
            headers={"Authorization": f"Bearer {token}"},
        )
        d = r.json()
        if d.get("code") == 0:
            ws_url = d["data"]["ws_url"]
            logger.info(f"WS registered: {ws_url[:60]}...")
            return ws_url
        logger.error(f"WS register error: {d}")
        return ""


async def reply_message(message_id: str, text: str) -> bool:
    """通过飞书 API 回复消息"""
    token = await get_tenant_token()
    if not token:
        return False
    async with httpx.AsyncClient(timeout=10) as c:
        r = await c.post(
            f"{FEISHU_BASE}/im/v1/messages/{message_id}/reply",
            headers={
                "Authorization": f"Bearer {token}",
                "Content-Type": "application/json; charset=utf-8",
            },
            json={
                "content": json.dumps({"text": text}, ensure_ascii=False),
                "msg_type": "text",
            },
        )
        d = r.json()
        if d.get("code") == 0:
            return True
        logger.error(f"Reply error: {d}")
        return False


async def query_mes(text: str) -> str:
    """调用 MES 网关"""
    try:
        async with httpx.AsyncClient(timeout=30.0) as c:
            r = await c.post(
                MES_GATEWAY,
                json={
                    "model": "gpt-4o",
                    "messages": [
                        {"role": "system", "content": "你是一个 MES 工业智能助手，擅长回答工单、生产、质量、设备相关问题。用中文回答，简洁专业。"},
                        {"role": "user", "content": text},
                    ],
                    "stream": False,
                    "temperature": 0.3,
                    "max_tokens": 4096,
                },
            )
            r.raise_for_status()
            return r.json()["choices"][0]["message"]["content"]
    except Exception as e:
        logger.error(f"Gateway error: {e}")
        return f"抱歉，查询 MES 系统时出错: {e}"


# ===================== WebSocket 事件处理 =====================

async def handle_ws_event(data: dict):
    """处理飞书 WebSocket 推送的事件"""
    header = data.get("header", {})
    event_type = header.get("event_type", "")
    logger.info(f"WS event: {event_type}")

    if event_type == "im.message.receive_v1":
        event = data.get("event", {})
        message = event.get("message", {})
        msg_type = message.get("message_type", "") or message.get("msg_type", "")
        message_id = message.get("message_id", "")

        if msg_type != "text" or not message_id:
            return

        # 提取文本
        try:
            content = json.loads(message.get("content", "{}"))
            text = content.get("text", "")
        except (json.JSONDecodeError, TypeError):
            text = message.get("content", "")

        # 去掉 @机器人
        text = text.strip()
        if " " in text and text.startswith("@"):
            text = text.split(" ", 1)[1].strip()

        if not text:
            return

        logger.info(f"WS msg: {text}")

        # 查询 MES
        answer = await query_mes(text)

        # 回复
        ok = await reply_message(message_id, answer)
        logger.info(f"Reply to {message_id}: {'OK' if ok else 'FAILED'}")

    # 处理其他事件类型...


async def ws_event_loop():
    """WebSocket 主循环（自动重连）"""
    while True:
        try:
            ws_url = await register_ws()
            if not ws_url:
                logger.warning("WS register failed, retry in 30s")
                await asyncio.sleep(30)
                continue

            logger.info(f"Connecting WS: {ws_url[:60]}...")
            async with websockets.connect(ws_url, ping_interval=30) as ws:
                logger.info("WS connected!")
                while True:
                    raw = await ws.recv()
                    data = json.loads(raw)

                    # 处理事件
                    if "header" in data:
                        await handle_ws_event(data)
                    else:
                        # 心跳 / ack
                        logger.debug(f"WS msg: {json.dumps(data, ensure_ascii=False)[:100]}")

        except asyncio.CancelledError:
            logger.info("WS loop cancelled")
            break
        except Exception as e:
            logger.error(f"WS error: {e}, reconnect in 10s")
            await asyncio.sleep(10)


# ===================== HTTP API =====================

@app.get("/")
async def root():
    return {
        "service": "MES Feishu Bridge (WS mode)",
        "status": "running",
        "mode": "websocket",
        "has_app_id": bool(FEISHU_APP_ID),
    }


@app.get("/health")
@app.head("/health")
async def health():
    return {"status": "ok", "mode": "websocket"}


@app.on_event("startup")
async def startup():
    if FEISHU_APP_ID and FEISHU_APP_SECRET:
        asyncio.create_task(ws_event_loop())
        logger.info("WS event loop started")
    else:
        logger.warning("FEISHU_APP_ID not set, WS not started")


# 保留 webhook 端点作为备用（自定义机器人）
@app.post("/webhook")
@app.post("/webhook/event")
async def webhook_fallback(req: Request):
    """Webhook 备用入口（仅限自定义机器人）"""
    try:
        body = await req.json()
    except Exception:
        return JSONResponse({"msg": ""})

    if body.get("challenge"):
        return {"challenge": body["challenge"]}

    # 从事件或直接文本提取
    text = ""
    if body.get("msg_type") == "text":
        try:
            text = json.loads(body.get("content", "{}")).get("text", "")
        except Exception:
            text = body.get("content", "")
    elif "text" in body:
        text = body["text"]

    if not text:
        return JSONResponse({"msg": ""})

    if " " in text and text.startswith("@"):
        text = text.split(" ", 1)[1].strip()

    answer = await query_mes(text)
    return JSONResponse({
        "msg_type": "text",
        "content": json.dumps({"text": answer}, ensure_ascii=False),
    })


if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", "9000"))
    uvicorn.run(app, host="0.0.0.0", port=port)
