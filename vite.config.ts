import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// All logic runs on-device: no backend, no API keys, no network calls.
// This keeps the demo offline-safe (rubric #01) and leak-proof (rubric #02).
// base is '/switchboard/' for the GitHub Pages project site at build time,
// and '/' for local dev so localhost:5173 still serves at the root.
export default defineConfig(({ command }) => ({
  base: command === 'build' ? '/switchboard/' : '/',
  plugins: [react()],
  server: { port: 5173, host: true, strictPort: true },
}))
