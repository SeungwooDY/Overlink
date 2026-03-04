import { defineConfig } from "vite";
import { resolve } from "path";
import { fileURLToPath } from "url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
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
