import { defineConfig } from "vite";
import solid from "vite-plugin-solid";
import { viteStaticCopy } from "vite-plugin-static-copy";

export default defineConfig({
  plugins: [
    solid(),
    viteStaticCopy({
      targets: [
        {
          src: "CHANGELOG.md",
          dest: ".",
        },
      ],
    }),
  ],
  server: {
    port: 1420,
    proxy: {
      "/api": {
        target: "http://127.0.0.1:3000",
        changeOrigin: true,
      },
    },
  },
  build: {
    target: "esnext",
  },
});
