---
name: mes_workorder
version: 1.0.0
description: |
  查询工单信息。当用户询问工单状态、完成情况、延期工单时调用。
  调用 MCP tool: mcp_mes_query_workorders
author: MES Demo
---

# 工单查询

## 触发条件

用户询问工单相关问题时触发，例如：
- 今日未完成工单有哪些？
- A 产线工单状态如何？
- 有没有延期工单？
- 工单完成率是多少？

## MCP 工具

- `mcp_mes_query_workorders`

## 参数说明

| 参数 | 必填 | 说明 |
|------|------|------|
| status | 否 | 工单状态：planned/running/completed/delayed/all |
| line | 否 | 产线：A/B/C |
| date | 否 | 日期，格式 YYYY-MM-DD |

## 参数推断规则

- 如果用户说"今日"，设置 date 为当前日期
- 如果用户提到某条产线（如 A 线），设置 line 参数
- 如果用户说"未完成"，设置 status=running
- 如果用户说"延期"或"超期"，设置 status=delayed
- 缺省时不传参，返回全部工单

## 输出解读

工具返回 JSON，包含：

- `items`: 工单列表
- `summary`: {total, completed, running, delayed, completion_rate}
- `risk_summary`: 风险摘要

## 回答要求

1. 优先展示已完成、进行中、延期的数量
2. 计算完成率
3. 如有延期工单，需突出显示并建议关注瓶颈产线
4. 以表格形式展示工单明细
