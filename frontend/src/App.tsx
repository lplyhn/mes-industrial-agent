import React from "react";
import { ChatPanel } from "./components/ChatPanel";
import { HistoryPanel } from "./components/HistoryPanel";
import { TracePanel } from "./components/TracePanel";
import { useSSE } from "./hooks/useSSE";
import "./styles/index.css";

const App: React.FC = () => {
  const {
    messages,
    toolCalls,
    convs,
    isLoading,
    error,
    sendMessage,
    stopStreaming,
    clearChat,
    loadConversations,
    switchConversation,
    createNewConv,
    deleteConv,
  } = useSSE();

  const [selectedTurnId, setSelectedTurnId] = React.useState<string | null>(null);
  const [currentConvId, setCurrentConvId] = React.useState<string>("");
  const [leftWidth, setLeftWidth] = React.useState(15);
  const [leftDragging, setLeftDragging] = React.useState(false);
  const [middleWidth, setMiddleWidth] = React.useState(25);
  const [middleDragging, setMiddleDragging] = React.useState(false);
  const containerRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => { loadConversations(); }, [loadConversations]);

  React.useEffect(() => {
    function onMove(e: MouseEvent) {
      if (!leftDragging || !containerRef.current) return;
      var rect = containerRef.current.getBoundingClientRect();
      var pct = ((e.clientX - rect.left) / rect.width) * 100;
      setLeftWidth(Math.max(10, Math.min(40, pct)));
    }
    function onUp() { setLeftDragging(false); }
    if (leftDragging) {
      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onUp);
    }
    return function() {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [leftDragging]);

  React.useEffect(() => {
    function onMove(e: MouseEvent) {
      if (!middleDragging || !containerRef.current) return;
      var rect = containerRef.current.getBoundingClientRect();
      var pct = ((e.clientX - rect.left) / rect.width) * 100;
      setMiddleWidth(Math.max(20, Math.min(60, pct - leftWidth)));
    }
    function onUp() { setMiddleDragging(false); }
    if (middleDragging) {
      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onUp);
    }
    return function() {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [middleDragging, leftWidth]);

  const handleSend = React.useCallback((content: string) => {
    setSelectedTurnId(null);
    sendMessage(content);
  }, [sendMessage]);

  const handleClear = React.useCallback(() => {
    setSelectedTurnId(null);
    clearChat();
    loadConversations();
  }, [clearChat, loadConversations]);

  return (
    <div
      ref={containerRef}
      style={{
        display: "flex",
        height: "100vh",
        width: "100vw",
        overflow: "hidden",
        backgroundColor: "#f5f5f5",
        userSelect: leftDragging || middleDragging ? "none" : undefined,
        cursor: leftDragging || middleDragging ? "col-resize" : undefined,
      }}
    >
      {/* Left: History Panel */}
      <div
        style={{
          width: leftWidth + "%",
          minWidth: 0,
          overflow: "hidden",
        }}
      >
        <HistoryPanel
          convs={convs}
          currentConvId={currentConvId}
          onNewChat={createNewConv}
          onSwitchConv={function(id) { setCurrentConvId(id); switchConversation(id); }}
          onDeleteConv={deleteConv}
        />
      </div>

      {/* Divider 1 */}
      <div
        onMouseDown={function(e) { e.preventDefault(); setLeftDragging(true); }}
        style={{
          width: "6px",
          cursor: "col-resize",
          backgroundColor: leftDragging ? "#1976d2" : "#e0e0e0",
          transition: "background-color 0.15s",
          flexShrink: 0,
        }}
      />

      {/* Middle: Chat Panel */}
      <div
        style={{
          width: middleWidth + "%",
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

      {/* Divider 2 */}
      <div
        onMouseDown={function(e) { e.preventDefault(); setMiddleDragging(true); }}
        style={{
          width: "6px",
          cursor: "col-resize",
          backgroundColor: middleDragging ? "#1976d2" : "#e0e0e0",
          transition: "background-color 0.15s",
          flexShrink: 0,
        }}
      />

      {/* Right: Trace Panel */}
      <div
        style={{
          flex: 1,
          minWidth: 0,
          backgroundColor: "#fff",
          overflow: "hidden",
          borderLeft: "1px solid #e0e0e0",
        }}
      >
        <TracePanel toolCalls={toolCalls} selectedTurnId={selectedTurnId} />
      </div>      {/* Error Toast */}
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
