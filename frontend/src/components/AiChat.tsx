import { useState } from "react";
import { post } from "../api/client";
import Button from "./Button";

interface AiChatProps {
  anomalyId?: string;
  investigationId?: string;
  className?: string;
}

interface Message {
  role: "user" | "assistant";
  content: string;
}

export default function AiChat({ anomalyId, investigationId, className = "" }: AiChatProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  const send = async () => {
    if (!input.trim() || loading) return;
    const userMsg: Message = { role: "user", content: input.trim() };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput("");
    setLoading(true);

    try {
      const res = await post<{ response: string }>("/ai/chat", {
        message: userMsg.content,
        anomaly_id: anomalyId,
        investigation_id: investigationId,
        history: newMessages.map((m) => ({ role: m.role, content: m.content })),
      });
      setMessages([...newMessages, { role: "assistant", content: res.response }]);
    } catch {
      setMessages([...newMessages, { role: "assistant", content: "Sorry, I encountered an error. Please try again." }]);
    } finally {
      setLoading(false);
    }
  };

  const suggestions = anomalyId
    ? ["What are the likely root causes?", "Are there similar patterns nearby?", "Summarize for my supervisor"]
    : ["What should I investigate first?", "Suggest next steps", "Draft an escalation summary"];

  return (
    <div className={`flex flex-col bg-white rounded-lg border border-census-gray-200 shadow-sm overflow-hidden ${className}`}>
      <div className="px-4 py-3 bg-census-blue text-white text-sm font-semibold flex items-center gap-2">
        <span className="text-base">&#9883;</span>
        AI Assistant
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3 max-h-80 min-h-[160px]">
        {messages.length === 0 && (
          <div className="text-census-gray-500 text-sm">
            <p className="mb-3">Ask me about this {anomalyId ? "anomaly" : "investigation"}. Try:</p>
            <div className="flex flex-wrap gap-2">
              {suggestions.map((s) => (
                <button
                  key={s}
                  onClick={() => { setInput(s); }}
                  className="text-xs px-2.5 py-1.5 rounded-full border border-census-blue/30 text-census-blue hover:bg-census-blue/5 transition"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
            <div
              className={`max-w-[85%] px-3 py-2 rounded-lg text-sm whitespace-pre-wrap ${
                msg.role === "user"
                  ? "bg-census-blue text-white"
                  : "bg-census-gray-100 text-census-gray-800"
              }`}
            >
              {msg.content}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="bg-census-gray-100 text-census-gray-500 px-3 py-2 rounded-lg text-sm">
              <span className="inline-flex gap-1">
                <span className="animate-bounce">&#8226;</span>
                <span className="animate-bounce" style={{ animationDelay: "0.1s" }}>&#8226;</span>
                <span className="animate-bounce" style={{ animationDelay: "0.2s" }}>&#8226;</span>
              </span>
            </div>
          </div>
        )}
      </div>

      <div className="border-t border-census-gray-200 p-3 flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && send()}
          placeholder="Ask a question..."
          className="flex-1 rounded border border-census-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-census-blue"
        />
        <Button onClick={send} disabled={!input.trim() || loading} className="text-sm px-3 py-2">
          Send
        </Button>
      </div>
    </div>
  );
}
