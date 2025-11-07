const axios = require('axios');
const cheerio = require('cheerio');
const { extractAppStoreImages } = require('./appstore');
const { sanitizeTitle } = require('./favicon-extractor');

/**
 * Extracts JSON-LD structured data from the page.
 *
 * @param {object} $ - Cheerio instance with loaded HTML
 * @returns {object|null} - Parsed JSON-LD data or null if not found
 */
function extractJsonLd($) {
  try {
    // Look for JSON-LD script tags
    const jsonLdScripts = $('script[type="application/ld+json"]');

    if (jsonLdScripts.length === 0) {
      return null;
    }

    // Find the SoftwareApplication schema
    let softwareAppData = null;

    jsonLdScripts.each((index, element) => {
      try {
        const scriptContent = $(element).html();
        if (!scriptContent) return;

        const jsonData = JSON.parse(scriptContent);

        // Check if this is a SoftwareApplication schema
        if (jsonData['@type'] === 'SoftwareApplication') {
          softwareAppData = jsonData;
          return false; // Break the loop
        }
      } catch (parseError) {
        console.warn(
          `Failed to parse JSON-LD at index ${index}:`,
          parseError.message,
        );
      }
    });

    if (!softwareAppData) {
      return null;
    }

    // Extract and normalize the relevant fields
    const extractedData = {
      name: softwareAppData.name || null,
      description: softwareAppData.description || null,
      applicationCategory: softwareAppData.applicationCategory || null,
      operatingSystem: softwareAppData.operatingSystem || null,
      availableOnDevice: softwareAppData.availableOnDevice || null,
      price: softwareAppData.offers?.price || null,
      priceCurrency: softwareAppData.offers?.priceCurrency || null,
      ratingValue: softwareAppData.aggregateRating?.ratingValue || null,
      reviewCount: softwareAppData.aggregateRating?.reviewCount || null,
      authorName: softwareAppData.author?.name || null,
      authorUrl: softwareAppData.author?.url || null,
    };

    console.log('Extracted JSON-LD data:', {
      name: extractedData.name,
      category: extractedData.applicationCategory,
      price: extractedData.price,
      rating: extractedData.ratingValue,
      reviewCount: extractedData.reviewCount,
    });

    return extractedData;
  } catch (error) {
    console.error('Failed to extract JSON-LD:', error.message);
    return null;
  }
}

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

    // Extract JSON-LD structured data
    const jsonLdData = extractJsonLd($);

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
      jsonLd: jsonLdData, // Include JSON-LD data
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
      jsonLd: null,
    };
  }
}

module.exports = {
  fetchWebsiteData,
};
