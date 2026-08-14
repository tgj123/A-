import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    proxy: {
      '/fund-flow-api': {
        target: 'http://127.0.0.1:8787',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/fund-flow-api/, ''),
      },
      '/tencent-api': {
        target: 'https://proxy.finance.qq.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/tencent-api/, ''),
        headers: { Referer: 'https://stockapp.finance.qq.com/' },
      },
    },
  },
})
