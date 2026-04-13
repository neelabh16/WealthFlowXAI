"use client";

import { motion } from "framer-motion";
import { SendHorizonal } from "lucide-react";
import type { ChatMessage } from "@/types";

export function ChatWindow({ messages }: { messages: ChatMessage[] }) {
  return (
    <div className="glass-card flex h-[520px] flex-col overflow-hidden">
      <div className="border-b border-[color:var(--border)] px-6 py-4">
        <p className="font-display text-xl text-[color:var(--text-strong)]">AI Financial Advisor</p>
        <p className="text-sm text-muted">Context-aware guidance grounded in your transactions, goals, and risk profile.</p>
      </div>
      <div className="flex-1 space-y-4 overflow-y-auto px-6 py-5">
        {messages.map((message, index) => (
          <motion.div
            key={`${message.role}-${index}`}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className={message.role === "assistant" ? "max-w-xl rounded-3xl border border-[color:var(--border)] p-4" : "ml-auto max-w-md rounded-3xl border border-[color:var(--border)] bg-[color:var(--surface-strong)] p-4"}
            style={message.role === "assistant" ? { background: "color-mix(in srgb, var(--brand-secondary) 16%, transparent)" } : undefined}
          >
            <p className="mb-1 text-xs uppercase tracking-[0.3em] text-subtle">{message.role}</p>
            <p className="text-sm leading-7 text-[color:var(--text-strong)]">{message.content}</p>
          </motion.div>
        ))}
      </div>
      <div className="border-t border-[color:var(--border)] px-6 py-4">
        <div className="flex items-center gap-3 rounded-full border border-[color:var(--border)] bg-[color:var(--panel)] px-4 py-3">
          <input
            className="flex-1 bg-transparent text-sm text-[color:var(--text-strong)] outline-none"
            placeholder="Ask about goals, spending, or what you can afford..."
          />
          <button className="rounded-full bg-[color:var(--brand)] p-2 text-[color:var(--brand-contrast)]">
            <SendHorizonal className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
