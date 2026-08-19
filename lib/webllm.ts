import * as webllm from '@mlc-ai/web-llm';

let engine: webllm.MLCEngineInterface | null = null;

// Use a small model supported by WebLLM suitable for browser
const MODEL_ID = 'Llama-3.2-1B-Instruct-q4f16_1-MLC'; 

export async function initWebLLM(
  onProgress?: (progress: webllm.InitProgressReport) => void
) {
  if (engine) return engine;

  engine = new webllm.MLCEngine();
  
  if (onProgress) {
    engine.setInitProgressCallback(onProgress);
  }

  await engine.reload(MODEL_ID);
  
  return engine;
}

export async function generateTutorResponse(
  messages: webllm.ChatCompletionMessageParam[],
  systemPrompt: string
) {
  if (!engine) {
    throw new Error('WebLLM engine not initialized. Call initWebLLM first.');
  }

  const allMessages: webllm.ChatCompletionMessageParam[] = [
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
