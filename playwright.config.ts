import { defineConfig, devices } from '@playwright/test';

// Runs against the production build, under the same /JapaneseWordBook/ path as GitHub Pages.
// One browser at a time locally, so the PC stays responsive.
export default defineConfig({
  testDir: 'tests/e2e',
  workers: process.env.CI ? 2 : 1,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: { baseURL: 'http://127.0.0.1:4180/JapaneseWordBook/' },
  webServer: {
    command: 'npx vite preview --host 127.0.0.1 --port 4180 --strictPort',
    url: 'http://127.0.0.1:4180/JapaneseWordBook/',
    reuseExistingServer: !process.env.CI,
  },
  projects: [
    { name: 'desktop-chrome', use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 800 } } },
    { name: 'iphone-webkit', use: { ...devices['iPhone 15'] } },
  ],
});
