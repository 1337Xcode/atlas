// why: one place that knows where archive assets live, so the backend can be swapped in later

export type AssetPaths = {
  scenario: (eventId: string) => string
  manifest: (eventId: string) => string
  // note: hand-authored theatre keyframes, which override the scenario's own beats
  theatre: (eventId: string) => string
  // note: page scans, illustrations and recordings, as named inside a scenario
  asset: (relativePath: string) => string
}

const leading = (path: string) => (path.startsWith('/') ? path : `/${path}`)

// note: served from `public/` in development and from the same origin in production
export const localPaths: AssetPaths = {
  scenario: (eventId) => `/events/${eventId}/scenario.json`,
  manifest: (eventId) => `/events/${eventId}/manifest.json`,
  theatre: (eventId) => `/events/${eventId}/theatre.json`,
  asset: (relativePath) =>
    /^https?:\/\//.test(relativePath) ? relativePath : leading(relativePath),
}

// fn: point the newspaper at the archive api instead of the public folder
export function apiPaths(base = '/api'): AssetPaths {
  return {
    scenario: (eventId) => `${base}/worlds/${eventId}/scenario`,
    manifest: (eventId) => `${base}/worlds/${eventId}/manifest`,
    theatre: (eventId) => `${base}/worlds/${eventId}/theatre`,
    asset: (relativePath) =>
      /^https?:\/\//.test(relativePath) ? relativePath : `${base}/images${leading(relativePath)}`,
  }
}
