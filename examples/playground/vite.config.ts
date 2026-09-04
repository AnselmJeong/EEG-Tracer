import { fileURLToPath } from 'node:url'

import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: [
      {
        find: /^@neurosignal\/trace-viewer\/styles\.css$/,
        replacement: fileURLToPath(new URL('../../packages/trace-viewer/src/styles/trace-viewer.css', import.meta.url)),
      },
      {
        find: /^@neurosignal\/trace-viewer$/,
        replacement: fileURLToPath(new URL('../../packages/trace-viewer/src/index.ts', import.meta.url)),
      },
    ],
  },
})
