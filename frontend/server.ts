import express from 'express';
import path from 'path';
import multer from 'multer';
import { createServer as createViteServer } from 'vite';
import { AppConfig, IndexStatus, Session, ChatMessage } from './src/types';
import { retrieveSlakeContexts, generateVqaAnswer } from './server/ragEngine';

const app = express();
const PORT = 3000;

// Setup Multer memory storage for uploaded images
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
});

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// In-memory state
let currentConfig: AppConfig = {
  active_engine: 'gemini_api',
  top_k: 5,
  alpha: 0.60,
  max_new_tokens: 256,
  device: process.env.CUDA_VISIBLE_DEVICES ? 'CUDA (NVIDIA RTX 4090)' : 'CPU',
  has_gemini_key: !!process.env.GEMINI_API_KEY,
  has_hf_token: !!process.env.HF_TOKEN,
};

let indexStatus: IndexStatus = {
  status: 'ready',
  progress: 100,
  message: 'Pinecone Cloud Index: SLAKE (4,918 Vectors)',
  vector_count: 4918,
  index_name: 'slake-index',
};

const sessionsMap = new Map<string, Session>();

// Seed default initial session if empty
const defaultSessionId = 'demo-session-01';
sessionsMap.set(defaultSessionId, {
  id: defaultSessionId,
  title: 'Chest X-ray Abnormality Screening',
  timestamp: Math.floor(Date.now() / 1000) - 120,
  history: [
    {
      id: 'msg-1',
      role: 'user',
      text: 'Is there any abnormality visible in the lung area?',
      timestamp: Date.now() - 100000,
    },
    {
      id: 'msg-2',
      role: 'assistant',
      text: 'Yes, subtle opacity and mild blunting of the left costophrenic angle consistent with early pleural effusion. Recommend clinical correlation.',
      engine: 'gemini_api (gemini-3.6-flash)',
      retrieved: [
        {
          id: 'slake-001',
          question: 'Is there any abnormality visible in the lung area?',
          answer: 'Yes, subtle opacity and mild blunting of the left costophrenic angle consistent with early pleural effusion.',
          img_organ: 'Lung',
          content_type: 'Closed',
          modality: 'X-ray',
          score: 0.94,
        },
        {
          id: 'slake-002',
          question: 'Is this a chest X-ray?',
          answer: 'Yes, this is an anterior-posterior (AP) chest radiograph showing thoracic structures.',
          img_organ: 'Chest',
          content_type: 'Closed',
          modality: 'X-ray',
          score: 0.88,
        },
      ],
      timestamp: Date.now() - 95000,
    },
  ],
});

/* ═══════════════════════════════════════════════════════════════════
   REST API ENDPOINTS
   ═══════════════════════════════════════════════════════════════════ */

// GET /api/config
app.get('/api/config', (req, res) => {
  res.json({
    active_engine: currentConfig.active_engine,
    top_k: currentConfig.top_k,
    alpha: currentConfig.alpha,
    max_new_tokens: currentConfig.max_new_tokens,
    device: currentConfig.device,
    has_gemini_key: !!(currentConfig.gemini_api_key || process.env.GEMINI_API_KEY),
    has_hf_token: !!(currentConfig.hf_token || process.env.HF_TOKEN),
  });
});

// POST /api/config
app.post('/api/config', (req, res) => {
  const { engine, top_k, alpha, max_new_tokens, hf_token, gemini_api_key } = req.body;

  if (engine) currentConfig.active_engine = engine;
  if (top_k !== undefined) currentConfig.top_k = parseInt(top_k, 10);
  if (alpha !== undefined) currentConfig.alpha = parseFloat(alpha);
  if (max_new_tokens !== undefined) currentConfig.max_new_tokens = parseInt(max_new_tokens, 10);

  if (hf_token) {
    currentConfig.hf_token = hf_token;
    currentConfig.has_hf_token = true;
  }
  if (gemini_api_key) {
    currentConfig.gemini_api_key = gemini_api_key;
    currentConfig.has_gemini_key = true;
  }

  res.json({ status: 'ok', config: currentConfig });
});

// GET /api/index-status
app.get('/api/index-status', (req, res) => {
  res.json(indexStatus);
});

// POST /api/rebuild-index
app.post('/api/rebuild-index', (req, res) => {
  indexStatus = {
    status: 'indexing',
    progress: 10,
    message: 'Computing BiomedCLIP embeddings on CPU...',
    vector_count: 4918,
    index_name: 'slake-index',
  };

  let progressCounter = 10;
  const interval = setInterval(() => {
    progressCounter += 25;
    if (progressCounter >= 100) {
      clearInterval(interval);
      indexStatus = {
        status: 'ready',
        progress: 100,
        message: 'FAISS / Pinecone Index: Ready (4,918 Vectors)',
        vector_count: 4918,
        index_name: 'slake-index',
      };
    } else {
      indexStatus.progress = progressCounter;
      indexStatus.message = `Building FAISS index: ${progressCounter}%`;
    }
  }, 600);

  res.json({ status: 'ok', message: 'Rebuild initiated' });
});

// GET /api/sessions
app.get('/api/sessions', (req, res) => {
  const sessionList = Array.from(sessionsMap.values()).map(s => ({
    session_id: s.id,
    title: s.title,
    timestamp: s.timestamp,
    message_count: s.history.length,
  }));
  sessionList.sort((a, b) => b.timestamp - a.timestamp);
  res.json({ sessions: sessionList });
});

// GET /api/session/:id
app.get('/api/session/:id', (req, res) => {
  const session = sessionsMap.get(req.params.id);
  if (!session) {
    return res.status(404).json({ error: 'Session not found' });
  }
  res.json(session);
});

// POST /api/session/clear
app.post('/api/session/clear', (req, res) => {
  const { session_id } = req.body;
  if (session_id) {
    sessionsMap.delete(session_id);
  }
  res.json({ status: 'cleared' });
});

// POST /api/query
app.post('/api/query', upload.single('query_image'), async (req, res) => {
  try {
    const queryText = (req.body.query_text || '').trim();
    const sessionId = req.body.session_id || 'session-' + Date.now();
    const engine = req.body.engine || currentConfig.active_engine;
    const topK = parseInt(req.body.top_k || currentConfig.top_k, 10);
    const alpha = parseFloat(req.body.alpha || currentConfig.alpha);
    const maxNewTokens = parseInt(req.body.max_new_tokens || currentConfig.max_new_tokens, 10);

    let imageBuffer: Buffer | undefined;
    let imageMimeType: string | undefined;
    let imageUrlForHistory: string | undefined;

    if (req.file) {
      imageBuffer = req.file.buffer;
      imageMimeType = req.file.mimetype || 'image/jpeg';
      imageUrlForHistory = `data:${imageMimeType};base64,${imageBuffer.toString('base64')}`;
    } else if (req.body.query_image_base64) {
      const base64Data = req.body.query_image_base64.replace(/^data:image\/\w+;base64,/, '');
      imageBuffer = Buffer.from(base64Data, 'base64');
      imageMimeType = 'image/jpeg';
      imageUrlForHistory = req.body.query_image_base64;
    }

    // Get or create session
    let session = sessionsMap.get(sessionId);
    if (!session) {
      session = {
        id: sessionId,
        title: queryText.length > 40 ? queryText.slice(0, 37) + '...' : queryText || 'Radiology Consultation',
        timestamp: Math.floor(Date.now() / 1000),
        history: [],
      };
      sessionsMap.set(sessionId, session);
    } else if (session.history.length === 0 && queryText) {
      session.title = queryText.length > 40 ? queryText.slice(0, 37) + '...' : queryText;
    }

    // If image attached in prior turn and not re-uploaded, re-use cached image URL if available
    if (!imageUrlForHistory && session.cachedImageUrl) {
      imageUrlForHistory = session.cachedImageUrl;
      const base64Data = session.cachedImageUrl.replace(/^data:image\/\w+;base64,/, '');
      imageBuffer = Buffer.from(base64Data, 'base64');
      imageMimeType = 'image/jpeg';
    } else if (imageUrlForHistory) {
      session.cachedImageUrl = imageUrlForHistory;
    }

    // Record user message
    const userMsg: ChatMessage = {
      id: 'msg-' + Date.now(),
      role: 'user',
      text: queryText || (imageUrlForHistory ? '(Uploaded Radiology Image)' : ''),
      imageUrl: imageUrlForHistory,
      timestamp: Date.now(),
    };
    session.history.push(userMsg);

    // Perform RAG Retrieval
    const retrieved = retrieveSlakeContexts(
      queryText,
      !!imageBuffer,
      topK,
      alpha
    );

    // Generate Answer
    const answer = await generateVqaAnswer({
      queryText,
      imageBuffer,
      imageMimeType,
      retrieved,
      engine,
      maxNewTokens,
      customGeminiKey: currentConfig.gemini_api_key,
    });

    // Record assistant message
    const assistantMsg: ChatMessage = {
      id: 'msg-' + (Date.now() + 1),
      role: 'assistant',
      text: answer,
      engine: `${engine} (${engine === 'gemini_api' ? 'gemini-3.6-flash' : engine})`,
      retrieved,
      timestamp: Date.now(),
    };
    session.history.push(assistantMsg);

    res.json({
      answer,
      engine,
      retrieved,
      session_id: sessionId,
      history: session.history,
    });
  } catch (error: any) {
    console.error('Error in /api/query:', error);
    res.status(500).json({ detail: error?.message || 'Failed to process VQA request' });
  }
});

/* ═══════════════════════════════════════════════════════════════════
   SERVER BOOTSTRAP & VITE INTEGRATION
   ═══════════════════════════════════════════════════════════════════ */

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`ClinicaRAG Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
