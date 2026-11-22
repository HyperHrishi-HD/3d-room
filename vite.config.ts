import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

declare const process: { env: Record<string, string | undefined> }

/**
 * Pages serves this repository from /<repo>/ rather than the domain root.
 * The deploy workflow sets BASE_PATH, and every runtime asset goes through
 * src/lib/assetUrl.ts so the same build works locally and on Pages.
 */
function normaliseBase(value: string | undefined): string {
  if (!value) return '/'
  const trimmed = value.replace(/^\/+|\/+$/g, '')
  return trimmed ? `/${trimmed}/` : '/'
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  base: normaliseBase(process.env.BASE_PATH),
  // Evidence captures and disposable browser profiles live under qa/. Watching
  // them makes Vite reload the app while a QA harness is driving it.
  server: { watch: { ignored: ['**/qa/**'] } },
})
