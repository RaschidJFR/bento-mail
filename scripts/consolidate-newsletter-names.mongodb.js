/**
 * Canonize / Normalize Newsletter Names
 * 
 * OVERVIEW:
 * Consolidates variant, legacy, or inconsistent newsletter names into canonical
 * names across both the `newsletters` collection (`name` field) and `articles`
 * collection (`sourceName` field).
 * 
 * HOW TO USE:
 * 1. Target Database: Set `use('development')` or `use('production')` depending on
 *    your target environment.
 * 2. Previewing Changes (Recommended): Set `DRY_RUN = true` to preview which names 
 *    will be updated without writing changes to MongoDB.
 * 3. Applying Changes: Set `DRY_RUN = false` and execute the script in mongosh or
 *    the VS Code MongoDB Playground.
 * 4. Adding Mappings: Add new canonical names and their aliases to `NAME_ALIASES`:
 *    ```js
 *    'Canonical Name': ['alias 1', 'alias 2']
 *    ```
 */

use('development');

// Safety toggle: true = dry run preview; false = execute updates
const DRY_RUN = true;

// Canonical newsletter names and their known aliases
const NAME_ALIASES = {
  // This is the actual name of the newsletter, and the array contains all known aliases or variants of that name.
  'Desired Newsletter Name': [
    'alias 1 here', // This is an alias that we want to consolidate into the canonical name.
    'alias 2 here',
  ],
  // add more canonical names and their aliases as needed
};

// Flatten NAME_ALIASES into lookup map: { 'old name': 'Canonical Name' }
const NAME_REMAP = Object.entries(NAME_ALIASES).reduce((acc, [canonicalName, aliases]) => {
  aliases.forEach((alias) => {
    if (alias !== canonicalName) {
      acc[alias] = canonicalName;
    }
  });
  return acc;
}, {});

const newsletters = db.getCollection('newsletters');
const articles = db.getCollection('articles');

const existingNames = newsletters
  .distinct('name', {
    name: { $type: 'string', $ne: '' },
  })
  .sort((a, b) => a.localeCompare(b));

const plannedUpdates = existingNames
  .filter((name) => Object.prototype.hasOwnProperty.call(NAME_REMAP, name))
  .map((oldName) => ({ oldName, newName: NAME_REMAP[oldName] }));

print(`Found ${existingNames.length} distinct newsletter name(s).`);
print(`Will update ${plannedUpdates.length} name(s):`);
plannedUpdates.forEach(({ oldName, newName }) => print(`- ${oldName} -> ${newName}`));

if (DRY_RUN) {
  print('\nDRY_RUN is enabled; no documents were updated. Set DRY_RUN = false to apply the changes.');
} else {
  let updatedNewsletterDocs = 0;
  let updatedArticleDocs = 0;

  for (const { oldName, newName } of plannedUpdates) {
    const newsletterResult = newsletters.updateMany(
      { name: oldName },
      { $set: { name: newName } }
    );
    updatedNewsletterDocs += newsletterResult.modifiedCount || 0;

    const articleResult = articles.updateMany(
      { sourceName: oldName },
      { $set: { sourceName: newName } }
    );
    updatedArticleDocs += articleResult.modifiedCount || 0;
  }

  print(`\nUpdated ${updatedNewsletterDocs} newsletter document(s).`);
  print(`Updated ${updatedArticleDocs} article document(s).`);

  const updatedNames = newsletters
    .distinct('name', {
      name: { $type: 'string', $ne: '' },
    })
    .sort((a, b) => a.localeCompare(b));

  print('\nCurrent distinct newsletter names:');
  updatedNames.forEach((name) => print(name));
}
