const {
  applyCategoryOverrides,
  applyMetaOverrides,
} = require('./apply-overrides');
const { sanitizeName } = require('./sanitize-name');
const { markdownDir } = require('./settings');
const fs = require('fs');
const path = require('path');
const { getLeaderboardPosition } = require('./leaderboard-utils');
const { getProductDates } = require('./product-dates-utils');

async function generateMDXContent(app) {
  const tags = applyCategoryOverrides(
    app.categories,
    app.subcategories,
    sanitizeName(app.name),
  );
  const {
    description,
    metaDescription,
    metaTitle,
    website,
    deal,
    expiresOnDate,
  } = applyMetaOverrides(sanitizeName(app.name), app);

  let mdxContent = `---
title: >
  ${app.name?.trim()}
date: ${new Date().toISOString().split('T')[0]}
tags:
${tags.map((tag) => `  - ${tag}`).join('\n')}
`;

  if (app.images && app.images.length > 0) {
    mdxContent += `images:\n`;
    app.images.forEach((image) => {
      mdxContent += `  - ${image}\n`;
    });
  }

  if (app.logo) {
    mdxContent += `logo: ${app.logo}
`;
  }

  mdxContent += `summary: >
  ${description?.trim()}
categories:
${(app.categories || []).map((category) => `  - ${category}`).join('\n')}
subcategories:
${(app.subcategories || [])
  .map((subcategory) => `  - ${subcategory}`)
  .join('\n')}
deal: >
  ${deal?.trim()}
website: ${website}
${expiresOnDate ? `expiresOnDate: ${expiresOnDate}` : ''}
layout: ProductLayout
`;

  const leaderboardPosition = getLeaderboardPosition(sanitizeName(app.name));
  if (leaderboardPosition !== null) {
    mdxContent += `leaderboardPosition: ${leaderboardPosition}
`;
  }

  const productDates = getProductDates(sanitizeName(app.name));
  if (productDates) {
    if (productDates.expiresOnDate) {
      mdxContent += `expiresOnDate: ${productDates.expiresOnDate}
`;
    }
    if (productDates.validFromDate) {
      mdxContent += `validFromDate: ${productDates.validFromDate}
`;
    }
  }

  if (metaDescription) {
    // Properly indent each line of metaDescription
    const formattedMetaDescription = metaDescription
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => `  ${line}`)
      .join('\n');

    mdxContent += `metaDescription: >
${formattedMetaDescription}
`;
  }

  if (metaTitle) {
    // Properly indent metaTitle
    const formattedMetaTitle = metaTitle
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => `  ${line}`)
      .join('\n');

    mdxContent += `metaTitle: >
${formattedMetaTitle}
`;
  }

  mdxContent += `---
${description}

## Rare Deal

<div className="deal-paragraph not-prose">
${deal}
</div>
${app.expires ? `\n<ExpirationDate date="${app.expires}" />\n` : ''}`;
  if (metaTitle || metaDescription) {
    // Format the content section differently from frontmatter
    const formattedContentMetaTitle = (metaTitle || '').trim();
    const formattedContentMetaDescription = (metaDescription || '').trim();

    mdxContent += `
## Product Details

${formattedContentMetaTitle}

${formattedContentMetaDescription}
`;
  }

  const markdownOutputPath = path.join(
    markdownDir,
    `${sanitizeName(app.name)}.mdx`,
  );
  fs.writeFileSync(markdownOutputPath, mdxContent);
}

module.exports = { generateMDXContent };
