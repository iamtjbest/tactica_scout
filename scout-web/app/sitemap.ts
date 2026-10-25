import { MetadataRoute } from 'next'

/**
 * Static routes only.
 *
 * The match, team, player, league and tournament pages are dynamic and
 * there are thousands of them, changing every matchday. Listing them
 * here would mean calling the backend at build time and shipping a
 * sitemap that is stale the moment a new fixture appears. Crawlers reach
 * those pages by following links from the pages below, which is what
 * the internal linking is for.
 *
 * If that long tail turns out to matter for search, the right fix is a
 * second, generated sitemap for fixtures only, not stuffing them here.
 */
const BASE = 'https://scout.tacticaengine.com'

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date()

  return [
    {
      url: BASE,
      lastModified: now,
      changeFrequency: 'hourly', // live scores, changes through every matchday
      priority: 1,
    },
    {
      url: `${BASE}/leagues`,
      lastModified: now,
      changeFrequency: 'daily',
      priority: 0.9,
    },
    {
      url: `${BASE}/compare`,
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 0.8,
    },
    {
      url: `${BASE}/tournaments`,
      lastModified: now,
      changeFrequency: 'daily',
      priority: 0.8,
    },
    {
      url: `${BASE}/news`,
      lastModified: now,
      changeFrequency: 'daily',
      priority: 0.7,
    },
  ]
}
