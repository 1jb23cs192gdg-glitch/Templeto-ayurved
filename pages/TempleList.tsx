import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { Temple } from '../types';
import { sendGeminiGrounding } from '../lib/geminiClient';

interface GroundedPlaceResult {
  query: string;
  answer: string;
  groundedLinks: { title: string; uri: string }[];
}

const TempleList = () => {
  const [temples, setTemples] = useState<Temple[]>([]);
  const [loading, setLoading] = useState(true);

  // Maps Grounding Search State
  const [searchQuery, setSearchQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [groundedResult, setGroundedResult] = useState<GroundedPlaceResult | null>(null);

  // Per-card quick Maps Grounding
  const [cardGroundedLinks, setCardGroundedLinks] = useState<Record<string, { title: string; uri: string }>>({});
  const [locatingCard, setLocatingCard] = useState<Record<string, boolean>>({});

  useEffect(() => {
    fetchTemples();
  }, []);

  const fetchTemples = async () => {
    try {
      const { data, error } = await supabase
        .from('temples')
        .select('*')
        .order('name', { ascending: true });
      
      if (error) throw error;

      if (data) {
        const formattedTemples: Temple[] = data.map(t => ({
          id: t.id,
          name: t.name,
          location: t.location || 'Location Pending',
          wasteDonatedKg: t.waste_donated_kg,
          greenStars: t.green_stars,
          imageUrl: t.image_url || 'https://images.unsplash.com/photo-1606293926075-69a00dbfde81?auto=format&fit=crop&q=80&w=400',
          description: t.description || 'Joining the renewable revolution.',
          ngoId: t.ngo_id,
          address: t.address
        }));
        setTemples(formattedTemples);
      } else {
        setTemples([]);
      }
    } catch (error) {
      console.error("Error fetching temples:", error);
      setTemples([]);
    } finally {
      setLoading(false);
    }
  };

  // Maps Grounding search using gemini-3.8-flash with googleMaps tool
  const handleMapsGroundingSearch = async (queryText?: string) => {
    const q = queryText || searchQuery;
    if (!q.trim()) return;

    setSearching(true);
    setGroundedResult(null);

    try {
      const prompt = `Locate the temple: "${q}". Provide its exact city, state, nearest major railway station or landmark, and temple overview. Use Google Maps data to verify its live location.`;
      const response = await sendGeminiGrounding(prompt, 'maps');

      const answer = response.text || "No details found for this location.";
      const links = (response.links || []).map(l => ({
        title: l.title || 'View on Google Maps',
        uri: l.uri
      }));

      setGroundedResult({
        query: q,
        answer,
        groundedLinks: links
      });
    } catch (err) {
      console.error("Maps Grounding search failed:", err);
      setGroundedResult({
        query: q,
        answer: "Failed to retrieve grounded location from Google Maps. Please verify your connection.",
        groundedLinks: []
      });
    } finally {
      setSearching(false);
    }
  };

  const handleLocateCardTemple = async (temple: Temple) => {
    setLocatingCard(prev => ({ ...prev, [temple.id]: true }));
    try {
      const prompt = `Provide the exact Google Maps location and navigation link for ${temple.name} located in ${temple.location || 'India'}.`;
      const response = await sendGeminiGrounding(prompt, 'maps');

      if (response.links && response.links.length > 0) {
        const top = response.links[0];
        setCardGroundedLinks(prev => ({
          ...prev,
          [temple.id]: {
            title: top.title || temple.name,
            uri: top.uri
          }
        }));
      }
    } catch (e) {
      console.error("Card Maps Grounding error", e);
    } finally {
      setLocatingCard(prev => ({ ...prev, [temple.id]: false }));
    }
  };

  if (loading) return (
    <div className="min-h-screen pt-24 text-center bg-stone-50 dark:bg-slate-900 text-stone-600 dark:text-stone-300">
      <div className="w-10 h-10 border-4 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
      Loading Partner Temples...
    </div>
  );

  return (
    <div className="min-h-screen bg-stone-50 dark:bg-slate-900 py-12 px-4">
      <div className="max-w-7xl mx-auto">
        
        {/* Header Section */}
        <div className="text-center max-w-3xl mx-auto mb-10">
          <span className="inline-block text-xs font-bold tracking-widest text-orange-600 uppercase bg-orange-100 dark:bg-orange-950/40 px-3 py-1 rounded-full mb-3">
            Sacred Geography & Recycling
          </span>
          <h1 className="text-4xl font-extrabold text-stone-800 dark:text-white tracking-tight mb-4">
            Partner Temples of India
          </h1>
          <p className="text-stone-600 dark:text-stone-300 text-sm md:text-base">
            Discover consecrated shrines participating in zero-waste flower recycling. Use our real-time Google Maps Grounded locator to navigate sacred locations across the country.
          </p>
        </div>

        {/* Live Google Maps Grounding Search Widget */}
        <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 shadow-xl border border-stone-200 dark:border-slate-700 mb-12">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4 mb-4">
            <div className="flex items-center gap-2.5">
              <span className="text-2xl">🗺️</span>
              <div>
                <h3 className="font-bold text-stone-800 dark:text-white text-base">
                  Google Maps Grounded Temple Finder
                </h3>
                <p className="text-xs text-stone-500 dark:text-stone-400">
                  Live verification via <code className="font-mono text-orange-600 dark:text-orange-400">gemini-3.8-flash</code> with Google Maps
                </p>
              </div>
            </div>
            {/* Quick Filter Badges */}
            <div className="flex flex-wrap gap-2 text-xs">
              {['Kashi Vishwanath', 'Tirupati Balaji', 'Somnath Temple', 'Dakshineswar Kali'].map((preset) => (
                <button
                  key={preset}
                  onClick={() => {
                    setSearchQuery(preset);
                    handleMapsGroundingSearch(preset);
                  }}
                  className="bg-stone-100 dark:bg-slate-700 hover:bg-orange-100 dark:hover:bg-orange-900/40 text-stone-700 dark:text-stone-200 hover:text-orange-700 px-3 py-1.5 rounded-full transition-colors text-xs font-medium"
                >
                  📍 {preset}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleMapsGroundingSearch()}
                placeholder="Search any temple in India (e.g. Mahakaleshwar Ujjain, Meenakshi Madurai)..."
                className="w-full bg-stone-50 dark:bg-slate-900 border border-stone-300 dark:border-slate-600 rounded-2xl px-4 py-3 text-sm text-stone-800 dark:text-white placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-orange-500 transition-all"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-3 text-stone-400 hover:text-stone-600 text-sm"
                >
                  ✕
                </button>
              )}
            </div>
            <button
              onClick={() => handleMapsGroundingSearch()}
              disabled={searching || !searchQuery.trim()}
              className="bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-700 hover:to-red-700 text-white font-bold px-6 py-3 rounded-2xl shadow-md transition-all flex items-center justify-center gap-2 disabled:opacity-50 text-sm"
            >
              {searching ? (
                <>
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                  <span>Grounding via Maps...</span>
                </>
              ) : (
                <>
                  <span>📍</span>
                  <span>Locate with Google Maps</span>
                </>
              )}
            </button>
          </div>

          {/* Grounded Result Display */}
          {groundedResult && (
            <div className="mt-5 p-5 bg-stone-50 dark:bg-slate-900/80 rounded-2xl border border-stone-200 dark:border-slate-700 animate-fade-in">
              <div className="flex items-center justify-between mb-2 pb-2 border-b border-stone-200 dark:border-slate-700">
                <span className="text-xs font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                  <span>✓</span> Google Maps Grounded Intelligence: "{groundedResult.query}"
                </span>
                <span className="text-[11px] text-stone-400 font-mono">gemini-3.8-flash</span>
              </div>
              <p className="text-sm text-stone-700 dark:text-stone-200 leading-relaxed whitespace-pre-line mb-4">
                {groundedResult.answer}
              </p>

              {/* Render Extracted URLs from Grounding Chunks */}
              {groundedResult.groundedLinks.length > 0 ? (
                <div className="pt-2 border-t border-stone-200 dark:border-slate-700 flex flex-wrap items-center gap-2">
                  <span className="text-xs font-bold text-stone-500 dark:text-stone-400">
                    Direct Navigation:
                  </span>
                  {groundedResult.groundedLinks.map((link, idx) => (
                    <a
                      key={idx}
                      href={link.uri}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-sm transition-all"
                    >
                      <span>📍</span>
                      <span className="truncate max-w-[240px]">{link.title}</span>
                      <span className="text-[10px]">↗</span>
                    </a>
                  ))}
                </div>
              ) : (
                <div className="pt-2 border-t border-stone-200 dark:border-slate-700">
                  <a
                    href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(groundedResult.query)}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold"
                  >
                    <span>📍</span>
                    <span>Search "{groundedResult.query}" on Google Maps ↗</span>
                  </a>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Temples Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {temples.map(temple => {
            const hasGroundedLink = cardGroundedLinks[temple.id];
            const isLocating = locatingCard[temple.id];
            const mapsQuery = temple.address || `${temple.name}, ${temple.location}`;

            return (
              <div 
                key={temple.id} 
                className="group bg-white dark:bg-slate-800 rounded-3xl overflow-hidden border border-stone-200 dark:border-slate-700 hover:shadow-2xl transition-all duration-300 flex flex-col justify-between"
              >
                <div>
                  <div className="relative h-48 overflow-hidden bg-stone-200 dark:bg-slate-700">
                    <img 
                      src={temple.imageUrl} 
                      alt={temple.name} 
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" 
                    />
                    <div className="absolute top-3 right-3 bg-white/95 dark:bg-slate-900/90 backdrop-blur px-2.5 py-1 rounded-xl text-xs font-bold text-amber-600 shadow-md flex items-center gap-1">
                      <span>★</span> {temple.greenStars} Stars
                    </div>
                  </div>
                  
                  <div className="p-5">
                    <h3 className="font-bold text-lg text-stone-800 dark:text-white truncate mb-1">
                      {temple.name}
                    </h3>
                    <p className="text-stone-500 dark:text-stone-400 text-xs mb-3 flex items-center gap-1 truncate">
                      <span>📍</span> {temple.location}
                    </p>

                    <div className="flex justify-between items-center text-xs py-2 px-3 bg-stone-50 dark:bg-slate-900/60 rounded-xl mb-4 border border-stone-100 dark:border-slate-700">
                      <span className="text-stone-500 dark:text-stone-400">Recycled:</span>
                      <span className="font-bold text-emerald-600 dark:text-emerald-400 text-sm">
                        {temple.wasteDonatedKg.toLocaleString()} kg
                      </span>
                    </div>

                    <p className="text-xs text-stone-600 dark:text-stone-300 line-clamp-2 italic mb-3">
                      "{temple.description}"
                    </p>
                  </div>
                </div>

                {/* Card Google Maps Navigation Actions */}
                <div className="p-5 pt-0 border-t border-stone-100 dark:border-slate-700/60 mt-2 space-y-2">
                  {hasGroundedLink ? (
                    <a
                      href={hasGroundedLink.uri}
                      target="_blank"
                      rel="noreferrer"
                      className="w-full py-2 px-3 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 shadow-sm transition-all"
                    >
                      <span>📍</span>
                      <span>Open Verified Map ↗</span>
                    </a>
                  ) : (
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleLocateCardTemple(temple)}
                        disabled={isLocating}
                        className="flex-1 py-2 px-2.5 bg-stone-100 dark:bg-slate-700 hover:bg-orange-50 dark:hover:bg-orange-950/30 text-stone-700 dark:text-stone-200 hover:text-orange-700 text-xs font-semibold rounded-xl border border-stone-200 dark:border-slate-600 transition-all flex items-center justify-center gap-1"
                        title="Ground location with Google Maps"
                      >
                        {isLocating ? (
                          <span className="animate-spin text-xs">⌛</span>
                        ) : (
                          <span>🎯</span>
                        )}
                        <span>{isLocating ? 'Verifying...' : 'Verify on Maps'}</span>
                      </button>
                      
                      <a
                        href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(mapsQuery)}`}
                        target="_blank"
                        rel="noreferrer"
                        className="p-2 bg-stone-100 dark:bg-slate-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 text-stone-700 dark:text-stone-200 hover:text-emerald-700 rounded-xl border border-stone-200 dark:border-slate-600 transition-all flex items-center justify-center text-xs"
                        title="Open directly in Google Maps"
                      >
                        <span>🗺️</span>
                      </a>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
          
          {temples.length === 0 && (
            <div className="col-span-full py-20 text-center bg-white dark:bg-slate-800 rounded-3xl border border-stone-200 dark:border-slate-700">
              <span className="text-4xl block mb-2">🛕</span>
              <p className="text-stone-400 font-semibold">No partner temples registered yet.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default TempleList;
