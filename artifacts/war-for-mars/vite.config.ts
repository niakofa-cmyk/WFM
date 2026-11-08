import path from 'path';
import { gzipSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';
import type { OutputBundle, OutputChunk } from 'rollup';
import type { Plugin } from 'vite';

const port = Number(process.env.PORT || 5173);
const basePath = process.env.BASE_PATH || '/';
const workspaceRoot = path.resolve(import.meta.dirname, '..', '..');
const MAX_INITIAL_STATIC_GZIP_BYTES = 140 * 1024;

function bundleAuditPlugin(buildMode: string): Plugin {
  return {
    name: 'wfm-bundle-audit',
    generateBundle(_options, bundle: OutputBundle) {
      const chunks = Object.values(bundle).filter(
        (item): item is OutputChunk => item.type === 'chunk',
      );
      const chunksByFile = new Map(chunks.map((chunk) => [chunk.fileName, chunk]));
      const staticClosure = new Set<string>();
      const allReachable = new Set<string>();

      const visit = (fileName: string, includeDynamic: boolean) => {
        const seen = includeDynamic ? allReachable : staticClosure;
        if (seen.has(fileName)) return;
        seen.add(fileName);
        const chunk = chunksByFile.get(fileName);
        if (!chunk) return;
        chunk.imports.forEach((dependency) => visit(dependency, includeDynamic));
        if (includeDynamic) {
          chunk.dynamicImports.forEach((dependency) => visit(dependency, true));
        }
      };

      chunks
        .filter((chunk) => chunk.isEntry)
        .forEach((chunk) => {
          visit(chunk.fileName, false);
          visit(chunk.fileName, true);
        });

      const reportChunks = chunks.map((chunk) => ({
        file: chunk.fileName,
        name: chunk.name,
        entry: chunk.isEntry,
        dynamicEntry: chunk.isDynamicEntry,
        imports: chunk.imports,
        dynamicImports: chunk.dynamicImports,
        initialStaticLoad: staticClosure.has(chunk.fileName),
        reachableFromEntry: allReachable.has(chunk.fileName),
        bytes: Buffer.byteLength(chunk.code),
        gzipBytes: gzipSync(chunk.code).byteLength,
        modules: Object.entries(chunk.modules)
          .map(([id, info]) => ({
            id: path.isAbsolute(id)
              ? path.relative(workspaceRoot, id)
              : id,
            originalBytes: info.originalLength,
            renderedBytes: info.renderedLength,
          }))
          .sort((a, b) => b.renderedBytes - a.renderedBytes),
      }));

      const forbiddenThreeModules = reportChunks.flatMap((chunk) =>
        chunk.modules
          .filter((module) => module.id.includes('/node_modules/three/'))
          .map((module) => module.id),
      );
      const initialStaticChunks = chunks.filter((chunk) =>
        staticClosure.has(chunk.fileName),
      );
      const report = {
        generatedAt: new Date().toISOString(),
        buildMode,
        app: '@workspace/war-for-mars',
        renderer: 'Orbital-owned WebGL2',
        forbiddenThreeModules,
        initialStaticJavascriptBytes: initialStaticChunks.reduce(
          (total, chunk) => total + Buffer.byteLength(chunk.code),
          0,
        ),
        initialStaticJavascriptGzipBytes: initialStaticChunks.reduce(
          (total, chunk) => total + gzipSync(chunk.code).byteLength,
          0,
        ),
        chunks: reportChunks,
      };
      const reportName =
        buildMode === 'combat-lab'
          ? 'wfm-combat-lab-bundle-audit.json'
          : 'wfm-bundle-audit.json';
      const reportPath = path.resolve(
        import.meta.dirname,
        '..',
        '..',
        'generated-artifacts',
        reportName,
      );

      mkdirSync(path.dirname(reportPath), { recursive: true });
      writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
      console.info(
        `[WFM bundle audit] Initial static JS: ${report.initialStaticJavascriptBytes} B raw / ${report.initialStaticJavascriptGzipBytes} B gzip`,
      );
      console.info(
        `[WFM bundle audit] Renderer: ${report.renderer}; forbidden Three.js modules: ${forbiddenThreeModules.length}`,
      );
      console.info(`[WFM bundle audit] Detailed report: ${reportPath}`);
      if (report.initialStaticJavascriptGzipBytes > MAX_INITIAL_STATIC_GZIP_BYTES) {
        this.error(
          `Initial static JavaScript is ${report.initialStaticJavascriptGzipBytes} B gzip; budget is ${MAX_INITIAL_STATIC_GZIP_BYTES} B.`,
        );
      }
      if (forbiddenThreeModules.length > 0) {
        this.error(`Three.js is not allowed in any WFM build chunk (${forbiddenThreeModules.length} module(s) found).`);
      }
    },
  };
}

export default defineConfig(({ mode }) => ({
  base: mode === 'combat-lab' ? './' : basePath,
  publicDir: 'public',
  plugins: [
    react(),
    tailwindcss({ optimize: false }),
    ...(process.env.WFM_BUNDLE_REPORT === '1'
      ? [bundleAuditPlugin(mode)]
      : []),
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
    outDir: path.resolve(import.meta.dirname, 'dist/public'),
    emptyOutDir: mode !== 'combat-lab',
    // Static entry gzip limits apply to both the app and standalone Orbital entry.
    chunkSizeWarningLimit: 575,
    rollupOptions: {
      input: path.resolve(import.meta.dirname, mode === 'combat-lab' ? 'combat-lab.html' : 'index.html'),
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
