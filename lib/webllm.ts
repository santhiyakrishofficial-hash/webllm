import { CreateMLCEngine, MLCEngineInterface, InitProgressReport, ChatCompletionMessageParam } from '@mlc-ai/web-llm';

let engine: MLCEngineInterface | null = null;

// Use a small model supported by WebLLM suitable for browser
const MODEL_ID = 'Llama-3.2-1B-Instruct-q4f16_1-MLC'; 

export async function initWebLLM(
  onProgress?: (progress: InitProgressReport) => void
) {
  if (engine) return engine;

  engine = await CreateMLCEngine(
    MODEL_ID,
    { initProgressCallback: onProgress }
  );
  
  return engine;
}

export async function generateTutorResponse(
  messages: ChatCompletionMessageParam[],
  systemPrompt: string
) {
  if (!engine) {
    throw new Error('WebLLM engine not initialized. Call initWebLLM first.');
  }

  const allMessages: ChatCompletionMessageParam[] = [
    { role: 'system', content: systemPrompt },
    ...messages
  ];

  const reply = await engine.chat.completions.create({
    messages: allMessages,
    temperature: 0.7, 
    max_tokens: 256 
  });

  return reply.choices[0].message.content;
}
