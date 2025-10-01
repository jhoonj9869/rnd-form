import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

export default defineConfig({
  server: {
    port: 5174,
    strictPort: true
  },
  root: 'src',
  build: {
    outDir: '../build',
    emptyOutDir: true,
    assetsInlineLimit: 100000000,
    rollupOptions: {
      output: {
        manualChunks: undefined
      }
    }
  },
  plugins: [viteSingleFile()]
});