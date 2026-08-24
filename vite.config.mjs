import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// React islandy (Fáze 1, strangler-fig). Zabalí React + komponenty do JEDNOHO
// IIFE souboru js/react-islands.js, který stará appka načte jedním <script>.
// define: process.env.NODE_ENV je NUTNÉ — v lib módu ho Vite jinak nenahradí a
// React v prohlížeči spadne na „process is not defined".
// emptyOutDir:false — abychom nesmazali zbytek js/.
export default defineConfig({
  plugins: [react()],
  define: { 'process.env.NODE_ENV': JSON.stringify('production') },
  build: {
    lib: {
      entry: 'react/main.jsx',
      name: 'LexisReactIslands',
      formats: ['iife'],
      fileName: () => 'react-islands.js',
    },
    outDir: 'js',
    emptyOutDir: false,
    minify: true,
  },
});
