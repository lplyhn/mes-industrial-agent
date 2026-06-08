import React from "react";

interface Props {
  convs: any[];
  currentConvId: string;
  onNewChat: () => void;
  onSwitchConv: (id: string) => void;
  onDeleteConv: (id: string) => void;
  onRenameConv?: (id: string, title: string) => void;
}

export const HistoryPanel: React.FC<Props> = ({
  convs,
  currentConvId,
  onNewChat,
  onSwitchConv,
  onDeleteConv,
  onRenameConv,
}) => {
  var [editingId, setEditingId] = React.useState<string | null>(null);
  var [editValue, setEditValue] = React.useState("");

  function startEdit(id: string, title: string) {
    setEditingId(id);
    setEditValue(title || "");
  }

  function commitEdit() {
    var id = editingId;
    var val = editValue;
    setEditingId(null);
    if (id && val.trim() && onRenameConv) {
      onRenameConv(id, val.trim());
    }
  }

  return (
    <div style={{
      height: "100%",
      display: "flex",
      flexDirection: "column",
      backgroundColor: "#fafafa",
      borderRight: "1px solid #e0e0e0",
    }}>
      {/* Header */}
      <div style={{
        padding: "16px 16px 12px",
        borderBottom: "1px solid #e0e0e0",
      }}>
        <div style={{ fontSize: "14px", fontWeight: 600, color: "#333", marginBottom: "10px" }}>
          MES 工业智能助手
        </div>
        <button
          onClick={onNewChat}
          style={{
            width: "100%",
            padding: "8px 0",
            border: "1px solid #1976d2",
            borderRadius: "6px",
            backgroundColor: "#e3f2fd",
            cursor: "pointer",
            fontSize: "13px",
            color: "#1976d2",
            fontWeight: 500,
            transition: "all 0.15s",
          }}
          onMouseEnter={(e) => { (e.target as HTMLElement).style.backgroundColor = "#bbdefb"; }}
          onMouseLeave={(e) => { (e.target as HTMLElement).style.backgroundColor = "#e3f2fd"; }}
        >
          + 新对话
        </button>
      </div>

      {/* Conversation list */}
      <div style={{ flex: 1, overflowY: "auto", padding: "8px 0" }}>
        {(!convs || convs.length === 0) && (
          <div style={{ textAlign: "center", padding: "24px 16px", color: "#bbb", fontSize: "12px" }}>
            暂无对话记录
          </div>
        )}
        {convs && convs.map(function(cv: any) {
          var isActive = cv.id === currentConvId;
          return (
            <div
              key={cv.id}
              onClick={function() { onSwitchConv(cv.id); }}
              style={{
                padding: "10px 16px",
                cursor: "pointer",
                borderLeft: isActive ? "3px solid #1976d2" : "3px solid transparent",
                backgroundColor: isActive ? "#e3f2fd" : "transparent",
                transition: "all 0.15s",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
              onMouseEnter={function(e) { if (!isActive) { (e.currentTarget as HTMLElement).style.backgroundColor = "#f0f0f0"; } }}
              onMouseLeave={function(e) { if (!isActive) { (e.currentTarget as HTMLElement).style.backgroundColor = "transparent"; } }}
            >
              {editingId === cv.id ? (
                <input
                  autoFocus
                  value={editValue}
                  onChange={function(e) { setEditValue(e.target.value); }}
                  onBlur={commitEdit}
                  onKeyDown={function(e) { if (e.key === 'Enter') commitEdit(); if (e.key === 'Escape') setEditingId(null); }}
                  onClick={function(e) { e.stopPropagation(); }}
                  style={{
                    flex: 1,
                    fontSize: "13px",
                    padding: "2px 4px",
                    border: "1px solid #1976d2",
                    borderRadius: "3px",
                    outline: "none",
                    backgroundColor: "#fff",
                  }}
                />
              ) : (
                <span style={{
                  fontSize: "13px",
                  color: isActive ? "#1976d2" : "#555",
                  fontWeight: isActive ? 500 : 400,
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  flex: 1,
                  cursor: "text",
                }}
                  onDoubleClick={function(e) { e.stopPropagation(); startEdit(cv.id, cv.title); }}
                >
                  {cv.title || "新对话"}
                </span>
              )}
              <span
                onClick={function(e) { e.stopPropagation(); startEdit(cv.id, cv.title); }}
                style={{
                  fontSize: "11px",
                  color: "#999",
                  cursor: "pointer",
                  padding: "2px 4px",
                  visibility: isActive ? "visible" : "hidden",
                  marginRight: "2px",
                }}
                title="重命名"
              >
                ✏
              </span>
              <span
                onClick={function(e) { e.stopPropagation(); onDeleteConv(cv.id); }}
                style={{
                  fontSize: "14px",
                  color: "#ccc",
                  cursor: "pointer",
                  padding: "2px 4px",
                  visibility: isActive ? "visible" : "hidden",
                }}
                title="删除对话"
              >
                ×
              </span>
            </div>
          );
        })}
      </div>

      {/* Footer */}
      <div style={{
        padding: "12px 16px",
        borderTop: "1px solid #e0e0e0",
        fontSize: "11px",
        color: "#999",
        textAlign: "center",
      }}>
        Hermes Agent + MCP
      </div>
    </div>
  );
};
