import { MetadataRoute } from 'next'

/**
 * One entry, on purpose.
 *
 * The landing page is the only public page here. Everything else is
 * behind sign-in, and a sitemap listing pages that redirect to /signin
 * is a negative signal, not a neutral one.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: 'https://scouteditor.tacticaengine.com',
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 1,
    },
  ]
}
