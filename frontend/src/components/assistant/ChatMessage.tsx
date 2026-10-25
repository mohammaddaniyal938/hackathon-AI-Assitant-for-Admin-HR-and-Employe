"use client";

import { Bot, UserRound } from "lucide-react";

export interface AssistantChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: number;
}

export default function ChatMessage({ message }: { message: AssistantChatMessage }) {
  const isUser = message.role === "user";
  const time = new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }).format(new Date(message.createdAt));

  return (
    <article className={`flex items-end gap-2 ${isUser ? "justify-end" : "justify-start"}`}>
      {!isUser && <span aria-hidden="true" className="mb-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-100 text-blue-700"><Bot size={16} /></span>}
      <div className={`max-w-[85%] ${isUser ? "items-end" : "items-start"} flex flex-col`}>
        <p className={`whitespace-pre-wrap break-words rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${isUser ? "rounded-br-md bg-blue-600 text-white" : "rounded-bl-md bg-slate-100 text-slate-800"}`}>
          {message.content}
        </p>
        <time dateTime={new Date(message.createdAt).toISOString()} className="mt-1 px-1 text-[10px] text-slate-400">{time}</time>
      </div>
      {isUser && <span aria-hidden="true" className="mb-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-200 text-slate-700"><UserRound size={15} /></span>}
    </article>
  );
}
