import { defineConfig, type Plugin } from 'vite'
import vue from '@vitejs/plugin-vue'
import { createHash } from 'node:crypto'
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { join, relative, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const projectRoot = fileURLToPath(new URL('.', import.meta.url))
const distDir = join(projectRoot, 'dist')

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name)
    return statSync(full).isDirectory() ? walk(full) : [full]
  })
}

/** 构建后生成预缓存清单，并把内容指纹注入 service worker 的缓存版本号。 */
function pwaPrecacheManifest(): Plugin {
  return {
    name: 'passionlife-pwa-precache',
    apply: 'build',
    closeBundle() {
      const files = walk(distDir)
        .map((file) => relative(distDir, file).split(sep).join('/'))
        .filter((file) => file !== 'sw-manifest.json' && !file.endsWith('.map'))
        .sort()
      const digest = createHash('sha256')
      for (const file of files) {
        digest.update(file).update(readFileSync(join(distDir, file)))
      }
      const buildId = digest.digest('hex').slice(0, 12)
      writeFileSync(join(distDir, 'sw-manifest.json'), JSON.stringify({ version: buildId, files }, null, 2))
      const swPath = join(distDir, 'sw.js')
      const sw = readFileSync(swPath, 'utf8')
      writeFileSync(swPath, sw.replace('__BUILD_ID__', buildId))
      console.log(`[pwa] precached ${files.length} files · build ${buildId}`)
    }
  }
}

// base 用相对路径：GitHub Pages 项目页 /<repo>/ 下，hash 路由刷新不依赖服务端重写。
export default defineConfig({
  base: './',
  plugins: [vue(), pwaPrecacheManifest()],
  build: {
    target: 'es2020',
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: false
  },
  server: {
    host: '127.0.0.1',
    port: 6173,
    strictPort: true
  }
})
