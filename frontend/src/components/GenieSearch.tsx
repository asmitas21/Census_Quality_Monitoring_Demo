import { useState, useRef, useEffect } from "react";
import { post } from "../api/client";

type GenieResponse = {
  answer: string;
  sql?: string;
  data?: Record<string, unknown>[];
  source?: string;
};

export default function GenieSearch() {
  const [query, setQuery] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [response, setResponse] = useState<GenieResponse | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const suggestions = [
    "Which states have the lowest self-response rates?",
    "Show top 10 counties where broadband access is below 30%",
    "Which counties declined the most from 2010 to 2020?",
    "Show counties with high language barriers AND low response rates",
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    
    setIsLoading(true);
    setIsExpanded(true);
    try {
      const res = await post<GenieResponse>("/ai/genie", { query });
      setResponse(res);
    } catch {
      setResponse({ 
        answer: "I couldn't process that question. Try asking about response rates, demographics, or geographic coverage.", 
        source: "error" 
      });
    }
    setIsLoading(false);
  };

  const handleSuggestion = (suggestion: string) => {
    setQuery(suggestion);
    inputRef.current?.focus();
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "/" && e.target === document.body) {
        e.preventDefault();
        inputRef.current?.focus();
      }
      if (e.key === "Escape") {
        setIsExpanded(false);
        setResponse(null);
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <div className="relative">
      <form onSubmit={handleSubmit} className="relative">
        <div className="relative group">
          <div className="absolute inset-0 bg-gradient-to-r from-primary-500/20 to-census-gold/20 rounded-xl blur-xl group-hover:blur-2xl transition-all opacity-0 group-hover:opacity-100" />
          <div className="relative flex items-center bg-white/10 backdrop-blur-sm border border-white/20 rounded-xl overflow-hidden hover:border-primary-400/50 transition-all">
            <div className="pl-4 pr-2">
              <svg className="w-5 h-5 text-primary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
            </div>
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Ask in plain English... (Press / to focus)"
              className="flex-1 bg-transparent text-white placeholder-white/50 py-3 px-2 outline-none text-sm"
            />
            <button
              type="submit"
              disabled={isLoading || !query.trim()}
              className="px-4 py-2 m-1.5 bg-primary-500 hover:bg-primary-600 disabled:bg-white/10 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
            >
              {isLoading ? (
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              ) : (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              )}
              <span className="hidden sm:inline">Ask Genie</span>
            </button>
          </div>
        </div>
      </form>

      {/* Suggestions */}
      {!isExpanded && (
        <div className="flex flex-wrap gap-2 mt-3">
          {suggestions.map((s, i) => (
            <button
              key={i}
              onClick={() => handleSuggestion(s)}
              className="text-xs px-3 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-primary-400/30 text-white/70 hover:text-white rounded-full transition-all"
            >
              {s}
            </button>
          ))}
        </div>
      )}

      {/* Response Panel - Inline expansion instead of absolute */}
      {isExpanded && response && (
        <div className="mt-3 bg-slate-800 border border-white/10 rounded-xl shadow-2xl">
          <div className="p-4 max-h-[400px] overflow-y-auto">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-primary-500/20 flex items-center justify-center flex-shrink-0">
                <svg className="w-4 h-4 text-primary-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-white text-sm leading-relaxed whitespace-pre-wrap">{response.answer}</p>
                {response.sql && (
                  <div className="mt-3 p-3 bg-slate-950 rounded-lg">
                    <p className="text-xs text-census-gray-400 mb-1">Generated SQL</p>
                    <pre className="text-xs text-primary-300 overflow-x-auto whitespace-pre-wrap">{response.sql}</pre>
                  </div>
                )}
                {response.source && response.source !== "error" && (
                  <p className="text-xs text-census-gray-500 mt-2">Source: {response.source}</p>
                )}
              </div>
              <button
                onClick={() => { setIsExpanded(false); setResponse(null); }}
                className="text-census-gray-500 hover:text-white flex-shrink-0"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
