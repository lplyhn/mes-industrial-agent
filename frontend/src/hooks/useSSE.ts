import { useState, useRef, useCallback, useEffect } from 'react';
import { ChatMessage, ToolCall } from '../types';
import { streamChat, listConversations, createConversation, updateConversation, getConversation, deleteConversation, analyzeToolData } from '../services/hermes';

export function useSSE() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  
  const [toolCalls, setToolCalls] = useState<ToolCall[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const aborterRef = useRef<AbortController | null>(null);
  const assistantIdRef = useRef<string>('');
  const contentRef = useRef('');
  const messagesRef = useRef<any[]>([]);
  const toolCallsRef = useRef<any[]>([]);
  const turnIdRef = useRef<string>('');
  const saveDataRef = useRef({ messages: [] as any[], toolCalls: [] as any[] });
  const convIdRef = useRef<string>('');
  const [convs, setConvs] = useState<any[]>([]);

  // Keep refs in sync with state
  const msgs = messages;
  const tcs = toolCalls;

  

  const loadConversations = useCallback(async () => {
    try { const r = await listConversations(); setConvs(r); } catch {} },
    []
  );

  const switchConversation = useCallback(async (id: string) => {
    try {
      const conv = await getConversation(id);
      setMessages(conv.messages || []);
      setToolCalls(conv.toolCalls || []);
      convIdRef.current = id;
      setError(null);
    } catch (e) { console.error(e); }
  }, []);

  const saveCurrentConv = useCallback(async (mid: string, msgs: any[], tcs: any[]) => {
    if (!mid) return;
    try {
      const title = msgs.length > 0 ? (typeof msgs[0].content === 'string' ? msgs[0].content.slice(0, 30) : '\u65b0\u5bf9\u8bdd') : '\u65b0\u5bf9\u8bdd';
      await updateConversation(mid, { title, messages: msgs, toolCalls: tcs });
    } catch (e) { console.error(e); }
  }, []);

  const deleteConv = useCallback(async (id: string) => {
    try {
      if (id === convIdRef.current) {
        convIdRef.current = '';
        setMessages([]);
        setToolCalls([]);
      }
      await deleteConversation(id);
      await loadConversations();
    } catch (e) { console.error(e); }
  }, [loadConversations]);

  const renameConv = useCallback(async (id: string, title: string) => {
    try {
      await updateConversation(id, { title });
      await loadConversations();
    } catch (e) { console.error(e); }
  }, [loadConversations]);

  const createNewConv = useCallback(async () => {
    try {
      // Save current conversation before switching
      if (convIdRef.current) {
        try {
          var sd = saveDataRef.current || { messages: [], toolCalls: [] };
          var msgs = sd.messages || [];
          var tcs = sd.toolCalls || [];
          var title = msgs.length > 0 ? (typeof msgs[0].content === 'string' ? msgs[0].content.slice(0, 30) : '???') : '???';
          await updateConversation(convIdRef.current, { title: title, messages: msgs, toolCalls: tcs });
        } catch(e) { console.error(e); }
      }
      const conv = await createConversation();
      convIdRef.current = conv.id;
      setMessages([]);
      setToolCalls([]);
      setError(null);
      await loadConversations();
    } catch (e) { console.error(e); }
  }, [loadConversations]);


  // Sync ref with latest state for save operations
  useEffect(() => {
    saveDataRef.current = { messages, toolCalls };
  }, [messages, toolCalls]);

const sendMessage = useCallback(async (content: string) => {
    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content,
      timestamp: Date.now(),
    };

    if (!convIdRef.current) { try { const nc = await createConversation(); convIdRef.current = nc.id; await loadConversations(); } catch {} }
    // Save user msg to DB first
    if (convIdRef.current) {
      try {
        var cur = saveDataRef.current || { messages: [], toolCalls: [] };
        var nm = (cur.messages || []).concat([userMsg]);
        await updateConversation(convIdRef.current, { messages: nm, toolCalls: cur.toolCalls || [] });
        saveDataRef.current = { messages: nm, toolCalls: cur.toolCalls || [] };
      } catch(e) { console.error(e); }
    }
    setMessages(prev => { var nm = [...prev, userMsg]; saveDataRef.current = { messages: nm, toolCalls: saveDataRef.current.toolCalls || [] }; return nm; });
    setIsLoading(true);
    setError(null);
    

    const assistantId = `assistant-${Date.now()}`;
    assistantIdRef.current = assistantId;
    turnIdRef.current = assistantId;
    contentRef.current = '';

    const abortController = new AbortController();
    aborterRef.current = abortController;

    try {
      await streamChat(
        [
          { role: 'user', content },
        ],
        {
          onContent: (chunk) => {
            contentRef.current += chunk;
            setMessages(prev => {
              const exists = prev.find(m => m.id === assistantId);
              if (exists) {
                return prev.map(m =>
                  m.id === assistantId ? { ...m, content: contentRef.current } : m
                );
              }
              const assistantMsg: ChatMessage = {
                id: assistantId,
                role: 'assistant',
                content: contentRef.current,
                timestamp: Date.now(),
              };
              return [...prev, assistantMsg];
            });
          },
          onToolProgress: (tool) => {
            setToolCalls(prev => {
              const idx = prev.findIndex(t => t.tool_name === tool.tool_name && t.status === 'running');
              if (idx >= 0) {
                const updated = [...prev];
                updated[idx] = { ...updated[idx], status: tool.status as "running" | "completed" | "failed" };
                return updated;
              }
              var newTC = [...prev, { ...tool, status: tool.status as "running" | "completed" | "failed", turnId: turnIdRef.current }];
              saveDataRef.current = { messages: saveDataRef.current.messages || [], toolCalls: newTC };
              // Trigger AI analysis when tool completes
              if (tool.status === 'completed' && tool.result && tool.result !== 'OK') {
                try {
                  const parsed = JSON.parse(tool.result);
                  if (parsed && typeof parsed === 'object' && Object.keys(parsed).length > 0) {
                    analyzeToolData(parsed, tool.tool_name).then(function(analysis) {
                      if (analysis) {
                        setToolCalls(function(prev2) {
                          var idx2 = prev2.findIndex(function(t) { return t.tool_name === tool.tool_name && t.status === 'completed'; });
                          if (idx2 >= 0) {
                            var u2 = [...prev2];
                            u2[idx2] = { ...u2[idx2], aiAnalysis: analysis };
                            saveDataRef.current = { messages: saveDataRef.current.messages || [], toolCalls: u2 };
                            return u2;
                          }
                          return prev2;
                        });
                      }
                    });
                  }
                } catch(e) {}
              }
              return newTC;
            });
          },
          onDone: async (fullContent) => {
            if (convIdRef.current) {
              try {
                var sd = saveDataRef.current || { messages: [], toolCalls: [] };
                var msgs = sd.messages || [];
                var tcs = sd.toolCalls || [];
                var title = msgs.length > 0 ? (typeof msgs[0].content === 'string' ? msgs[0].content.slice(0, 30) : '新对话') : '新对话';
                await updateConversation(convIdRef.current, { title: title, messages: msgs, toolCalls: tcs });
                await loadConversations();
              } catch(e) { console.error(e); }
            }
            setIsLoading(false);
          },
          onError: (err) => {
            setError(err);
            setIsLoading(false);
          },
        },
        abortController.signal
      );
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') {
        setIsLoading(false);
        return;
      }
      setError(err instanceof Error ? err.message : String(err));
      setIsLoading(false);
    }
  }, []);

  const stopStreaming = useCallback(() => {
    aborterRef.current?.abort();
    setIsLoading(false);
  }, []);

  const clearChat = useCallback(() => {
    setMessages([]);
    setToolCalls([]);
    setError(null);
  }, []);

  return {
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
    renameConv,
  };
}



