import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';

export default defineConfig({
  plugins: [svelte()],
  clearScreen: false,
  server: {
    port: 5173,
    strictPort: true,
    host: '127.0.0.1',
    // Rust/Cargo writes and locks binaries under src-tauri/target on Windows.
    // Vite only needs to watch frontend sources, so exclude the whole Rust tree.
    watch: {
      ignored: ['**/src-tauri/**']
    }
  }
});
