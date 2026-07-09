import { defineConfig } from 'vitest/config'
import viteReact from '@vitejs/plugin-react'

// Component/integration tests run under jsdom with React Testing Library.
// The TanStack Start plugin is intentionally omitted — unit tests render
// components in isolation and don't need the server pipeline.
export default defineConfig({
  plugins: [viteReact()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    css: false,
  },
})
