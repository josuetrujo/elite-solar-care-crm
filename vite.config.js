import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// base: './' makes the build work on GitHub Pages, a NAS, or a normal host
// without needing to know the folder name in advance.
export default defineConfig({
  plugins: [react()],
  base: './',
})
