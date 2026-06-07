export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

export interface ToolCall {
  tool_name: string;
  status: 'running' | 'completed' | 'failed';
  label?: string;
  result?: string;
  params?: Record<string, unknown>;
  error?: string;
  duration?: number;
}

export interface SSEEvent {
  event: string;
  data: string;
}

export interface WorkOrder {
  id: string;
  line: string;
  status: string;
  planned_qty: number;
  completed_qty: number;
  date: string;
  product: string;
}

export interface ProductionRecord {
  hour: string;
  line: string;
  output: number;
  target: number;
  oee: number;
}

export interface QualityRecord {
  batch: string;
  line: string;
  sample_size: number;
  defect_count: number;
  defect_type: string;
  hour: string;
}

export interface EquipmentRecord {
  id: string;
  line: string;
  status: string;
  alarm_code?: string;
  temperature?: number;
}


// Tool result data for rich rendering
export interface ToolResultData {
  tool_name: string;
  data: any;
}
