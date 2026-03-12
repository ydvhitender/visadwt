import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  base: '/elwtapp/',
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
<<<<<<< HEAD
=======
    allowedHosts: ['el.visad.co.uk'],
    hmr: {
      protocol: 'wss',
      host: 'el.visad.co.uk',
      clientPort: 443,
      path: '/elwtapp/',
    },
    proxy: {
      '/elwtapp/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/elwtapp/, ''),
      },
      '/elwtapp/socket.io': {
        target: 'http://localhost:3001',
        ws: true,
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/elwtapp/, ''),
      },
    },
>>>>>>> dab62c0 (new final changes)
  },
});
