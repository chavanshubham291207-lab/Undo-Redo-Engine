import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true
      },
      '/state': 'http://localhost:5000',
      '/push': 'http://localhost:5000',
      '/pop': 'http://localhost:5000',
      '/undo': 'http://localhost:5000',
      '/redo': 'http://localhost:5000',
      '/reset': 'http://localhost:5000',
      '/health': 'http://localhost:5000'
    }
  }
});
