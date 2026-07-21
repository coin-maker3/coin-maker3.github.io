import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// base './' so the built app works from any static path (Firebase, GitHub Pages subfolder, file://)
export default defineConfig({
  base: './',
  plugins: [react(), tailwindcss()],
})
