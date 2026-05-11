import React, { useState, useRef, useEffect } from 'react';
import { Button } from './Button';
import { Card } from './Card';
import { api, getErrorMessage, getAccessToken } from '@/services/api';
import type { ChatPayload, ChatResponse } from '@/types/api';
import { useToast } from '@/hooks/useToast';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  sources?: string[];
}

interface ChatPanelProps {
  analysisId: string;
  repositoryName?: string;
}

const SAMPLE_QUESTIONS = [
  "What is the main tech stack used here?",
  "Explain the project structure.",
  "Are there any specific design patterns used?",
  "How are the API routes structured?",
  "Where is the database logic located?"
];

export const ChatPanel: React.FC<ChatPanelProps> = ({ analysisId, repositoryName }) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const { pushToast } = useToast();
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage: Message = { role: 'user', content: input };
    setMessages((prev) => [...prev, userMessage]);
    const currentInput = input;
    setInput('');
    setIsLoading(true);

    try {
      const baseUrl = typeof import.meta.env.VITE_API_URL === 'string' ? import.meta.env.VITE_API_URL : 'http://localhost:8000';
      const token = getAccessToken();
      
      const response = await fetch(`${baseUrl}/analysis/${analysisId}/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ question: currentInput }),
      });

      if (!response.ok) {
        throw new Error(`Chat failed with status ${response.status}`);
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      
      if (!reader) {
        throw new Error('Response body is not readable.');
      }

      // Add an empty assistant message first
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: '', sources: [] },
      ]);

      let fullContent = '';
      let sources: string[] = [];

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n');
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const dataStr = line.slice(6).trim();
            if (!dataStr) continue;
            
            try {
              const data = JSON.parse(dataStr);
              if (data.error) {
                throw new Error(data.error);
              }
              if (data.sources) {
                sources = data.sources;
              }
              if (data.text) {
                fullContent += data.text;
                
                // Update the last message in real-time
                setMessages((prev) => {
                  const next = [...prev];
                  const last = next[next.length - 1];
                  if (last && last.role === 'assistant') {
                    return [
                      ...next.slice(0, -1),
                      { ...last, content: fullContent, sources: sources.length > 0 ? sources : last.sources }
                    ];
                  }
                  return next;
                });
              }
            } catch (e) {
              // Ignore JSON parse errors for incomplete chunks
              continue;
            }
          }
        }
      }
    } catch (error) {
      pushToast({
        title: 'Chat failed',
        description: error instanceof Error ? error.message : 'Failed to generate response.',
        tone: 'error',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleQuickQuestion = (question: string) => {
    setInput(question);
  };

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-primary-500 to-primary-600 text-white shadow-glass transition-all hover:scale-110 hover:shadow-glow focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
        aria-label="Open chat"
      >
        <svg xmlns="http://www.w3.org/-2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="h-6 w-6">
          <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 0 1 .865-.501 48.172 48.172 0 0 0 3.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0 0 12 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018Z" />
        </svg>
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-50 pointer-events-none flex items-end justify-end p-4 sm:p-6">
      <div 
        className={`pointer-events-auto bg-white/90 backdrop-blur-xl shadow-premium border border-white/60 flex flex-col transition-all duration-300 ease-in-out overflow-hidden relative ${
          isExpanded ? 'w-[calc(100vw-2rem)] h-[calc(100vh-2rem)] sm:w-[800px] sm:h-[80vh] rounded-2xl' : 'w-[360px] h-[500px] rounded-2xl sm:w-[400px] sm:h-[550px]'
        }`}
        style={{ resize: 'both', minWidth: '300px', minHeight: '400px', maxWidth: '100vw', maxHeight: '100vh' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-black/5 bg-white/50 backdrop-blur-md">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-100 text-primary-600">
              <svg xmlns="http://www.w3.org/-2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="h-4 w-4">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 0 0-2.456 2.456ZM16.894 20.567 16.5 21.75l-.394-1.183a2.25 2.25 0 0 0-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 0 0 1.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 0 0 1.423 1.423l1.183.394-1.183.394a2.25 2.25 0 0 0-1.423 1.423Z" />
              </svg>
            </div>
            <div>
              <h3 className="text-sm font-bold text-ink">Chat with AI</h3>
              {repositoryName && <p className="text-[10px] text-slate-500 font-medium">{repositoryName}</p>}
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="rounded-lg p-1.5 text-slate-400 hover:bg-black/5 hover:text-slate-600 transition-colors"
              title={isExpanded ? "Collapse" : "Expand"}
            >
              <svg xmlns="http://www.w3.org/-2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="h-4 w-4">
                {isExpanded ? (
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 9V4.5M9 9H4.5M9 9 3.75 3.75M9 15v4.5M9 15H4.5M9 15l-5.25 5.25M15 9h4.5M15 9V4.5M15 9l5.25-5.25M15 15h4.5M15 15v4.5m0-4.5 5.25 5.25" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9m5.25 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15" />
                )}
              </svg>
            </button>
            <button
              onClick={() => setIsOpen(false)}
              className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600 transition-colors"
              title="Close"
            >
              <svg xmlns="http://www.w3.org/-2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="h-4 w-4">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Chat Area */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin bg-black/[0.01]">
          {messages.length === 0 && (
            <div className="text-center py-6 text-slate-500 flex flex-col items-center justify-center h-full">
              <div className="w-16 h-16 rounded-full bg-primary-50 border border-primary-100 flex items-center justify-center mb-4 text-primary-400">
                <svg xmlns="http://www.w3.org/-2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-8 h-8">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H8.25m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H12m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 0 1-2.555-.337A5.972 5.972 0 0 1 5.41 20.97a5.969 5.969 0 0 1-.474-.065 4.48 4.48 0 0 0 .978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25Z" />
                </svg>
              </div>
              <p className="text-sm font-bold text-ink mb-1">How can I help?</p>
              <p className="text-xs mb-6 opacity-80">Ask questions about the code or architecture.</p>
              <div className="flex flex-wrap justify-center gap-2">
                {SAMPLE_QUESTIONS.map((q, i) => (
                  <button
                    key={i}
                    onClick={() => handleQuickQuestion(q)}
                    className="text-[11px] px-3 py-1.5 rounded-pill border border-slate-200 hover:border-primary-300 hover:bg-primary-50 hover:text-primary-700 transition-all bg-white shadow-sm font-medium"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          )}
          {messages.map((msg, idx) => (
            <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[85%] rounded-2xl p-3.5 text-[13px] shadow-sm leading-relaxed ${
                msg.role === 'user' 
                  ? 'bg-gradient-to-br from-primary-500 to-primary-600 text-white rounded-br-sm' 
                  : 'bg-white text-slate-700 border border-slate-100 rounded-bl-sm'
              }`}>
                <div className="whitespace-pre-wrap font-medium">{msg.content}</div>
                {msg.sources && msg.sources.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-black/10 text-[10px] text-inherit opacity-80 font-mono">
                    <span className="font-bold uppercase tracking-wider">Sources:</span> {msg.sources.join(', ')}
                  </div>
                )}
              </div>
            </div>
          ))}
          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-white border border-slate-100 shadow-sm rounded-2xl rounded-bl-sm p-4 animate-pulse flex gap-1 items-center h-10">
                <div className="w-1.5 h-1.5 bg-primary-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                <div className="w-1.5 h-1.5 bg-primary-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                <div className="w-1.5 h-1.5 bg-primary-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
              </div>
            </div>
          )}
        </div>

        {/* Input Area */}
        <div className="p-3 bg-white border-t border-black/5">
          <form onSubmit={handleSubmit} className="flex gap-2 relative">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Message AI..."
              className="flex-1 h-11 pl-4 pr-12 rounded-full border border-slate-200 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-300 text-sm bg-slate-50 hover:bg-white transition-colors"
              disabled={isLoading}
            />
            <button 
              type="submit" 
              disabled={isLoading || !input.trim()} 
              className="absolute right-1.5 top-1.5 bottom-1.5 w-8 flex items-center justify-center rounded-full bg-primary-600 text-white disabled:bg-slate-200 disabled:text-slate-400 transition-colors hover:bg-primary-700"
              aria-label="Send"
            >
              <svg xmlns="http://www.w3.org/-2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 -mr-0.5">
                <path d="M3.105 2.288a.75.75 0 0 0-.826.95l1.414 4.926A1.5 1.5 0 0 0 5.135 9.25h6.115a.75.75 0 0 1 0 1.5H5.135a1.5 1.5 0 0 0-1.442 1.086l-1.414 4.926a.75.75 0 0 0 .826.95 28.897 28.897 0 0 0 15.293-7.155.75.75 0 0 0 0-1.114A28.896 28.896 0 0 0 3.105 2.288Z" />
              </svg>
            </button>
          </form>
        </div>
        
        {/* Resize handle overlay (visual only, relies on CSS resize on parent) */}
        <div className="absolute bottom-1 right-1 w-3 h-3 cursor-se-resize opacity-20 pointer-events-none">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2h-4"/><path d="M21 9V5a2 2 0 0 0-2-2h-4"/><path d="M9 21H5a2 2 0 0 1-2-2v-4"/><path d="M3 9V5a2 2 0 0 1 2-2h4"/></svg>
        </div>
      </div>
    </div>
  );
};
