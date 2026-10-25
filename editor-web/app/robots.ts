import { MetadataRoute } from 'next'

/**
 * The editor is a signed-in tool, not a content site. Only the landing
 * page is worth indexing. Everything else is either per-account data
 * (dashboard, competitions, inbox, billing, settings), a competition
 * workspace under /t/, the admin review queue, or an invite link under
 * /join whose whole point is that it was sent to one person.
 *
 * Crawlers hitting those get redirected to sign-in anyway, so blocking
 * them here saves the crawl budget and keeps invite URLs out of search.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: [
        '/api/',
        '/admin',
        '/billing',
        '/competitions',
        '/dashboard',
        '/inbox',
        '/join',
        '/settings',
        '/signin',
        '/t/',
      ],
    },
    sitemap: 'https://scouteditor.tacticaengine.com/sitemap.xml',
  }
}
