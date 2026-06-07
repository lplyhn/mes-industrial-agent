const HERMES_URL = 'http://localhost:8642/v1/chat/completions';

export interface StreamCallbacks {
  onContent: (content: string) => void;
  onToolProgress: (tool: {
    tool_name: string;
    status: string;
    label?: string;
    result?: string;
  }) => void;
  onDone: (fullContent: string) => void;
  onError: (error: string) => void;
}

export async function streamChat(
  messages: { role: string; content: string }[],
  callbacks: StreamCallbacks,
  signal?: AbortSignal
): Promise<void> {
  const response = await fetch(HERMES_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer YOUR_API_KEY',
    },
    body: JSON.stringify({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: '你是一个 MES 工业助手，擅长回答工单、生产、质量、设备相关问题。' },
        ...messages,
      ],
      stream: true,
      temperature: 0.3,
      max_tokens: 4096,
    }),
    signal,
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`HTTP ${response.status}: ${errText}`);
  }

  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error('Response body is not readable');
  }

  const decoder = new TextDecoder();
  let buffer = '';
  let fullContent = '';
  let currentEvent = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;

        if (trimmed.startsWith('event: ')) {
          currentEvent = trimmed.slice(7).trim();
          continue;
        }

        if (trimmed.startsWith('data: ')) {
          const dataStr = trimmed.slice(6).trim();
          if (dataStr === '[DONE]') continue;

          try {
            const parsed = JSON.parse(dataStr);
            parseSSEData(currentEvent, parsed, callbacks, () => fullContent);
          } catch {}
          continue;
        }
      }
    }

    // Process remaining buffer
    if (buffer.trim()) {
      const trimmed = buffer.trim();
      if (trimmed.startsWith('data: ')) {
        const dataStr = trimmed.slice(6).trim();
        if (dataStr !== '[DONE]') {
          try {
            const parsed = JSON.parse(dataStr);
            parseSSEData(currentEvent, parsed, callbacks, () => fullContent);
          } catch {}
        }
      }
    }

    callbacks.onDone(fullContent);
  } catch (err: unknown) {
    if (err instanceof Error && err.name === 'AbortError') return;
    callbacks.onError(err instanceof Error ? err.message : String(err));
  }
}

function parseSSEData(
  currentEvent: string,
  parsed: any,
  callbacks: StreamCallbacks,
  getFullContent: () => string
) {
  if (currentEvent === 'hermes.tool.progress') {
    // 1. Update agent trace (right panel)
    if (callbacks.onToolProgress && parsed.tool) {
      let toolName = parsed.tool;
      if (toolName.startsWith('mcp_mes_')) {
        toolName = toolName.slice(8);
      }
      callbacks.onToolProgress({
        tool_name: toolName,
        status: parsed.status || 'running',
        label: parsed.label,
        result: parsed.result,
      });
    }

    // 2. Extract LLM text content from tool progress
    const delta = parsed.choices?.[0]?.delta;
    if (delta?.content) {
      callbacks.onContent(delta.content);
    }
    return;
  }

  // Standard OpenAI SSE chunk
  const delta = parsed.choices?.[0]?.delta;
  if (delta?.content) {
    callbacks.onContent(delta.content);
  }
}
