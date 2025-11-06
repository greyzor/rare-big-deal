const path = require('path');
const { execSync } = require('child_process');
const { generateMDXContent } = require('./generate-mdx-content');
const { parseReadme } = require('./parse-readme');
const { fetchAssets } = require('./asset-fetcher');

// Generate pick index before processing apps
const generateIndexScript = path.join(__dirname, 'generate-pick-index.js');
execSync(`node ${generateIndexScript}`, { stdio: 'inherit' });

/**
 * Main function to process all apps from the README.
 * Fetches assets and generates MDX content for each app.
 */
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
