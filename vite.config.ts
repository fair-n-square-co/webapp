import { defineConfig } from 'vite'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import viteReact from '@vitejs/plugin-react'

export default defineConfig({
  server: { port: 3000 },
  plugins: [
    // Tests are colocated next to the routes they cover, so the route generator
    // must not treat them as route files.
    tanstackStart({ router: { routeFileIgnorePattern: '\\.(test|spec)\\.[jt]sx?$' } }),
    viteReact(),
  ],
})
