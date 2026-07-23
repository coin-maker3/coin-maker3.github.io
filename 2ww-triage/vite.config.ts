import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { apiMiddleware } from './vite-api-plugin'

export default defineConfig({
  plugins: [react(), apiMiddleware()],
})
