/**
 * Apple App Store specific extraction utilities
 * Handles extracting app icons and OG images from App Store pages
 */

async function extractAppStoreIcon($, website) {
  console.log('Detected Apple App Store URL, extracting app icon...');

  // Look for app icon in various possible selectors (square orientation)
  const appIconSelectors = [
    '.app-icon picture source[type="image/jpeg"]',
    '.app-icon picture source[type="image/webp"]',
    '.app-icon picture source[type="image/png"]',
    '.artwork-component--orientation-square picture source[type="image/jpeg"]',
    '.artwork-component--orientation-square picture source[type="image/webp"]',
    'div[class*="app-icon"] picture source[type="image/jpeg"]',
    'div[class*="app-icon"] picture source[type="image/webp"]',
  ];

  for (const selector of appIconSelectors) {
    const srcset = $(selector).attr('srcset');
    if (srcset) {
      console.log(`Found app icon with selector: ${selector}`);
      console.log(`srcset: ${srcset}`);

      // Parse srcset to get the highest resolution image
      const srcsetEntries = srcset.split(',').map((entry) => entry.trim());

      // Find the entry with the highest width descriptor (e.g., "400w")
      let maxWidth = 0;
      let maxResUrl = null;

      for (const entry of srcsetEntries) {
        const parts = entry.split(' ');
        const url = parts[0];
        const widthDescriptor = parts[1]; // e.g., "400w"

        if (widthDescriptor && widthDescriptor.endsWith('w')) {
          const width = parseInt(widthDescriptor.slice(0, -1), 10);
          if (width > maxWidth) {
            maxWidth = width;
            maxResUrl = url;
          }
        }
      }

      // Fallback to first entry if no width descriptor found
      const imageUrl = maxResUrl || srcsetEntries[0]?.split(' ')[0];

      if (imageUrl) {
        const iconUrl = imageUrl.startsWith('http')
          ? imageUrl
          : new URL(imageUrl, website).href;
        console.log(`Extracted app icon URL (${maxWidth}w): ${iconUrl}`);
        return iconUrl;
      }
    }
  }

  return null;
}

async function extractAppStoreOgImage($, website) {
  console.log('Detected Apple App Store URL, extracting OG image...');

  // Look for preview images (screenshots/OG images) in various ways
  const ogImageSelectors = [
    // Using data-testid - most reliable
    '[id*="product_media_"] [data-testid="artwork-component"] picture source[type="image/jpeg"]',
    '[id*="product_media_"] [data-testid="artwork-component"] picture source[type="image/webp"]',
  ];

  for (const selector of ogImageSelectors) {
    const element = $(selector).first();
    const srcset = element.attr('srcset');

    if (srcset) {
      console.log(`Found OG image with selector: ${selector}`);
      console.log(`srcset: ${srcset}`);

      // Parse srcset to get the highest resolution image
      const srcsetEntries = srcset.split(',').map((entry) => entry.trim());

      // Find the entry with the highest width descriptor (e.g., "1286w")
      let maxWidth = 0;
      let maxResUrl = null;

      for (const entry of srcsetEntries) {
        const parts = entry.split(' ');
        const url = parts[0];
        const widthDescriptor = parts[1]; // e.g., "1286w"

        if (widthDescriptor && widthDescriptor.endsWith('w')) {
          const width = parseInt(widthDescriptor.slice(0, -1), 10);
          if (width > maxWidth) {
            maxWidth = width;
            maxResUrl = url;
          }
        }
      }

      // Fallback to first entry if no width descriptor found
      const imageUrl = maxResUrl || srcsetEntries[0]?.split(' ')[0];

      if (imageUrl) {
        const ogImageUrl = imageUrl.startsWith('http')
          ? imageUrl
          : new URL(imageUrl, website).href;
        console.log(`Extracted OG image URL (${maxWidth}w): ${ogImageUrl}`);
        return ogImageUrl;
      }
    }
  }

  return null;
}

module.exports = {
  extractAppStoreIcon,
  extractAppStoreOgImage,
};
