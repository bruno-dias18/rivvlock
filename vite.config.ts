import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  define: {
    'process.env': {}
  },
  build: {
    // Optimize build output
    target: 'esnext',
    minify: 'esbuild',
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          'ui-vendor': [
            '@radix-ui/react-dialog',
            '@radix-ui/react-label',
            '@radix-ui/react-select',
            '@radix-ui/react-popover',
            '@radix-ui/react-tabs',
            '@radix-ui/react-tooltip',
            '@radix-ui/react-dropdown-menu',
            '@radix-ui/react-slider',
            '@radix-ui/react-switch',
            '@radix-ui/react-checkbox',
            '@radix-ui/react-radio-group',
            '@radix-ui/react-alert-dialog',
          ],
          'stripe': ['@stripe/stripe-js', '@stripe/react-stripe-js'],
          'supabase': ['@supabase/supabase-js'],
          'pdf': ['jspdf', 'html2canvas'],
          'charts': ['recharts'],
          'i18n': ['i18next', 'react-i18next', 'i18next-browser-languagedetector'],
          'tanstack': ['@tanstack/react-query', '@tanstack/react-virtual'],
        },
      },
    },
    cssCodeSplit: true,
    cssMinify: true,
    assetsInlineLimit: 4096, // Inline assets < 4KB
    chunkSizeWarningLimit: 1000,
  },
  optimizeDeps: {
    include: ['react', 'react-dom', 'react-router-dom'],
    exclude: [],
  },
}));