import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
        historyApiFallback: true,
        proxy: {
          // Groq AI — forwards /api/ai/groq to Groq API (mirrors api/ai/groq.js serverless fn)
          '/api/ai/groq': {
            target: 'https://api.groq.com',
            changeOrigin: true,
            rewrite: (path) => path.replace(/^\/api\/ai\/groq/, '/openai/v1/chat/completions'),
            configure: (proxy) => {
              proxy.on('proxyReq', (proxyReq) => {
                proxyReq.setHeader('Authorization', `Bearer ${env.VITE_GROQ_API_KEY || ''}`);
              });
            },
          },
          // Proxy SerpAPI calls through Vite to avoid CORS — browser calls /api/serpapi/*,
          // Vite forwards them to https://serpapi.com/* server-side (no CORS restriction).
          '/api/serpapi': {
            target: 'https://serpapi.com',
            changeOrigin: true,
            rewrite: (path) => path.replace(/^\/api\/serpapi/, ''),
          },
          '/api/socialblade': {
            target: 'https://matrix.sbapis.com',
            changeOrigin: true,
            rewrite: (path) => path.replace(/^\/api\/socialblade/, '/b'),
            headers: {
              'CLIENTID': env.VITE_SB_CLIENT_ID || '',
              'token':    env.VITE_SB_TOKEN     || '',
            },
          },
          '/api/freepik': {
            target: 'https://api.freepik.com',
            changeOrigin: true,
            rewrite: (path) => path.replace(/^\/api\/freepik/, ''),
            configure: (proxy) => {
              proxy.on('proxyReq', (proxyReq) => {
                proxyReq.setHeader(
                  'x-freepik-api-key',
                  'FPSX7fa9b8de502bc5b65c3b9d6cd585c7a5'
                );
              });
            },
          },
        },
      },
      plugins: [react(), tailwindcss()],
      define: {
        'process.env.VITE_GEMINI_API_KEY': JSON.stringify(env.VITE_GEMINI_API_KEY)
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});
