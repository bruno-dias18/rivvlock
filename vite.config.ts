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
    sourcemap: false, // Disable sourcemaps in production for smaller bundles
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          // Core React libraries
          if (id.includes('node_modules/react') || id.includes('node_modules/react-dom')) {
            return 'react-core';
          }
          if (id.includes('node_modules/react-router')) {
            return 'react-router';
          }
          
          // UI Libraries - split by category
          if (id.includes('@radix-ui')) {
            return 'radix-ui';
          }
          if (id.includes('lucide-react')) {
            return 'icons';
          }
          if (id.includes('framer-motion')) {
            return 'animations';
          }
          
          // Charts & Data Visualization (lazy loaded on demand)
          if (id.includes('recharts')) {
            return 'charts';
          }
          
          // PDF & Documents (lazy loaded on demand)
          if (id.includes('jspdf') || id.includes('jszip') || id.includes('papaparse')) {
            return 'documents';
          }
          
          // Payment providers
          if (id.includes('@stripe')) {
            return 'stripe';
          }
          
          // Supabase & Auth
          if (id.includes('@supabase')) {
            return 'supabase';
          }
          
          // React Query
          if (id.includes('@tanstack/react-query')) {
            return 'react-query';
          }
          
          // i18n
          if (id.includes('i18next')) {
            return 'i18n';
          }
          
          // Form libraries
          if (id.includes('react-hook-form') || id.includes('zod') || id.includes('@hookform')) {
            return 'forms';
          }
          
          // Date utilities
          if (id.includes('date-fns')) {
            return 'date-utils';
          }
          
          // Other node_modules
          if (id.includes('node_modules')) {
            return 'vendor';
          }
        },
      },
    },
    cssCodeSplit: true,
    cssMinify: true,
    assetsInlineLimit: 4096,
    chunkSizeWarningLimit: 500, // More aggressive warning
    reportCompressedSize: false, // Faster builds
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
      'jspdf',
      'jszip',
      'recharts',
      'papaparse',
    ],
  },
}));