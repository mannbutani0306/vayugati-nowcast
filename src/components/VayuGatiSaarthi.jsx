import React, { useEffect, useRef, useState } from 'react';
import { askVayuGatiSaarthi } from '../lib/apiClient';
import { Bot, LoaderCircle, Send, X } from 'lucide-react';

const WELCOME_MESSAGE = {
  role: 'model',
  text: 'Namaste, I am VayuGati Saarthi. Ask me about the portals, alerts, accessibility, or weather data shown in this app.',
};

export default function VayuGatiSaarthi({ isOpen, onClose }) {
  const [messages, setMessages] = useState([WELCOME_MESSAGE]);
  const [draft, setDraft] = useState('');
  const [isSending, setIsSending] = useState(false);
  const messageListRef = useRef(null);

  useEffect(() => {
    messageListRef.current?.scrollTo({ top: messageListRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (event) => {
    event.preventDefault();
    const text = draft.trim();
    if (!text || isSending) return;

    const userMessage = { role: 'user', text };
    const conversation = [...messages.slice(1), userMessage].slice(-12);
    setMessages((current) => [...current, userMessage]);
    setDraft('');
    setIsSending(true);

    try {
      const answer = await askVayuGatiSaarthi(conversation);
      setMessages((current) => [...current, { role: 'model', text: answer }]);
    } catch (error) {
      setMessages((current) => [...current, {
        role: 'model',
        text: error.message || 'Saarthi is unavailable right now. Please try again later.',
      }]);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[150] flex items-stretch justify-center bg-black/55 p-0 sm:items-center sm:p-4" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="flex h-[100dvh] w-full max-w-xl flex-col bg-white text-[#1A1D20] shadow-2xl sm:h-[min(720px,calc(100dvh-2rem))] sm:border sm:border-[#D4DEE5]" role="dialog" aria-modal="true" aria-labelledby="saarthi-title">
        <header className="flex items-center justify-between border-b border-[#D4DEE5] bg-[#0F172A] px-4 py-3 text-white sm:px-5">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center bg-[#D9532F] text-white">
              <Bot aria-hidden="true" className="h-5 w-5" />
            </span>
            <div>
              <h2 id="saarthi-title" className="text-sm font-bold">VayuGati Saarthi</h2>
              <p className="text-[11px] text-neutral-300">App and weather-data assistant</p>
            </div>
          </div>
          <button type="button" onClick={onClose} aria-label="Close VayuGati Saarthi" className="inline-flex h-9 w-9 items-center justify-center text-neutral-200 hover:bg-white/10 hover:text-white">
            <X className="h-5 w-5" />
          </button>
        </header>

        <div ref={messageListRef} className="flex-1 space-y-3 overflow-y-auto bg-[#F5F8F8] px-3 py-4 sm:px-5" aria-live="polite">
          {messages.map((message, index) => (
            <div key={`${message.role}-${index}`} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <p className={`max-w-[88%] whitespace-pre-wrap px-3 py-2.5 text-sm leading-relaxed ${message.role === 'user' ? 'bg-[#0F4960] text-white' : 'border border-[#D4DEE5] bg-white text-[#263238]'}`}>
                {message.text}
              </p>
            </div>
          ))}
          {isSending && <div className="flex items-center gap-2 text-xs text-[#56636A]" role="status"><LoaderCircle className="h-4 w-4 animate-spin" /> Saarthi is responding</div>}
        </div>

        <form onSubmit={handleSubmit} className="flex items-end gap-2 border-t border-[#D4DEE5] bg-white p-3 sm:p-4">
          <label className="sr-only" htmlFor="saarthi-message">Message Saarthi</label>
          <textarea
            id="saarthi-message"
            rows={2}
            maxLength={2000}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="Ask about VayuGati Nowcast..."
            className="min-h-11 max-h-32 flex-1 resize-y border border-[#B8C6CC] px-3 py-2 text-sm text-[#1A1D20] outline-none focus:border-[#0F4960]"
          />
          <button type="submit" disabled={!draft.trim() || isSending} aria-label="Send message" className="inline-flex h-11 w-11 shrink-0 items-center justify-center bg-[#D9532F] text-white hover:bg-[#BF4422] disabled:cursor-not-allowed disabled:opacity-50">
            <Send className="h-4 w-4" />
          </button>
        </form>
      </section>
    </div>
  );
}