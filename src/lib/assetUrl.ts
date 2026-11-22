/**
 * Public files live under Vite's configured base. On GitHub Pages the demo is
 * served from /<repo>/, so an absolute literal such as /media/world-map.jpg
 * would point at the user's domain root instead of the project.
 */
export function assetUrl(path: string): string {
  const base = (import.meta.env.BASE_URL || '/').replace(/\/+$/, '')
  return `${base}/${path.replace(/^\/+/, '')}`
}
