import { defineConfig } from 'vite';

export default defineConfig({
  base: process.env.BASE_PATH || '/',
  server: {
    port: 5173,
    open: true,
  },
  build: {
    rollupOptions: {
      input: {
        main: './index.html',
        buffs: './buffs.html',
        party: './party.html',
      },
    },
  },
});
