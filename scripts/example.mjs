import { processNewsletterHtml } from '../src/lib/newsletter-processor.mjs';
import { mkdir, writeFile, readFile, readdir } from 'node:fs/promises';
import { join, extname, basename } from 'node:path';

const RESULTS_DIR = 'results';

async function processNewsletter(input, maxArticles = null) {
  try {
    let htmlContent;
    let filenameWithoutExt;
    
    // Check if input is a URL or file path
    if (input.startsWith('http://') || input.startsWith('https://')) {
      console.log(`Processing newsletter from URL: ${input}`);
      
      // Extract a filename from URL for directory naming
      const url = new URL(input);
      filenameWithoutExt = url.hostname.replace(/\./g, '-');
      
      // Process URL directly with processNewsletterHtml
      htmlContent = input;
    } else {
      const fileExtension = extname(input).toLowerCase();

      if (fileExtension !== '.html') {
        throw new Error(`Unsupported file type: ${fileExtension}. Please provide a .html file or URL.`);
      }

      filenameWithoutExt = basename(input, '.html');
      
      // Read newsletter HTML content from file
      console.log(`Processing newsletter file: ${input}`);
      htmlContent = await readFile(input, 'utf-8');
    }

    const downloadDir = join(RESULTS_DIR, filenameWithoutExt);
    await mkdir(downloadDir, { recursive: true });

    // Process newsletter using the new module
    const extractedArticles = await processNewsletterHtml(htmlContent, {
      concurrency: 3,
      timeout: 15000,
      delay: 500,
      maxArticles,
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
  const url = process.argv[2];
  const max = parseInt(process.argv[3]) || 5;
  if (url) {
    await processNewsletter(url, max);
  } else {
    await processNewsletterFolder();
  }
}
