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
        find: './find.html',
        buffs: './buffs.html',
        party: './party.html',
        races: './races.html',
        creator: './creator.html',
      },
    },
  },
});
