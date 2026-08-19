'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Send } from 'lucide-react';
import { Message, MessageType } from './Message';
import { initWebLLM, generateTutorResponse } from '@/lib/webllm';
import { getSystemPrompt } from '@/lib/prompts';
import { ChatCompletionMessageParam } from '@mlc-ai/web-llm';

interface ChatBoxProps {
  subjectId: string;
}

export function ChatBox({ subjectId }: ChatBoxProps) {
  const [messages, setMessages] = useState<MessageType[]>([]);
  const [input, setInput] = useState('');
  const [isInitializing, setIsInitializing] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [initProgress, setInitProgress] = useState('');
  const [engineReady, setEngineReady] = useState(false);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Load history from local storage when subject changes
  useEffect(() => {
    const saved = localStorage.getItem(`chat_history_${subjectId}`);
    if (saved) {
      try {
        setMessages(JSON.parse(saved));
      } catch (e) {
        setMessages([]);
      }
    } else {
      setMessages([
        { 
          id: 'welcome', 
          role: 'assistant', 
          content: `Hi! I'm your AI Tutor. Let's learn about this subject together! Ask me a question.` 
        }
      ]);
    }
  }, [subjectId]);

  // Save history to local storage
  useEffect(() => {
    if (messages.length > 0) {
      localStorage.setItem(`chat_history_${subjectId}`, JSON.stringify(messages));
    }
  }, [messages, subjectId]);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleInit = async () => {
    if (engineReady || isInitializing) return;
    
    setIsInitializing(true);
    try {
      await initWebLLM((progress) => {
        setInitProgress(progress.text);
      });
      setEngineReady(true);
      setMessages(prev => [...prev, {
        id: Date.now().toString(),
        role: 'system',
        content: 'AI Engine loaded successfully! Ready to chat.'
      }]);
    } catch (error) {
      console.error(error);
      setMessages(prev => [...prev, {
        id: Date.now().toString(),
        role: 'system',
        content: 'Failed to load AI engine. Check browser support for WebGPU.'
      }]);
    } finally {
      setIsInitializing(false);
    }
  };

  const handleSend = async () => {
    if (!input.trim() || isGenerating) return;
    
    if (!engineReady) {
      await handleInit();
      // Still return, force user to click send again or auto-send
      return;
    }

    const userMessage: MessageType = {
      id: Date.now().toString(),
      role: 'user',
      content: input.trim()
    };
    
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsGenerating(true);

    try {
      // Prepare history for WebLLM (excluding system messages)
      const chatHistory: ChatCompletionMessageParam[] = messages
        .filter(m => m.role !== 'system')
        .map(m => ({
          role: m.role as 'user' | 'assistant',
          content: m.content
        }));
        
      chatHistory.push({ role: 'user', content: userMessage.content });
      
      const systemPrompt = getSystemPrompt(subjectId);
      
      const reply = await generateTutorResponse(chatHistory, systemPrompt);
      
      if (reply) {
        setMessages(prev => [...prev, {
          id: Date.now().toString(),
          role: 'assistant',
          content: reply
        }]);
      }
    } catch (error: any) {
      console.error(error);
      setMessages(prev => [...prev, {
        id: Date.now().toString(),
        role: 'system',
        content: `Error generating response: ${error.message || String(error)}. Please try again.`
      }]);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="chat-box">
      {!engineReady && !isInitializing && (
        <div className="p-4 bg-blue-50 text-blue-800 text-center text-sm border-b border-blue-200">
          The AI runs locally in your browser. First message will download the small AI model (approx 1-2GB).
          <button onClick={handleInit} className="ml-2 font-bold underline">Load Now</button>
        </div>
      )}
      
      {isInitializing && (
        <div className="p-4 bg-yellow-50 text-yellow-800 text-center text-sm border-b border-yellow-200">
          Loading AI Model... {initProgress}
        </div>
      )}

      <div className="messages-list">
        {messages.map(msg => (
          <Message key={msg.id} message={msg} />
        ))}
        {isGenerating && (
          <div className="message message-ai">
            <div className="loading-indicator">
              <div className="dot"></div>
              <div className="dot"></div>
              <div className="dot"></div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>
      
      <div className="input-area">
        <input
          type="text"
          className="chat-input"
          placeholder={engineReady ? "Ask me anything..." : "Type a message to start AI download..."}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={isGenerating || isInitializing}
        />
        <button 
          className="send-btn" 
          onClick={handleSend}
          disabled={!input.trim() || isGenerating || isInitializing}
          aria-label="Send message"
        >
          <Send size={20} />
        </button>
      </div>
    </div>
  );
}
