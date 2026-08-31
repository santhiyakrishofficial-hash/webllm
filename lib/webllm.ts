/**
 * webllm.ts
 * ─────────
 * Text-only WebLLM engine using Qwen3-1.7B via WebGPU.
 * Vision (image+text) is handled separately by lib/visionEngine.ts.
 */

import {
  CreateMLCEngine,
  MLCEngineInterface,
  InitProgressReport,
  ChatCompletionMessageParam,
} from '@mlc-ai/web-llm';

// ─── Model ────────────────────────────────────────────────────────────────────
// Qwen3-1.7B — ~800 MB download, ~2 GB VRAM, latest Qwen generation
export const TEXT_MODEL_ID = 'Qwen3-1.7B-q4f16_1-MLC';

// ─── Singleton ────────────────────────────────────────────────────────────────
let engine: MLCEngineInterface | null = null;

/**
 * Initialise the Qwen3-1.7B text engine once.
 * Subsequent calls return the cached engine.
 */
export async function initWebLLM(
  onProgress?: (progress: InitProgressReport) => void
): Promise<MLCEngineInterface> {
  if (engine) return engine;

  engine = await CreateMLCEngine(TEXT_MODEL_ID, {
    initProgressCallback: onProgress,
  });

  return engine;
}

/**
 * Generate a text response from the Qwen3-1.7B engine.
 */
export async function generateTutorResponse(
  messages: ChatCompletionMessageParam[],
  systemPrompt: string
): Promise<string | null> {
  if (!engine) {
    throw new Error('Text engine not initialised. Call initWebLLM() first.');
  }

  const allMessages: ChatCompletionMessageParam[] = [
    { role: 'system', content: systemPrompt },
    ...messages,
  ];

  const reply = await engine.chat.completions.create({
    messages: allMessages,
    temperature: 0.7,
    max_tokens: 512,
  });

  return reply.choices[0].message.content;
}

export function isTextEngineReady(): boolean {
  return engine !== null;
}
