import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import basicSsl from '@vitejs/plugin-basic-ssl';

// `npm run dev:lan` serves https on the LAN so phones can open the camera (needs a secure context).
export default defineConfig(({ command }) => ({
  plugins: [react(), ...(command === 'serve' && process.argv.includes('--host') ? [basicSsl()] : [])],
  worker: { format: 'es' },
  optimizeDeps: { exclude: ['@huggingface/transformers'] },
  build: { target: 'es2022', chunkSizeWarningLimit: 2000 },
}));
