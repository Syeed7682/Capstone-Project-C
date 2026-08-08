export interface SlakeSample {
  id: string;
  question: string;
  answer: string;
  img_organ: string;
  content_type: 'Closed' | 'Open' | 'OOD';
  modality: 'X-ray' | 'MRI' | 'CT' | 'Ultrasound';
  plane?: 'Coronal' | 'Sagittal' | 'Axial';
  keywords: string[];
  sample_vector: number[];
}

export interface RetrievedContext {
  id: string;
  question: string;
  answer: string;
  img_organ: string;
  content_type: string;
  modality: string;
  score: number; // 0.0 to 1.0
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  imageUrl?: string;
  engine?: string;
  retrieved?: RetrievedContext[];
  timestamp: number;
}

export interface Session {
  id: string;
  title: string;
  timestamp: number;
  history: ChatMessage[];
  cachedImageUrl?: string;
}

export interface AppConfig {
  active_engine: 'gemini_api' | 'huggingface_api' | 'local_moondream' | 'local_llava';
  top_k: number;
  alpha: number;
  max_new_tokens: number;
  device: string;
  has_gemini_key: boolean;
  has_hf_token: boolean;
  hf_token?: string;
  gemini_api_key?: string;
}

export interface IndexStatus {
  status: 'ready' | 'indexing' | 'failed';
  progress: number;
  message: string;
  vector_count: number;
  index_name: string;
}
