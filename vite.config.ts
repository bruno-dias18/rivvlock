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
    target: 'esnext',
    minify: 'esbuild',
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          // Core React
          if (id.includes('node_modules/react/') || id.includes('node_modules/react-dom/')) {
            return 'react-vendor';
          }
          if (id.includes('node_modules/react-router')) {
            return 'react-router';
          }

          // UI Framework - Split Radix UI separately
          if (id.includes('@radix-ui')) {
            return 'radix-ui';
          }

          // Core services - Keep separate for better caching
          if (id.includes('@supabase/supabase-js')) {
            return 'supabase';
          }
          if (id.includes('@tanstack/react-query') || id.includes('@tanstack/react-virtual')) {
            return 'tanstack';
          }
          if (id.includes('@stripe/stripe-js') || id.includes('@stripe/react-stripe-js')) {
            return 'stripe';
          }

          // i18n
          if (id.includes('i18next') || id.includes('react-i18next')) {
            return 'i18n';
          }

          // Forms
          if (id.includes('react-hook-form') || id.includes('zod') || id.includes('@hookform/resolvers')) {
            return 'forms';
          }

          // Utilities
          if (id.includes('date-fns')) {
            return 'date-fns';
          }
          if (id.includes('framer-motion')) {
            return 'framer';
          }
          if (id.includes('lucide-react')) {
            return 'icons';
          }

          // Dashboard Layout (shared across all pages)
          if (id.includes('/components/layouts/DashboardLayoutWithSidebar') ||
              id.includes('/components/AppSidebar') ||
              id.includes('/components/UserMenu') ||
              id.includes('/components/BottomTabBar')) {
            return 'layout';
          }

          // Heavy lazy-loaded libraries (will be loaded only when needed via dynamic imports)
          if (id.includes('node_modules/jspdf')) {
            return 'jspdf';
          }
          if (id.includes('node_modules/jszip')) {
            return 'jszip';
          }
          if (id.includes('node_modules/html2canvas')) {
            return 'html2canvas';
          }
          if (id.includes('node_modules/recharts')) {
            return 'recharts';
          }

          // NO CATCH-ALL VENDOR CHUNK - Let Vite optimize the rest automatically
          // This prevents creating a huge vendor.js bundle
        },
      },
    },
    cssCodeSplit: true,
    cssMinify: true,
    assetsInlineLimit: 4096,
    chunkSizeWarningLimit: 500,
    reportCompressedSize: false,
  },
  optimizeDeps: {
    include: [
      'react', 
      'react-dom', 
      'react-router-dom',
      '@tanstack/react-query',
      '@supabase/supabase-js',
    ],
    exclude: [
      // Heavy libraries that should be lazy loaded
      'jspdf',
      'jszip',
      'recharts',
      'papaparse',
      'html2canvas',
    ],
  },
}));