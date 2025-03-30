import React from 'react';
import { MessageCircle, Bot } from 'lucide-react';
import { Message } from '../types/chat';

interface ChatMessageProps {
  message: Message;
}

export function ChatMessage({ message }: ChatMessageProps) {
  const isUser = message.role === 'user';

  return (
    <div className={`flex items-start gap-4 ${isUser ? 'flex-row-reverse' : ''}`}>
      <div className={`w-8 h-8 rounded-full flex items-center justify-center transform transition-transform hover:scale-110 ${
        isUser ? 'gradient-animate' : 'bg-gray-600'
      }`}>
        {isUser ? (
          <MessageCircle size={18} className="text-white animate-bounce" />
        ) : (
          <Bot size={18} className="text-white bot-icon-pulse" />
        )}
      </div>
      <div className={`flex-1 px-4 py-2 rounded-lg transform transition-all hover:scale-[1.02] ${
        isUser ? 'gradient-animate text-white' : 'glass-effect text-gray-100'
      }`}>
        <p className="text-sm">{message.content}</p>
        <span className="text-xs opacity-70 mt-1 block">
          {new Date(message.timestamp).toLocaleTimeString()}
        </span>
      </div>
    </div>
  );
}