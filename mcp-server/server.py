# MCP Server - MES 业务工具层
# 将后端 API 封装为 MCP 工具，供 Hermes Agent 调用
# 包含 5 个核心工具：工单查询、生产查询、质量分析、设备诊断、日报生成

import json
import httpx
from mcp.server.fastmcp import FastMCP

mcp = FastMCP("mes", port=8001)

MES_API_BASE = "http://localhost:8000"


async def _get(endpoint: str, params: dict = None) -> list:
    """调用后端 MES API"""
    async with httpx.AsyncClient(timeout=10.0) as client:
        resp = await client.get(f"{MES_API_BASE}{endpoint}", params=params)
        resp.raise_for_status()
        return resp.json()


@mcp.tool()
async def mcp_mes_query_workorders(
    status: str | None = None,
    line: str | None = None,
    date: str | None = None,
) -> str:
    """查询 MES 工单，返回结构化业务摘要。
    可用于回答：今日未完成工单有哪些、某产线工单状态、延期工单等。
    """
    params = {}
    if status:
        params["status"] = status
    if line:
        params["line"] = line
    if date:
        params["date"] = date

    data = await _get("/api/workorders", params)

    total = len(data)
    completed = sum(1 for item in data if item["status"] == "completed")
    running = sum(1 for item in data if item["status"] == "running")
    delayed = sum(1 for item in data if item["status"] == "delayed")

    result = {
        "items": data,
        "summary": {
            "total": total,
            "completed": completed,
            "running": running,
            "delayed": delayed,
            "completion_rate": round(completed / total * 100, 2) if total else 0,
        },
        "risk_summary": (
            "存在延期工单，建议优先关注瓶颈产线" if delayed else "未发现明显工单延期风险"
        ),
    }
    return json.dumps(result, ensure_ascii=False)


@mcp.tool()
async def mcp_mes_query_production(
    line: str | None = None,
    hours: int = 24,
) -> str:
    """查询 MES 生产数据，返回产量、OEE、异常时段分析。
    可用于回答：产量达标情况、OEE 表现、哪些时段的产能低于目标。
    """
    params = {"hours": hours}
    if line:
        params["line"] = line

    data = await _get("/api/production", params)

    if not data:
        return json.dumps({"error": "未找到生产数据"}, ensure_ascii=False)

    total_output = sum(item["output"] for item in data)
    total_target = sum(item["target"] for item in data)
    avg_oee = round(sum(item["oee"] for item in data) / len(data), 2) if data else 0
    achievement_rate = round(total_output / total_target * 100, 2) if total_target else 0

    # 查找异常时段（OEE < 0.70 视为异常）
    abnormal_periods = [
        {"hour": item["hour"], "line": item["line"], "oee": item["oee"]}
        for item in data if item["oee"] < 0.70
    ]

    result = {
        "items": data,
        "summary": {
            "total_output": total_output,
            "total_target": total_target,
            "achievement_rate": achievement_rate,
            "avg_oee": avg_oee,
            "abnormal_period_count": len(abnormal_periods),
        },
        "abnormal_periods": abnormal_periods,
        "risk_summary": (
            f"发现 {len(abnormal_periods)} 个异常时段，主要集中在 "
            + ", ".join([p["hour"] for p in abnormal_periods[:5]])
            if abnormal_periods else "所有时段 OEE 正常"
        ),
    }
    return json.dumps(result, ensure_ascii=False)


@mcp.tool()
async def mcp_mes_analyze_quality(
    line: str | None = None,
    hours: int = 24,
) -> str:
    """分析 MES 质量数据，返回不良率、风险等级、缺陷分布和趋势风险。
    可用于回答：某产线质量是否异常、不良率是否超标、主要缺陷类型。
    """
    params = {"hours": hours}
    if line:
        params["line"] = line

    data = await _get("/api/quality", params)

    if not data:
        return json.dumps({"error": "未找到质量数据"}, ensure_ascii=False)

    total_sample = sum(item["sample_size"] for item in data)
    total_defect = sum(item["defect_count"] for item in data)
    defect_rate = round(total_defect / total_sample * 100, 2) if total_sample else 0

    # 风险等级判定（确定性阈值）
    risk_level = "normal"
    if defect_rate > 8:
        risk_level = "critical"
    elif defect_rate > 5:
        risk_level = "warning"

    # 缺陷分布
    defect_types = {}
    for item in data:
        dt = item["defect_type"]
        defect_types[dt] = defect_types.get(dt, 0) + item["defect_count"]
    total_defect_count = sum(defect_types.values()) or 1
    defect_distribution = {
        k: {"count": v, "percentage": round(v / total_defect_count * 100, 2)}
        for k, v in sorted(defect_types.items(), key=lambda x: -x[1])
    }

    # 趋势风险（最近 3 小时不良率是否连续上升）
    sorted_data = sorted(data, key=lambda x: x["hour"])
    recent_3 = sorted_data[-3:] if len(sorted_data) >= 3 else sorted_data
    rates = []
    for item in recent_3:
        rate = round(item["defect_count"] / max(item["sample_size"], 1) * 100, 2)
        rates.append(rate)
    trend_risk = len(rates) >= 3 and rates[0] < rates[1] < rates[2]

    # 主导缺陷
    dominant_defect = max(defect_distribution.items(), key=lambda x: x[1]["count"])[0] if defect_distribution else None

    result = {
        "items": data,
        "summary": {
            "total_sample": total_sample,
            "total_defect": total_defect,
            "defect_rate": defect_rate,
            "risk_level": risk_level,
        },
        "defect_distribution": defect_distribution,
        "trend_risk": trend_risk,
        "dominant_defect": dominant_defect,
        "analysis": (
            f"不良率 {defect_rate}%，风险等级: {risk_level}。"
            + (f"主导缺陷: {dominant_defect}。" if dominant_defect else "")
            + ("最近 3 小时不良率连续上升，存在恶化趋势！" if trend_risk else "")
        ),
    }
    return json.dumps(result, ensure_ascii=False)


@mcp.tool()
async def mcp_mes_diagnose_equipment(
    line: str | None = None,
    status: str | None = None,
) -> str:
    """诊断 MES 设备状态，返回报警设备列表和影响分析。
    可用于回答：当前有哪些报警设备、设备状态、故障影响。
    """
    params = {}
    if line:
        params["line"] = line
    if status:
        params["status"] = status

    data = await _get("/api/equipment", params)

    if not data:
        return json.dumps({"error": "未找到设备数据"}, ensure_ascii=False)

    alarm_devices = [d for d in data if d["status"] == "alarm"]
    maintenance_devices = [d for d in data if d["status"] == "maintenance"]

    # 影响分析
    impact_analysis = []
    for d in alarm_devices:
        impact = (
            f"{d['id']}({d['line']}线) 报警码 {d['alarm_code']}"
            + (f"，当前温度 {d['temperature']}°C" if d.get('temperature') else "")
        )
        impact_analysis.append(impact)

    result = {
        "items": data,
        "summary": {
            "total": len(data),
            "running": sum(1 for d in data if d["status"] == "running"),
            "alarm": len(alarm_devices),
            "maintenance": len(maintenance_devices),
        },
        "alarm_devices": [
            {"id": d["id"], "line": d["line"], "alarm_code": d["alarm_code"], "temperature": d.get("temperature")}
            for d in alarm_devices
        ],
        "impact_analysis": impact_analysis,
        "suggestion": (
            "建议优先排查报警设备并检查关联产线质量数据" if alarm_devices else "未发现设备报警"
        ),
    }
    return json.dumps(result, ensure_ascii=False)


@mcp.tool()
async def mcp_mes_generate_daily_report(
    date: str | None = None,
) -> str:
    """生成今日生产日报数据包，聚合工单、生产、质量、设备分析结果。
    MCP 工具仅返回结构化 JSON，由 LLM 生成 Markdown 日报。
    """
    # 并行调用四类数据
    import asyncio

    async def fetch_all():
        async with httpx.AsyncClient(timeout=15.0) as client:
            wos = await client.get(f"{MES_API_BASE}/api/workorders", params={"date": date} if date else {})
            prods = await client.get(f"{MES_API_BASE}/api/production", params={"hours": 24})
            quals = await client.get(f"{MES_API_BASE}/api/quality", params={"hours": 24})
            eqs = await client.get(f"{MES_API_BASE}/api/equipment")
            return {
                "workorders": wos.json() if wos.status_code == 200 else [],
                "production": prods.json() if prods.status_code == 200 else [],
                "quality": quals.json() if quals.status_code == 200 else [],
                "equipment": eqs.json() if eqs.status_code == 200 else [],
            }
    
    raw = await fetch_all()

    # 精简摘要
    wos = raw["workorders"]
    prods = raw["production"]
    quals = raw["quality"]
    eqs = raw["equipment"]

    report_data = {
        "date": date or "今日",
        "workorders": {
            "total": len(wos),
            "completed": sum(1 for w in wos if w["status"] == "completed"),
            "delayed": sum(1 for w in wos if w["status"] == "delayed"),
            "running": sum(1 for w in wos if w["status"] == "running"),
            "completion_rate": round(sum(1 for w in wos if w["status"] == "completed") / max(len(wos), 1) * 100, 2),
        },
        "production": {
            "total_output": sum(p["output"] for p in prods),
            "avg_oee": round(sum(p["oee"] for p in prods) / max(len(prods), 1), 2),
            "abnormal_hours": [{"hour": p["hour"], "line": p["line"], "oee": p["oee"]} for p in prods if p["oee"] < 0.70],
        },
        "quality": {
            "total_sample": sum(q["sample_size"] for q in quals),
            "total_defect": sum(q["defect_count"] for q in quals),
            "defect_rate": round(sum(q["defect_count"] for q in quals) / max(sum(q["sample_size"] for q in quals), 1) * 100, 2),
        },
        "equipment": {
            "total": len(eqs),
            "alarm": sum(1 for e in eqs if e["status"] == "alarm"),
            "maintenance": sum(1 for e in eqs if e["status"] == "maintenance"),
            "alarm_devices": [e["id"] for e in eqs if e["status"] == "alarm"],
        },
        "report_requirement": "请基于以上数据生成 Markdown 格式生产日报，包括：1) 总览结论 2) 工单执行情况 3) 产量与 OEE 表现 4) 质量风险分析 5) 设备报警与影响 6) 下一步建议",
    }

    return json.dumps(report_data, ensure_ascii=False)


if __name__ == "__main__":
    import sys

    if "--http" in sys.argv:
        app = mcp.streamable_http_app()
        import uvicorn
        port = 8001
        for i, arg in enumerate(sys.argv):
            if arg == "--port" and i + 1 < len(sys.argv):
                port = int(sys.argv[i + 1])
        uvicorn.run(app, host="0.0.0.0", port=port)
    else:
        mcp.run(transport="stdio")

