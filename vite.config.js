import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const apiTarget = process.env.NERAVU_API_TARGET || 'http://127.0.0.1:8000';

export default defineConfig({
  plugins: [react()],
  server: {
    warmup: {
      clientFiles: [
        './src/main.jsx',
        './src/App.jsx',
        './src/platform/components.jsx',
        './src/platform/PlatformContext.jsx',
        './src/platform/i18n.js'
      ]
    },
    proxy: {
      '/api': {
        target: apiTarget,
        changeOrigin: true
      }
    }
  }
});
