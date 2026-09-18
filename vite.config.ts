import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  base: './',
  plugins: [react()],
  test: { include: ['tests/**/*.test.ts'] },
  build: {
    rollupOptions: {
      output: {
        manualChunks: { three: ['three'], network: ['peerjs', 'qrcode'] },
      },
    },
  },
});
