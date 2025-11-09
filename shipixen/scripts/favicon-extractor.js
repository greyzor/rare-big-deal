const axios = require('axios');
const { extractAppStoreIcon } = require('./appstore');

/**
 * Sanitizes a title string by removing invisible Unicode characters and control characters.
 *
 * @param {string} title - The title to sanitize
 * @returns {string} - Sanitized title
 */
function sanitizeTitle(title) {
  if (!title) return '';

  return title
    .trim()
    // Remove Left-to-Right Mark (U+200E), Right-to-Left Mark (U+200F), Zero Width Space (U+200B),
    // Zero Width No-Break Space (U+FEFF), and other common invisible/control characters
    .replace(
      /[\u200E\u200F\u200B\uFEFF\u202A\u202B\u202C\u202D\u202E]/g,
      '',
    )
    // Remove any other control characters (except newlines and tabs which we'll replace with spaces)
    // eslint-disable-next-line no-control-regex
    .replace(/[\x00-\x1F\x7F-\x9F]/g, ' ')
    // Replace multiple spaces with single space
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Extracts the highest resolution favicon from a website.
 *
 * @param {object} $ - Cheerio instance with loaded HTML
 * @param {string} website - The website URL
 * @param {string|null} appStoreImageUrl - Optional App Store image URL to use as fallback
 * @returns {Promise<string|null>} - URL of the highest resolution favicon, or null if not found
 */
async function extractHighestResFavicon($, website, appStoreImageUrl = null) {
  // Special handling for Apple App Store URLs to extract app icon
  if (website.includes('apps.apple.com')) {
    const appStoreIcon = await extractAppStoreIcon($, website);
    if (appStoreIcon) {
      return appStoreIcon;
    }
  }

  // Standard favicon extraction for non-App Store URLs or as fallback
  const possibleFaviconUrls = [
    $('link[rel="apple-touch-icon"]').attr('href'),
    $('link[rel="icon"][type="image/png"]').attr('href'),
    '/favicon-32x32.png',
    '/favicon-16x16.png',
    '/apple-touch-icon.png',
    '/favicon.png',
    // Get .ico too
    $('link[rel="icon"]').attr('href'),
    $('link[rel="shortcut icon"]').attr('href'),
    appStoreImageUrl, // Add the app store image URL to the list
  ]
    .filter(Boolean)
    .map((url) => new URL(url, website).href);

  for (const url of possibleFaviconUrls) {
    try {
      const headResponse = await axios.head(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0',
        },
        validateStatus: (status) => status < 400,
      });

      if (
        headResponse.status === 200 &&
        headResponse.headers['content-type'].startsWith('image/')
      ) {
        return url;
      }
    } catch (error) {
      console.warn(`Favicon URL not found: ${url}`);
    }
  }

  // Final fallback: Try Google's favicon service with maximum size
  try {
    const domain = new URL(website).hostname;
    const googleFaviconUrl = `https://www.google.com/s2/favicons?domain=${domain}&sz=256`;

    const headResponse = await axios.head(googleFaviconUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0',
      },
      validateStatus: (status) => status < 400,
    });

    if (
      headResponse.status === 200 &&
      headResponse.headers['content-type'].startsWith('image/')
    ) {
      console.log(`Using Google favicon service for ${domain}`);
      return googleFaviconUrl;
    }
  } catch (error) {
    console.warn(`Google favicon service failed for ${website}`);
  }

  return null;
}

/**
 * Checks if a logo file exists in the specified directory.
 *
 * @param {string} appDir - Directory to check for logo
 * @param {string} productName - Name of the product
 * @returns {string|null} - Path to the logo if it exists, null otherwise
 */
function checkExistingLogo(appDir, productName) {
  const fs = require('fs');
  const path = require('path');
  const existingLogoPath = path.join(appDir, 'logo.png');

  if (fs.existsSync(existingLogoPath)) {
    console.log(`Using existing logo for ${productName}`);
    return `/static/images/product/${productName}/logo.png`;
  }

  return null;
}

module.exports = {
  sanitizeTitle,
  extractHighestResFavicon,
  checkExistingLogo,
};

