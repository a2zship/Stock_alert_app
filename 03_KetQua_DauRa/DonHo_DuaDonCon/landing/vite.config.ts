import { defineConfig, loadEnv } from 'vite'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  return {
    base: './',
    server: {
      port: Number(env.DEV_PORT) || undefined,
      strictPort: true,
      // ảnh gốc đang được chép vào assets/ — không theo dõi để tránh lỗi EBUSY khi file còn bị khoá
      watch: { ignored: ['**/assets/**', '**/dist/**'] },
    },
    preview: { port: Number(env.PREVIEW_PORT) || undefined, strictPort: true },
    build: { target: 'es2020', assetsInlineLimit: 0 },
  }
})
