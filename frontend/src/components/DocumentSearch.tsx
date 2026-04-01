import { useState } from "react";
import { get, post } from "../api/client";
import { useWorkspaceHost, ucExploreUrl } from "../hooks/useWorkspaceHost";

interface Document {
  name: string;
  title: string;
  description: string;
  pages: string;
}

interface RAGResponse {
  answer: string;
  sources: { document: string; source: string }[];
  source: string;
  query: string;
}

interface DocumentsResponse {
  documents: Document[];
  total: number;
  index_status: string;
  message: string;
}

export function DocumentSearch() {
  const host = useWorkspaceHost();
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState<RAGResponse | null>(null);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [showDocs, setShowDocs] = useState(false);

  const handleSearch = async () => {
    if (!query.trim()) return;
    
    setLoading(true);
    setResponse(null);
    
    try {
      const result = await post<RAGResponse>("/ai/rag", { query });
      setResponse(result);
    } catch (err) {
      console.error("RAG query error:", err);
      setResponse({
        answer: "Sorry, I encountered an error searching the documents. Please try again.",
        sources: [],
        source: "error",
        query,
      });
    } finally {
      setLoading(false);
    }
  };

  const loadDocuments = async () => {
    if (documents.length === 0) {
      try {
        const result = await get<DocumentsResponse>("/ai/documents");
        setDocuments(result.documents);
      } catch (err) {
        console.error("Error loading documents:", err);
      }
    }
    setShowDocs(!showDocs);
  };

  const suggestions = [
    "How do we count children under 5?",
    "What is NRFU methodology?",
    "How does ACS sampling work?",
    "What causes census undercount?",
  ];

  return (
    <div className="bg-gradient-to-br from-slate-800/80 to-slate-900/80 rounded-2xl border border-white/10 p-6">
      <div className="flex items-center gap-3 mb-4">
        <div className="p-2 bg-primary-500/20 rounded-lg">
          <svg className="w-5 h-5 text-primary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
          </svg>
        </div>
        <div>
          <h3 className="text-lg font-semibold text-white">Census Document Search</h3>
          <p className="text-sm text-white/60">Ask questions about Census methodology using RAG + Vector Search</p>
        </div>
      </div>

      {/* Search input */}
      <div className="relative mb-4">
        <div className="absolute left-4 top-1/2 -translate-y-1/2">
          <svg className="w-5 h-5 text-white/40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSearch()}
          placeholder="Ask about Census methodology, procedures, or best practices..."
          className="w-full px-4 py-3 pl-12 bg-slate-900/50 border border-white/10 rounded-xl text-white placeholder:text-white/40 focus:outline-none focus:border-primary-500/50 focus:ring-2 focus:ring-primary-500/20"
        />
        <button
          onClick={handleSearch}
          disabled={loading || !query.trim()}
          className="absolute right-2 top-1/2 -translate-y-1/2 px-4 py-1.5 bg-primary-500 hover:bg-primary-600 disabled:bg-white/10 disabled:text-white/40 text-white text-sm font-medium rounded-lg transition flex items-center gap-2"
        >
          {loading ? (
            <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          ) : (
            "Search Docs"
          )}
        </button>
      </div>

      {/* Suggestions */}
      {!response && !loading && (
        <div className="flex flex-wrap gap-2 mb-4">
          {suggestions.map((s, i) => (
            <button
              key={i}
              onClick={() => {
                setQuery(s);
                setTimeout(handleSearch, 100);
              }}
              className="px-3 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-sm text-white/70 hover:text-white transition"
            >
              {s}
            </button>
          ))}
        </div>
      )}

      {/* Response */}
      {response && (
        <div className="mt-4 bg-slate-800/50 border border-white/10 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-2 h-2 rounded-full bg-green-400"></div>
            <span className="text-xs text-white/60 uppercase tracking-wide">
              {response.source === "rag" ? "AI + Vector Search" : response.source}
            </span>
          </div>
          
          <p className="text-white text-sm leading-relaxed whitespace-pre-wrap">
            {response.answer}
          </p>

          {response.sources && response.sources.length > 0 && (
            <div className="mt-4 pt-3 border-t border-white/10">
              <p className="text-xs text-white/50 mb-2">Sources:</p>
              <div className="flex flex-wrap gap-2">
                {response.sources.map((s, i) => (
                  <span
                    key={i}
                    className="px-2 py-1 bg-primary-500/10 border border-primary-500/20 rounded text-xs text-primary-300 inline-flex items-center gap-1"
                  >
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    {s.source}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Document list toggle */}
      <div className="mt-4 pt-4 border-t border-white/10">
        <button
          onClick={loadDocuments}
          className="flex items-center gap-2 text-sm text-white/60 hover:text-white transition"
        >
          <svg className={`w-4 h-4 transition ${showDocs ? "rotate-90" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
          View indexed documents ({documents.length || 3})
        </button>

        {showDocs && documents.length > 0 && (
          <div className="mt-3 space-y-2">
            {documents.map((doc, i) => (
              <div
                key={i}
                className="p-3 bg-white/5 rounded-lg border border-white/5"
              >
                <div className="flex items-start gap-3">
                  <svg className="w-5 h-5 text-primary-400 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <div>
                    <p className="text-sm font-medium text-white">{doc.title}</p>
                    <p className="text-xs text-white/60 mt-1">{doc.description}</p>
                    <p className="text-xs text-white/40 mt-1">{doc.pages} pages</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Link to Unity Catalog */}
      <div className="mt-4 pt-4 border-t border-white/10">
        <a
          href={ucExploreUrl(host, "census_operations_demo/operations/census_documents")}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 text-sm text-primary-400 hover:text-primary-300 transition"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
          </svg>
          View documents in Unity Catalog →
        </a>
      </div>
    </div>
  );
}
