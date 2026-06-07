---
name: mes_production
version: 1.0.0
description: |
  查询生产数据。当用户询问产量、OEE、产能达标情况时调用。
  调用 MCP tool: mcp_mes_query_production
author: MES Demo
---

# 生产查询

## 触发条件

用户询问生产相关问题时触发，例如：
- A 线产量达标了吗？
- 今天的 OEE 是多少？
- 哪些时段产能低于目标？
- 对比 A 线和 B 线的 OEE

## MCP 工具

- `mcp_mes_query_production`

## 参数说明

| 参数 | 必填 | 说明 |
|------|------|------|
| line | 否 | 产线：A/B/C |
| hours | 否 | 查询小时数，默认 24 |

## 参数推断规则

- 如果用户说"最近 N 小时"，设置 hours=N
- 如果用户提到产线，设置 line 参数
- 默认返回最近 24 小时数据

## 输出解读

工具返回 JSON，包含：

- `items`: 生产记录列表
- `summary`: {total_output, total_target, achievement_rate, avg_oee, abnormal_period_count}
- `abnormal_periods`: OEE < 0.70 的异常时段列表
- `risk_summary`: 风险摘要

## 回答要求

1. 展示总产量、达成率、平均 OEE
2. 如有异常时段，列出具体时段和 OEE 值
3. 跨产线对比时，分产线展示
4. 分析异常原因时结合设备状态（需调用设备诊断工具）
