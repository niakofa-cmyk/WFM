import path from 'path';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';

const port = Number(process.env.PORT || 5173);
const basePath = process.env.BASE_PATH || '/';

export default defineConfig(({ mode }) => ({
  base: mode === 'combat-lab' ? './' : basePath,
  publicDir: mode === 'combat-lab' ? false : 'public',
  plugins: [
    react(),
    tailwindcss({ optimize: false }),
    mode === 'combat-lab' && {
      name: 'combat-lab-default-entry',
      enforce: 'post',
      generateBundle: {
        order: 'post',
        handler(_options, bundle) {
          const entry = bundle['combat-lab.html'];
          if (!entry || entry.type !== 'asset') {
            this.error('Combat Lab HTML entry was not generated.');
          }
          this.emitFile({ type: 'asset', fileName: 'index.html', source: entry.source });
        },
      },
    },
  ],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, 'src'),
      '@assets': path.resolve(
        import.meta.dirname,
        '..',
        '..',
        'attached_assets',
      ),
    },
    dedupe: ['react', 'react-dom'],
  },
  root: path.resolve(import.meta.dirname),
  build: {
    outDir: path.resolve(import.meta.dirname, mode === 'combat-lab' ? 'dist/combat-lab' : 'dist/public'),
    emptyOutDir: true,
    rollupOptions: {
      input: path.resolve(import.meta.dirname, mode === 'combat-lab' ? 'combat-lab.html' : 'index.html'),
      output: {
        manualChunks(id) {
          if (id.includes('/node_modules/three/')) return 'three-engine';
        },
      },
    },
  },
  server: {
    port,
    strictPort: true,
    host: '0.0.0.0',
    allowedHosts: true,
    fs: {
      strict: true,
    },
  },
  preview: {
    port,
    host: '0.0.0.0',
    allowedHosts: true,
  },
}));
