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
  console.log('\n[Parse App Info] 🚀 Starting app processing...');
  const mainStartTime = Date.now();

  const apps = await parseReadme();

  console.log(`[Parse App Info] 📦 Processing ${apps.length} apps...\n`);

  const fetchPromises = apps.map(async (app, index) => {
    const startTime = Date.now();

    console.log(`[Parse App Info] [${index + 1}/${apps.length}] 🔄 Processing: ${app.name}`);

    try {
      await fetchAssets(app);
      await generateMDXContent(app);

      const elapsed = Date.now() - startTime;
      console.log(`[Parse App Info] [${index + 1}/${apps.length}] ✅ Completed: ${app.name} (${elapsed}ms)`);
    } catch (error) {
      console.error(
        `[Parse App Info] [${index + 1}/${apps.length}] ❌ Failed to generate markdown for ${app.name}:`,
        error.message,
      );
    }

    const duration = (Date.now() - startTime) / 1000;

    if (duration > 2) {
      console.warn(
        `[Parse App Info] ⚠️  Warning: Processing ${app.name} took ${duration.toFixed(2)} seconds`,
      );
    }
  });

  const results = await Promise.allSettled(fetchPromises);

  const succeeded = results.filter(r => r.status === 'fulfilled').length;
  const failed = results.filter(r => r.status === 'rejected').length;
  const totalElapsed = Date.now() - mainStartTime;
  
  console.log(`\n[Parse App Info] ========================================`);
  console.log(`[Parse App Info] 📊 Summary:`);
  console.log(`[Parse App Info]   📄 Total apps: ${apps.length}`);
  console.log(`[Parse App Info]   ✅ Succeeded: ${succeeded}`);
  console.log(`[Parse App Info]   ❌ Failed: ${failed}`);
  console.log(`[Parse App Info]   ⏱️  Total time: ${(totalElapsed / 1000).toFixed(2)}s`);
  console.log(`[Parse App Info] ========================================\n`);
}

main();
