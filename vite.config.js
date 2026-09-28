import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),

    VitePWA({
      registerType: "autoUpdate",

      includeAssets: [
        "favicon.svg",
        "robots.txt"
      ],

      manifest: {
        name: "Trelqo",
        short_name: "Trelqo",
        description: "Trelqo — a modern shopping experience.",
        theme_color: "#111827",
        background_color: "#070f30",
        display: "standalone",
        orientation: "portrait",
        scope: "/",
        start_url: "/",

        icons: [
          {
            src: "/icons/icon-192.PNG",
            sizes: "192x192",
            type: "image/png",
            purpose: "any",
          },
          {
            src: "/icons/icon-512.PNG",
            sizes: "512x512",
            type: "image/png",
            purpose: "any",
          },
          {
            src: "/icons/icon-512-maskable.PNG",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },

      workbox: {
        cleanupOutdatedCaches: true,
        navigateFallback: "/index.html",
        globPatterns: [
          "**/*.{js,css,html,ico,svg,webp}"
        ],
        globIgnores: ["**/icons/**"],

        runtimeCaching: [
          {
            urlPattern: ({ request }) => request.destination === "image",
            handler: "CacheFirst",
            options: {
              cacheName: "trelqo -images",
              expiration: { maxEntries: 300, maxAgeSeconds: 60 * 60 * 24 * 30 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            urlPattern: /^https:\/\/fonts\.(googleapis|gstatic)\.com\//,
            handler: "StaleWhileRevalidate",
            options: {
              cacheName: "trelqo -fonts",
              expiration: { maxEntries: 30, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },

      devOptions: {
        enabled: true,
      },
    }),
  ],

  server: {
    port: 5173,
  },

  build: {
    target: "esnext",
    cssCodeSplit: true,
    reportCompressedSize: false,
    chunkSizeWarningLimit: 700,

    rollupOptions: {
      output: {
        manualChunks(id) {
          // Rollup's synthetic CommonJS/ESM-interop helper module (created
          // for UMD/CJS packages like html2canvas/jspdf/canvg/dompurify) is
          // a single shared singleton. If it physically lives inside the
          // heavy admin-only "vendor-pdf-tools" chunk below, anything else
          // in the app that also happens to need it forces that whole 650KB
          // chunk to load eagerly. Giving it its own tiny, always-cheap
          // chunk keeps it independent of where else it's used.
          if (id.includes("commonjsHelpers")) {
            return "vendor-interop";
          }
          if (!id.includes("node_modules")) return;

          if (id.includes("/react-router") || id.includes("/react-dom/") || /\/react\//.test(id)) {
            return "vendor-react";
          }
          if (id.includes("@firebase/firestore") || id.includes("firebase/firestore")) {
            return "vendor-firebase-firestore";
          }
          // idb is Firestore's small IndexedDB-persistence helper - it's a
          // real, eager dependency of firestore (not of the admin-only PDF
          // tools below), so it belongs with firestore, not the catch-all.
          if (id.includes("/idb/")) {
            return "vendor-firebase-firestore";
          }
          // PERFORMANCE: html2canvas/jspdf (+ their canvg/dompurify/file-saver
          // dependencies, ~650KB total) are only ever reached via a dynamic
          // import() inside lib/receipt.js, used by the admin "download
          // receipt" feature. Deliberately NOT forcing them into a named
          // manual chunk here (unlike the buckets above) - grouping them
          // with a fixed name was forcing Rollup to treat the whole group as
          // an eager dependency of the entry. Leaving them unmatched lets
          // Rollup's automatic code-splitting give them their own true
          // lazy-only chunk(s), which is what makes them skip the initial
          // customer page load entirely.
          if (id.includes("html2canvas") || id.includes("jspdf") || id.includes("canvg") || id.includes("dompurify") || id.includes("file-saver")) {
            return;
          }
          if (id.includes("@firebase/auth") || id.includes("firebase/auth")) {
            return "vendor-firebase-auth";
          }
          if (id.includes("@firebase/storage") || id.includes("firebase/storage")) {
            return "vendor-firebase-storage";
          }
          if (id.includes("@firebase/messaging") || id.includes("firebase/messaging")) {
            return "vendor-firebase-messaging";
          }
          if (id.includes("@firebase") || id.includes("/firebase/")) {
            return "vendor-firebase-core";
          }
          if (id.includes("@emailjs")) {
            return "vendor-emailjs";
          }
          if (id.includes("qrcode")) {
            return "vendor-qrcode";
          }
          return "vendor";
        },
      },
    },
  },
});