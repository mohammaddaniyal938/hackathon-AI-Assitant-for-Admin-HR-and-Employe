"use client";

import { useState } from "react";
import { MessageCircle, Sparkles } from "lucide-react";
import ChatWindow from "./ChatWindow";

export default function FloatingChatButton() {
  const [open, setOpen] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const visible = open && !minimized;

  const toggleChat = () => {
    if (visible) {
      setOpen(false);
      setMinimized(false);
      return;
    }
    setOpen(true);
    setMinimized(false);
  };

  return (
    <>
      <ChatWindow
        visible={visible}
        onMinimize={() => setMinimized(true)}
        onClose={() => { setOpen(false); setMinimized(false); }}
      />
      <div className="group fixed bottom-5 right-5 z-[80] sm:bottom-6 sm:right-6">
        <span role="tooltip" className="pointer-events-none absolute bottom-full right-0 mb-3 whitespace-nowrap rounded-lg bg-slate-950 px-3 py-2 text-xs font-medium text-white opacity-0 shadow-lg transition group-hover:opacity-100 group-focus-within:opacity-100">
          Chat with AI
        </span>
        <span aria-hidden="true" className="absolute inset-0 rounded-full bg-blue-500/30 animate-ping" />
        <button
          type="button"
          aria-label={visible ? "Close HCM AI Assistant" : "Open HCM AI Assistant"}
          aria-expanded={visible}
          aria-controls="hcm-ai-message"
          title={visible ? "Close chat" : "Chat with AI"}
          onClick={toggleChat}
          className="relative flex h-14 w-14 items-center justify-center rounded-full bg-blue-600 text-white shadow-lg shadow-blue-900/25 transition hover:scale-105 hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-300"
        >
          {visible ? <MessageCircle size={25} fill="currentColor" className="stroke-white" /> : <span className="relative"><MessageCircle size={25} /><Sparkles size={13} className="absolute -right-1 -top-1 rounded-full bg-blue-600" /></span>}
        </button>
      </div>
    </>
  );
}
