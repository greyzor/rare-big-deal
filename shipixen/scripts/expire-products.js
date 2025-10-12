const fs = require('fs');
const path = require('path');

// Get tomorrow's date in YYYY-MM-DD format
function getTomorrowDate() {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  return tomorrow.toISOString().split('T')[0];
}

// Parse and update frontmatter
function updateFrontmatter(content, expirationDate) {
  const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);

  if (!frontmatterMatch) {
    console.log('No frontmatter found');
    return content;
  }

  const frontmatter = frontmatterMatch[1];
  const restOfContent = content.slice(frontmatterMatch[0].length);

  // Check if expiresOnDate already exists
  const expiresOnDateMatch = frontmatter.match(/^expiresOnDate:.*$/m);

  let updatedFrontmatter;
  if (expiresOnDateMatch) {
    // Replace existing expiresOnDate
    updatedFrontmatter = frontmatter.replace(
      /^expiresOnDate:.*$/m,
      `expiresOnDate: ${expirationDate}`
    );
  } else {
    // Add expiresOnDate after leaderboardPosition if it exists, otherwise at the end
    const leaderboardMatch = frontmatter.match(/^leaderboardPosition:.*$/m);
    if (leaderboardMatch) {
      updatedFrontmatter = frontmatter.replace(
        /^(leaderboardPosition:.*$)/m,
        `$1\nexpiresOnDate: ${expirationDate}`
      );
    } else {
      // Add at the end of frontmatter
      updatedFrontmatter = frontmatter + `\nexpiresOnDate: ${expirationDate}`;
    }
  }

  return `---\n${updatedFrontmatter}\n---${restOfContent}`;
}

// Main function
function expireProducts() {
  const productsDir = path.join(__dirname, '../data/products');
  const tomorrowDate = getTomorrowDate();

  console.log(`Setting expiration date to: ${tomorrowDate}`);
  console.log(`Processing products in: ${productsDir}\n`);

  // Read all files in the products directory
  const files = fs.readdirSync(productsDir);
  const mdxFiles = files.filter(file => file.endsWith('.mdx'));

  let successCount = 0;
  let errorCount = 0;

  mdxFiles.forEach(file => {
    const filePath = path.join(productsDir, file);

    try {
      // Read the file
      const content = fs.readFileSync(filePath, 'utf8');

      // Update the frontmatter
      const updatedContent = updateFrontmatter(content, tomorrowDate);

      // Write back to the file
      fs.writeFileSync(filePath, updatedContent, 'utf8');

      console.log(`✓ Updated: ${file}`);
      successCount++;
    } catch (error) {
      console.error(`✗ Error processing ${file}:`, error.message);
      errorCount++;
    }
  });

  console.log(`\n========================================`);
  console.log(`Summary:`);
  console.log(`  Total files: ${mdxFiles.length}`);
  console.log(`  Successfully updated: ${successCount}`);
  console.log(`  Errors: ${errorCount}`);
  console.log(`========================================`);
}

// Run the script
expireProducts();

