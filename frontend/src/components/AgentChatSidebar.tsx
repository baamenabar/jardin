import React, { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, X, RefreshCw } from 'lucide-react';
import { ChatMessage } from '../types/garden';
import { api } from '../services/api';

interface AgentChatSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  onRefreshData: () => void;
}

export const AgentChatSidebar: React.FC<AgentChatSidebarProps> = ({
  isOpen,
  onClose,
  onRefreshData,
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: 'assistant',
      content:
        'Hello! I am Hermes, your landscape architect and garden agent. I can help analyze sunlight, project bloom cycles, create structures (like houses or sheds), or recommend cultivars. What would you like to plan today?',
    },
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async (textToSend?: string) => {
    const query = (textToSend || input).trim();
    if (!query || isLoading) return;

    const userMsg: ChatMessage = { role: 'user', content: query };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput('');
    setIsLoading(true);

    try {
      const response = await api.sendChat(newMessages);
      setMessages([...newMessages, { role: 'assistant', content: response.message.content }]);
      // Refresh canvas data in case Hermes executed tools (placed plants, created shed/fences, etc.)
      onRefreshData();
    } catch (err: any) {
      setMessages([
        ...newMessages,
        {
          role: 'assistant',
          content: `⚠️ Error contacting agent: ${err.message || 'Please check backend logs.'}`,
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const quickPrompts = [
    'Analyze sunlight hours for all beds',
    'What blooms in July?',
    'Recommend plants for partial shade',
    'Add a 2.5m shed in back garden',
  ];

  if (!isOpen) return null;

  return (
    <div className="w-80 md:w-96 bg-garden-surface border-l border-garden-border flex flex-col h-full select-none z-30 shadow-xl backdrop-blur text-xs text-garden-text">
      {/* Header */}
      <div className="p-3.5 border-b border-garden-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-[#487eb3] to-[#595ca6] flex items-center justify-center text-white shadow-xs">
            <Bot className="w-4 h-4" />
          </div>
          <div>
            <div className="font-bold text-sm text-garden-text flex items-center gap-1.5">
              <span>Hermes Copilot</span>
              <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block animate-pulse" />
            </div>
            <div className="text-[10px] text-garden-textMuted font-mono">Garden Assistant</div>
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded-lg text-garden-textLight hover:text-garden-text hover:bg-garden-subtle transition"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Message List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3.5 text-xs">
        {messages.map((msg, idx) => (
          <div
            key={idx}
            className={`flex gap-2.5 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            {msg.role === 'assistant' && (
              <div className="w-6 h-6 rounded-full bg-sky-100 border border-sky-300 flex items-center justify-center shrink-0 text-sky-800">
                <Bot className="w-3.5 h-3.5" />
              </div>
            )}
            <div
              className={`p-3 rounded-xl max-w-[85%] whitespace-pre-wrap leading-relaxed ${
                msg.role === 'user'
                  ? 'bg-garden-accent text-white rounded-br-none shadow-xs'
                  : 'bg-white border border-garden-border text-garden-text rounded-bl-none shadow-2xs'
              }`}
            >
              {msg.content}
            </div>
            {msg.role === 'user' && (
              <div className="w-6 h-6 rounded-full bg-emerald-800 border border-emerald-900 flex items-center justify-center shrink-0 text-white">
                <User className="w-3.5 h-3.5" />
              </div>
            )}
          </div>
        ))}
        {isLoading && (
          <div className="flex gap-2.5 items-center text-garden-textMuted text-xs italic">
            <RefreshCw className="w-3.5 h-3.5 animate-spin text-garden-sky" />
            <span>Hermes is thinking and analyzing garden parameters...</span>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Suggested Quick Prompts */}
      <div className="px-3 py-2 border-t border-garden-border bg-garden-subtle/50 flex flex-wrap gap-1.5">
        {quickPrompts.map((prompt) => (
          <button
            key={prompt}
            onClick={() => handleSend(prompt)}
            disabled={isLoading}
            className="text-[11px] bg-white hover:bg-garden-subtle text-garden-text border border-garden-border px-2 py-1 rounded-full transition shadow-2xs truncate max-w-full"
          >
            {prompt}
          </button>
        ))}
      </div>

      {/* Chat Input Bar */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSend();
        }}
        className="p-3 border-t border-garden-border flex gap-2 bg-white"
      >
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask Hermes to place plants, add a shed..."
          disabled={isLoading}
          className="flex-1 bg-garden-subtle/60 border border-garden-border rounded-xl px-3 py-2 text-xs text-garden-text placeholder:text-garden-textLight focus:outline-none focus:bg-white focus:border-garden-sky transition"
        />
        <button
          type="submit"
          disabled={isLoading || !input.trim()}
          className="p-2 bg-garden-sky hover:bg-[#3d6e9f] disabled:opacity-50 text-white rounded-xl transition shadow-2xs"
        >
          <Send className="w-4 h-4" />
        </button>
      </form>
    </div>
  );
};
