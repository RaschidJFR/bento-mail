'use client';
import { useState, useRef, useEffect, KeyboardEvent } from 'react';
import { X, Send, MessageCircle, Loader2 } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { Button } from './ui/button';
import type { IArticle } from '@lib/models/types';
import { getMessage } from '@app/hooks/getMessage';

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

  // Prevent body scroll when modal is open and handle ESC key
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';

      const handleEscKey = (e: globalThis.KeyboardEvent) => {
        if (e.key === 'Escape' && !isMobile) {
          onClose();
        }
      };

      document.addEventListener('keydown', handleEscKey);
      return () => {
        document.body.style.overflow = '';
        document.removeEventListener('keydown', handleEscKey);
      };
    } else {
      document.body.style.overflow = '';
    }
  }, [isOpen, isMobile, onClose]);

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

    try {
      // Prepare messages for the API (convert to OpenAI format)
      const apiMessages = [...messages, userMessage].map((msg) => ({
        role: msg.role,
        content: msg.content,
      }));

      // Call the chat endpoint
      const responseContent = await getMessage(article._id, apiMessages);

      const aiMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: responseContent,
      };
      setMessages((prev) => [...prev, aiMessage]);
    } catch (error) {
      console.error('Failed to get chat response:', error);
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: 'Sorry, I encountered an error while processing your message. Please try again.',
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
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
            <div className="w-10 h-10 rounded-md overflow-hidden bg-brand-primary/20 flex items-center justify-center shrink-0">
              {article.coverImg ? (
                <img src={article.coverImg} alt="" className="w-full h-full object-cover" />
              ) : (
                <MessageCircle className="w-5 h-5 text-brand-primary" />
              )}
            </div>
            <div className="flex flex-col">
              <h3 className="font-semibold text-foreground text-sm sm:text-base">{article.header || ''}</h3>
              <p className="text-xs text-muted-foreground truncate max-w-[200px] sm:max-w-[300px]">
                {article.summaries?.oneliner || ''}
              </p>
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
                    ? 'bg-brand-accent text-white rounded-br-md'
                    : 'bg-surface-elevated border border-border text-foreground rounded-bl-md'
                }`}
              >
                {message.role === 'assistant' ? (
                  <ReactMarkdown
                    components={{
                      h1: ({ ...props }) => <h1 className="text-lg font-bold mt-4 mb-2 first:mt-0" {...props} />,
                      h2: ({ ...props }) => <h2 className="text-base font-semibold mt-3 mb-2 first:mt-0" {...props} />,
                      h3: ({ ...props }) => <h3 className="text-sm font-semibold mt-2 mb-1 first:mt-0" {...props} />,
                      p: ({ ...props }) => <p className="mb-2 last:mb-0" {...props} />,
                      ul: ({ ...props }) => <ul className="list-disc list-inside mb-2 space-y-1" {...props} />,
                      ol: ({ ...props }) => <ol className="list-decimal list-inside mb-2 space-y-1" {...props} />,
                      li: ({ ...props }) => <li className="ml-2" {...props} />,
                      a: ({ ...props }) => (
                        <a
                          className="text-brand-primary hover:underline"
                          target="_blank"
                          rel="noopener noreferrer"
                          {...props}
                        />
                      ),
                      code: ({ className, ...props }) => {
                        const isInline = !className;
                        return isInline ? (
                          <code className="bg-muted px-1.5 py-0.5 rounded text-xs font-mono" {...props} />
                        ) : (
                          <code
                            className="block bg-muted p-3 rounded-lg text-xs font-mono overflow-x-auto my-2"
                            {...props}
                          />
                        );
                      },
                      pre: ({ ...props }) => <pre className="bg-muted rounded-lg overflow-x-auto my-2" {...props} />,
                      blockquote: ({ ...props }) => (
                        <blockquote
                          className="border-l-2 border-brand-primary/50 pl-3 italic my-2 text-muted-foreground"
                          {...props}
                        />
                      ),
                      strong: ({ ...props }) => <strong className="font-semibold" {...props} />,
                      em: ({ ...props }) => <em className="italic" {...props} />,
                      hr: ({ ...props }) => <hr className="my-3 border-border" {...props} />,
                    }}
                  >
                    {message.content}
                  </ReactMarkdown>
                ) : (
                  message.content
                )}
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
              maxLength={500}
              placeholder="Type your question..."
              rows={1}
              className="flex-1 resize-none bg-background border border-border rounded-xl px-4 py-3 text-base sm:text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-brand-primary/50 focus:border-brand-primary transition-all"
              style={{ maxHeight: '150px', fontSize: '16px' }}
            />
            <Button
              onClick={handleSend}
              disabled={!input.trim() || isLoading}
              className="bg-brand-accent hover:bg-brand-accent/90 text-white h-[46px] px-4 rounded-xl shrink-0"
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
