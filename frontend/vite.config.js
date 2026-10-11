import { readFileSync } from 'node:fs';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ command }) => ({
  plugins: [react()],
  server: {
    host: 'localhost',
    port: 5173,
    strictPort: true,
    https: command === 'serve' ? {
      key: readFileSync(new URL('../certs/localhost.key', import.meta.url)),
      cert: readFileSync(new URL('../certs/localhost.crt', import.meta.url))
    } : undefined
  }
}));