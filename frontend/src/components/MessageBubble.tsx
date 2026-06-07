import React from "react";
import type { ChatMessage } from "../types";

interface Props {
  message: ChatMessage;
}

function formatTimestamp(ts: number): string {
  const d = new Date(ts);
  return `${d.getHours().toString().padStart(2, "0")}:${d.getMinutes()
    .toString()
    .padStart(2, "0")}:${d.getSeconds().toString().padStart(2, "0")}`;
}

export const MessageBubble: React.FC<Props> = ({ message }) => {
  const isUser = message.role === "user";

  return (
    <div
      style={{
        display: "flex",
        flexDirection: isUser ? "row-reverse" : "row",
        gap: "12px",
        marginBottom: "16px",
        alignItems: "flex-start",
      }}
    >
      <div
        style={{
          width: "32px",
          height: "32px",
          borderRadius: "50%",
          backgroundColor: isUser ? "#1976d2" : "#00a854",
          color: "#fff",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: "14px",
          fontWeight: 600,
          flexShrink: 0,
        }}
      >
        {isUser ? "U" : "AI"}
      </div>
      <div style={{ maxWidth: "75%" }}>
        <div
          style={{
            backgroundColor: isUser ? "#e3f2fd" : "#ffffff",
            border: "1px solid",
            borderColor: isUser ? "#bbdefb" : "#e0e0e0",
            borderRadius: "12px",
            padding: "12px 16px",
            lineHeight: 1.6,
            fontSize: "14px",
            color: "#333",
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
          }}
        >
          {message.content ||
            (message.role === "assistant" ? "思考中..." : "")}
        </div>
        <div
          style={{
            fontSize: "11px",
            color: "#999",
            marginTop: "4px",
            textAlign: isUser ? "right" : "left",
          }}
        >
          {formatTimestamp(message.timestamp)}
        </div>
      </div>
    </div>
  );
};
