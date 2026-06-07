"""
回归测试：MES Mock API
确保四类核心端点返回正确数据和业务约束
"""
import requests

BASE_URL = "http://localhost:8000"


def test_health():
    resp = requests.get(f"{BASE_URL}/health")
    assert resp.status_code == 200
    assert resp.json()["status"] == "ok"


def test_workorders():
    resp = requests.get(f"{BASE_URL}/api/workorders")
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) > 0
    # A 产线至少存在一个延期工单
    a_orders = [w for w in data if w["line"] == "A"]
    assert any(w["status"] == "delayed" for w in a_orders), "A 线应有延期工单"


def test_workorders_filter():
    resp = requests.get(f"{BASE_URL}/api/workorders", params={"line": "A", "status": "delayed"})
    assert resp.status_code == 200
    data = resp.json()
    assert all(w["line"] == "A" and w["status"] == "delayed" for w in data)


def test_production():
    # Query A line with 24 hours to get full A line data
    resp = requests.get(f"{BASE_URL}/api/production", params={"line": "A", "hours": 24})
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) > 0
    # A 线 14:00-16:00 OEE 应低于 0.70
    a_data = [r for r in data if "14:" <= r["hour"] <= "16:"]
    assert any(r["oee"] < 0.70 for r in a_data), "A 线 14-16 时 OEE 应低于 0.70"


def test_quality():
    resp = requests.get(f"{BASE_URL}/api/quality", params={"line": "A", "hours": 24})
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) > 0
    # A 线最近 6 小时 dimension_error 应占主导
    recent = [q for q in data if q["hour"] >= "18:00"]
    dim_errors = [q for q in recent if q["defect_type"] == "dimension_error"]
    assert len(dim_errors) > 0, "A 线最近 6 小时应有 dimension_error"


def test_equipment():
    resp = requests.get(f"{BASE_URL}/api/equipment")
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) == 3
    # EQ-003 必须是 alarm 状态
    eq003 = next(e for e in data if e["id"] == "EQ-003")
    assert eq003["status"] == "alarm"
    assert eq003["alarm_code"] == "TEMP_HIGH"


def test_equipment_filter():
    resp = requests.get(f"{BASE_URL}/api/equipment", params={"line": "A"})
    assert resp.status_code == 200
    data = resp.json()
    assert all(e["line"] == "A" for e in data)


if __name__ == "__main__":
    test_health()
    test_workorders()
    test_workorders_filter()
    test_production()
    test_quality()
    test_equipment()
    test_equipment_filter()
    print("All backend tests passed!")
