import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

// ASTRARI build — inline all JS/CSS into a single self-contained dist/index.html.
// public/ files (manifest.json, sw.js, icons) are copied to dist as separate
// files (service workers and the manifest cannot be inlined).
export default defineConfig({
  base: './',
  plugins: [viteSingleFile()],
  build: {
    outDir: 'dist',
    assetsInlineLimit: 100000000,
    cssCodeSplit: false,
    rollupOptions: {
      output: {
        inlineDynamicImports: true,
        manualChunks: undefined,
      },
    },
  },
});
