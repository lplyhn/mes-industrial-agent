# FastAPI Mock MES Backend

# 数据服务层 - Mock MES API Server
# 提供工单、生产、质量、设备四类核心数据端点
# 数据确定性生成，支持可重复验证

from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware
from datetime import datetime, timedelta
import random
from typing import Optional
from pydantic import BaseModel

app = FastAPI(title="MES Mock API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ============================================================
# 数据模型
# ============================================================

class WorkOrder(BaseModel):
    id: str
    line: str
    status: str
    planned_qty: int
    completed_qty: int
    date: str
    product: str

class ProductionRecord(BaseModel):
    hour: str
    line: str
    output: int
    target: int
    oee: float

class QualityRecord(BaseModel):
    batch: str
    line: str
    sample_size: int
    defect_count: int
    defect_type: str
    hour: str

class EquipmentRecord(BaseModel):
    id: str
    line: str
    status: str
    alarm_code: Optional[str] = None
    temperature: Optional[float] = None

# ============================================================
# 确定性 Mock 数据生成
# ============================================================

random.seed(42)
BASE_DATE = "2026-06-07"
LINES = ["A", "B", "C"]

WORKORDERS = []
for i, line in enumerate(LINES):
    for j in range(4):
        is_delayed = (line == "A" and j == 0) or (line == "A" and j == 1)
        is_running = (line == "B" and j == 0)
        status = "delayed" if is_delayed else ("running" if is_running else "completed")
        planned = random.randint(100, 500)
        completed = int(planned * (0.3 if is_delayed else (0.5 if is_running else random.uniform(0.95, 1.0))))
        WORKORDERS.append(WorkOrder(
            id=f"WO-{line}{j+1:03d}",
            line=line,
            status=status,
            planned_qty=planned,
            completed_qty=completed,
            date=BASE_DATE,
            product=f"PROD-{random.choice(['A001','B002','C003'])}"
        ))

PRODUCTION = []
for line in LINES:
    for h in range(24):
        hour_str = f"{h:02d}:00"
        target = 100
        # A 线 14:00-16:00 OEE 明显下降
        if line == "A" and 14 <= h <= 16:
            output = random.randint(40, 60)
            oee = round(random.uniform(0.40, 0.60), 2)
        elif line == "A" and 8 <= h <= 10:
            output = random.randint(75, 90)
            oee = round(random.uniform(0.75, 0.90), 2)
        else:
            output = random.randint(85, 105)
            oee = round(random.uniform(0.85, 1.02), 2)
        PRODUCTION.append(ProductionRecord(
            hour=hour_str, line=line, output=output, target=target, oee=oee
        ))

QUALITY = []
for line in LINES:
    for h in range(24):
        hour_str = f"{h:02d}:00"
        sample = random.randint(50, 100)
        # A 线最近 6 小时 dimension_error 明显升高
        if line == "A" and h >= 18:
            defect = random.randint(8, 15)
            dtype = "dimension_error"
        elif line == "A":
            defect = random.randint(2, 6)
            dtype = random.choice(["dimension_error", "surface_defect", "material_defect"])
        else:
            defect = random.randint(1, 4)
            dtype = random.choice(["surface_defect", "material_defect"])
        QUALITY.append(QualityRecord(
            batch=f"BATCH-{line}{h:02d}",
            line=line,
            sample_size=sample,
            defect_count=defect,
            defect_type=dtype,
            hour=hour_str
        ))

EQUIPMENTS = []
for i, line in enumerate(LINES):
    eq_id = f"EQ-00{i+1}"
    # EQ-003 (A 线) 设置为 TEMP_HIGH 报警
    if eq_id == "EQ-003":
        EQUIPMENTS.append(EquipmentRecord(
            id=eq_id, line="A", status="alarm",
            alarm_code="TEMP_HIGH", temperature=89.5
        ))
    elif eq_id == "EQ-002":
        EQUIPMENTS.append(EquipmentRecord(
            id=eq_id, line=line, status="maintenance",
            alarm_code=None, temperature=None
        ))
    else:
        EQUIPMENTS.append(EquipmentRecord(
            id=eq_id, line=line, status="running",
            alarm_code=None, temperature=45.2
        ))

# ============================================================
# API 端点
# ============================================================

@app.get("/api/workorders", response_model=list[WorkOrder])
def get_workorders(
    status: Optional[str] = Query(None, regex="^(planned|running|completed|delayed|all)$"),
    line: Optional[str] = Query(None, regex="^[ABC]$"),
    date: Optional[str] = None,
):
    results = WORKORDERS.copy()
    if status and status != "all":
        results = [w for w in results if w.status == status]
    if line:
        results = [w for w in results if w.line == line]
    if date:
        results = [w for w in results if w.date == date]
    return results


@app.get("/api/production", response_model=list[ProductionRecord])
def get_production(
    line: Optional[str] = Query(None, regex="^[ABC]$"),
    hours: Optional[int] = Query(24, ge=1, le=168),
):
    results = PRODUCTION.copy()
    if line:
        results = [r for r in results if r.line == line]
    # 按小时倒序取最新 hours 条
    # 数据按 line 分组，每条 line 有 24 条
    if line:
        results = results[-hours:] if hours <= len(results) else results
    else:
        # 多线时取每条线最新的 hours // len(LINES) 条
        per_line = max(1, hours // len(LINES))
        filtered = []
        for l in LINES:
            line_data = [r for r in results if r.line == l]
            filtered.extend(line_data[-per_line:])
        results = filtered
    return results


@app.get("/api/quality", response_model=list[QualityRecord])
def get_quality(
    line: Optional[str] = Query(None, regex="^[ABC]$"),
    hours: Optional[int] = Query(24, ge=1, le=168),
):
    results = QUALITY.copy()
    if line:
        results = [r for r in results if r.line == line]
    if line:
        results = results[-hours:] if hours <= len(results) else results
    else:
        per_line = max(1, hours // len(LINES))
        filtered = []
        for l in LINES:
            line_data = [r for r in results if r.line == l]
            filtered.extend(line_data[-per_line:])
        results = filtered
    return results


@app.get("/api/equipment", response_model=list[EquipmentRecord])
def get_equipment(
    line: Optional[str] = Query(None, regex="^[ABC]$"),
    status: Optional[str] = Query(None, regex="^(running|alarm|maintenance|offline|all)$"),
):
    results = EQUIPMENTS.copy()
    if line:
        results = [r for r in results if r.line == line]
    if status and status != "all":
        results = [r for r in results if r.status == status]
    return results


@app.get("/health")
def health():
    return {"status": "ok", "timestamp": datetime.now().isoformat()}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
