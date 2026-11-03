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

function bundleAuditPlugin(): Plugin {
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

      const engineChunk = chunks.find((chunk) => chunk.name === 'three-engine');
      const initialStaticChunks = chunks.filter((chunk) =>
        staticClosure.has(chunk.fileName),
      );
      const report = {
        generatedAt: new Date().toISOString(),
        app: '@workspace/war-for-mars',
        engine: 'Three.js / WebGL',
        engineChunk: engineChunk?.fileName ?? null,
        engineLoadedInInitialStaticGraph: engineChunk
          ? staticClosure.has(engineChunk.fileName)
          : null,
        engineReachableFromEntry: engineChunk
          ? allReachable.has(engineChunk.fileName)
          : null,
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
      const reportPath = path.resolve(
        import.meta.dirname,
        '..',
        '..',
        'generated-artifacts',
        'wfm-bundle-audit.json',
      );

      mkdirSync(path.dirname(reportPath), { recursive: true });
      writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
      console.info(
        `[WFM bundle audit] Initial static JS: ${report.initialStaticJavascriptBytes} B raw / ${report.initialStaticJavascriptGzipBytes} B gzip`,
      );
      console.info(
        `[WFM bundle audit] Three.js chunk: ${engineChunk ? `${Buffer.byteLength(engineChunk.code)} B raw / ${gzipSync(engineChunk.code).byteLength} B gzip; initial load: ${report.engineLoadedInInitialStaticGraph}` : 'not found'}`,
      );
      console.info(`[WFM bundle audit] Detailed report: ${reportPath}`);
      if (engineChunk && staticClosure.has(engineChunk.fileName)) {
        this.error('Three.js entered the initial static-load graph; keep combat renderer imports deferred.');
      }
    },
  };
}

const auditPlugins =
  process.env.WFM_BUNDLE_REPORT === '1' ? [bundleAuditPlugin()] : [];

export default defineConfig({
  base: basePath,
  plugins: [react(), tailwindcss({ optimize: false }), ...auditPlugins],
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
    emptyOutDir: true,
    rollupOptions: {
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
});
