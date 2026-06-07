---
name: mes_quality
version: 1.0.0
description: |
  分析质量数据。当用户询问质量异常、不良率、缺陷分布时调用。
  调用 MCP tool: mcp_mes_analyze_quality
author: MES Demo
---

# 质量分析

## 触发条件

用户询问质量相关问题时触发，例如：
- A 产线最近 24 小时质量是否异常？
- 不良率是多少？
- 主要缺陷类型是什么？
- 质量趋势如何？

## MCP 工具

- `mcp_mes_analyze_quality`

## 参数说明

| 参数 | 必填 | 说明 |
|------|------|------|
| line | 否 | 产线：A/B/C |
| hours | 否 | 查询小时数，默认 24 |

## 参数推断规则

- 如果用户说"最近 N 小时"，设置 hours=N
- 如果用户提到产线，设置 line 参数
- 默认分析最近 24 小时质量数据

## 输出解读

工具返回 JSON，包含：

- `summary`: {total_sample, total_defect, defect_rate, risk_level}
- `defect_distribution`: 缺陷类型分布 {type: {count, percentage}}
- `trend_risk`: 最近 3 小时是否连续上升
- `dominant_defect`: 主导缺陷类型
- `analysis`: 分析结论文本

## 风险等级说明

| 等级 | 不良率 | 含义 |
|------|--------|------|
| normal | ≤ 5% | 正常 |
| warning | 5% ~ 8% | 需关注 |
| critical | > 8% | 严重异常 |

## 回答要求

1. 明确告知风险等级和不良率
2. 展示缺陷分布（饼图或列表）
3. 如有趋势风险，需明确指出
4. 结合设备报警信息做跨域归因分析
5. 给出具体排查建议
