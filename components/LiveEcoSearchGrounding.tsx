import React, { useState, useEffect } from 'react';
import { sendGeminiGrounding } from '../lib/geminiClient';

interface WebCitation {
  title: string;
  uri: string;
}

interface GroundedSearchNews {
  topic: string;
  headline: string;
  summary: string;
  timestamp: string;
  citations: WebCitation[];
  searchQueries: string[];
}

const PRESET_TOPICS = [
  {
    id: 'ganga',
    title: '🌊 Ganga River Cleanliness',
    query: 'Latest Namami Gange river water quality and pollution cleanup reports 2025 2026'
  },
  {
    id: 'temple-circular',
    title: '🌸 Temple Waste Circular Economy',
    query: 'Temple flower recycling incense composting projects in India news'
  },
  {
    id: 'holy-cities-aqi',
    title: '🌫️ Sacred Cities AQI & Air Quality',
    query: 'Current air quality index AQI Varanasi Ayodhya Haridwar Mathura pollution levels'
  },
  {
    id: 'ayurvedic-sustainability',
    title: '🌿 Organic Dhoop & Ayurvedic Standards',
    query: 'Ayurvedic charcoal-free flower waste incense organic export guidelines India'
  }
];

export const LiveEcoSearchGrounding = () => {
  const [selectedTopic, setSelectedTopic] = useState(PRESET_TOPICS[0]);
  const [customQuery, setCustomQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState<GroundedSearchNews | null>(null);
  const [history, setHistory] = useState<GroundedSearchNews[]>([]);

  // Fetch initial report on mount
  useEffect(() => {
    executeSearchGrounding(PRESET_TOPICS[0].query, PRESET_TOPICS[0].title);
  }, []);

  const executeSearchGrounding = async (queryText: string, topicLabel: string) => {
    if (!queryText.trim()) return;

    setLoading(true);
    try {
      const prompt = `You are an environmental researcher reporting on Indian temple sustainability and river health.
Conduct a live search on: "${queryText}".
Provide a concise executive summary formatted with:
1. Executive Key Takeaways (bullet points)
2. Recent developments and statistics
3. Citizen / Devotee Call to Action
Keep the tone journalistic, objective, and inspiring.`;

      const response = await sendGeminiGrounding(prompt, 'search');
      const summaryText = response.text || "No news summary available at this moment.";
      const searchQueries = response.searchQueries || [];

      // Deduplicate citations by URI
      const uniqueCitations = (response.links || [])
        .map(l => ({ title: l.title || 'Verified Web Source', uri: l.uri }))
        .filter((item, index, self) => index === self.findIndex((c) => c.uri === item.uri));

      const newReport: GroundedSearchNews = {
        topic: topicLabel,
        headline: queryText,
        summary: summaryText,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        citations: uniqueCitations,
        searchQueries
      };

      setReport(newReport);
      setHistory(prev => [newReport, ...prev.filter(h => h.topic !== topicLabel)].slice(0, 5));
    } catch (err: any) {
      console.error("Search Grounding failed:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleCustomSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customQuery.trim()) return;
    executeSearchGrounding(customQuery, `🔍 "${customQuery}"`);
    setCustomQuery('');
  };

  return (
    <section className="my-12">
      <div className="bg-gradient-to-br from-slate-900 via-stone-900 to-slate-950 rounded-3xl p-6 sm:p-8 text-white border border-stone-800 shadow-2xl relative overflow-hidden">
        
        {/* Glow ambient effects */}
        <div className="absolute -top-24 -right-24 w-80 h-80 bg-orange-600/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 w-80 h-80 bg-blue-600/15 rounded-full blur-3xl pointer-events-none" />

        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 relative z-10 border-b border-white/10 pb-5">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-blue-500/20 text-blue-300 border border-blue-400/30 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse"></span>
                Live Google Search Grounding
              </span>
              <span className="text-xs text-stone-400 font-mono">gemini-3.8-flash</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              Sacred Eco-Intelligence & Live Pollution News
            </h2>
            <p className="text-stone-300 text-sm mt-1">
              Real-time environmental telemetry, river pollution index, and circular green temple initiatives verified via live Google Search.
            </p>
          </div>

          <button
            onClick={() => executeSearchGrounding(selectedTopic.query, selectedTopic.title)}
            disabled={loading}
            className="self-start md:self-auto px-4 py-2 bg-white/10 hover:bg-white/20 border border-white/15 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all disabled:opacity-50"
          >
            <span className={loading ? "animate-spin" : ""}>🔄</span>
            <span>Refresh Live Data</span>
          </button>
        </div>

        {/* Topic Tabs */}
        <div className="flex flex-wrap gap-2 mb-6 relative z-10">
          {PRESET_TOPICS.map((topic) => {
            const isActive = selectedTopic.id === topic.id;
            return (
              <button
                key={topic.id}
                onClick={() => {
                  setSelectedTopic(topic);
                  executeSearchGrounding(topic.query, topic.title);
                }}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                  isActive
                    ? 'bg-gradient-to-r from-orange-600 to-amber-600 text-white shadow-lg shadow-orange-900/30 border border-orange-400/40'
                    : 'bg-white/5 hover:bg-white/10 text-stone-300 border border-white/10'
                }`}
              >
                <span>{topic.title}</span>
              </button>
            );
          })}
        </div>

        {/* Custom Search Prompt Bar */}
        <form onSubmit={handleCustomSubmit} className="mb-6 relative z-10">
          <div className="relative">
            <input
              type="text"
              value={customQuery}
              onChange={(e) => setCustomQuery(e.target.value)}
              placeholder="Search live environmental news (e.g., 'Yamuna froth status today', 'Ujjain temple biogas plant')..."
              className="w-full bg-white/5 border border-white/15 rounded-2xl pl-4 pr-32 py-3 text-sm text-white placeholder-stone-400 focus:outline-none focus:border-blue-500 focus:bg-white/10 transition-all shadow-inner"
            />
            <button
              type="submit"
              disabled={loading || !customQuery.trim()}
              className="absolute right-1.5 top-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl transition-all disabled:opacity-40"
            >
              Search Live ↗
            </button>
          </div>
        </form>

        {/* Live Grounded Report Body */}
        <div className="relative z-10 bg-black/40 rounded-2xl p-5 sm:p-6 border border-white/10">
          {loading ? (
            <div className="py-12 flex flex-col items-center justify-center text-center">
              <div className="w-10 h-10 border-4 border-blue-400 border-t-transparent rounded-full animate-spin mb-3"></div>
              <p className="text-sm font-semibold text-blue-200">
                Searching Google Grounded Web Data via gemini-3.8-flash...
              </p>
              <p className="text-xs text-stone-400 mt-1">Retrieving verified articles and live river/temple reports</p>
            </div>
          ) : report ? (
            <div>
              <div className="flex flex-wrap items-center justify-between gap-2 mb-4 pb-3 border-b border-white/10">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping"></span>
                  <h3 className="text-lg font-bold text-orange-200">{report.topic}</h3>
                </div>
                <div className="text-xs text-stone-400 font-mono">
                  Grounded at {report.timestamp}
                </div>
              </div>

              {/* Summary text */}
              <div className="text-sm text-stone-200 leading-relaxed space-y-3 whitespace-pre-line mb-6 font-normal">
                {report.summary}
              </div>

              {/* Verified Sources / Citations from groundingChunks */}
              {report.citations.length > 0 && (
                <div className="pt-4 border-t border-white/10">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-xs font-bold uppercase tracking-wider text-blue-300">
                      🌐 Verified Google Search Sources ({report.citations.length})
                    </span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                    {report.citations.map((cite, idx) => (
                      <a
                        key={idx}
                        href={cite.uri}
                        target="_blank"
                        rel="noreferrer"
                        className="bg-white/5 hover:bg-white/10 border border-white/10 hover:border-blue-400/50 p-2.5 rounded-xl text-xs flex items-center justify-between gap-2 transition-all group"
                      >
                        <div className="truncate">
                          <p className="font-semibold text-stone-200 group-hover:text-blue-300 truncate">
                            {cite.title}
                          </p>
                          <p className="text-[10px] text-stone-400 truncate font-mono">
                            {new URL(cite.uri).hostname.replace('www.', '')}
                          </p>
                        </div>
                        <span className="text-stone-400 group-hover:text-blue-300 text-sm font-bold flex-shrink-0">
                          ↗
                        </span>
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {/* Related Search Queries */}
              {report.searchQueries && report.searchQueries.length > 0 && (
                <div className="mt-4 pt-3 border-t border-white/5 flex flex-wrap items-center gap-2 text-xs">
                  <span className="text-stone-400 text-[11px]">Related Google Queries:</span>
                  {report.searchQueries.map((q, i) => (
                    <button
                      key={i}
                      onClick={() => executeSearchGrounding(q, `🔍 "${q}"`)}
                      className="text-[11px] bg-white/5 hover:bg-white/10 text-stone-300 px-2 py-0.5 rounded-md border border-white/10 hover:text-white transition-colors"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="py-8 text-center text-stone-400">
              Select a topic or enter a query above to view Search Grounded eco-intelligence.
            </div>
          )}
        </div>
      </div>
    </section>
  );
};

export default LiveEcoSearchGrounding;
