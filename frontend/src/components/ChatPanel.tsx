import React, { useState, useRef, useEffect, useCallback } from "react";
import type { ChatMessage } from "../types";
import { MessageBubble } from "./MessageBubble";

interface Props {
  messages: ChatMessage[];
  convs?: any[];
  isLoading: boolean;
  onSend: (content: string) => void;
  onStop: () => void;
  onClear: () => void;
  onNewChat?: () => void;
  onSwitchConv?: (id: string) => void;
  onSelectMessage?: (msgId: string) => void;
}

const QUICK_QUESTIONS = [
  "今日未完成工单有哪些",
  "A 产线最近 24 小时质量是否异常",
  "当前有哪些报警设备",
  "生成今日生产日报",
];

function getSpeechRecognition(): any {
  const w = window as any;
  return w.SpeechRecognition || w.webkitSpeechRecognition || null;
}

export const ChatPanel: React.FC<Props> = ({
  messages,
  convs,
  isLoading,
  onSend,
  onStop,
  onClear,
  onNewChat,
  onSwitchConv,
  onSelectMessage,
}) => {
  const [input, setInput] = useState("");
  const [isListening, setIsListening] = useState(false);
  const [hasVoice, setHasVoice] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    setHasVoice(!!getSpeechRecognition());
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const toggleVoice = useCallback(() => {
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
      return;
    }
    const SR = getSpeechRecognition();
    if (!SR) return;
    try {
      const rec = new SR();
      rec.lang = "zh-CN";
      rec.continuous = true;
      rec.interimResults = true;
      rec.onresult = (e: any) => {
        let text = "";
        for (let i = e.resultIndex; i < e.results.length; i++) {
          text += e.results[i][0].transcript;
        }
        setInput(text);
      };
      rec.onerror = () => setIsListening(false);
      rec.onend = () => setIsListening(false);
      recognitionRef.current = rec;
      rec.start();
      setIsListening(true);
      setInput("");
    } catch (e) {
      console.error(e);
      setIsListening(false);
    }
  }, [isListening]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || isLoading) return;
    onSend(trimmed);
    setInput("");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", backgroundColor: "#f5f5f5" }}>
      {/* Header */}
      <div style={{ padding: "16px 20px", backgroundColor: "#fff", borderBottom: "1px solid #e0e0e0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <h2 style={{ margin: 0, fontSize: "16px", color: "#333" }}>MES 工业智能助手</h2>
          <span style={{ fontSize: "12px", color: "#999" }}>基于 Hermes Agent + MCP</span>
        </div>
        <button onClick={onNewChat} style={{ padding: "6px 14px", border: "1px solid #1976d2", borderRadius: "6px", backgroundColor: "#e3f2fd", cursor: "pointer", fontSize: "12px", color: "#1976d2", whiteSpace: "nowrap", fontWeight: 500 }}>+ \u65b0\u5bf9\u8bdd</button>
        <button onClick={onClear} style={{ padding: "6px 14px", border: "1px solid #e0e0e0", borderRadius: "6px", backgroundColor: "#fff", cursor: "pointer", fontSize: "12px", color: "#666" }}>清除对话</button>
      </div>

      {convs && convs.length > 0 && (
        <div style={{ padding: "8px 12px", borderBottom: "1px solid #e0e0e0", backgroundColor: "#fafafa", maxHeight: "120px", overflowY: "auto" }}>
          <div style={{ fontSize: "11px", color: "#999", marginBottom: "6px" }}>历史对话</div>
          {convs.map(function(cv: any) {
            return (
              <div key={cv.id} onClick={function(){ onSwitchConv && onSwitchConv(cv.id); }} style={{ padding: "4px 8px", cursor: "pointer", borderRadius: "4px", fontSize: "12px", color: "#333", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }} onMouseEnter={function(e: any){ (e.target as HTMLElement).style.backgroundColor = "#e3f2fd"; }} onMouseLeave={function(e: any){ (e.target as HTMLElement).style.backgroundColor = "transparent"; }}>
                {cv.title || "新对话"}
              </div>
            );
          })}
        </div>
      )}

      {/* Messages */}
      <div style={{ flex: 1, overflowY: "auto", padding: "20px" }}>
        {messages.length === 0 && (
          <div style={{ textAlign: "center", padding: "60px 20px 40px", color: "#999" }}>
            <div style={{ fontSize: "48px", marginBottom: "12px" }}>🏭</div>
            <p style={{ margin: "0 0 4px", fontSize: "16px", color: "#666" }}>MES 工业智能助手</p>
            <p style={{ margin: "0", fontSize: "13px" }}>可以用自然语言查询工单、生产、质量和设备信息</p>
          </div>
        )}
        {messages.map((msg) => (
          <MessageBubble key={msg.id} message={msg} onSelect={onSelectMessage} />
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Input + Quick Questions */}
      <div style={{ backgroundColor: "#fff", borderTop: "1px solid #e0e0e0" }}>
        {/* Quick question chips */}
        {!isLoading && (
          <div style={{ padding: "10px 20px 0", display: "flex", gap: "6px", flexWrap: "wrap" }}>
            {QUICK_QUESTIONS.map((q) => (
              <button key={q} onClick={() => onSend(q)}
                style={{
                  padding: "5px 12px", border: "1px solid #e0e0e0", borderRadius: "14px",
                  backgroundColor: "#fafafa", cursor: "pointer", fontSize: "12px", color: "#666",
                  whiteSpace: "nowrap", transition: "all 0.15s",
                }}
                onMouseEnter={(e) => { (e.target as HTMLElement).style.borderColor = "#1976d2"; (e.target as HTMLElement).style.color = "#1976d2"; (e.target as HTMLElement).style.backgroundColor = "#e3f2fd"; }}
                onMouseLeave={(e) => { (e.target as HTMLElement).style.borderColor = "#e0e0e0"; (e.target as HTMLElement).style.color = "#666"; (e.target as HTMLElement).style.backgroundColor = "#fafafa"; }}
              >{q}</button>
            ))}
          </div>
        )}
        {/* Input row */}
        <form onSubmit={handleSubmit} style={{ display: "flex", gap: "8px", padding: "10px 20px 16px", alignItems: "center" }}>
          {hasVoice && (
            <button type="button" onClick={toggleVoice} disabled={isLoading}
              title={isListening ? "点击停止录音" : "语音输入"}
              style={{
                width: "38px", height: "38px", padding: 0, border: "none", borderRadius: "8px", fontSize: "18px",
                backgroundColor: isListening ? "#e53935" : "#f0f0f0",
                cursor: isLoading ? "not-allowed" : "pointer",
                display: "flex", alignItems: "center", justifyContent: "center",
                transition: "all 0.2s",
              }}
            >{isListening ? "🔴" : "🎤"}</button>
          )}
          <input value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={handleKeyDown}
            placeholder={isListening ? "正在聆听..." : hasVoice ? "输入或语音输入问题..." : "输入您的问题..."}
            disabled={isLoading}
            style={{
              flex: 1, padding: "10px 14px", fontSize: "14px", outline: "none",
              border: isListening ? "2px solid #e53935" : "1px solid #ddd",
              borderRadius: "8px",
            }}
          />
          {isLoading ? (
            <button type="button" onClick={onStop} style={{ padding: "10px 20px", border: "none", borderRadius: "8px", backgroundColor: "#f44336", color: "#fff", cursor: "pointer", fontSize: "14px", whiteSpace: "nowrap" }}>停止</button>
          ) : (
            <button type="submit" style={{ padding: "10px 20px", border: "none", borderRadius: "8px", backgroundColor: "#1976d2", color: "#fff", cursor: "pointer", fontSize: "14px", whiteSpace: "nowrap" }}>发送</button>
          )}
        </form>
        {isListening && <div style={{ fontSize: "11px", color: "#e53935", padding: "0 20px 10px", textAlign: "center" }}>🔴 录音中，点击 🎤 停止后手动发送</div>}
        {!hasVoice && <div style={{ fontSize: "10px", color: "#bbb", padding: "0 20px 10px", textAlign: "right" }}>语音输入需要 Chrome/Edge 浏览器</div>}
      </div>
    </div>
  );
};
