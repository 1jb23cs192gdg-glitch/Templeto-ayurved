import React, { useState, useRef, useEffect } from 'react';
import { RobotLogo } from '../constants';
import { sendGeminiChatStream, GroundingLink } from '../lib/geminiClient';
import { pcmFloat32ToBase64, playPcmChunk } from '../lib/liveAudioHelper';

type GroundingMode = 'auto' | 'maps' | 'search';

interface Message {
  role: 'user' | 'model';
  text: string;
  modeUsed?: 'maps' | 'search';
  groundingLinks?: GroundingLink[];
  searchQueries?: string[];
  isStreaming?: boolean;
}

const AIChatBot = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [groundingMode, setGroundingMode] = useState<GroundingMode>('auto');
  const [userCoords, setUserCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'model',
      text: 'Namaste! I am VEDA, your AI Sustainability & Sacred Geography Guide. Powered by Google Maps & Google Search Grounding, I can locate verified temples, navigate sacred grounds, and retrieve live river & eco-pollution data.',
      groundingLinks: [
        { type: 'map', title: 'Explore Partner Temples', uri: '#/temples' },
        { type: 'web', title: 'Sacred Waste Recycling Project', uri: 'https://en.wikipedia.org/wiki/Phool.co' }
      ]
    }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isVoiceActive, setIsVoiceActive] = useState(false);
  const [voiceStatus, setVoiceStatus] = useState<string>('');

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Audio / Live API refs
  const wsRef = useRef<WebSocket | null>(null);
  const inputAudioCtxRef = useRef<AudioContext | null>(null);
  const outputAudioCtxRef = useRef<AudioContext | null>(null);
  const audioStreamRef = useRef<MediaStream | null>(null);
  const timeStateRef = useRef<{ nextStartTime: number; activeSources: AudioBufferSourceNode[] }>({
    nextStartTime: 0,
    activeSources: []
  });

  // Request browser geolocation once for Maps grounding accuracy
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setUserCoords({
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude
          });
        },
        () => {
          // Fallback or permission denied: defaults to India coordinates
          setUserCoords({ latitude: 20.5937, longitude: 78.9629 });
        },
        { timeout: 8000 }
      );
    }
  }, []);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isOpen, isVoiceActive]);

  // Cleanup Live API audio on unmount
  useEffect(() => {
    return () => {
      stopVoiceSession();
    };
  }, []);

  // Determine whether this prompt is best handled by Google Maps or Google Search
  const determineGroundingMode = (query: string): 'maps' | 'search' => {
    if (groundingMode === 'maps') return 'maps';
    if (groundingMode === 'search') return 'search';

    const lower = query.toLowerCase();
    const mapKeywords = ['where', 'location', 'near', 'nearby', 'address', 'distance', 'directions', 'route', 'map', 'temple in', 'temple at', 'city', 'reach', 'drive', 'kashi', 'ayodhya', 'varanasi', 'puri', 'tirupati', 'somnath', 'haridwar', 'rishikesh', 'ujjain', 'kolkata', 'delhi', 'mumbai'];
    const searchKeywords = ['news', 'today', 'latest', 'aqi', 'air quality', 'ganga', 'pollution', 'water', 'clean', 'river', 'research', 'ayurveda', 'dhoop', 'recipe', 'policy', 'study', 'statistics', 'government'];

    const hasMapKeyword = mapKeywords.some(kw => lower.includes(kw));
    const hasSearchKeyword = searchKeywords.some(kw => lower.includes(kw));

    if (hasMapKeyword && !hasSearchKeyword) return 'maps';
    if (hasSearchKeyword && !hasMapKeyword) return 'search';
    return hasMapKeyword ? 'maps' : 'search';
  };

  const handleSend = async (overridePrompt?: string) => {
    const userMsg = overridePrompt || input;
    if (!userMsg.trim() || isLoading) return;

    if (!overridePrompt) setInput('');
    setMessages(prev => [...prev, { role: 'user', text: userMsg }]);
    setIsLoading(true);

    const activeMode = determineGroundingMode(userMsg);

    // Placeholder model streaming message
    const modelMessageIndex = messages.length + 1;
    setMessages(prev => [
      ...prev,
      {
        role: 'model',
        text: '',
        modeUsed: activeMode,
        isStreaming: true
      }
    ]);

    let accumulatedText = '';

    await sendGeminiChatStream(
      userMsg,
      activeMode,
      userCoords,
      {
        onChunk: (chunk: string) => {
          accumulatedText += chunk;
          setMessages(prev => {
            const next = [...prev];
            const target = next[next.length - 1];
            if (target && target.role === 'model' && target.isStreaming) {
              target.text = accumulatedText;
            }
            return next;
          });
        },
        onDone: ({ links, searchQueries }) => {
          // Deduplicate links by URI
          const uniqueLinks = links.filter((l, idx, arr) => 
            arr.findIndex(item => item.uri === l.uri) === idx
          );

          setMessages(prev => {
            const next = [...prev];
            const target = next[next.length - 1];
            if (target && target.role === 'model') {
              target.text = accumulatedText || 'I processed your sacred query.';
              target.isStreaming = false;
              target.groundingLinks = uniqueLinks;
              target.searchQueries = searchQueries;
            }
            return next;
          });
          setIsLoading(false);
        },
        onError: (err: string) => {
          console.error('Chat error:', err);
          setMessages(prev => {
            const next = [...prev];
            const target = next[next.length - 1];
            if (target && target.role === 'model') {
              target.text = accumulatedText || 'Could not complete request. Please verify your connection or API key in Settings > Secrets.';
              target.isStreaming = false;
            }
            return next;
          });
          setIsLoading(false);
        }
      }
    );
  };

  // --- Gemini Live API Voice Mode ---
  const startVoiceSession = async () => {
    try {
      setVoiceStatus('Initializing Gemini Live voice session...');
      setIsVoiceActive(true);

      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/live`;
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      const inputCtx = new AudioContextClass({ sampleRate: 16000 });
      const outputCtx = new AudioContextClass({ sampleRate: 24000 });
      inputAudioCtxRef.current = inputCtx;
      outputAudioCtxRef.current = outputCtx;

      timeStateRef.current = { nextStartTime: 0, activeSources: [] };

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioStreamRef.current = stream;

      const source = inputCtx.createMediaStreamSource(stream);
      const processor = inputCtx.createScriptProcessor(4096, 1, 1);
      source.connect(processor);
      processor.connect(inputCtx.destination);

      processor.onaudioprocess = (e) => {
        if (ws.readyState === WebSocket.OPEN) {
          const inputData = e.inputBuffer.getChannelData(0);
          const base64Audio = pcmFloat32ToBase64(inputData);
          ws.send(JSON.stringify({ audio: base64Audio }));
        }
      };

      ws.onopen = () => {
        setVoiceStatus('Connected to VEDA Live Audio. Speak naturally!');
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.status === 'ready') {
            setVoiceStatus('Listening & Speaking live...');
          }
          if (data.audio && outputAudioCtxRef.current) {
            playPcmChunk(outputAudioCtxRef.current, data.audio, timeStateRef.current);
          }
          if (data.interrupted) {
            // Stop playing current chunks
            timeStateRef.current.activeSources.forEach(s => {
              try { s.stop(); } catch (_) {}
            });
            timeStateRef.current.activeSources = [];
            timeStateRef.current.nextStartTime = outputAudioCtxRef.current?.currentTime || 0;
          }
          if (data.error) {
            setVoiceStatus(`Live API: ${data.error}`);
          }
        } catch (e) {
          console.error('Error handling live message:', e);
        }
      };

      ws.onerror = (e) => {
        console.error('WebSocket error:', e);
        setVoiceStatus('Live voice connection error');
      };

      ws.onclose = () => {
        setVoiceStatus('Voice session ended');
        setIsVoiceActive(false);
      };
    } catch (err: any) {
      console.error('Could not start microphone:', err);
      setVoiceStatus('Microphone access denied or unsupported');
      setIsVoiceActive(false);
    }
  };

  const stopVoiceSession = () => {
    if (audioStreamRef.current) {
      audioStreamRef.current.getTracks().forEach(t => t.stop());
      audioStreamRef.current = null;
    }
    if (inputAudioCtxRef.current) {
      try { inputAudioCtxRef.current.close(); } catch (_) {}
      inputAudioCtxRef.current = null;
    }
    if (outputAudioCtxRef.current) {
      try { outputAudioCtxRef.current.close(); } catch (_) {}
      outputAudioCtxRef.current = null;
    }
    if (wsRef.current) {
      try { wsRef.current.close(); } catch (_) {}
      wsRef.current = null;
    }
    setIsVoiceActive(false);
    setVoiceStatus('');
  };

  const samplePrompts = [
    { label: '📍 Temples in Varanasi', prompt: 'Which famous temples in Varanasi accept Nirmalya flower recycling?' },
    { label: '🌊 Ganga AQI & Cleanliness', prompt: 'What is the latest Ganga river cleanliness and pollution report?' },
    { label: '🗺️ Nearest Temple from Delhi', prompt: 'Where are the leading temples in and around Delhi with waste management?' },
    { label: '🌿 Flower Recycling Value', prompt: 'How is temple marigold flower waste converted into Ayurvedic dhoop?' }
  ];

  return (
    <>
      {/* Floating Holographic Orb Button */}
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className={`fixed bottom-6 right-6 z-50 group transition-all duration-500 ${isOpen ? 'rotate-90 scale-0 opacity-0' : 'scale-100 opacity-100'}`}
        aria-label="Open VEDA AI Sustainability Guide"
      >
        <div className="relative w-16 h-16">
          <div className="absolute inset-0 bg-orange-600 rounded-full blur-lg opacity-75 animate-pulse-glow"></div>
          <div className="relative w-full h-full bg-gradient-to-br from-orange-500 to-red-600 rounded-full flex items-center justify-center border-2 border-white/30 shadow-2xl overflow-hidden">
             {/* Rotating Ring */}
             <div className="absolute w-full h-full border-2 border-dashed border-white/40 rounded-full animate-[spin_10s_linear_infinite]"></div>
             <RobotLogo className="w-8 h-8 text-white animate-float" />
          </div>
        </div>
      </button>

      {/* Glassmorphism Chat Interface */}
      <div 
        className={`fixed bottom-6 right-6 w-[92vw] sm:w-[420px] h-[600px] max-h-[85vh] rounded-3xl shadow-2xl flex flex-col overflow-hidden z-50 transition-all duration-500 border border-white/20 backdrop-blur-2xl ${
          isOpen ? 'scale-100 opacity-100 translate-y-0' : 'scale-75 opacity-0 translate-y-20 pointer-events-none'
        }`}
        style={{ background: 'rgba(18, 22, 34, 0.94)' }}
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-orange-600 to-red-600 p-4 flex justify-between items-center shadow-md">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center backdrop-blur border border-white/30">
              <RobotLogo className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-white text-sm tracking-wider">VEDA AI</h3>
                <span className="text-[10px] bg-black/30 text-orange-200 px-1.5 py-0.5 rounded font-mono border border-white/10">
                  gemini-3.8-flash
                </span>
              </div>
              <p className="text-[11px] text-orange-100 flex items-center gap-1.5">
                <span className="w-2 h-2 bg-emerald-400 rounded-full animate-ping"></span>
                <span>Server-Side Grounded with Maps & Search</span>
              </p>
            </div>
          </div>
          <button 
            onClick={() => setIsOpen(false)} 
            className="text-white/80 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors"
            aria-label="Close"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Mode Selector Strip & Live API Voice Button */}
        <div className="bg-stone-900/90 px-3 py-2 border-b border-white/10 flex items-center justify-between text-xs">
          <div className="flex items-center gap-1">
            <span className="text-stone-400 text-[11px] font-medium">Grounding:</span>
            <div className="inline-flex rounded-lg bg-stone-800 p-0.5 border border-white/10 text-[11px]">
              <button
                onClick={() => setGroundingMode('auto')}
                className={`px-2 py-0.5 rounded font-medium transition-all ${
                  groundingMode === 'auto'
                    ? 'bg-gradient-to-r from-orange-500 to-amber-600 text-white shadow'
                    : 'text-stone-400 hover:text-stone-200'
                }`}
              >
                ✨ Auto
              </button>
              <button
                onClick={() => setGroundingMode('maps')}
                className={`px-2 py-0.5 rounded font-medium transition-all flex items-center gap-1 ${
                  groundingMode === 'maps'
                    ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow'
                    : 'text-stone-400 hover:text-stone-200'
                }`}
              >
                📍 Maps
              </button>
              <button
                onClick={() => setGroundingMode('search')}
                className={`px-2 py-0.5 rounded font-medium transition-all flex items-center gap-1 ${
                  groundingMode === 'search'
                    ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow'
                    : 'text-stone-400 hover:text-stone-200'
                }`}
              >
                🌐 Search
              </button>
            </div>
          </div>

          {/* Gemini Live API Audio Stream Trigger */}
          <button
            onClick={() => {
              if (isVoiceActive) stopVoiceSession();
              else startVoiceSession();
            }}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold flex items-center gap-1.5 transition-all border ${
              isVoiceActive
                ? 'bg-red-500/20 text-red-300 border-red-500/50 animate-pulse'
                : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30 hover:bg-emerald-500/30'
            }`}
            title="Real-time Audio Conversation with Gemini Live API"
          >
            <span>{isVoiceActive ? '🔴' : '🎙️'}</span>
            <span>{isVoiceActive ? 'End Live' : 'Live Voice'}</span>
          </button>
        </div>

        {/* Live Audio Banner if active */}
        {isVoiceActive && (
          <div className="bg-emerald-950/80 border-b border-emerald-500/30 px-3 py-1.5 flex items-center justify-between text-[11px] text-emerald-200 animate-fadeIn">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 bg-emerald-400 rounded-full animate-ping" />
              <span>{voiceStatus || 'Gemini 3.8 Live API Active'}</span>
            </div>
            <button
              onClick={stopVoiceSession}
              className="text-stone-400 hover:text-white underline text-[10px]"
            >
              Stop
            </button>
          </div>
        )}

        {/* Neural Grid Background */}
        <div 
          className="absolute inset-0 z-0 opacity-5 pointer-events-none" 
          style={{ backgroundImage: 'radial-gradient(circle, #ea580c 1px, transparent 1px)', backgroundSize: '20px 20px' }}
        />

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 relative z-10 scrollbar-thin scrollbar-thumb-orange-600/50 scrollbar-track-transparent">
          {messages.map((msg, idx) => (
            <div key={idx} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'} animate-fade-in-up`}>
              {msg.role === 'model' && msg.modeUsed && (
                <span className="text-[10px] text-stone-400 mb-1 px-1 flex items-center gap-1">
                  {msg.modeUsed === 'maps' ? (
                    <span className="text-emerald-400 font-semibold flex items-center gap-0.5">
                      📍 Google Maps Grounded
                    </span>
                  ) : (
                    <span className="text-blue-400 font-semibold flex items-center gap-0.5">
                      🌐 Google Search Grounded
                    </span>
                  )}
                </span>
              )}

              <div className={`max-w-[88%] rounded-2xl p-3.5 text-sm leading-relaxed ${
                msg.role === 'user' 
                  ? 'bg-gradient-to-r from-orange-600 to-amber-600 text-white rounded-br-sm shadow-[0_4px_15px_rgba(234,88,12,0.3)]' 
                  : 'bg-white/10 border border-white/10 text-stone-100 rounded-bl-sm shadow-sm backdrop-blur-md'
              }`}>
                <div className="whitespace-pre-line">{msg.text || (msg.isStreaming ? '...' : '')}</div>
                {msg.isStreaming && (
                  <span className="inline-block w-1.5 h-3 ml-1 bg-orange-400 animate-pulse" />
                )}
              </div>

              {/* Grounded interactive links & citations */}
              {msg.groundingLinks && msg.groundingLinks.length > 0 && (
                <div className="mt-2.5 max-w-[92%] space-y-1.5">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-stone-400">
                    Verified Google Grounding Sources:
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {msg.groundingLinks.map((link, i) => (
                      <a 
                        key={i} 
                        href={link.uri} 
                        target="_blank" 
                        rel="noreferrer" 
                        className={`text-xs px-2.5 py-1.5 rounded-lg border font-medium flex items-center gap-1.5 transition-all shadow-sm ${
                          link.type === 'map'
                            ? 'bg-emerald-950/70 border-emerald-600/40 text-emerald-200 hover:bg-emerald-900/80 hover:border-emerald-400'
                            : 'bg-blue-950/70 border-blue-600/40 text-blue-200 hover:bg-blue-900/80 hover:border-blue-400'
                        }`}
                      >
                        <span>{link.type === 'map' ? '📍' : '🌐'}</span>
                        <span className="truncate max-w-[220px]">{link.title}</span>
                        <span className="text-[10px] opacity-70">↗</span>
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}

          {isLoading && !messages[messages.length - 1]?.isStreaming && (
            <div className="flex justify-start">
              <div className="bg-white/10 border border-white/10 p-3.5 rounded-2xl rounded-bl-none flex items-center gap-2 text-xs text-orange-200">
                <div className="flex gap-1.5">
                  <div className="w-2 h-2 bg-orange-400 rounded-full animate-bounce"></div>
                  <div className="w-2 h-2 bg-orange-400 rounded-full animate-bounce" style={{animationDelay: '0.15s'}}></div>
                  <div className="w-2 h-2 bg-orange-400 rounded-full animate-bounce" style={{animationDelay: '0.3s'}}></div>
                </div>
                <span>Querying Google {groundingMode === 'maps' ? 'Maps' : groundingMode === 'search' ? 'Search' : 'Grounding'}...</span>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Quick Suggestion Pills */}
        <div className="px-3 py-2 bg-stone-900/70 border-t border-white/10 flex gap-1.5 overflow-x-auto scrollbar-none">
          {samplePrompts.map((s, idx) => (
            <button
              key={idx}
              onClick={() => handleSend(s.prompt)}
              className="whitespace-nowrap text-[11px] bg-white/5 hover:bg-white/15 text-stone-300 border border-white/10 px-2.5 py-1 rounded-full transition-all"
            >
              {s.label}
            </button>
          ))}
        </div>

        {/* Input Area */}
        <div className="p-3 bg-black/40 backdrop-blur-md border-t border-white/10 relative z-10">
          <div className="relative">
            <input 
              type="text" 
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
              placeholder={
                groundingMode === 'maps' 
                  ? "Ask about temple locations, maps, routes..." 
                  : groundingMode === 'search'
                  ? "Ask about live Ganga quality, eco-news..."
                  : "Ask VEDA with Maps & Search Grounding..."
              }
              className="w-full bg-white/10 border border-white/15 rounded-full pl-4 pr-12 py-2.5 text-sm text-white placeholder-stone-400 focus:outline-none focus:border-orange-500 focus:bg-white/15 transition-all shadow-inner"
            />
            <button 
              onClick={() => handleSend()}
              disabled={!input.trim() || isLoading}
              className="absolute right-1 top-1 p-2 bg-gradient-to-r from-orange-600 to-red-600 rounded-full text-white hover:shadow-[0_0_12px_rgba(234,88,12,0.8)] transition-all disabled:opacity-40 disabled:shadow-none"
              aria-label="Send"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

export default AIChatBot;
