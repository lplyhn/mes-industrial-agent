import { useState, useRef, useCallback } from 'react';
import { ChatMessage, ToolCall } from '../types';
import { streamChat, listConversations, createConversation, updateConversation, getConversation } from '../services/hermes';

export function useSSE() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [toolCalls, setToolCalls] = useState<ToolCall[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const aborterRef = useRef<AbortController | null>(null);
  const assistantIdRef = useRef<string>('');
  const contentRef = useRef('');
  const turnIdRef = useRef<string>('');
  const convIdRef = useRef<string>('');
  const [convs, setConvs] = useState<any[]>([]);

  

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

  const createNewConv = useCallback(async () => {
    try {
      const conv = await createConversation();
      convIdRef.current = conv.id;
      setMessages([]);
      setToolCalls([]);
      setError(null);
      await loadConversations();
    } catch (e) { console.error(e); }
  }, [loadConversations]);

const sendMessage = useCallback(async (content: string) => {
    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content,
      timestamp: Date.now(),
    };

    setMessages(prev => [...prev, userMsg]);
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
              return [...prev, { ...tool, status: tool.status as "running" | "completed" | "failed", turnId: turnIdRef.current }];
            });
          },
          onDone: (fullContent) => {
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
  };
}



