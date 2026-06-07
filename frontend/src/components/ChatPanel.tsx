import React, { useState, useRef, useEffect, useCallback } from "react";
import type { ChatMessage } from "../types";
import { MessageBubble } from "./MessageBubble";

interface Props {
  messages: ChatMessage[];
  isLoading: boolean;
  onSend: (content: string) => void;
  onStop: () => void;
  onClear: () => void;
}

const SUGGESTIONS = [
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
  isLoading,
  onSend,
  onStop,
  onClear,
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
        <button onClick={onClear} style={{ padding: "6px 14px", border: "1px solid #e0e0e0", borderRadius: "6px", backgroundColor: "#fff", cursor: "pointer", fontSize: "12px", color: "#666" }}>清除对话</button>
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: "auto", padding: "20px" }}>
        {messages.length === 0 && (
          <div style={{ textAlign: "center", padding: "40px 20px", color: "#999" }}>
            <div style={{ fontSize: "40px", marginBottom: "12px" }}>🏭</div>
            <p style={{ margin: "0 0 4px", fontSize: "16px", color: "#666" }}>MES 工业智能助手</p>
            <p style={{ margin: "0 0 24px", fontSize: "13px" }}>可以用自然语言查询工单、生产、质量和设备信息</p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", justifyContent: "center" }}>
              {SUGGESTIONS.map((s) => (
                <button key={s} onClick={() => onSend(s)} style={{ padding: "8px 16px", border: "1px solid #ddd", borderRadius: "20px", backgroundColor: "#fff", cursor: "pointer", fontSize: "13px", color: "#555" }}
                  onMouseEnter={(e) => { (e.target as HTMLElement).style.borderColor = "#1976d2"; (e.target as HTMLElement).style.color = "#1976d2"; }}
                  onMouseLeave={(e) => { (e.target as HTMLElement).style.borderColor = "#ddd"; (e.target as HTMLElement).style.color = "#555"; }}>{s}</button>
              ))}
            </div>
          </div>
        )}
        {messages.map((msg) => (
          <MessageBubble key={msg.id} message={msg} />
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div style={{ padding: "16px 20px", backgroundColor: "#fff", borderTop: "1px solid #e0e0e0" }}>
        <form onSubmit={handleSubmit} style={{ display: "flex", gap: "8px", alignItems: "center" }}>
          {/* Microphone */}
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
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={isListening ? "正在聆听，说完后点击 🎤 停止..." : hasVoice ? "输入或语音输入问题..." : "输入您的问题..."}
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
        {isListening && <div style={{ fontSize: "11px", color: "#e53935", marginTop: "6px", textAlign: "center" }}>🔴 录音中，点击 🎤 停止后手动发送</div>}
        {!hasVoice && <div style={{ fontSize: "10px", color: "#bbb", marginTop: "4px", textAlign: "right" }}>语音输入需要 Chrome/Edge 浏览器</div>}
      </div>
    </div>
  );
};
