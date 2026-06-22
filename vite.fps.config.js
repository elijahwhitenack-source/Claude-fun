import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

// Second build pass: the 3D first-person page (fps.html) as its own self-contained
// dist/fps.html. Run after the main build with emptyOutDir:false so it doesn't wipe
// dist/index.html (the 2D game). Three.js is inlined into the single file.
export default defineConfig({
  base: './',
  plugins: [viteSingleFile()],
  build: {
    outDir: 'dist',
    emptyOutDir: false,
    assetsInlineLimit: 100000000,
    cssCodeSplit: false,
    rollupOptions: {
      input: { fps: 'fps.html' },
      output: { inlineDynamicImports: true, manualChunks: undefined },
    },
  },
});
