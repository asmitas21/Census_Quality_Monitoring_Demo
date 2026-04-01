import { useState, useEffect, useRef } from "react";
import { post } from "../api/client";

interface Finding {
  id: string;
  category: string;
  severity: "critical" | "high" | "medium" | "low";
  title: string;
  description: string;
  affected_areas: string[];
  data_points: { label: string; value: string }[];
  recommended_actions: { id: string; action: string; impact: string }[];
  source_tables: string[];
  confidence: number;
}

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  sources?: string[];
}

const MOCK_FINDINGS: Finding[] = [
  {
    id: "f1",
    category: "Demographic Correlation",
    severity: "critical",
    title: "Hispanic + Renter Households: 1.21x Children Undercount Risk",
    description: "AI analysis detected that census tracts with both high Hispanic population (50%+) and high renter percentage (75%+) show a 1.21x concentration of children under 5, indicating elevated undercount risk based on 2010 post-enumeration studies.",
    affected_areas: ["Miami-Dade, FL", "Los Angeles, CA", "Harris, TX", "Maricopa, AZ", "Cook, IL"],
    data_points: [
      { label: "Tracts Affected", value: "688" },
      { label: "Risk Multiplier", value: "1.21x" },
      { label: "Historical Undercount", value: "4.6%" },
    ],
    recommended_actions: [
      { id: "a1", action: "Deploy bilingual enumerator teams", impact: "Est. +8% response rate" },
      { id: "a2", action: "Partner with local community organizations", impact: "Est. +5% trust score" },
      { id: "a3", action: "Extended NRFU visit windows", impact: "Est. +12% contact rate" },
    ],
    source_tables: ["census_operations_demo.operations.tract_detailed", "census_operations_demo.operations.county_household_relationships"],
    confidence: 0.94,
  },
  {
    id: "f2",
    category: "Historical Anomaly",
    severity: "high",
    title: "Texas Border Counties: 2010-2020 Coverage Decline",
    description: "Comparison of 2010 and 2020 Census data shows declining coverage rates in Texas border counties, with some areas showing 15%+ drops in children under 5 counts despite population growth indicators.",
    affected_areas: ["Hidalgo County", "Cameron County", "Webb County", "El Paso County"],
    data_points: [
      { label: "Avg Coverage Decline", value: "-12.3%" },
      { label: "Counties Affected", value: "8" },
      { label: "Pop. Growth (Est.)", value: "+4.2%" },
    ],
    recommended_actions: [
      { id: "a4", action: "Pre-enumeration community outreach", impact: "Address trust concerns" },
      { id: "a5", action: "Spanish-language media campaign", impact: "Increase awareness" },
    ],
    source_tables: ["census_operations_demo.operations.county_census_2010", "census_operations_demo.operations.tract_detailed"],
    confidence: 0.89,
  },
  {
    id: "f3",
    category: "Data Quality",
    severity: "medium",
    title: "Proxy Response Rate Anomaly in Urban Cores",
    description: "Urban census tracts show proxy response rates 2.3x higher than suburban areas, potentially indicating data quality issues for household composition counts.",
    affected_areas: ["New York City", "Chicago", "Philadelphia", "Detroit"],
    data_points: [
      { label: "Urban Proxy Rate", value: "18.4%" },
      { label: "Suburban Proxy Rate", value: "8.1%" },
      { label: "Quality Score Gap", value: "-23 pts" },
    ],
    recommended_actions: [
      { id: "a6", action: "Additional callback attempts", impact: "Reduce proxy reliance" },
      { id: "a7", action: "Evening/weekend enumeration", impact: "Better contact rates" },
    ],
    source_tables: ["census_operations_demo.operations.tract_detailed"],
    confidence: 0.82,
  },
  {
    id: "f4",
    category: "Geographic Cluster",
    severity: "high",
    title: "Rural Appalachia: Complex Household Concentration",
    description: "AI clustering identified a geographic pattern of complex households (grandparent-headed, multigenerational) in rural Appalachian counties that correlates with historical undercount patterns.",
    affected_areas: ["Eastern Kentucky", "West Virginia", "Southwest Virginia", "Eastern Tennessee"],
    data_points: [
      { label: "Complex HH Rate", value: "24.7%" },
      { label: "National Avg", value: "11.2%" },
      { label: "2010 Undercount", value: "3.8%" },
    ],
    recommended_actions: [
      { id: "a8", action: "Train enumerators on complex HH protocols", impact: "Accuracy improvement" },
      { id: "a9", action: "Community leader partnerships", impact: "Trust building" },
    ],
    source_tables: ["census_operations_demo.operations.county_household_relationships"],
    confidence: 0.91,
  },
  {
    id: "f5",
    category: "Intervention Success",
    severity: "low",
    title: "2010 Bilingual Outreach Success Pattern",
    description: "Historical analysis shows that counties with dedicated bilingual outreach programs in 2010 achieved 12% higher self-response rates in Hispanic communities compared to similar counties without such programs.",
    affected_areas: ["Orange County, CA", "Miami-Dade, FL", "Harris County, TX"],
    data_points: [
      { label: "Response Lift", value: "+12.4%" },
      { label: "Cost per HH", value: "$2.30" },
      { label: "ROI Score", value: "High" },
    ],
    recommended_actions: [
      { id: "a10", action: "Replicate bilingual program", impact: "Proven effectiveness" },
    ],
    source_tables: ["census_operations_demo.operations.county_census_2010"],
    confidence: 0.96,
  },
  {
    id: "f6",
    category: "Demographic Correlation",
    severity: "medium",
    title: "Linguistically Isolated Households + Young Children",
    description: "Households where no member speaks English 'very well' show 1.8x higher rates of children under 5, requiring specialized enumeration approaches.",
    affected_areas: ["Southern California", "South Texas", "South Florida", "New York Metro"],
    data_points: [
      { label: "Ling. Isolated HH", value: "4.2M" },
      { label: "Children Rate", value: "1.8x avg" },
      { label: "Response Gap", value: "-18%" },
    ],
    recommended_actions: [
      { id: "a11", action: "Multi-language form availability", impact: "+15% completion" },
      { id: "a12", action: "Community navigator programs", impact: "Trust + accuracy" },
    ],
    source_tables: ["census_operations_demo.operations.county_language"],
    confidence: 0.88,
  },
];

export default function AIFindings() {
  const [findings] = useState<Finding[]>(MOCK_FINDINGS);
  const [selectedFinding, setSelectedFinding] = useState<Finding | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  const handleSendMessage = async () => {
    if (!chatInput.trim()) return;

    const userMessage = chatInput;
    setChatInput("");
    setChatMessages((prev) => [...prev, { role: "user", content: userMessage }]);
    setChatLoading(true);

    try {
      const response = await post<{ answer: string; sql?: string; sources?: string[] }>("/ai/genie", {
        question: userMessage,
      });
      setChatMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: response.answer || "I couldn't process that question. Please try rephrasing.",
          sources: response.sources,
        },
      ]);
    } catch {
      setChatMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "I encountered an error processing your question. Please try again.",
        },
      ]);
    }
    setChatLoading(false);
  };

  const startFindingChat = (finding: Finding) => {
    setSelectedFinding(finding);
    setChatMessages([
      {
        role: "assistant",
        content: `I've analyzed "${finding.title}". This finding has a ${(finding.confidence * 100).toFixed(0)}% confidence score and affects ${finding.affected_areas.length} geographic areas. What would you like to know more about? You can ask about the methodology, affected areas, recommended actions, or historical context.`,
        sources: finding.source_tables,
      },
    ]);
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case "critical":
        return "bg-red-500";
      case "high":
        return "bg-orange-500";
      case "medium":
        return "bg-yellow-500";
      default:
        return "bg-blue-500";
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case "Demographic Correlation":
        return (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        );
      case "Historical Anomaly":
        return (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
          </svg>
        );
      case "Data Quality":
        return (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        );
      case "Geographic Cluster":
        return (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
          </svg>
        );
      case "Intervention Success":
        return (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
          </svg>
        );
      default:
        return (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
          </svg>
        );
    }
  };

  return (
    <div className="flex h-[calc(100vh-120px)] gap-6">
      {/* Findings List */}
      <div className="w-1/2 flex flex-col">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold text-white">AI Findings</h1>
            <p className="text-sm text-census-gray-500">
              {findings.length} insights discovered from your data
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="px-3 py-1 bg-primary-500/20 text-primary-400 text-xs rounded-full">
              Vector Search + LLM
            </span>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto space-y-4 pr-2">
          {findings.map((finding) => (
            <div
              key={finding.id}
              className={`p-4 rounded-xl border transition-all cursor-pointer ${
                selectedFinding?.id === finding.id
                  ? "bg-slate-800 border-primary-500/50"
                  : "bg-slate-800/50 border-white/5 hover:border-white/20"
              }`}
              onClick={() => setSelectedFinding(finding)}
            >
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-lg bg-white/5 text-white/80">
                  {getCategoryIcon(finding.category)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`px-2 py-0.5 text-xs font-medium text-white rounded ${getSeverityColor(finding.severity)}`}>
                      {finding.severity.toUpperCase()}
                    </span>
                    <span className="text-xs text-census-gray-500">{finding.category}</span>
                    <span className="text-xs text-census-gray-600 ml-auto">
                      {(finding.confidence * 100).toFixed(0)}% confidence
                    </span>
                  </div>
                  <h3 className="font-semibold text-white text-sm mb-2">{finding.title}</h3>
                  <p className="text-xs text-census-gray-400 line-clamp-2">{finding.description}</p>

                  {/* Data Points */}
                  <div className="flex gap-4 mt-3">
                    {finding.data_points.slice(0, 3).map((dp) => (
                      <div key={dp.label} className="text-center">
                        <p className="text-sm font-bold text-white">{dp.value}</p>
                        <p className="text-xs text-census-gray-500">{dp.label}</p>
                      </div>
                    ))}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 mt-4">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        startFindingChat(finding);
                      }}
                      className="px-3 py-1.5 bg-primary-500 hover:bg-primary-600 text-white text-xs font-medium rounded-lg transition flex items-center gap-1"
                    >
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                      </svg>
                      Discuss
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        // Handle take action
                      }}
                      className="px-3 py-1.5 bg-green-500/20 hover:bg-green-500/30 text-green-400 text-xs font-medium rounded-lg transition flex items-center gap-1"
                    >
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                      Take Action
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Chat Panel */}
      <div className="w-1/2 flex flex-col bg-slate-800/50 rounded-xl border border-white/5">
        {/* Chat Header */}
        <div className="p-4 border-b border-white/10">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5 text-primary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
              <h3 className="font-semibold text-white">Census Intelligence Chat</h3>
            </div>
            {selectedFinding && (
              <span className="text-xs text-census-gray-500">
                Discussing: {selectedFinding.title.slice(0, 30)}...
              </span>
            )}
          </div>
        </div>

        {/* Chat Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {chatMessages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <svg className="w-12 h-12 text-census-gray-600 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
              <p className="text-census-gray-500 mb-2">Select a finding and click "Discuss"</p>
              <p className="text-census-gray-600 text-sm">
                Or ask any question about census data
              </p>
            </div>
          ) : (
            chatMessages.map((msg, i) => (
              <div
                key={i}
                className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[80%] p-3 rounded-xl ${
                    msg.role === "user"
                      ? "bg-primary-500 text-white"
                      : "bg-slate-700 text-white"
                  }`}
                >
                  <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                  {msg.sources && msg.sources.length > 0 && (
                    <div className="mt-2 pt-2 border-t border-white/10">
                      <p className="text-xs text-white/60 mb-1">Sources:</p>
                      <div className="flex flex-wrap gap-1">
                        {msg.sources.map((src) => (
                          <span
                            key={src}
                            className="px-2 py-0.5 bg-white/10 rounded text-xs text-white/80 font-mono"
                          >
                            {src.split(".").pop()}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
          {chatLoading && (
            <div className="flex justify-start">
              <div className="bg-slate-700 p-3 rounded-xl">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-white/50 rounded-full animate-bounce" />
                  <div className="w-2 h-2 bg-white/50 rounded-full animate-bounce" style={{ animationDelay: "0.1s" }} />
                  <div className="w-2 h-2 bg-white/50 rounded-full animate-bounce" style={{ animationDelay: "0.2s" }} />
                </div>
              </div>
            </div>
          )}
          <div ref={chatEndRef} />
        </div>

        {/* Chat Input */}
        <div className="p-4 border-t border-white/10">
          <div className="flex gap-2">
            <input
              type="text"
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSendMessage()}
              placeholder="Ask about findings, data, or census methodology..."
              className="flex-1 px-4 py-2 bg-slate-900 border border-white/10 rounded-lg text-white placeholder-census-gray-500 text-sm focus:outline-none focus:border-primary-500"
            />
            <button
              onClick={handleSendMessage}
              disabled={chatLoading}
              className="px-4 py-2 bg-primary-500 hover:bg-primary-600 disabled:opacity-50 text-white rounded-lg transition"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
