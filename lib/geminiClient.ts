// Client-side API caller for Server-Side Gemini Services
// Zero API keys are bundled or exposed in client code.

export interface GroundingLink {
  type: 'map' | 'web';
  title: string;
  uri: string;
}

export interface ChatResponse {
  text: string;
  links: GroundingLink[];
  searchQueries: string[];
}

export interface WasteAnalysisItem {
  name: string;
  category: string;
  percentage: string;
  recycleOutput: string;
}

export interface WasteAnalysisResult {
  items: WasteAnalysisItem[];
  overallRecyclability: string;
  recommendedBins: string[];
  summary: string;
}

export async function sendGeminiChat(
  message: string,
  activeMode: 'maps' | 'search',
  userCoords?: { latitude: number; longitude: number } | null
): Promise<ChatResponse> {
  const res = await fetch('/api/gemini/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, activeMode, userCoords })
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || errorData.details || `Server chat failed (${res.status})`);
  }

  return await res.json();
}

export async function sendGeminiChatStream(
  message: string,
  activeMode: 'maps' | 'search',
  userCoords: { latitude: number; longitude: number } | null | undefined,
  callbacks: {
    onChunk: (text: string) => void;
    onDone: (data: { links: GroundingLink[]; searchQueries: string[] }) => void;
    onError: (error: string) => void;
  }
) {
  try {
    const res = await fetch('/api/gemini/chat-stream', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, activeMode, userCoords })
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      callbacks.onError(err.error || `Stream failed with status ${res.status}`);
      return;
    }

    if (!res.body) {
      throw new Error('ReadableStream not supported by browser or empty body');
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.startsWith('data: ')) {
          try {
            const data = JSON.parse(trimmed.slice(6));
            if (data.text) {
              callbacks.onChunk(data.text);
            }
            if (data.done) {
              callbacks.onDone({
                links: data.links || [],
                searchQueries: data.searchQueries || []
              });
            }
            if (data.error) {
              callbacks.onError(data.error);
            }
          } catch (e) {
            console.error('Failed to parse SSE line:', trimmed, e);
          }
        }
      }
    }
  } catch (err: any) {
    callbacks.onError(err.message || 'Stream connection error');
  }
}

export async function sendGeminiGrounding(
  prompt: string,
  type: 'maps' | 'search',
  coords?: { latitude: number; longitude: number } | null
): Promise<{ text: string; links: GroundingLink[]; searchQueries: string[] }> {
  const res = await fetch('/api/gemini/grounding', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt, type, coords })
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || errorData.details || `Grounding query failed (${res.status})`);
  }

  return await res.json();
}

export async function sendGeminiWasteAnalysis(
  base64Data: string,
  mimeType: string,
  prompt?: string
): Promise<WasteAnalysisResult> {
  const res = await fetch('/api/gemini/analyze-waste', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ base64Data, mimeType, prompt })
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || errorData.details || `Waste analysis failed (${res.status})`);
  }

  const json = await res.json();
  return json.analysis;
}

export async function sendGeminiGenerateImage(prompt: string): Promise<string> {
  const res = await fetch('/api/gemini/generate-image', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt })
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || errorData.details || `Image generation failed (${res.status})`);
  }

  const json = await res.json();
  return json.image;
}
