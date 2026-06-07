import { useState, useRef, useCallback } from 'react';
import { ChatMessage, ToolCall } from '../types';
import { streamChat } from '../services/hermes';

export function useSSE() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [toolCalls, setToolCalls] = useState<ToolCall[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const aborterRef = useRef<AbortController | null>(null);
  const assistantIdRef = useRef<string>('');
  const contentRef = useRef('');

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
              return [...prev, { ...tool, status: tool.status as "running" | "completed" | "failed" }];
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
    isLoading,
    error,
    sendMessage,
    stopStreaming,
    clearChat,
  };
}



