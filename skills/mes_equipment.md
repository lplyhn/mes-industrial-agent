---
name: mes_equipment
version: 1.0.0
description: |
  诊断设备状态。当用户询问设备报警、设备状态、设备故障时调用。
  调用 MCP tool: mcp_mes_diagnose_equipment
author: MES Demo
---

# 设备诊断

## 触发条件

用户询问设备相关问题时触发，例如：
- 当前有哪些报警设备？
- EQ-003 的状态是什么？
- A 线设备有没有异常？
- 设备故障会影响生产吗？

## MCP 工具

- `mcp_mes_diagnose_equipment`

## 参数说明

| 参数 | 必填 | 说明 |
|------|------|------|
| line | 否 | 产线：A/B/C |
| status | 否 | 设备状态：running/alarm/maintenance/offline/all |

## 参数推断规则

- 如果用户说"报警设备"，设置 status=alarm
- 如果用户提到某条产线，设置 line 参数
- 缺省时返回全部设备

## 输出解读

工具返回 JSON，包含：

- `items`: 设备列表
- `summary`: {total, running, alarm, maintenance}
- `alarm_devices`: 报警设备详情 [{id, line, alarm_code, temperature}]
- `impact_analysis`: 影响分析列表
- `suggestion`: 处理建议

## 回答要求

1. 优先展示报警设备及报警码
2. 分析设备状态对产线的影响
3. 结合质量数据做关联分析（如温度报警是否导致质量异常）
4. 给出处理建议
5. 以卡片形式展示设备状态
