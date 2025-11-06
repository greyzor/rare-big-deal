const fs = require('fs');
const path = require('path');
const axios = require('axios');
const cheerio = require('cheerio');
const { overrides } = require('../data/config/product-overrides');
const { generateMDXContent } = require('./generate-mdx-content');
const { parseReadme } = require('./parse-readme');
const { sanitizeName } = require('./sanitize-name');
const { outputDir } = require('./settings');
const sharp = require('sharp');
const { execSync } = require('child_process');
const {
  extractAppStoreIcon,
  extractAppStoreOgImage,
  extractAppStoreImages,
} = require('./appstore');

const generateIndexScript = path.join(__dirname, 'generate-pick-index.js');
execSync(`node ${generateIndexScript}`, { stdio: 'inherit' });

async function downloadImage(url, outputPath) {
  try {
    const response = await axios.get(url, {
      responseType: 'arraybuffer',
      headers: {
        'User-Agent': 'Mozilla/5.0',
      },
      validateStatus: (status) => status < 400,
    });

    console.log(`HTTP status code for ${url}: ${response.status}`);

    const contentType = response.headers['content-type'];
    console.log(`Content-Type for ${url}: ${contentType}`);

    if (contentType && contentType.startsWith('image/')) {
      let imageBuffer = response.data;

      // If the image is a JPG or WebP, convert it to PNG
      if (
        contentType === 'image/jpeg' ||
        contentType === 'image/webp' ||
        contentType === 'image/png'
      ) {
        const pngOutputPath = outputPath.replace(
          /\.(jpg|jpeg|webp|png)$/,
          '.png',
        );
        await sharp(imageBuffer).png().toFile(pngOutputPath);
        console.log(
          `Converted ${contentType} to PNG and saved to ${pngOutputPath}`,
        );
        return true;
      } else {
        fs.writeFileSync(outputPath, imageBuffer);
        console.log(`Downloaded image from ${url} to ${outputPath}`);
        return true;
      }
    } else {
      console.error(
        `Invalid image type from ${url}. Detected Content-Type: ${contentType}`,
      );
      return false;
    }
  } catch (error) {
    console.error(`Failed to download image from ${url}:`, error.message);
    return false;
  }
}

async function fetchWebsiteData(website, hasLogoOverride) {
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

    // Trim the title to remove any extra whitespace and sanitize invisible Unicode characters
    if (title) {
      title = title
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

    let highestResFaviconUrl = null;
    if (!hasLogoOverride) {
      // Special handling for Apple App Store URLs to extract app icon
      if (website.includes('apps.apple.com')) {
        highestResFaviconUrl = await extractAppStoreIcon($, website);
      }

      // Standard favicon extraction for non-App Store URLs or as fallback
      if (!highestResFaviconUrl) {
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
              highestResFaviconUrl = url;
              break;
            }
          } catch (error) {
            console.warn(`Favicon URL not found: ${url}`);
          }
        }
      }
    }

    return {
      ogImageUrl,
      ogImageUrls,
      highestResFaviconUrl,
      description,
      title,
    };
  } catch (error) {
    console.error(`Failed to fetch website data:`, error.message);
    return {
      ogImageUrl: null,
      ogImageUrls: [],
      highestResFaviconUrl: null,
      description,
      title,
    };
  }
}

async function fetchAssets(app) {
  const { website, name } = app;
  const productName = sanitizeName(name);
  const appDir = path.join(outputDir, 'product', productName);
  fs.mkdirSync(appDir, { recursive: true });

  const override = overrides[productName];

  if (override) {
    console.log(`Applying overrides for ${productName}`);
    if (override.logo) {
      const logoPath = path.join(appDir, 'logo.png');
      fs.copyFileSync(path.join(__dirname, '..', override.logo), logoPath);
      app.logo = `/static/images/product/${productName}/logo.png`;
      console.log(`Copied override logo for ${productName} ${app.logo}`);
    }
    if (override.ogImage) {
      const ogImagePath = path.join(appDir, 'og-image.png');
      fs.copyFileSync(
        path.join(__dirname, '..', override.ogImage),
        ogImagePath,
      );
      app.images = [`/static/images/product/${productName}/og-image.png`];
      console.log(`Copied override ogImage for ${productName} ${app.images}`);
    }
    app.categories = override.categories || app.categories;
    app.subcategories = override.subcategories || app.subcategories;
  }

  if (!override || !override.logo || !override.ogImage) {
    try {
      console.log(`Fetching website data for ${productName}`);
      const {
        ogImageUrl,
        ogImageUrls,
        highestResFaviconUrl,
        description,
        title,
      } = await fetchWebsiteData(website, !!override?.logo);

      // Log the fetched title
      console.log(`Fetched title for ${productName}:`, title);

      app.metaDescription = description;
      app.metaTitle = title;

      if (!override?.ogImage) {
        // Download multiple images if available (App Store), otherwise single image
        const imageUrlsToDownload =
          ogImageUrls.length > 0 ? ogImageUrls : [ogImageUrl].filter(Boolean);

        if (imageUrlsToDownload.length > 0) {
          const downloadedImages = [];

          for (let i = 0; i < imageUrlsToDownload.length; i++) {
            const imageUrl = imageUrlsToDownload[i];
            const imageName =
              i === 0 ? 'og-image.png' : `og-image-${i + 1}.png`;
            const imagePath = path.join(appDir, imageName);

            console.log(
              `Downloading image ${i + 1}/${imageUrlsToDownload.length}: ${imageUrl}`,
            );

            const isValidImage = await downloadImage(imageUrl, imagePath);
            if (isValidImage) {
              downloadedImages.push(
                `/static/images/product/${productName}/${imageName}`,
              );
            }
          }

          if (downloadedImages.length > 0) {
            app.images = downloadedImages;
            console.log(
              `Successfully downloaded ${downloadedImages.length} image(s) for ${productName}`,
            );
          }
        }
      }

      if (
        highestResFaviconUrl &&
        (highestResFaviconUrl.endsWith('.jpg') ||
          highestResFaviconUrl.endsWith('.jpeg') ||
          highestResFaviconUrl.endsWith('.png') ||
          highestResFaviconUrl.endsWith('.webp') ||
          highestResFaviconUrl.endsWith('.ico')) &&
        !override?.logo
      ) {
        const logoPath = path.join(appDir, 'logo.png');
        const isValidImage = await downloadImage(
          highestResFaviconUrl,
          logoPath,
        );

        if (isValidImage) {
          if (highestResFaviconUrl.endsWith('.ico')) {
            const icoPath = path.join(appDir, 'logo.png');
            await fs.promises.rename(logoPath, icoPath); // Rename the downloaded file to .ico

            await sharp(icoPath).png().toFile(logoPath); // Convert .ico to .png

            await fs.promises.unlink(icoPath); // Remove the .ico file
          }

          app.logo = `/static/images/product/${productName}/logo.png`;
        }
      } else {
        // Check if logo already exists in the directory
        const existingLogoPath = path.join(appDir, 'logo.png');
        if (fs.existsSync(existingLogoPath)) {
          app.logo = `/static/images/product/${productName}/logo.png`;
          console.log(`Using existing logo for ${productName}`);
        }
      }
    } catch (error) {
      console.error(`Failed to fetch assets for ${app.name}:`, error.message);

      // Check if logo already exists in the directory
      const existingLogoPath = path.join(appDir, 'logo.png');
      if (fs.existsSync(existingLogoPath)) {
        app.logo = `/static/images/product/${productName}/logo.png`;
        console.log(`Using existing logo for ${productName}`);
      }
    }
  }
}

async function main() {
  const apps = await parseReadme();

  const fetchPromises = apps.map(async (app) => {
    const startTime = Date.now();
    try {
      await fetchAssets(app);
      await generateMDXContent(app);
    } catch (error) {
      console.error(
        `💥 Could not generate markdown for ${app.name}:`,
        error.message,
      );
    }
    const endTime = Date.now();
    const duration = (endTime - startTime) / 1000;
    if (duration > 2) {
      console.warn(
        `\x1b[33m⚠️  Warning: Processing ${app.name} took ${duration.toFixed(
          2,
        )} seconds\x1b[0m`,
      );
    }
  });

  await Promise.allSettled(fetchPromises);
}

main();
