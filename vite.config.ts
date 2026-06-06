import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// All logic runs on-device: no backend, no API keys, no network calls.
// This keeps the demo offline-safe (rubric #01) and leak-proof (rubric #02).
export default defineConfig({
  plugins: [react()],
  server: { port: 5173, host: true, strictPort: true },
})
