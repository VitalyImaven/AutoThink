import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';
import { copyFileSync, existsSync, mkdirSync } from 'fs';

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'copy-manifest',
      closeBundle() {
        const distDir = resolve(__dirname, 'dist');
        if (!existsSync(distDir)) {
          mkdirSync(distDir, { recursive: true });
        }
        
        // Copy manifest
        copyFileSync(
          resolve(__dirname, 'src/manifest.json'),
          resolve(distDir, 'manifest.json')
        );
        
        // Copy icons if they exist
        const iconSizes = ['16', '48', '128'];
        const publicDir = resolve(__dirname, 'public');
        
        iconSizes.forEach(size => {
          const iconFile = `icon${size}.png`;
          const iconPath = resolve(publicDir, iconFile);
          if (existsSync(iconPath)) {
            copyFileSync(iconPath, resolve(distDir, iconFile));
          }
        });
        
        // Create games directory in dist
        const gamesDistDir = resolve(distDir, 'src/games');
        if (!existsSync(gamesDistDir)) {
          mkdirSync(gamesDistDir, { recursive: true });
        }
        
        // Copy IQ Arena CSS
        const cssPath = resolve(__dirname, 'src/games/iq-arena.css');
        if (existsSync(cssPath)) {
          copyFileSync(cssPath, resolve(gamesDistDir, 'iq-arena.css'));
        }
      }
    }
  ],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        background: resolve(__dirname, 'src/background.ts'),
        content: resolve(__dirname, 'src/content.ts'),
        'main-panel': resolve(__dirname, 'src/main-panel.ts'),
        options: resolve(__dirname, 'src/options/index.html'),
        'main-panel-page': resolve(__dirname, 'src/main-panel.html'),
        'iq-arena-page': resolve(__dirname, 'src/games/iq-arena.html'),
      },
      output: {
        entryFileNames: (chunkInfo) => {
          if (chunkInfo.name === 'iq-arena-page') {
            return 'src/games/iq-arena.js';
          }
          return '[name].js';
        },
        chunkFileNames: '[name].js',
        assetFileNames: (assetInfo) => {
          if (assetInfo.name === 'main-panel-page.html') {
            return 'src/main-panel.html';
          }
          if (assetInfo.name === 'iq-arena-page.html') {
            return 'src/games/iq-arena.html';
          }
          if (assetInfo.name === 'index.html') {
            return 'src/options/index.html';
          }
          return '[name].[ext]';
        },
      },
    },
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
    },
  },
});
