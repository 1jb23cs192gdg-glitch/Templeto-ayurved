import express, { Request, Response } from 'express';
import http from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { GoogleGenAI, Modality, type LiveServerMessage } from '@google/genai';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);
const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

// Generous payload limits for base64 image data
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Initialize GoogleGenAI server-side with User-Agent header
const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY || '';
const ai = new GoogleGenAI({
  apiKey,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    },
  },
});

// Helper for error responses
function handleGeminiError(error: any, res: Response, defaultMessage: string) {
  console.error('[Gemini API Server Error]:', error);
  const status = error?.status || error?.statusCode || 500;
  const message = error?.message || defaultMessage;
  
  if (message.includes('API_KEY_INVALID') || message.includes('PERMISSION_DENIED') || status === 403 || status === 400) {
    return res.status(status).json({
      error: 'Invalid or missing API key. Please check your key in Settings > Secrets.',
      details: message
    });
  }
  if (status === 429) {
    return res.status(429).json({
      error: 'Quota exhausted. Check billing or select an API key in Settings > Secrets.',
      details: message
    });
  }
  return res.status(status).json({
    error: defaultMessage,
    details: message
  });
}

// Extract grounding links helper
function extractGroundingLinks(candidate: any) {
  const chunks = candidate?.groundingMetadata?.groundingChunks || [];
  const links: Array<{ type: 'map' | 'web'; title: string; uri: string }> = [];

  chunks.forEach((c: any) => {
    if (c.maps?.uri) {
      links.push({
        type: 'map',
        title: c.maps.title || 'View Location on Google Maps',
        uri: c.maps.uri
      });
    }
    if (c.web?.uri) {
      links.push({
        type: 'web',
        title: c.web.title || 'Read Verified Source',
        uri: c.web.uri
      });
    }
  });

  return links;
}

// 1. Health check
app.get('/api/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    hasKey: Boolean(apiKey),
    timestamp: new Date().toISOString()
  });
});

// 2. Chat Endpoint (VEDA Assistant with Google Maps / Google Search Grounding)
app.post('/api/gemini/chat', async (req: Request, res: Response) => {
  try {
    const { message, activeMode, userCoords } = req.body;
    if (!message || typeof message !== 'string') {
      return res.status(400).json({ error: 'Message is required' });
    }

    let config: any;
    if (activeMode === 'maps') {
      config = {
        tools: [{ googleMaps: {} }],
        systemInstruction: "You are VEDA (Virtual Eco-Devotion Assistant), a knowledgeable guide for 'Temple to Ayurveda'. You are deeply respectful of Indian culture, Vedas, and modern recycling technology. Always use Google Maps data to look up accurate locations, verified sacred temples, distances, routes, and addresses in India. When mentioning places, provide the specific name and location.",
      };
      if (userCoords && userCoords.latitude && userCoords.longitude) {
        config.toolConfig = {
          retrievalConfig: {
            latLng: {
              latitude: userCoords.latitude,
              longitude: userCoords.longitude,
            }
          }
        };
      }
    } else {
      config = {
        tools: [{ googleSearch: {} }],
        systemInstruction: "You are VEDA (Virtual Eco-Devotion Assistant), an environmental & Ayurvedic intelligence agent. Always use Google Search data to fetch real-time updates regarding temple waste management, river pollution (Ganga, Yamuna, Godavari), latest Indian environmental policies, circular economy, and verified Ayurvedic botanical facts.",
      };
    }

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: message,
      config
    });

    const text = response.text || "I was unable to retrieve a response. Please try rephrasing your sacred query.";
    const candidate = response.candidates?.[0];
    const links = extractGroundingLinks(candidate);
    const searchQueries = candidate?.groundingMetadata?.webSearchQueries || [];

    return res.json({ text, links, searchQueries });
  } catch (error: any) {
    return handleGeminiError(error, res, 'Failed to generate chat response.');
  }
});

// 3. Streaming Chat Endpoint (Server-Sent Events)
app.post('/api/gemini/chat-stream', async (req: Request, res: Response) => {
  try {
    const { message, activeMode, userCoords } = req.body;
    if (!message || typeof message !== 'string') {
      return res.status(400).json({ error: 'Message is required' });
    }

    let config: any;
    if (activeMode === 'maps') {
      config = {
        tools: [{ googleMaps: {} }],
        systemInstruction: "You are VEDA (Virtual Eco-Devotion Assistant), a knowledgeable guide for 'Temple to Ayurveda'. Always use Google Maps data to look up accurate locations, verified temples, routes, and distances in India.",
      };
      if (userCoords && userCoords.latitude && userCoords.longitude) {
        config.toolConfig = {
          retrievalConfig: {
            latLng: {
              latitude: userCoords.latitude,
              longitude: userCoords.longitude,
            }
          }
        };
      }
    } else {
      config = {
        tools: [{ googleSearch: {} }],
        systemInstruction: "You are VEDA (Virtual Eco-Devotion Assistant), an environmental & Ayurvedic intelligence agent. Use Google Search data for real-time updates on sacred waste management and circular economy.",
      };
    }

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    const stream = await ai.models.generateContentStream({
      model: 'gemini-3.8-flash',
      contents: message,
      config
    });

    let lastCandidate: any = null;

    for await (const chunk of stream) {
      if (chunk.candidates?.[0]) {
        lastCandidate = chunk.candidates[0];
      }
      if (chunk.text) {
        res.write(`data: ${JSON.stringify({ text: chunk.text })}\n\n`);
      }
    }

    const links = extractGroundingLinks(lastCandidate);
    const searchQueries = lastCandidate?.groundingMetadata?.webSearchQueries || [];
    res.write(`data: ${JSON.stringify({ done: true, links, searchQueries })}\n\n`);
    res.end();
  } catch (error: any) {
    console.error('Chat stream error:', error);
    if (!res.headersSent) {
      handleGeminiError(error, res, 'Failed to stream chat response.');
    } else {
      res.write(`data: ${JSON.stringify({ error: error.message || 'Stream error occurred.' })}\n\n`);
      res.end();
    }
  }
});

// 4. Grounding Query Endpoint (Google Maps Grounding & Google Search Grounding)
app.post('/api/gemini/grounding', async (req: Request, res: Response) => {
  try {
    const { prompt, type, coords } = req.body;
    if (!prompt) {
      return res.status(400).json({ error: 'Prompt is required' });
    }

    const isMaps = type === 'maps';
    const config: any = {
      tools: isMaps ? [{ googleMaps: {} }] : [{ googleSearch: {} }],
    };

    if (isMaps && coords && coords.latitude && coords.longitude) {
      config.toolConfig = {
        retrievalConfig: {
          latLng: {
            latitude: coords.latitude,
            longitude: coords.longitude,
          }
        }
      };
    }

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: prompt,
      config
    });

    const text = response.text || '';
    const candidate = response.candidates?.[0];
    const links = extractGroundingLinks(candidate);
    const searchQueries = candidate?.groundingMetadata?.webSearchQueries || [];

    return res.json({ text, links, searchQueries });
  } catch (error: any) {
    return handleGeminiError(error, res, 'Grounding query failed.');
  }
});

// 5. Waste Analysis Endpoint (Multimodal Image Analysis for Ritual Waste Segregation)
app.post('/api/gemini/analyze-waste', async (req: Request, res: Response) => {
  try {
    const { base64Data, mimeType, prompt } = req.body;
    if (!base64Data || !mimeType) {
      return res.status(400).json({ error: 'base64Data and mimeType are required' });
    }

    const promptText = prompt || `
      Analyze this image of temple/ritual waste. 
      Identify the items (e.g., Flowers, Coconuts, Plastic, Incense sticks, Cloth, Ash, Paper).
      Estimate the composition percentage.
      Determine if it is Biodegradable or Non-biodegradable.
      Suggest the recycling output (e.g., Flowers -> Incense, Coconut -> Biofuel).
      
      CRITICAL: Recommend the correct Bin(s) for the detected waste types from these options:
      1. "Flower Waste Bin" (for flowers, garlands, organic soft waste)
      2. "Plastic Waste Bin" (for bottles, wrappers, packets, non-biodegradable)
      3. "Coconut Shell Bin" (for hard coconut shells)
      4. "Paper/Cloth Bin" (for books, paper, religious cloth, chunri)

      If the image contains mixed waste (e.g. flowers mixed with plastic bottles), suggest MULTIPLE bins so the user can segregate them.
      
      Return the response in this JSON format ONLY:
      {
        "items": [
          {"name": "Item Name", "category": "Bio/Non-Bio", "percentage": "XX%", "recycleOutput": "Product Name"}
        ],
        "overallRecyclability": "High/Medium/Low",
        "recommendedBins": ["Bin Name 1", "Bin Name 2"],
        "summary": "One sentence summary"
      }
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: {
        parts: [
          { inlineData: { mimeType, data: base64Data } },
          { text: promptText }
        ]
      },
      config: {
        responseMimeType: 'application/json'
      }
    });

    const text = response.text;
    if (!text) {
      throw new Error('Empty response from model');
    }

    const parsed = JSON.parse(text);
    return res.json({ analysis: parsed });
  } catch (error: any) {
    return handleGeminiError(error, res, 'Waste analysis failed.');
  }
});

// 6. Image Generation Endpoint (Temple AI Studio)
app.post('/api/gemini/generate-image', async (req: Request, res: Response) => {
  try {
    const { prompt } = req.body;
    if (!prompt) {
      return res.status(400).json({ error: 'Prompt is required' });
    }

    const response = await ai.models.generateImages({
      model: 'imagen-3.0-generate-002',
      prompt,
      config: {
        numberOfImages: 1,
        outputMimeType: 'image/jpeg',
        aspectRatio: '1:1',
      }
    });

    if (response.generatedImages && response.generatedImages[0]?.image?.imageBytes) {
      const base64String = response.generatedImages[0].image.imageBytes;
      return res.json({ image: `data:image/jpeg;base64,${base64String}` });
    }

    return res.status(500).json({ error: 'No image generated. Please try a different prompt.' });
  } catch (error: any) {
    return handleGeminiError(error, res, 'Image generation failed.');
  }
});

// 7. WebSocket Live API Audio Bridge (/live)
const wss = new WebSocketServer({ server, path: '/live' });

wss.on('connection', async (clientWs: WebSocket) => {
  console.log('[Gemini Live API]: Client connected via WebSocket');
  let session: any = null;

  try {
    session = await ai.live.connect({
      model: 'gemini-3.8-live',
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Zephyr' } },
        },
        systemInstruction: "You are VEDA (Virtual Eco-Devotion Assistant), a wise and compassionate voice assistant for 'Temple to Ayurveda'. You speak gently and clearly, helping devotees, temple managers, and volunteers understand sacred waste recycling, organic compost, Ayurvedic medicine, and temple sustainability in India.",
      },
      callbacks: {
        onmessage: (message: LiveServerMessage) => {
          const audio = message.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
          if (audio && clientWs.readyState === WebSocket.OPEN) {
            clientWs.send(JSON.stringify({ audio }));
          }
          if (message.serverContent?.interrupted && clientWs.readyState === WebSocket.OPEN) {
            clientWs.send(JSON.stringify({ interrupted: true }));
          }
        },
        onclose: () => {
          console.log('[Gemini Live API]: Gemini session closed');
          if (clientWs.readyState === WebSocket.OPEN) {
            clientWs.send(JSON.stringify({ status: 'session_closed' }));
          }
        },
        onerror: (err: any) => {
          console.error('[Gemini Live API Error]:', err);
          if (clientWs.readyState === WebSocket.OPEN) {
            clientWs.send(JSON.stringify({ error: err.message || 'Live API error' }));
          }
        }
      },
    });

    clientWs.send(JSON.stringify({ status: 'ready', message: 'Connected to Gemini Live voice session' }));

    clientWs.on('message', (data: any) => {
      try {
        const payload = JSON.parse(data.toString());
        if (payload.audio && session) {
          session.sendRealtimeInput({
            audio: { data: payload.audio, mimeType: 'audio/pcm;rate=16000' },
          });
        }
        if (payload.text && session) {
          session.sendRealtimeInput({
            text: payload.text,
          });
        }
      } catch (err) {
        console.error('[Gemini Live]: Error parsing client message:', err);
      }
    });

    clientWs.on('close', () => {
      console.log('[Gemini Live API]: Client disconnected');
      if (session) {
        try {
          session.close();
        } catch (_) {}
      }
    });

    clientWs.on('error', (err) => {
      console.error('[Gemini Live API Client Error]:', err);
      if (session) {
        try {
          session.close();
        } catch (_) {}
      }
    });
  } catch (err: any) {
    console.error('[Gemini Live API Connection Error]:', err);
    if (clientWs.readyState === WebSocket.OPEN) {
      clientWs.send(JSON.stringify({ error: err.message || 'Failed to initialize Gemini Live session' }));
      clientWs.close();
    }
  }
});

// Vite Middleware for Dev / Static Files for Prod
const isProduction = process.env.NODE_ENV === 'production';
if (!isProduction) {
  const { createServer: createViteServer } = await import('vite');
  const vite = await createViteServer({
    server: { middlewareMode: true },
    appType: 'spa',
  });
  app.use(vite.middlewares);
} else {
  app.use(express.static(path.resolve(__dirname, 'dist')));
  app.get('*', (_req: Request, res: Response) => {
    res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
  });
}

if (!process.env.VERCEL) {
  server.listen(port, '0.0.0.0', () => {
    console.log(`Temple to Ayurveda full-stack server running on http://0.0.0.0:${port}`);
  });
}

export default app;
