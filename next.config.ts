import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Turbopack config (Next.js 16+ default)
  turbopack: {},

  // Allows browser-fetch of ONNX model shards from HuggingFace CDN
  // and enables SharedArrayBuffer / WebGPU in all browsers
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'Cross-Origin-Embedder-Policy', value: 'credentialless' },
          { key: 'Cross-Origin-Opener-Policy',   value: 'same-origin'  },
        ],
      },
    ];
  },
};

export default nextConfig;
