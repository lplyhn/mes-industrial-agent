import React from "react";
import { ChatPanel } from "./components/ChatPanel";
import { TracePanel } from "./components/TracePanel";
import { useSSE } from "./hooks/useSSE";
import "./styles/index.css";

const App: React.FC = () => {
  const {
    messages,
    toolCalls,
    isLoading,
    error,
    sendMessage,
    stopStreaming,
    clearChat,
  } = useSSE();

  const [selectedTurnId, setSelectedTurnId] = React.useState<string | null>(null);
  const [leftWidth, setLeftWidth] = React.useState(25);
  const [dragging, setDragging] = React.useState(false);
  const containerRef = React.useRef<HTMLDivElement>(null);

  const handleSend = React.useCallback((content: string) => {
    setSelectedTurnId(null);
    sendMessage(content);
  }, [sendMessage]);

  const handleClear = React.useCallback(() => {
    setSelectedTurnId(null);
    clearChat();
  }, [clearChat]);

  const handleMouseDown = React.useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setDragging(true);
  }, []);

  const handleMouseMove = React.useCallback((e: MouseEvent) => {
    if (!dragging || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const pct = (x / rect.width) * 100;
    setLeftWidth(Math.max(5, Math.min(80, pct)));
  }, [dragging]);

  const handleMouseUp = React.useCallback(() => {
    setDragging(false);
  }, []);

  React.useEffect(() => {
    if (dragging) {
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
    }
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [dragging, handleMouseMove, handleMouseUp]);

  return (
    <div
      ref={containerRef}
      style={{
        display: "flex",
        height: "100vh",
        width: "100vw",
        overflow: "hidden",
        backgroundColor: "#f5f5f5",
        userSelect: dragging ? "none" : undefined,
        cursor: dragging ? "col-resize" : undefined,
      }}
    >
      {/* Left: Chat Panel */}
      <div
        style={{
          width: `${leftWidth}%`,
          minWidth: 0,
          overflow: "hidden",
        }}
      >
        <ChatPanel
          messages={messages}
          isLoading={isLoading}
          onSend={handleSend}
          onStop={stopStreaming}
          onClear={handleClear}
          onSelectMessage={setSelectedTurnId}
        />
      </div>

      {/* Draggable Divider */}
      <div
        onMouseDown={handleMouseDown}
        style={{
          width: "6px",
          cursor: "col-resize",
          backgroundColor: dragging ? "#1976d2" : "#e0e0e0",
          transition: "background-color 0.15s",
          flexShrink: 0,
          position: "relative",
        }}
      >
        <div
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            width: "2px",
            height: "32px",
            backgroundColor: dragging ? "#fff" : "#ccc",
            borderRadius: "2px",
            transition: "background-color 0.15s",
          }}
        />
      </div>

      {/* Right: Trace Panel */}
      <div
        style={{
          flex: 1,
          minWidth: 0,
          backgroundColor: "#fff",
          overflow: "hidden",
        }}
      >
        <TracePanel toolCalls={toolCalls} selectedTurnId={selectedTurnId} />
      </div>

      {/* Error Toast */}
      {error && (
        <div
          style={{
            position: "fixed",
            bottom: "80px",
            left: "50%",
            transform: "translateX(-50%)",
            backgroundColor: "#c62828",
            color: "#fff",
            padding: "12px 24px",
            borderRadius: "8px",
            fontSize: "14px",
            boxShadow: "0 4px 12px rgba(0,0,0,0.2)",
            zIndex: 1000,
          }}
        >
          {error}
        </div>
      )}
    </div>
  );
};

export default App;






