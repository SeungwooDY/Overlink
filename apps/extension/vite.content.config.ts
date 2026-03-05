import { defineConfig } from "vite";
import { resolve } from "path";
import { fileURLToPath } from "url";
import { viteStaticCopy } from "vite-plugin-static-copy";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
// Monorepo root — node_modules is hoisted here
const repoRoot = resolve(__dirname, "../..");

const API_BASE =
  process.env.API_BASE ?? "https://overlink-web.vercel.app";

export default defineConfig({
  define: {
    __API_BASE__: JSON.stringify(API_BASE),
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
    minify: false,
    rollupOptions: {
      input: resolve(__dirname, "src/content.ts"),
      output: {
        entryFileNames: "content.js",
        format: "iife",
        inlineDynamicImports: true,
      },
    },
  },
  plugins: [
    viteStaticCopy({
      targets: [
        // Tesseract worker — spawned at runtime via chrome.runtime.getURL
        {
          src: resolve(repoRoot, "node_modules/tesseract.js/dist/worker.min.js"),
          dest: ".",
        },
        // Tesseract WASM core — loaded by the worker at runtime
        {
          src: resolve(repoRoot, "node_modules/tesseract.js-core/tesseract-core*.wasm.js"),
          dest: ".",
        },
      ],
    }),
  ],
});
