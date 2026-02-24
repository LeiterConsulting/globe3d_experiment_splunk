import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const APP_ID = process.env.SPLUNK_APP_ID || process.env.VITE_SPLUNK_APP_ID || 'splunk_globe_app_v2'

export default defineConfig({
  plugins: [react()],
  define: {
    'process.env.NODE_ENV': '"production"',
    'process.env': '{}',
  },
  build: {
    outDir: 'dist-splunk',
    emptyOutDir: true,
    sourcemap: false,
    cssCodeSplit: false,
    lib: {
      entry: 'src/splunk/splunkMain.tsx',
      name: 'SplunkTerminalApp',
      formats: ['iife'],
      fileName: () => APP_ID,
    },
    rollupOptions: {
      output: {
        banner:
          ";(function(){try{var g=typeof globalThis!=='undefined'?globalThis:window;g.process=g.process||{env:{}};g.process.env=g.process.env||{};g.process.env.NODE_ENV=g.process.env.NODE_ENV||'production';}catch(e){}})();",
        inlineDynamicImports: true,
        entryFileNames: `${APP_ID}.js`,
        assetFileNames: (assetInfo) => {
          if (assetInfo.name?.endsWith('.css')) return `${APP_ID}.css`
          return 'asset-[name][extname]'
        },
      },
    },
    target: 'es2018',
  },
})
