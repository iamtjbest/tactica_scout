import { MetadataRoute } from 'next'

/**
 * Scout is a public app, so almost everything is crawlable. What is not:
 * the auth flow and the signed-in settings page. Those are per-user,
 * have nothing worth ranking on them, and a confirmation or reset URL
 * sitting in a search index is a real problem rather than a cosmetic one.
 *
 * Match, team, player and league pages are deliberately NOT blocked —
 * they're the long tail that brings people in from search.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: [
        '/api/',
        '/signin',
        '/signup',
        '/verify',
        '/forgot-password',
        '/reset-password',
        '/settings',
      ],
    },
    sitemap: 'https://scout.tacticaengine.com/sitemap.xml',
  }
}
