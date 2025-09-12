import { processNewsletterHtml } from './lib/newsletter-processor.mjs';
import { mkdir, writeFile, readFile, readdir } from 'node:fs/promises';
import { join, extname, basename } from 'node:path';

const RESULTS_DIR = 'results';

async function processNewsletter(inputFilePath) {
  try {
    const fileExtension = extname(inputFilePath).toLowerCase();

    if (fileExtension !== '.html') {
      throw new Error(`Unsupported file type: ${fileExtension}. Please provide a .html file.`);
    }

    const filenameWithoutExt = basename(inputFilePath, '.html');
    const downloadDir = join(RESULTS_DIR, filenameWithoutExt);
    await mkdir(downloadDir, { recursive: true });

    // Read newsletter HTML content
    console.log(`Processing newsletter file: ${inputFilePath}`);
    const htmlContent = await readFile(inputFilePath, 'utf-8');

    // Process newsletter using the new module
    const extractedArticles = await processNewsletterHtml(htmlContent, {
      concurrency: 3,
      timeout: 15000,
      delay: 500,
    });

    console.log(`Processed ${extractedArticles.length} articles`);

    // Save extracted articles
    const extractedPath = join(downloadDir, 'processed-articles.json');
    await writeFile(extractedPath, JSON.stringify(extractedArticles, null, 2), 'utf-8');
    console.log(`\nExtracted articles saved to: ${extractedPath}\n`);
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

/**
 * Processes all HTML newsletter files in a folder
 * @param {string} folderPath - Path to the folder containing HTML files
 * @returns {Promise<Array>} Array of processing results
 */
async function processNewsletterFolder(folderPath = 'samples') {
  try {
    console.log(`Processing all HTML files in folder: ${folderPath}`);

    // Read directory contents
    const files = await readdir(folderPath);

    // Filter for HTML files
    const htmlFiles = files.filter((file) => extname(file).toLowerCase() === '.html');

    if (htmlFiles.length === 0) {
      console.log('No HTML files found in the specified folder');
      return [];
    }

    console.log(`Found ${htmlFiles.length} HTML files to process\n`);

    // Process each HTML file
    for (let i = 0; i < htmlFiles.length; i++) {
      const htmlFile = htmlFiles[i];
      const htmlFilePath = join(folderPath, htmlFile);

      console.log(`\n=== Processing file ${i + 1}/${htmlFiles.length}: ${htmlFile} ===`);

      try {
        await processNewsletter(htmlFilePath);
      } catch (error) {
        console.error(`✗ Failed to process newsletter ${htmlFile}: ${error.message}`);
      }
    }
  } catch (error) {
    console.error('Error processing newsletter folder:', error);
    throw error;
  }
}

// run in cli mode
if (import.meta.url === `file://${process.argv[1]}`) {
  await processNewsletterFolder();
}
