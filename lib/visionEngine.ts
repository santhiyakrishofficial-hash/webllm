/**
 * visionEngine.ts
 * ───────────────
 * Multimodal image + text inference with SmolVLM-500M-Instruct.
 *
 * Key requirement: MUST use the UNIFIED processor(text, image) call.
 * Splitting into image_processor + tokenizer separately causes
 * "Number of tokens and features do not match: tokens 1, features 64"
 * because only the unified call can expand the single <image> placeholder
 * into the correct number of patch tokens that match the vision encoder output.
 *
 * The previous "StringValue" error came from incorrect tensor slicing
 * (generated_ids.slice(null, [promptLen, null])) in the decode step —
 * NOT from the unified processor call itself.
 */

import {
  AutoProcessor,
  AutoModelForImageTextToText,
  RawImage,
  env,
} from '@huggingface/transformers';

// ─── Model ────────────────────────────────────────────────────────────────────
export const VLM_MODEL_ID = 'HuggingFaceTB/SmolVLM-500M-Instruct';

env.allowLocalModels  = false;
env.allowRemoteModels = true;

// ─── Singletons ───────────────────────────────────────────────────────────────
let processor: any = null;
let model: any      = null;
let isLoading       = false;

export type VisionProgressCallback = (info: {
  status: string;
  file?: string;
  progress?: number;
  loaded?: number;
  total?: number;
}) => void;

// ─── Init ─────────────────────────────────────────────────────────────────────
export async function initVisionEngine(
  onProgress?: VisionProgressCallback
): Promise<void> {
  if (processor && model) return;

  if (isLoading) {
    await new Promise<void>((resolve) => {
      const id = setInterval(() => {
        if (!isLoading) { clearInterval(id); resolve(); }
      }, 300);
    });
    return;
  }

  isLoading = true;
  try {
    processor = await AutoProcessor.from_pretrained(VLM_MODEL_ID, {
      progress_callback: onProgress,
    });

    // Mixed dtypes: vision tower in fp16, LM decoder 4-bit → ~1.5 GB VRAM
    model = await AutoModelForImageTextToText.from_pretrained(VLM_MODEL_ID, {
      dtype: {
        embed_tokens:         'fp16',
        vision_encoder:       'fp16',
        decoder_model_merged: 'q4',
      },
      device: 'webgpu',
      progress_callback: onProgress,
    });
  } finally {
    isLoading = false;
  }
}

// ─── Inference ────────────────────────────────────────────────────────────────
export async function generateVisionResponse(
  imageDataUrl: string,
  textPrompt: string,
  _systemPrompt?: string
): Promise<string> {
  if (!processor || !model) {
    throw new Error('Vision engine not initialised. Call initVisionEngine() first.');
  }

  // 1. Decode the data-URL into a RawImage
  const image = await RawImage.fromURL(imageDataUrl);

  // 2. Build chat messages with the image placeholder
  const messages = [
    {
      role: 'user',
      content: [
        { type: 'image' },   // expands to N patch tokens during preprocessing
        { type: 'text', text: textPrompt || 'Describe this image.' },
      ],
    },
  ];

  // 3. Apply the chat template → formatted prompt string
  const text: string = processor.apply_chat_template(messages, {
    add_generation_prompt: true,
  });

  // 4. UNIFIED processor call — passes text AND image together so the processor
  //    can expand <image> into exactly as many tokens as the vision encoder
  //    produces (e.g. 64 patch tokens). do_image_splitting=false avoids
  //    sub-image tiling which would multiply memory usage.
  //    Pass image directly (not in array) as Idefics3Processor expects.
  const inputs = await processor(text, image, {
    do_image_splitting: false,
  });

  // 5. Generate new tokens
  const generated_ids = await model.generate({
    ...inputs,
    max_new_tokens: 256,
  });

  // 6. Decode only the NEWLY generated tokens.
  //    Use dims.at(-1) to get sequence-length from the last dimension,
  //    then slice the generated tensor correctly via the Transformers.js API.
  const promptLen: number = inputs.input_ids.dims.at(-1) as number;
  const decoded: string[] = processor.batch_decode(
    generated_ids.slice(null, [promptLen, null]),
    { skip_special_tokens: true }
  ) as string[];

  return (decoded[0] ?? '').trim();
}

export function isVisionEngineReady(): boolean {
  return processor !== null && model !== null;
}
