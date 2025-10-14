import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react-swc';
import path from 'path';

/**
 * Integration tests configuration
 * 
 * These tests interact with real Supabase services (edge functions, database)
 * but use the anon key for safety.
 * 
 * Run with: npm run test:integration
 */
export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.integration.ts'],
    include: ['**/*.integration.test.{ts,tsx}'],
    testTimeout: 10000, // Longer timeout for API calls
    hookTimeout: 10000,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
