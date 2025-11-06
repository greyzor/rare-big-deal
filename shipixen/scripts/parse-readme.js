const { readmePath } = require('./settings');
const fs = require('fs');

const skipProductNames = [];

async function parseReadme() {
  const readmeContent = fs.readFileSync(readmePath, 'utf-8');
  const lines = readmeContent.split('\n');

  let currentCategory = '';
  let currentSubcategory = '';
  const appMap = {};
  const apps = [];

  for (const line of lines) {
    if (line.startsWith('## ')) {
      currentCategory = line.replace('## ', '').trim();
    } else if (line.startsWith('### ')) {
      currentSubcategory = line.replace('### ', '').trim();
    } else if (line.startsWith('|')) {
      const parts = line.split('|').map((part) => part.trim());
      if (parts.length >= 5 && parts[2].startsWith('[')) {
        const name = parts[2].match(/\[(.*?)\]/)[1];
        const website = parts[2].match(/\((.*?)\)/)[1];
        const description = parts[3];
        const deal = parts[4];
        const expiresOnDate = parts[5] || '';

        if (skipProductNames.includes(name)) {
          continue;
        }

        if (!appMap[name]) {
          appMap[name] = {
            name,
            website,
            description,
            deal,
            expiresOnDate,
            categories: [],
            subcategories: [],
          };
          apps.push(appMap[name]);
        }

        if (
          currentCategory &&
          !appMap[name].categories.includes(currentCategory)
        ) {
          appMap[name].categories.push(currentCategory);
        }

        if (
          currentSubcategory &&
          !appMap[name].subcategories.includes(currentSubcategory)
        ) {
          appMap[name].subcategories.push(currentSubcategory);
        }
      }
    }
  }

  return apps;
}

module.exports = { parseReadme };
