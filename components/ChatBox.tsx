'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Send, ImagePlus, X, Cpu, Eye } from 'lucide-react';
import { Message, MessageType } from './Message';
import { initWebLLM, generateTutorResponse, TEXT_MODEL_ID } from '@/lib/webllm';
import {
  initVisionEngine,
  generateVisionResponse,
  VLM_MODEL_ID,
  VisionProgressCallback,
} from '@/lib/visionEngine';
import { getSystemPrompt } from '@/lib/prompts';
import { ChatCompletionMessageParam, InitProgressReport } from '@mlc-ai/web-llm';

interface ChatBoxProps {
  subjectId: string;
}

type EngineMode = 'text' | 'vision';

// ─── helpers ─────────────────────────────────────────────────────────────────
function fileToBase64(
  file: File
): Promise<{ base64: string; mimeType: string; dataUrl: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      const [header, base64] = dataUrl.split(',');
      const mimeType = header.replace('data:', '').replace(';base64', '');
      resolve({ base64, mimeType, dataUrl });
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// ─── Component ────────────────────────────────────────────────────────────────
export function ChatBox({ subjectId }: ChatBoxProps) {
  const [messages, setMessages] = useState<MessageType[]>([]);
  const [input, setInput] = useState('');
  const [isInitializing, setIsInitializing] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [initProgress, setInitProgress] = useState('');
  const [engineMode, setEngineMode] = useState<EngineMode | null>(null);

  // Pending image attached by user
  const [pendingImage, setPendingImage] = useState<{
    dataUrl: string;
  } | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Persist chat history ──────────────────────────────────────────────────
  useEffect(() => {
    const saved = localStorage.getItem(`chat_history_${subjectId}`);
    if (saved) {
      try {
        setMessages(JSON.parse(saved));
      } catch {
        setMessages([]);
      }
    } else {
      setMessages([
        {
          id: 'welcome',
          role: 'assistant',
          content:
            `Hi! I'm your AI Tutor 🤖\n\n` +
            `• **Text AI** (Qwen3-1.7B) — ~800 MB download, ~2 GB VRAM\n` +
            `• **Vision AI** (SmolVLM-500M) — ~1 GB download, ~1.5 GB VRAM\n\n` +
            `Pick an engine below to start!`,
        },
      ]);
    }
  }, [subjectId]);

  useEffect(() => {
    if (messages.length === 0) return;
    try {
      // Strip image data-URLs before persisting — they can be MBs each and
      // would immediately blow localStorage's ~5 MB quota.
      // Also keep only the last 50 messages to prevent unbounded growth.
      const MAX_STORED = 50;
      const toStore = messages
        .slice(-MAX_STORED)
        .map(({ imageDataUrl: _dropped, ...rest }) => rest); // omit images
      localStorage.setItem(
        `chat_history_${subjectId}`,
        JSON.stringify(toStore)
      );
    } catch (e) {
      // If quota is still exceeded (e.g. many long AI replies), clear and retry
      try {
        localStorage.removeItem(`chat_history_${subjectId}`);
      } catch { /* ignore */ }
    }
  }, [messages, subjectId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // ── Engine init ────────────────────────────────────────────────────────────
  const handleInit = useCallback(
    async (mode: EngineMode) => {
      if (isInitializing) return;
      setIsInitializing(true);
      setInitProgress(
        `Downloading ${mode === 'text' ? TEXT_MODEL_ID : VLM_MODEL_ID}…`
      );

      try {
        if (mode === 'text') {
          await initWebLLM((p: InitProgressReport) =>
            setInitProgress(p.text)
          );
        } else {
          const onProgress: VisionProgressCallback = (info) => {
            if (info.progress !== undefined && info.file) {
              const pct = Math.round(info.progress * 100);
              setInitProgress(`Loading ${info.file} — ${pct}%`);
            } else if (info.status) {
              setInitProgress(info.status);
            }
          };
          await initVisionEngine(onProgress);
        }

        setEngineMode(mode);
        setMessages((prev) => [
          ...prev,
          {
            id: Date.now().toString(),
            role: 'system',
            content:
              mode === 'text'
                ? `✅ Text AI ready (${TEXT_MODEL_ID})`
                : `✅ Vision AI ready (${VLM_MODEL_ID}) — attach an image with 📎!`,
          },
        ]);
      } catch (err: any) {
        setMessages((prev) => [
          ...prev,
          {
            id: Date.now().toString(),
            role: 'system',
            content: `❌ Failed to load ${mode} engine: ${err.message ?? String(err)}`,
          },
        ]);
      } finally {
        setIsInitializing(false);
        setInitProgress('');
      }
    },
    [isInitializing]
  );

  // ── Image picker ───────────────────────────────────────────────────────────
  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      alert('Please select an image file.');
      return;
    }
    const result = await fileToBase64(file);
    setPendingImage({ dataUrl: result.dataUrl });
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // ── Send ───────────────────────────────────────────────────────────────────
  const handleSend = async () => {
    const text = input.trim();
    if ((!text && !pendingImage) || isGenerating) return;

    // Auto-init if needed
    if (!engineMode) {
      const autoMode: EngineMode = pendingImage ? 'vision' : 'text';
      await handleInit(autoMode);
      return;
    }

    // Warn if image attached but vision not loaded
    if (pendingImage && engineMode !== 'vision') {
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now().toString(),
          role: 'system',
          content:
            '⚠️ Image attached but Vision AI is not loaded. Click **Load Vision AI** first.',
        },
      ]);
      return;
    }

    const userMessage: MessageType = {
      id: Date.now().toString(),
      role: 'user',
      content: text || '(Describe this image)',
      imageDataUrl: pendingImage?.dataUrl,
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    const capturedImage = pendingImage;
    setPendingImage(null);
    setIsGenerating(true);

    try {
      const systemPrompt = getSystemPrompt(subjectId);
      let reply: string | null = null;

      if (capturedImage && engineMode === 'vision') {
        // ── Vision path via SmolVLM (Transformers.js) ──
        reply = await generateVisionResponse(
          capturedImage.dataUrl,
          userMessage.content,
          systemPrompt
        );
      } else {
        // ── Text path via Qwen3 (WebLLM) ──
        const history: ChatCompletionMessageParam[] = messages
          .filter((m) => m.role !== 'system')
          .map((m) => ({
            role: m.role as 'user' | 'assistant',
            content: m.content,
          }));
        history.push({ role: 'user', content: userMessage.content });
        reply = await generateTutorResponse(history, systemPrompt);
      }

      if (reply) {
        setMessages((prev) => [
          ...prev,
          {
            id: Date.now().toString(),
            role: 'assistant',
            content: reply!,
          },
        ]);
      }
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now().toString(),
          role: 'system',
          content: `❌ Error: ${err.message ?? String(err)}`,
        },
      ]);
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

  const engineLoaded = engineMode !== null;

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="chat-box">

      {/* ── Engine selection banner ── */}
      {!engineLoaded && !isInitializing && (
        <div className="engine-banner">
          <span>Choose your AI engine:</span>
          <div className="engine-btns">
            <button
              className="engine-btn engine-btn-text"
              onClick={() => handleInit('text')}
              title={`${TEXT_MODEL_ID} · ~800 MB · ~2 GB VRAM`}
            >
              <Cpu size={15} />
              Load Text AI
              <small>(~800 MB)</small>
            </button>
            <button
              className="engine-btn engine-btn-vision"
              onClick={() => handleInit('vision')}
              title={`${VLM_MODEL_ID} · ~1 GB · ~1.5 GB VRAM`}
            >
              <Eye size={15} />
              Load Vision AI
              <small>(~1 GB)</small>
            </button>
          </div>
        </div>
      )}

      {/* ── Loading progress ── */}
      {isInitializing && (
        <div className="init-banner">
          <div className="init-spinner" />
          <span>{initProgress || 'Initialising…'}</span>
        </div>
      )}

      {/* ── Messages ── */}
      <div className="messages-list">
        {messages.map((msg) => (
          <Message key={msg.id} message={msg} />
        ))}
        {isGenerating && (
          <div className="message message-ai">
            <div className="loading-indicator">
              <div className="dot" />
              <div className="dot" />
              <div className="dot" />
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* ── Image preview strip ── */}
      {pendingImage && (
        <div className="image-preview-strip">
          <img
            src={pendingImage.dataUrl}
            alt="Pending"
            className="image-preview-thumb"
          />
          <span className="image-preview-label">Image ready to send</span>
          <button
            className="image-remove-btn"
            onClick={() => setPendingImage(null)}
            aria-label="Remove image"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* ── Input area ── */}
      <div className="input-area">
        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          style={{ display: 'none' }}
          onChange={handleImageSelect}
        />

        {/* Image attach button */}
        <button
          className={`attach-btn ${engineMode === 'vision' ? 'attach-btn-active' : ''}`}
          onClick={() => fileInputRef.current?.click()}
          disabled={isGenerating || isInitializing}
          title={
            engineMode !== 'vision'
              ? 'Load Vision AI first to attach images'
              : 'Attach image'
          }
          aria-label="Attach image"
        >
          <ImagePlus size={20} />
        </button>

        <input
          type="text"
          className="chat-input"
          placeholder={
            !engineLoaded
              ? 'Load an AI engine above to start…'
              : engineMode === 'vision'
              ? 'Ask about text or attach an image…'
              : 'Ask me anything…'
          }
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={isGenerating || isInitializing}
        />

        <button
          className="send-btn"
          onClick={handleSend}
          disabled={
            (!input.trim() && !pendingImage) || isGenerating || isInitializing
          }
          aria-label="Send message"
        >
          <Send size={20} />
        </button>
      </div>

      {/* ── Active engine status pill ── */}
      {engineLoaded && (
        <div className="engine-status">
          {engineMode === 'vision' ? <Eye size={12} /> : <Cpu size={12} />}
          {engineMode === 'vision' ? VLM_MODEL_ID : TEXT_MODEL_ID}
        </div>
      )}
    </div>
  );
}
