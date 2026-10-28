/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// GitHub Pages serves the site under the repository name.
export default defineConfig({
  base: '/JapaneseWordBook/',
  plugins: [react()],
  test: { environment: 'node', include: ['src/**/*.test.ts'] },
});
