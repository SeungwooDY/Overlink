import { defineConfig } from "vite";
import { resolve } from "path";
import { fileURLToPath } from "url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));

const API_BASE =
  process.env.API_BASE ?? "https://overlink-web.vercel.app";
const SUPABASE_ANON_KEY =
  process.env.SUPABASE_ANON_KEY ?? "";

export default defineConfig({
  define: {
    __API_BASE__: JSON.stringify(API_BASE),
    __SUPABASE_ANON_KEY__: JSON.stringify(SUPABASE_ANON_KEY),
  },
  build: {
    outDir: "dist",
    emptyOutDir: false, // content build already emptied dist/
    minify: false,
    rollupOptions: {
      input: {
        background: resolve(__dirname, "src/background.ts"),
        offscreen: resolve(__dirname, "src/offscreen.ts"),
        popup: resolve(__dirname, "src/popup.ts"),
        "auth-bridge": resolve(__dirname, "src/auth-bridge.ts"),
      },
      output: {
        entryFileNames: "[name].js",
        format: "es",
      },
    },
  },
});
