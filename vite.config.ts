import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  root: '.',
  publicDir: 'public',
  plugins: [],
  resolve: {
    alias: {
      '@controller': resolve(__dirname, 'src/mvc/controller'),
      '@core': resolve(__dirname, 'src/core'),
      '@interfaces': resolve(__dirname, 'src/interfaces'),
      '@model': resolve(__dirname, 'src/mvc/model'),
      '@mvc': resolve(__dirname, 'src/mvc'),
      '@services': resolve(__dirname, 'src/services'),
      '@ui': resolve(__dirname, 'src/ui'),
      '@utils': resolve(__dirname, 'src/utils'),
      '@view': resolve(__dirname, 'src/mvc/view'),
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
  server: {
    port: 3000,
    open: true,
  },
});
