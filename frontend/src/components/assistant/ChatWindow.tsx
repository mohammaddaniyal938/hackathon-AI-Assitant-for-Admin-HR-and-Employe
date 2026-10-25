"use client";

import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { Bot, Minus, Send, X } from "lucide-react";
import axios from "axios";
import api from "@/lib/api";
import ChatMessage, { type AssistantChatMessage } from "./ChatMessage";

const suggestedPrompts = [
  "How do I record my attendance?",
  "How does the leave approval process work?",
  "Who can view and finalize payroll?",
  "What can I do in HCM Lite as an HR user?",
];

type Availability = "connecting" | "online" | "unavailable";

const getTimestamp = () => Date.now();

const newMessage = (role: AssistantChatMessage["role"], content: string): AssistantChatMessage => ({
  id: crypto.randomUUID(),
  role,
  content,
  createdAt: getTimestamp(),
});

export default function ChatWindow({
  visible,
  onMinimize,
  onClose,
}: {
  visible: boolean;
  onMinimize: () => void;
  onClose: () => void;
}) {
  const [messages, setMessages] = useState<AssistantChatMessage[]>(() => [{
    id: "welcome-message",
    role: "assistant",
    content: "Hi! I'm the HCM AI Assistant. I can help you navigate attendance, leave, payroll, employee management, and dashboards. I can't access private records or complete actions for you.",
    createdAt: getTimestamp(),
  }]);
  const [availability, setAvailability] = useState<Availability>("connecting");
  const [availabilityError, setAvailabilityError] = useState("");
  const [error, setError] = useState("");
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const scrollArea = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!visible) return;
    let active = true;

    const checkAvailability = async () => {
      setAvailability("connecting");
      setAvailabilityError("");

      try {
        const { data } = await api.get<{ available: boolean }>("/assistant/status");
        if (!active) return;
        setAvailability(data.available ? "online" : "unavailable");
        if (!data.available) {
          setAvailabilityError("The AI service is not configured. Add GROQ_API_KEY to backend/.env and restart the backend.");
        }
      } catch {
        if (!active) return;
        setAvailability("unavailable");
        setAvailabilityError("Unable to reach the assistant service. Check the backend connection and try again.");
      }
    };

    void checkAvailability();
    return () => { active = false; };
  }, [visible]);

  useEffect(() => {
    scrollArea.current?.scrollTo({ top: scrollArea.current.scrollHeight, behavior: "smooth" });
  }, [messages, sending, visible]);

  const sendMessage = async (rawContent: string) => {
    const content = rawContent.trim();
    if (!content || sending || availability !== "online") return;

    const userMessage = newMessage("user", content);
    const history = messages
      .filter((message) => message.id !== "welcome-message")
      .slice(-8)
      .map(({ role, content: previousContent }) => ({ role, content: previousContent }));
    setMessages((current) => [...current, userMessage].slice(-40));
    setDraft("");
    setError("");
    setSending(true);
    try {
      const response = await api.post<{ reply: string }>("/assistant/chat", { message: content, history });
      setMessages((current) => [...current, newMessage("assistant", response.data.reply)].slice(-40));
    } catch (requestError) {
      const message = axios.isAxiosError(requestError)
        ? requestError.response?.data?.message || "The assistant could not respond. Please check your connection and try again."
        : "The assistant could not respond. Please check your connection and try again.";
      setError(message);
    } finally {
      setSending(false);
      input.current?.focus();
    }
  };

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void sendMessage(draft);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void sendMessage(draft);
    }
  };

  return (
    <section
      hidden={!visible}
      aria-label="HCM AI Assistant chat"
      aria-live="polite"
      className="fixed bottom-24 right-4 z-[70] flex flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl shadow-slate-900/20 sm:right-6"
      style={{ width: "min(24rem, calc(100vw - 2rem))", height: "min(40rem, calc(100dvh - 7rem))" }}
    >
      <header className="flex shrink-0 items-center justify-between gap-3 bg-slate-950 px-4 py-3.5 text-white">
        <div className="flex min-w-0 items-center gap-3">
          <span aria-hidden="true" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-blue-500"><Bot size={23} /></span>
          <div className="min-w-0">
            <h2 className="truncate text-sm font-bold">HCM AI Assistant</h2>
            <p className="mt-0.5 flex items-center gap-1.5 text-xs text-slate-300">
              <span className={`h-2 w-2 rounded-full ${availability === "online" ? "bg-emerald-400" : availability === "connecting" ? "animate-pulse bg-amber-300" : "bg-slate-400"}`} />
              {availability === "online" ? "Online" : availability === "connecting" ? "Connecting..." : "Unavailable"}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <button type="button" aria-label="Minimize chat" title="Minimize" onClick={onMinimize} className="rounded-lg p-2 text-slate-300 transition hover:bg-white/10 hover:text-white"><Minus size={18} /></button>
          <button type="button" aria-label="Close chat" title="Close" onClick={onClose} className="rounded-lg p-2 text-slate-300 transition hover:bg-white/10 hover:text-white"><X size={18} /></button>
        </div>
      </header>

      <div ref={scrollArea} className="min-h-0 flex-1 space-y-4 overflow-y-auto bg-white px-4 py-4">
        {messages.map((message) => <ChatMessage key={message.id} message={message} />)}
        {messages.length === 1 && (
          <div className="space-y-2 pt-1">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Suggested questions</p>
            {suggestedPrompts.map((prompt) => (
              <button key={prompt} type="button" disabled={availability !== "online" || sending} onClick={() => void sendMessage(prompt)} className="block w-full rounded-xl border border-slate-200 px-3 py-2 text-left text-xs leading-relaxed text-slate-700 transition hover:border-blue-300 hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-50">
                {prompt}
              </button>
            ))}
          </div>
        )}
        {sending && (
          <div role="status" className="flex items-center gap-2 text-xs text-slate-500">
            <Bot size={16} className="text-blue-600" />
            <span className="flex items-center gap-1">Thinking<span className="animate-pulse">...</span></span>
          </div>
        )}
        <div aria-hidden="true" />
      </div>

      <div className="shrink-0 border-t border-slate-100 bg-white p-3">
        {(availabilityError || error) && <p role="alert" className="mb-2 rounded-xl bg-amber-50 px-3 py-2 text-xs leading-relaxed text-amber-900">{error || availabilityError}</p>}
        <form onSubmit={submit} className="flex items-end gap-2 rounded-2xl border border-slate-200 bg-slate-50 p-2 focus-within:border-blue-400 focus-within:ring-2 focus-within:ring-blue-100">
          <label htmlFor="hcm-ai-message" className="sr-only">Message the HCM AI Assistant</label>
          <textarea
            id="hcm-ai-message"
            ref={input}
            rows={1}
            maxLength={2000}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={availability === "online" ? "Ask about HCM Lite..." : "Assistant unavailable"}
            disabled={availability !== "online" || sending}
            className="max-h-28 min-h-9 flex-1 resize-y bg-transparent px-2 py-2 text-sm outline-none placeholder:text-slate-400 disabled:cursor-not-allowed"
          />
          <button type="submit" aria-label="Send message" disabled={!draft.trim() || sending || availability !== "online"} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300"><Send size={16} /></button>
        </form>
        <p className="mt-2 px-1 text-[10px] leading-relaxed text-slate-400">Do not send passwords, access tokens, or sensitive personal information. Chat messages are sent to Groq for an AI response.</p>
      </div>
    </section>
  );
}
