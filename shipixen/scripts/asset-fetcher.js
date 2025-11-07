const fs = require('fs');
const path = require('path');
const { overrides } = require('../data/config/product-overrides');
const { sanitizeName } = require('./sanitize-name');
const { outputDir } = require('./settings');
const { fetchWebsiteData } = require('./website-scraper');
const {
  extractHighestResFavicon,
  checkExistingLogo,
} = require('./favicon-extractor');
const {
  downloadImage,
  downloadMultipleImages,
  convertIcoToPng,
} = require('./image-downloader');

/**
 * Applies configured overrides for a product (logo, images, categories, etc.).
 *
 * @param {object} app - The app/product object
 * @param {string} productName - Sanitized product name
 * @param {string} appDir - Directory for the product's assets
 * @returns {object} - Override configuration if exists, null otherwise
 */
function applyOverrides(app, productName, appDir) {
  const override = overrides[productName];

  if (!override) {
    return null;
  }

  console.log(`Applying overrides for ${productName}`);

  if (override.logo) {
    const logoPath = path.join(appDir, 'logo.png');
    fs.copyFileSync(path.join(__dirname, '..', override.logo), logoPath);
    app.logo = `/static/images/product/${productName}/logo.png`;
    console.log(`Copied override logo for ${productName} ${app.logo}`);
  }

  // Handle ogImages (plural) with priority over ogImage (singular)
  if (
    override.ogImages &&
    Array.isArray(override.ogImages) &&
    override.ogImages.length > 0
  ) {
    app.images = [];
    override.ogImages.forEach((imagePath, index) => {
      const fileName =
        index === 0 ? 'og-image.png' : `og-image-${index + 1}.png`;
      const ogImagePath = path.join(appDir, fileName);
      fs.copyFileSync(path.join(__dirname, '..', imagePath), ogImagePath);
      app.images.push(`/static/images/product/${productName}/${fileName}`);
    });
    console.log(
      `Copied ${override.ogImages.length} override ogImages for ${productName}`,
    );
  } else if (override.ogImage) {
    const ogImagePath = path.join(appDir, 'og-image.png');
    fs.copyFileSync(path.join(__dirname, '..', override.ogImage), ogImagePath);
    app.images = [`/static/images/product/${productName}/og-image.png`];
    console.log(`Copied override ogImage for ${productName} ${app.images}`);
  }

  app.categories = override.categories || app.categories;
  app.subcategories = override.subcategories || app.subcategories;

  return override;
}

/**
 * Downloads and processes images for a product.
 *
 * @param {object} app - The app/product object
 * @param {string} productName - Sanitized product name
 * @param {string} appDir - Directory for the product's assets
 * @param {string[]} imageUrls - Array of image URLs to download
 */
async function processProductImages(app, productName, appDir, imageUrls) {
  if (imageUrls.length === 0) {
    return;
  }

  const downloadedImages = await downloadMultipleImages(
    imageUrls,
    appDir,
    productName,
  );

  if (downloadedImages.length > 0) {
    app.images = downloadedImages;
    console.log(
      `Successfully downloaded ${downloadedImages.length} image(s) for ${productName}`,
    );
  }
}

/**
 * Downloads and processes the logo/favicon for a product.
 *
 * @param {object} app - The app/product object
 * @param {string} productName - Sanitized product name
 * @param {string} appDir - Directory for the product's assets
 * @param {string} faviconUrl - URL of the favicon to download
 */
async function processProductLogo(app, productName, appDir, faviconUrl) {
  if (
    !faviconUrl ||
    !(
      faviconUrl.endsWith('.jpg') ||
      faviconUrl.endsWith('.jpeg') ||
      faviconUrl.endsWith('.png') ||
      faviconUrl.endsWith('.webp') ||
      faviconUrl.endsWith('.ico')
    )
  ) {
    // Check if logo already exists
    const existingLogo = checkExistingLogo(appDir, productName);
    if (existingLogo) {
      app.logo = existingLogo;
    }
    return;
  }

  const logoPath = path.join(appDir, 'logo.png');
  const isValidImage = await downloadImage(faviconUrl, logoPath);

  if (isValidImage) {
    if (faviconUrl.endsWith('.ico')) {
      const icoPath = path.join(appDir, 'logo.png');
      await fs.promises.rename(logoPath, icoPath);
      await convertIcoToPng(icoPath, logoPath);
    }

    app.logo = `/static/images/product/${productName}/logo.png`;
  } else {
    // Check if logo already exists as fallback
    const existingLogo = checkExistingLogo(appDir, productName);
    if (existingLogo) {
      app.logo = existingLogo;
    }
  }
}

/**
 * Fetches all assets (images, logos, metadata) for a product.
 *
 * @param {object} app - The app/product object containing name, website, etc.
 */
async function fetchAssets(app) {
  const { website, name } = app;
  const productName = sanitizeName(name);
  const appDir = path.join(outputDir, 'product', productName);
  fs.mkdirSync(appDir, { recursive: true });

  // Apply overrides first
  const override = applyOverrides(app, productName, appDir);

  // If both logo and ogImage(s) are overridden, we're done
  if (override?.logo && (override?.ogImages || override?.ogImage)) {
    return;
  }

  try {
    console.log(`Fetching website data for ${productName}`);
    const {
      $,
      ogImageUrl,
      ogImageUrls,
      appStoreImageUrl,
      description,
      title,
      jsonLd,
    } = await fetchWebsiteData(website);

    // Log the fetched title
    console.log(`Fetched title for ${productName}:`, title);

    app.metaDescription = description;
    app.metaTitle = title;

    // Store JSON-LD data if available
    if (jsonLd) {
      app.jsonLd = jsonLd;
      console.log(`Stored JSON-LD data for ${productName}`);
    }

    // Process images if not overridden
    if (!override?.ogImages && !override?.ogImage) {
      const imageUrlsToDownload =
        ogImageUrls.length > 0 ? ogImageUrls : [ogImageUrl].filter(Boolean);

      await processProductImages(app, productName, appDir, imageUrlsToDownload);
    }

    // Process logo/favicon if not overridden
    if (!override?.logo && $) {
      const highestResFaviconUrl = await extractHighestResFavicon(
        $,
        website,
        appStoreImageUrl,
      );

      await processProductLogo(app, productName, appDir, highestResFaviconUrl);
    }
  } catch (error) {
    console.error(`Failed to fetch assets for ${app.name}:`, error.message);

    // Check if logo already exists as fallback
    const existingLogo = checkExistingLogo(appDir, productName);
    if (existingLogo) {
      app.logo = existingLogo;
    }
  }
}

module.exports = {
  fetchAssets,
  applyOverrides,
  processProductImages,
  processProductLogo,
};
