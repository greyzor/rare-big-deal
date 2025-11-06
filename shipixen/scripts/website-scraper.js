const axios = require('axios');
const cheerio = require('cheerio');
const { extractAppStoreImages } = require('./appstore');
const { sanitizeTitle } = require('./favicon-extractor');

/**
 * Fetches and extracts metadata from a website.
 *
 * @param {string} website - The URL of the website to scrape
 * @returns {Promise<object>} - Object containing og:image, description, title, etc.
 */
async function fetchWebsiteData(website) {
  let description = '';
  let title = '';
  let appStoreImageUrl = null;

  try {
    const response = await axios.get(website, {
      headers: {
        'User-Agent': 'Mozilla/5.0',
      },
    });
    const $ = cheerio.load(response.data);

    let ogImageUrl = $('meta[property="og:image"]').attr('content');
    let ogImageUrls = []; // Array for multiple images

    // Special handling for Apple App Store URLs to extract all images
    if (website.includes('apps.apple.com')) {
      const appStoreImages = await extractAppStoreImages($, website);
      if (appStoreImages && appStoreImages.length > 0) {
        ogImageUrls = appStoreImages;
        ogImageUrl = appStoreImages[0]; // Keep first image for backward compatibility
      }
    }

    description = $('meta[name="description"]').attr('content');

    // Get only the first title element to handle cases where there are multiple (invalid HTML)
    title =
      $('title').first().text() ||
      $('meta[property="og:title"]').attr('content');

    // Sanitize the title
    title = sanitizeTitle(title);

    // Log the extracted title
    console.log(`Extracted title for ${website}:`, title);

    // Ensure the URLs are absolute
    if (ogImageUrl && !ogImageUrl.startsWith('http')) {
      ogImageUrl = new URL(ogImageUrl, website).href;
    }

    // Try to find the app store image
    const appStoreImageSource = $(
      'picture.we-artwork source[type="image/jpeg"], picture.we-artwork source[type="image/webp"], picture.we-artwork source[type="image/png"]',
    ).attr('srcset');

    if (appStoreImageSource) {
      // Get the first image URL from the srcset
      const firstEntry = appStoreImageSource.split(',')[0];
      appStoreImageUrl = firstEntry.trim().split(' ')[0];

      // Ensure the URL is absolute
      if (appStoreImageUrl && !appStoreImageUrl.startsWith('http')) {
        appStoreImageUrl = new URL(appStoreImageUrl, website).href;
      }
    }

    return {
      $, // Return the Cheerio instance for additional parsing
      ogImageUrl,
      ogImageUrls,
      appStoreImageUrl,
      description,
      title,
    };
  } catch (error) {
    console.error(`Failed to fetch website data:`, error.message);
    return {
      $: null,
      ogImageUrl: null,
      ogImageUrls: [],
      appStoreImageUrl: null,
      description,
      title,
    };
  }
}

module.exports = {
  fetchWebsiteData,
};

