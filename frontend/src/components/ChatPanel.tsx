import React, { useState, useRef, useEffect } from 'react';
import { Button } from './Button';
import { Card } from './Card';
import { api, getErrorMessage } from '@/services/api';
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

export const ChatPanel: React.FC<ChatPanelProps> = ({ analysisId }) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
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
      const response = await api.post<ChatResponse>(`/analysis/${analysisId}/chat`, {
        question: currentInput,
      } as ChatPayload);

      const data = response.data;
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: data.answer, sources: data.sources },
      ]);
    } catch (error) {
      pushToast({
        title: 'Chat failed',
        description: getErrorMessage(error),
        tone: 'error',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleQuickQuestion = (question: string) => {
    setInput(question);
  };

  return (
    <Card title="Chat with Repository" description="Ask questions about the code, architecture, or logic.">
      <div className="flex flex-col h-[500px]">
        <div ref={scrollRef} className="flex-1 overflow-y-auto space-y-4 p-2 mb-4 scrollbar-thin">
          {messages.length === 0 && (
            <div className="text-center py-6 text-slate-400">
              <p className="text-sm font-medium mb-4">Quick Questions:</p>
              <div className="flex flex-wrap justify-center gap-2">
                {SAMPLE_QUESTIONS.map((q, i) => (
                  <button
                    key={i}
                    onClick={() => handleQuickQuestion(q)}
                    className="text-[11px] px-3 py-1.5 rounded-full border border-slate-200 hover:border-primary-500 hover:text-primary-600 transition-colors bg-white shadow-sm"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          )}
          {messages.map((msg, idx) => (
            <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[85%] rounded-panel p-3 text-sm ${
                msg.role === 'user' 
                  ? 'bg-primary-600 text-white' 
                  : 'bg-slate-100 text-slate-800 border border-slate-200'
              }`}>
                <div className="whitespace-pre-wrap">{msg.content}</div>
                {msg.sources && msg.sources.length > 0 && (
                  <div className="mt-2 pt-2 border-t border-slate-200/50 text-[10px] text-slate-500">
                    Sources: {msg.sources.join(', ')}
                  </div>
                )}
              </div>
            </div>
          ))}
          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-slate-100 rounded-panel p-3 animate-pulse">
                <div className="h-2 w-12 bg-slate-300 rounded"></div>
              </div>
            </div>
          )}
        </div>

        <form onSubmit={handleSubmit} className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask something..."
            className="flex-1 h-10 px-3 rounded-panel border border-slate-200 focus:outline-none focus:ring-2 focus:ring-primary-500/20 text-sm"
            disabled={isLoading}
          />
          <Button type="submit" disabled={isLoading} size="sm">
            Send
          </Button>
        </form>
      </div>
    </Card>
  );
};
