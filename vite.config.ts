import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  base: '/sans_cube/',
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/setup.ts'],
    alias: {
      'firebase/auth': path.resolve(__dirname, 'tests/__mocks__/firebase-auth.ts'),
      'firebase/firestore': path.resolve(__dirname, 'tests/__mocks__/firebase-firestore.ts'),
      'firebase/app': path.resolve(__dirname, 'tests/__mocks__/firebase-app.ts'),
      'firebase/analytics': path.resolve(__dirname, 'tests/__mocks__/firebase-analytics.ts'),
    },
    server: {
      deps: {
        inline: ['gan-web-bluetooth', 'aes-js'],
      },
    },
  },
})
