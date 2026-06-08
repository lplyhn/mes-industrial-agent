import json, asyncio, httpx, uuid

from fastapi import FastAPI

from fastapi.responses import StreamingResponse

from fastapi.middleware.cors import CORSMiddleware

from pydantic import BaseModel

from typing import Optional



app = FastAPI()

app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_credentials=True, allow_methods=["*"], allow_headers=["*"])




# AI analysis config
ANALYSIS_API_KEY = "sk-83d9f6fa7b8442ddbb484da6460179ba"
ANALYSIS_BASE_URL = "https://api.deepseek.com"
ANALYSIS_MODEL = "deepseek-v4-flash"

API_BASE = "http://localhost:8000"



class ChatReq(BaseModel):

    model: Optional[str] = "gpt-4o"

    messages: list[dict]

    stream: Optional[bool] = True

    temperature: Optional[float] = 0.3

    max_tokens: Optional[int] = 4096



async def get_json(url: str, params: dict = None) -> list:

    async with httpx.AsyncClient(timeout=10.0) as c:

        r = await c.get(f"{API_BASE}{url}", params=params)

        r.raise_for_status()

        return r.json()



def detect(msg: str) -> list[str]:

    m = msg.lower()

    if any(k in m for k in ["日报","report","daily","总结","概览"]): return ["daily_report"]

    if any(k in m for k in ["质量","不良","缺陷","quality","defect"]): return ["quality"]

    if any(k in m for k in ["设备","报警","故障","equipment","alarm"]): return ["equipment"]

    if any(k in m for k in ["产量","oee","产能","生产","production"]): return ["production"]

    if any(k in m for k in ["工单","work","order","完成","延期","未完成"]): return ["workorders"]

    if "oee" in m: return ["workorders","production","quality","equipment"]

    return ["workorders"]



def get_line(msg: str) -> str:

    for l in ["a","b","c"]:

        if f"{l}线" in msg.lower(): return l.upper()

    return ""



def line_param(msg, intent):

    line = get_line(msg)

    p = {}

    if line: p["line"] = line

    if intent=="production": p["hours"]=24

    if intent=="quality": p["hours"]=24

    return p



API_ENDPOINTS = {

    "workorders": "/api/workorders",

    "production": "/api/production",

    "quality": "/api/quality",

    "equipment": "/api/equipment",

}



async def fetch_data(intents, msg):

    results = []

    for intent in intents:

        if intent == "daily_report":

            wos = await get_json("/api/workorders")

            prods = await get_json("/api/production", {"hours":24})

            quals = await get_json("/api/quality", {"hours":24})

            eqs = await get_json("/api/equipment")

            results.append({"intent":"daily_report","data":{"workorders":wos,"production":prods,"quality":quals,"equipment":eqs}})

        elif intent in API_ENDPOINTS:

            params = line_param(msg, intent)

            if intent=="workorders" and any(k in msg.lower() for k in ["延期","delayed"]): params["status"]="delayed"

            if intent=="workorders" and any(k in msg.lower() for k in ["running"]): params["status"]="running"

            if intent=="equipment" and any(k in msg.lower() for k in ["报警","alarm"]): params["status"]="alarm"

            data = await get_json(API_ENDPOINTS[intent], params)

            results.append({"intent":intent,"data":data})

    return results



def fmt_wo(items):

    total=len(items); comp=sum(1 for w in items if w["status"]=="completed"); delayed=sum(1 for w in items if w["status"]=="delayed")

    run=sum(1 for w in items if w["status"]=="running")

    rate=round(comp/total*100,2) if total else 0

    lines=["## 工单执行",f"- 总工单：{total} | 已完成：{comp} | 进行中：{run} | 延期：{delayed}",f"- 完成率：{rate}%"]

    if items:

        lines.append("\n| ID | 产线 | 状态 | 计划 | 完成 |")

        lines.append("|---|---|---|---|---|")

        for it in items[:5]: lines.append(f"| {it['id']} | {it['line']}线 | {it['status']} | {it['planned_qty']} | {it['completed_qty']} |")

    if delayed: lines.append("\n?? 存在延期工单，建议优先关注瓶颈产线")

    return "\n".join(lines)



def fmt_prod(items):

    total_o=sum(i["output"] for i in items); total_t=sum(i["target"] for i in items)

    avg_oee=round(sum(i["oee"] for i in items)/len(items),2) if items else 0

    rate=round(total_o/total_t*100,2) if total_t else 0

    abnormal=[i for i in items if i["oee"]<0.70]

    lines=["## 生产指标",f"- 总产量：{total_o} | 达成率：{rate}% | 平均OEE：{avg_oee}"]

    if abnormal:

        lines.append(f"- 异常时段(OEE<0.70)：{len(abnormal)}个")

        for p in abnormal[:3]: lines.append(f"  - {p['hour']} {p['line']}线 OEE={p['oee']}")

    return "\n".join(lines)



def fmt_qual(items):

    total_s=sum(i["sample_size"] for i in items); total_d=sum(i["defect_count"] for i in items)

    rate=round(total_d/total_s*100,2) if total_s else 0

    risk="normal"; icon="?"

    if rate>8: risk="critical"; icon="??"

    elif rate>5: risk="warning"; icon="??"

    types={}

    for i in items:

        dt=i["defect_type"]; types[dt]=types.get(dt,0)+i["defect_count"]

    total=sum(types.values()) or 1

    dominant=max(types,key=types.get) if types else None

    lines=[f"## 质量分析 {icon}",f"- 不良率：{rate}% | 风险等级：{risk}"]

    if dominant: lines.append(f"- 主导缺陷：{dominant}")

    if types: lines.extend(["\n缺陷分布："]+[f"- {t}: {c}个 ({round(c/total*100,2)}%)" for t,c in sorted(types.items(),key=lambda x:-x[1])])

    return "\n".join(lines)



def fmt_eq(items):

    alarm_d=[i for i in items if i["status"]=="alarm"]; maint_d=[i for i in items if i["status"]=="maintenance"]

    run_d=[i for i in items if i["status"]=="running"]

    lines=["## 设备状态",f"- 总设备：{len(items)} | 运行：{len(run_d)} | 报警：{len(alarm_d)} | 维修：{len(maint_d)}"]

    for d in alarm_d:

        t=f" 温度：{d['temperature']}°C" if d.get("temperature") else ""

        lines.append(f"- {d['id']}({d['line']}线) 报警码：{d['alarm_code']}{t}")

    if alarm_d: lines.append("\n建议优先排查报警设备并检查关联产线质量数据")

    return "\n".join(lines)



def fmt_dr(data):

    w=data["workorders"]; p=data["production"]; q=data["quality"]; e=data["equipment"]

    comp=sum(1 for x in w if x["status"]=="completed"); delayed=sum(1 for x in w if x["status"]=="delayed")

    rate=round(comp/len(w)*100,2) if w else 0

    total_o=sum(x["output"] for x in p); avg_oee=round(sum(x["oee"] for x in p)/len(p),2) if p else 0

    qr=round(sum(x["defect_count"] for x in q)/max(sum(x["sample_size"] for x in q),1)*100,2) if q else 0

    alarm=sum(1 for x in e if x["status"]=="alarm")

    lines=["## 生产日报\n---",f"### 工单执行\n- 总工单：{len(w)} | 完成：{comp} | 延期：{delayed} | 完成率：{rate}%"]

    lines.append(f"\n### 产量与OEE\n- 总产量：{total_o} | 平均OEE：{avg_oee}")

    lines.append(f"\n### 质量风险\n- 不良率：{qr}%")

    if alarm>0: lines.append(f"\n### 设备报警\n- {alarm}个设备报警")

    lines.append("\n### 下一步建议\n- 请根据以上数据制定改进措施")

    return "\n".join(lines)



async def stream_resp(text: str, intents: list, results: list):



    for r in results[:3]:

        intent=r["intent"]

        d=r["data"]

        tool_name=f"mcp_mes_{intent}" if intent!="daily_report" else "mcp_mes_generate_daily_report"



        preview = "OK"

        if isinstance(d, list):

            # Extract summary from item list based on intent

            if intent == "production":

                total_o=sum(x.get("output",0) for x in d)

                total_t=sum(x.get("target",0) for x in d)

                avg_oee=round(sum(x.get("oee",0) for x in d)/max(len(d),1),2)

                ar=round(total_o/max(total_t,1)*100,2)

                preview = json.dumps({"items":d,"total":len(d),"total_output":total_o,"avg_oee":avg_oee,"achievement_rate":ar},ensure_ascii=False)

            elif intent == "equipment":

                alarm=sum(1 for x in d if x.get("status")=="alarm")

                maint=sum(1 for x in d if x.get("status")=="maintenance")

                running=sum(1 for x in d if x.get("status")=="running")

                alarm_devices=[{"id":x["id"],"alarm_code":x.get("alarm_code"),"temperature":x.get("temperature")} for x in d if x.get("status")=="alarm"]

                preview = json.dumps({"items":d[:3],"total":len(d),"alarm":alarm,"maintenance":maint,"running":running,"alarm_devices":alarm_devices},ensure_ascii=False)

            elif intent == "quality":

                total_s=sum(x.get("sample_size",0) for x in d)

                total_d=sum(x.get("defect_count",0) for x in d)

                qr=round(total_d/max(total_s,1)*100,2) if total_s else 0

                risk="critical" if qr>8 else "warning" if qr>5 else "normal"

                # compute defect distribution

                from collections import Counter

                defect_counter = Counter()

                total_defects = 0

                for item in d:

                    dt = item.get("defect_type","unknown")

                    cnt = item.get("defect_count",0)

                    defect_counter[dt] += cnt

                    total_defects += cnt

                total_defects = max(total_defects,1)

                defect_dist = {k:{"count":v,"percentage":round(v/total_defects*100,2)} for k,v in defect_counter.most_common()}

                dominant = defect_counter.most_common(1)[0][0] if defect_counter else None

                preview = json.dumps({"items":d[:3],"total":len(d),"defect_rate":qr,"risk_level":risk,"defect_distribution":defect_dist,"dominant_defect":dominant},ensure_ascii=False)

            elif intent == "production":

                total_o=sum(x.get("output",0) for x in d)

                total_t=sum(x.get("target",0) for x in d)

                avg_oee=round(sum(x.get("oee",0) for x in d)/max(len(d),1),2)

                ar=round(total_o/max(total_t,1)*100,2)

                preview = json.dumps({"items":d[:3],"total":len(d),"total_output":total_o,"avg_oee":avg_oee,"achievement_rate":ar},ensure_ascii=False)

            else:

                preview = json.dumps({"items":d[:3],"total":len(d)},ensure_ascii=False)

        elif isinstance(d, dict):

            # Daily report bundle - pass through full data

            if "workorders" in d and "production" in d and "quality" in d:

                w=d["workorders"]; p=d["production"]; q=d["quality"]; e=d.get("equipment",[])

                preview_data = {

                    "workorders": {"items":w[:5],"total":len(w),"completed":sum(1 for x in w if x["status"]=="completed"),"delayed":sum(1 for x in w if x["status"]=="delayed")},

                    "production": {"items":p,"total":len(p),"total_output":sum(x["output"] for x in p),"avg_oee":round(sum(x["oee"] for x in p)/max(len(p),1),2),"achievement_rate":round(sum(x["output"] for x in p)/max(sum(x["target"] for x in p),1)*100,2)},

                    "quality": {"items":q[:10],"total":len(q),"defect_rate":round(sum(x["defect_count"] for x in q)/max(sum(x["sample_size"] for x in q),1)*100,2) if q else 0,"risk_level":"critical" if (round(sum(x["defect_count"] for x in q)/max(sum(x["sample_size"] for x in q),1)*100,2) if q else 0)>8 else "warning" if (round(sum(x["defect_count"] for x in q)/max(sum(x["sample_size"] for x in q),1)*100,2) if q else 0)>5 else "normal","defect_distribution":{dt:{"count":sum(item["defect_count"] for item in q if item["defect_type"]==dt),"percentage":round(sum(item["defect_count"] for item in q if item["defect_type"]==dt)/max(sum(x["defect_count"] for x in q),1)*100,2)} for dt in set(x["defect_type"] for x in q)} if q else {}},

                    "equipment": {"items":e[:10],"total":len(e),"alarm":sum(1 for x in e if x["status"]=="alarm"),"maintenance":sum(1 for x in e if x["status"]=="maintenance"),"running":sum(1 for x in e if x["status"]=="running"),"alarm_devices":[{"id":x["id"],"alarm_code":x.get("alarm_code"),"temperature":x.get("temperature")} for x in e if x.get("status")=="alarm"]},

                }

                preview = json.dumps(preview_data, ensure_ascii=False)

            elif "workorders" in d:

                w=d["workorders"]

                summary={"total":len(w),"completed":sum(1 for x in w if x["status"]=="completed"),"delayed":sum(1 for x in w if x["status"]=="delayed"),"completion_rate":round(sum(1 for x in w if x["status"]=="completed")/max(len(w),1)*100,2)}

            elif "production" in d:

                p=d["production"]

                summary={"items":p,"total_output":sum(x["output"] for x in p),"avg_oee":round(sum(x["oee"] for x in p)/len(p),2) if p else 0}

            elif "quality" in d:

                q=d["quality"]

                qr=round(sum(x["defect_count"] for x in q)/max(sum(x["sample_size"] for x in q),1)*100,2) if q else 0

                summary={"defect_rate":qr,"risk_level":"critical" if qr>8 else "warning" if qr>5 else "normal"}

            elif "equipment" in d:

                e=d["equipment"]

                summary={"total":len(e),"alarm":sum(1 for x in e if x["status"]=="alarm"),"maintenance":sum(1 for x in e if x["status"]=="maintenance")}

            else:

                preview = json.dumps(summary or d,ensure_ascii=False)

        prog=json.dumps({"tool":tool_name,"status":"completed","result":preview,"label":f"\u67e5\u8be2{intent}"},ensure_ascii=False)

        yield f"event: hermes.tool.progress\ndata: {prog}\n\n"

    for i in range(0,len(text),15):

        yield f"data: {json.dumps({'choices':[{'delta':{'content':text[i:i+15]},'index':0}]},ensure_ascii=False)}\n\n"

        await asyncio.sleep(0.01)

    yield "data: [DONE]\n\n"

@app.post("/v1/chat/completions")

async def chat(req: ChatReq):

    msg = req.messages[-1]["content"] if req.messages else ""

    intents = detect(msg)

    results = await fetch_data(intents, msg)

    fmts = {"workorders":fmt_wo,"production":fmt_prod,"quality":fmt_qual,"equipment":fmt_eq}

    parts = []

    for r in results:

        intent=r["intent"]; d=r["data"]

        if intent=="daily_report": parts.append(fmt_dr(d))

        elif intent in fmts: parts.append(fmts[intent](d))

    text = "\n\n".join(parts)

    if not req.stream:

        return {"id":str(uuid.uuid4()),"object":"chat.completion","choices":[{"message":{"role":"assistant","content":text},"index":0}]}

    return StreamingResponse(stream_resp(text, intents, results), media_type="text/event-stream", headers={"Cache-Control":"no-cache","Connection":"keep-alive"})



@app.post("/analyze")
async def analyze(req: dict):
    import json, httpx
    data = req.get("data", "{}")
    tool_name = req.get("tool_name", "unknown")
    if isinstance(data, str):
        try: parsed = json.loads(data)
        except: parsed = data
    else:
        parsed = data
    data_str = json.dumps(parsed, indent=2, ensure_ascii=False)[:3000]
    system_prompt = "你是一个MES工业数据分析专家。分析下方工具返回的JSON数据，输出简洁的洞察分析（3-5句话）：\n1. 关键数据解读（核心指标）\n2. 异常/警告信号（如果有）\n3. 改进建议\n用中文输出，不要使用Markdown格式，每句话一行。"
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            r = await client.post(
                ANALYSIS_BASE_URL + "/chat/completions",
                json={"model": ANALYSIS_MODEL, "messages": [{"role": "system", "content": system_prompt}, {"role": "user", "content": f"工具: {tool_name}\n数据:\n{data_str}"}], "temperature": 0.3, "max_tokens": 512},
                headers={"Authorization": f"Bearer {ANALYSIS_API_KEY}", "Content-Type": "application/json"},
            )
            if r.status_code == 200:
                j = r.json()
                analysis = j.get("choices", [{}])[0].get("message", {}).get("content", "")
                return {"analysis": analysis}
            else:
                return {"analysis": "[analysis request failed]"}
    except Exception as e:
        return {"analysis": "[analysis service error]"}


@app.get("/health")

async def health():

    return {"status":"ok","service":"mes-gateway"}



if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8642)
