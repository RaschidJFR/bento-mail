'use client';
import { useState, useRef, useEffect, KeyboardEvent } from 'react';
import { X, Send, MessageCircle, Loader2 } from 'lucide-react';
import { Button } from './ui/button';
import type { IArticle } from '@lib/models';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

interface ArticleChatModalProps {
  isOpen: boolean;
  onClose: () => void;
  article: IArticle;
}

const mockResponses = [
  "That's a great question! Based on the article, the key takeaway is that technological advances are reshaping how we approach this topic.",
  "I'd be happy to help clarify that. The article discusses several important points related to your question.",
  'Good observation! The author makes a compelling argument about this, suggesting that we need to consider multiple perspectives.',
  'From what I understand from the article, this is a complex issue with various factors at play.',
  "That's an interesting angle. The article touches on this by highlighting the relationship between innovation and practical application.",
];

// Detect if device is mobile/touch
const isMobileDevice = () => {
  return (
    /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
    'ontouchstart' in window ||
    navigator.maxTouchPoints > 0
  );
};

export const ArticleChatModal = ({ isOpen, onClose, article }: ArticleChatModalProps) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Detect mobile on mount
  useEffect(() => {
    setIsMobile(isMobileDevice());
  }, []);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 150)}px`;
    }
  }, [input]);

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Focus textarea when modal opens (only on desktop to avoid iOS zoom)
  useEffect(() => {
    if (isOpen && textareaRef.current && !isMobile) {
      setTimeout(() => textareaRef.current?.focus(), 100);
    }
  }, [isOpen, isMobile]);

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input.trim(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    // Mock AI response with delay
    setTimeout(() => {
      const aiMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: mockResponses[Math.floor(Math.random() * mockResponses.length)],
      };
      setMessages((prev) => [...prev, aiMessage]);
      setIsLoading(false);
    }, 1000 + Math.random() * 1000);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (isMobile) {
      // Mobile: Ctrl/Cmd+Enter sends, plain Enter adds new line
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        handleSend();
      }
    } else {
      // Desktop: Enter sends, Shift+Enter adds new line
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
      // Shift+Enter just adds a new line (default behavior)
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-0 sm:p-6">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative w-full h-full sm:max-w-2xl sm:h-[80vh] sm:max-h-[600px] bg-background border-0 sm:border sm:border-border sm:rounded-xl shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border bg-surface-elevated">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-brand-primary/20 flex items-center justify-center">
              <MessageCircle className="w-4 h-4 text-brand-primary" />
            </div>
            <div className="flex flex-col">
              <h3 className="font-semibold text-foreground text-sm sm:text-base">Ask about this article</h3>
              <p className="text-xs text-muted-foreground truncate max-w-[200px] sm:max-w-[300px]">{article.header}</p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="hover:bg-destructive/10 hover:text-destructive"
          >
            <X className="w-5 h-5" />
          </Button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground">
              <MessageCircle className="w-12 h-12 mb-3 opacity-30" />
              <p className="text-sm">Ask any question about this article</p>
              <p className="text-xs mt-1 opacity-70">
                {isMobile ? 'Tap Send to submit your message' : 'Press Enter to send, Shift+Enter for new line'}
              </p>
            </div>
          )}

          {messages.map((message) => (
            <div key={message.id} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`max-w-[85%] sm:max-w-[75%] px-4 py-3 rounded-2xl text-sm leading-relaxed ${
                  message.role === 'user'
                    ? 'bg-brand-primary text-white rounded-br-md'
                    : 'bg-surface-elevated border border-border text-foreground rounded-bl-md'
                }`}
              >
                {message.content}
              </div>
            </div>
          ))}

          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-surface-elevated border border-border px-4 py-3 rounded-2xl rounded-bl-md">
                <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="p-4 border-t border-border bg-surface-elevated">
          <div className="flex items-end gap-2">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type your question..."
              rows={1}
              className="flex-1 resize-none bg-background border border-border rounded-xl px-4 py-3 text-base sm:text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-brand-primary/50 focus:border-brand-primary transition-all"
              style={{ maxHeight: '150px', fontSize: '16px' }}
            />
            <Button
              onClick={handleSend}
              disabled={!input.trim() || isLoading}
              className="bg-brand-primary hover:bg-brand-primary/90 text-white h-[46px] px-4 rounded-xl shrink-0"
            >
              <Send className="w-4 h-4" />
              <span className="ml-2 hidden sm:inline">Send</span>
            </Button>
          </div>
          <p className="text-xs text-muted-foreground mt-2 text-center sm:text-left">
            {isMobile ? (
              'Tap Send button to submit'
            ) : (
              <>
                Press <kbd className="px-1.5 py-0.5 bg-muted rounded text-xs">Enter</kbd> to send,{' '}
                <kbd className="px-1.5 py-0.5 bg-muted rounded text-xs">Shift</kbd>+
                <kbd className="px-1.5 py-0.5 bg-muted rounded text-xs">Enter</kbd> for new line
              </>
            )}
          </p>
        </div>
      </div>
    </div>
  );
};
