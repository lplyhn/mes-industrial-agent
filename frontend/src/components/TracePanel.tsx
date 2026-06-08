import React, { useState, useMemo, useRef, useEffect } from "react";
import type { ToolCall } from "../types";
import { ResultRenderer } from "./ResultRenderer";

interface Props {
  toolCalls: ToolCall[];
  selectedTurnId?: string | null;
}

const S_ICONS: Record<string, string> = { running: "⏳", completed: "✅", failed: "❌" };
const S_COLORS: Record<string, string> = { running: "#f57c00", completed: "#2e7d32", failed: "#c62828" };

function tryParseData(result: string | undefined): any {
  if (!result || result === "OK") return null;
  try {
    const d = JSON.parse(result);
    return d && typeof d === "object" && Object.keys(d).length > 0 ? d : null;
  } catch {
    return null;
  }
}

function getAnalysisTone(text: string): "normal" | "warning" | "error" {
  var t = text.toLowerCase();
  var errorWords = ["严重", "故障", "紧急", "失败", "危险", "异常", "critical", "必须立即"];
  var warningWords = ["警告", "注意", "延迟", "延期", "下降", "偏高", "偏低", "风险", "建议", "损失"];
  for (var w of errorWords) { if (t.indexOf(w) >= 0) return "error"; }
  for (var w of warningWords) { if (t.indexOf(w) >= 0) return "warning"; }
  return "normal";
}

function getPreview(result: string | undefined): string | null {
  if (!result || result === "OK") return null;
  try {
    const p = JSON.parse(result);
    if (p.workorders || p.production || p.quality || p.equipment) {
      const parts: string[] = [];
      const w = p.workorders || {};
      if (w.total !== undefined) parts.push(`工单${w.total}`);
      if (w.completed !== undefined) parts.push(`完成${w.completed}`);
      if (w.delayed !== undefined && w.delayed > 0) parts.push(`延期${w.delayed}`);
      if (p.production) {
        const prod = p.production;
        if (prod.total_output !== undefined) parts.push(`产量${prod.total_output}`);
        if (prod.avg_oee !== undefined) parts.push(`OEE${prod.avg_oee}`);
      }
      if (p.quality) {
        parts.push(`不良率${p.quality.defect_rate}%`);
      }
      if (p.equipment) {
        if (p.equipment.alarm > 0) parts.push(`报警${p.equipment.alarm}个`);
      }
      return parts.length > 0 ? parts.join(" | ") : null;
    }
    if (p.items) return `查询到 ${p.items.length} 条记录`;
  } catch {}
  return result.length > 80 ? result.slice(0, 80) + "..." : result;
}

export const TracePanel: React.FC<Props> = ({ toolCalls, selectedTurnId }) => {
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);
  const previews = useMemo(
    () => toolCalls.map((c) => ({ preview: getPreview(c.result), data: tryParseData(c.result) })),
    [toolCalls]
  );

  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Auto-scroll to bottom on new tool calls
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [toolCalls]);

  // Scroll to matching tool call when selectedTurnId changes
  useEffect(() => {
    if (!selectedTurnId || !scrollRef.current) return;
    const el = scrollRef.current.querySelector(`[data-turn-id="${selectedTurnId}"]`);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [selectedTurnId]);

  return (
    <div
      style={{
        height: "100%",
        display: "flex",
        flexDirection: "column",
        backgroundColor: "#fff",
      }}
    >
      <div style={{ padding: "16px 20px", borderBottom: "1px solid #e0e0e0" }}>
        <h3 style={{ margin: 0, fontSize: "15px", color: "#333" }}>Agent Trace</h3>
        <p style={{ margin: "4px 0 0", fontSize: "12px", color: "#999" }}>
          工具调用轨迹
        </p>
      </div>
      <div ref={scrollRef} style={{ flex: 1, overflowY: "auto", padding: "12px 16px" }}>
        {toolCalls.length === 0 && (
          <div
            style={{
              textAlign: "center",
              padding: "40px 16px",
              color: "#ccc",
              fontSize: "13px",
            }}
          >
            暂无工具调用记录
          </div>
        )}
        {toolCalls.map((call, idx) => {
          const p = previews[idx];
          return (
            <div
              key={`${call.tool_name}-${idx}`}
              data-turn-id={call.turnId || ""}
              style={{
                border: call.turnId && call.turnId === selectedTurnId ? "2px solid #1976d2" : "1px solid #e8e8e8",
                borderRadius: "8px",
                marginBottom: "8px",
                overflow: "hidden",
                boxShadow: call.turnId && call.turnId === selectedTurnId ? "0 0 8px rgba(25,118,210,0.3)" : "none",
                transition: "all 0.3s",
              }}
            >
              {/* Header */}
              <div
                onClick={() =>
                  setExpandedIndex(expandedIndex === idx ? null : idx)
                }
                style={{
                  padding: "10px 12px",
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  cursor: "pointer",
                  backgroundColor: "#fafafa",
                }}
              >
                <span>{S_ICONS[call.status] || "❓"}</span>
                <span
                  style={{
                    fontSize: "13px",
                    fontWeight: 500,
                    color: "#333",
                    whiteSpace: "nowrap",
                  }}
                >
                  {call.tool_name}
                </span>
                <span
                  style={{
                    fontSize: "11px",
                    color: S_COLORS[call.status] || "#999",
                    fontWeight: 500,
                  }}
                >
                  {call.status}
                </span>
                <span
                  style={{
                    color: "#ccc",
                    fontSize: "12px",
                    marginLeft: "auto",
                  }}
                >
                  {expandedIndex === idx ? "▲" : "▼"}
                </span>
              </div>

              {/* Rich visualization */}
              {p.data && (
                <div
                  style={{
                    padding: "8px 12px 4px",
                    borderTop: "1px solid #f0f0f0",
                  }}
                >
                  <ResultRenderer data={p.data} />
                </div>
              )}

              {/* Text preview (when no structured data) */}
              {!p.data && p.preview && (
                <div
                  style={{
                    padding: "8px 12px",
                    borderTop: "1px solid #f0f0f0",
                    fontSize: "11px",
                    color: "#555",
                    lineHeight: 1.5,
                    wordBreak: "break-word",
                  }}
                >
                  {p.preview}
                </div>
              )}

              {/* AI Analysis - after data visualization */}
              {call.aiAnalysis && (function() {
                var tone = getAnalysisTone(call.aiAnalysis);
                var isWarn = tone === "warning";
                var isErr = tone === "error";
                var bg = isErr ? "linear-gradient(135deg, #fbe9e7 0%, #ffccbc 100%)" : isWarn ? "linear-gradient(135deg, #fff8e1 0%, #ffe082 100%)" : "linear-gradient(135deg, #f1f8e9 0%, #e8f5e9 100%)";
                var borderColor = isErr ? "#ef9a9a" : isWarn ? "#ffcc02" : "#c8e6c9";
                var badgeBg = isErr ? "#c62828" : isWarn ? "#e65100" : "#2e7d32";
                var titleColor = isErr ? "#c62828" : isWarn ? "#e65100" : "#2e7d32";
                var textColor = isErr ? "#b71c1c" : isWarn ? "#bf360c" : "#1b5e20";
                var badgeLabel = isErr ? "警" : isWarn ? "!" : "AI";
                var titleLabel = isErr ? "异常警报" : isWarn ? "风险提示" : "数据分析报告";

                return (
                  <div
                    className="ai-analysis-block"
                    style={{
                      padding: "10px 14px",
                      borderTop: "1px solid " + borderColor,
                      background: bg,
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "5px",
                        marginBottom: "6px",
                      }}
                    >
                      <span
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          justifyContent: "center",
                          width: "18px",
                          height: "18px",
                          borderRadius: "50%",
                          backgroundColor: badgeBg,
                          color: "#fff",
                          fontSize: "10px",
                          fontWeight: 700,
                        }}
                      >
                        {badgeLabel}
                      </span>
                      <span
                        style={{
                          fontSize: "11px",
                          fontWeight: 600,
                          color: titleColor,
                          letterSpacing: "0.3px",
                        }}
                      >
                        {titleLabel}
                      </span>
                    </div>
                    <div
                      style={{
                        fontSize: "12px",
                        color: textColor,
                        lineHeight: 1.7,
                        whiteSpace: "pre-wrap",
                        wordBreak: "break-word",
                      }}
                    >
                      {call.aiAnalysis}
                    </div>
                  </div>
                );
              })()}

              {/* Expanded raw detail */}
              {expandedIndex === idx && (
                <div
                  style={{
                    padding: "10px 12px",
                    backgroundColor: "#f9f9f9",
                    borderTop: "1px solid #e8e8e8",
                  }}
                >
                  {call.label && (
                    <div style={{ marginBottom: "8px" }}>
                      <span
                        style={{
                          fontSize: "12px",
                          color: "#666",
                          fontWeight: 500,
                        }}
                      >
                        Label:
                      </span>
                      <span style={{ fontSize: "12px", color: "#333" }}>
                        {" "}
                        {call.label}
                      </span>
                    </div>
                  )}
                  {call.result && (
                    <div>
                      <span
                        style={{
                          fontSize: "12px",
                          color: "#666",
                          fontWeight: 500,
                        }}
                      >
                        Raw:
                      </span>
                      <pre
                        style={{
                          fontSize: "11px",
                          color: "#555",
                          backgroundColor: "#f0f0f0",
                          padding: "8px",
                          borderRadius: "4px",
                          overflowX: "auto",
                          maxHeight: "200px",
                          margin: "4px 0 0",
                          whiteSpace: "pre-wrap",
                          wordBreak: "break-word",
                        }}
                      >
                        {typeof call.result === "string"
                          ? call.result
                          : JSON.stringify(call.result, null, 2)}
                      </pre>
                    </div>
                  )}
                  {call.error && (
                    <div style={{ color: "#c62828", fontSize: "12px" }}>
                      Error: {call.error}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

