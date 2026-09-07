import { X, Send, Zap, Sparkles, BookOpen, TrendingUp, Loader2 } from 'lucide-react';
import { Button } from '../ui/button';
import { usePulseStore } from '../../stores/pulseStore';
import { useState, useRef, useEffect } from 'react';
import { AIClient } from '../../ai/AIClient';

export const PulseAssistant = () => {
  const { messages, isOpen, togglePulse, addMessage } = usePulseStore();
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;
    
    const userMessage = input;
    addMessage(userMessage, 'user');
    setInput('');
    setIsLoading(true);
    
    try {
      // Prepare conversation history, including the message just sent (the
      // `messages` store snapshot above was captured before addMessage
      // updated it, so it wouldn't otherwise include this turn).
      const conversationHistory = [
        ...messages.map(msg => ({
          role: msg.type === 'user' ? 'user' : 'assistant',
          content: msg.content
        })),
        { role: 'user', content: userMessage }
      ];

      const data = await AIClient.pulseChat({
        message: userMessage,
        conversationHistory
      });

      addMessage(data.reply || 'No response received.', 'pulse');
    } catch (error: any) {
      console.error('Pulse chat error:', error);
      addMessage(
        "Sorry, I'm having trouble connecting right now. Please try again in a moment! 🎵",
        'pulse'
      );
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed bottom-6 right-6 w-96 h-[600px] glass-panel rounded-xl shadow-2xl shadow-neon-purple/20 flex flex-col animate-slide-in z-50">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-studio-border">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-neon-purple to-neon-cyan flex items-center justify-center animate-pulse-glow">
            <Zap className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="font-bold">Pulse</h3>
            <p className="text-xs text-muted-foreground">Your AI Assistant</p>
          </div>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={togglePulse}
          className="hover:bg-studio-surface"
        >
          <X className="w-4 h-4" />
        </Button>
      </div>

      {/* Quick Actions */}
      <div className="p-4 border-b border-studio-border">
        <div className="grid grid-cols-3 gap-2">
          <button className="flex flex-col items-center gap-1 p-3 rounded-lg bg-studio-panel hover:bg-neon-purple/10 border border-studio-border hover:border-neon-purple transition-all">
            <Sparkles className="w-5 h-5 text-neon-purple" />
            <span className="text-xs">Tips</span>
          </button>
          <button className="flex flex-col items-center gap-1 p-3 rounded-lg bg-studio-panel hover:bg-neon-cyan/10 border border-studio-border hover:border-neon-cyan transition-all">
            <BookOpen className="w-5 h-5 text-neon-cyan" />
            <span className="text-xs">Learn</span>
          </button>
          <button className="flex flex-col items-center gap-1 p-3 rounded-lg bg-studio-panel hover:bg-neon-pink/10 border border-studio-border hover:border-neon-pink transition-all">
            <TrendingUp className="w-5 h-5 text-neon-pink" />
            <span className="text-xs">Trends</span>
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`
                max-w-[80%] rounded-lg p-3
                ${message.type === 'user'
                  ? 'bg-neon-purple text-white'
                  : 'bg-studio-panel border border-studio-border'
                }
              `}
            >
              <p className="text-sm">{message.content}</p>
              <span className="text-xs opacity-60 mt-1 block">
                {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-studio-panel border border-studio-border rounded-lg p-3">
              <div className="flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin text-neon-purple" />
                <span className="text-sm text-muted-foreground">Pulse is thinking...</span>
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-4 border-t border-studio-border">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder="Ask Pulse anything..."
            className="flex-1 bg-studio-panel border border-studio-border rounded-lg px-4 py-2 focus:outline-none focus:border-neon-purple text-sm"
          />
          <Button
            onClick={handleSend}
            size="icon"
            disabled={isLoading || !input.trim()}
            className="bg-gradient-to-r from-neon-purple to-neon-cyan hover:shadow-lg hover:shadow-neon-purple/50 disabled:opacity-50"
          >
            {isLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </Button>
        </div>
      </div>
    </div>
  );
};
