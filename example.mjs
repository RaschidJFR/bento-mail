import {
  extractArticlesFromNewsletter,
  extractWebArticleFullText,
  generateArticleSummaries,
} from './lib/ai-article-extractor.mjs';
import { downloadHtml } from './lib/html-downloader.mjs';
import { mkdir, writeFile, readFile, readdir } from 'node:fs/promises';
import { join, extname, dirname, basename } from 'node:path';

const RESULTS_DIR = 'results';

/**
 * Sanitizes a filename by removing invalid characters
 * @param {string} filename - The filename to sanitize
 * @returns {string} Sanitized filename
 */
function sanitizeFilename(filename) {
  return filename
    .replace(/[<>:"/\\|?*]/g, '-')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .substring(0, 100); // Limit length to 100 characters
}

/**
 * Reads an HTML newsletter file and extracts articles using AI
 * @param {string} htmlFilePath - Path to the HTML file
 * @returns {Promise<Array>} Array of extracted articles
 */
async function processNewsletterFile(htmlFilePath) {
  try {
    const htmlContent = await readFile(htmlFilePath, 'utf-8');
    const articles = await extractArticlesFromNewsletter(htmlContent);
    return articles;
  } catch (error) {
    console.error('Error processing newsletter file:', error);
    throw error;
  }
}

/**
 * Downloads a single article and saves it to a file
 * @param {Object} article - Article object with header and url
 * @param {string} downloadDir - Directory to save the article
 * @returns {Promise<Object>} Download result object
 */
async function downloadArticle(article, downloadDir = `${RESULTS_DIR}/downloads`) {
  try {
    // Download HTML content
    const htmlContent = await downloadHtml(article.url, {
      timeout: 15000,
      headers: {
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
    });

    // Create filename from article header
    const sanitizedTitle = sanitizeFilename(article.header);
    const filename = `${sanitizedTitle}.html`;
    const filepath = join(downloadDir, filename);

    // Save to file
    await mkdir(downloadDir, { recursive: true });
    await writeFile(filepath, htmlContent, 'utf-8');

    const result = {
      title: article.header,
      url: article.url,
      filename,
      filepath,
      status: 'success',
      size: htmlContent.length,
    };

    return result;
  } catch (error) {
    const result = {
      title: article.header,
      url: article.url,
      status: 'error',
      error: error.message,
    };

    return result;
  }
}

/**
 * Downloads articles and saves them locally
 * @param {Array} articles - Array of article objects with url property
 * @param {string} downloadDir - Directory to save downloaded articles (default: 'downloads')
 * @returns {Promise<Array>} Array of download results
 */
async function downloadArticles(articles, downloadDir = `${RESULTS_DIR}/downloads`) {
  try {
    // Filter articles that have URLs
    const articlesWithUrls = articles.filter((article) => article.url);
    console.log(`${articlesWithUrls.length} articles have URLs to download`);

    if (articlesWithUrls.length === 0) {
      console.log('No articles with URLs found to download');
      return [];
    }

    // Create downloads directory if it doesn't exist
    await mkdir(downloadDir, { recursive: true });

    const downloadResults = [];

    // Download each article
    for (let i = 0; i < articlesWithUrls.length; i++) {
      const article = articlesWithUrls[i];

      console.log(`\nDownloading article ${i + 1}/${articlesWithUrls.length}: ${article.header}`);
      console.log(`URL: ${article.url}`);

      const result = await downloadArticle(article, downloadDir);
      downloadResults.push(result);

      if (result.status === 'success') {
        console.log(`✓ Saved: ${result.filename} (${result.size} bytes)`);
      } else {
        console.error(`✗ Failed to download: ${result.error}`);
      }

      // Add small delay to be respectful to servers
      if (i < articlesWithUrls.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
    }

    // Summary
    const successful = downloadResults.filter((r) => r.status === 'success').length;
    const failed = downloadResults.filter((r) => r.status === 'error').length;

    console.log(`\n=== Download Summary ===`);
    console.log(`Successful: ${successful}`);
    console.log(`Failed: ${failed}`);
    console.log(`Total: ${downloadResults.length}`);

    // Save download report
    const reportPath = join(downloadDir, 'download-report.json');
    await writeFile(reportPath, JSON.stringify(downloadResults, null, 2), 'utf-8');
    console.log(`\nDownload report saved to: ${reportPath}`);

    return downloadResults;
  } catch (error) {
    console.error('Error downloading articles:', error);
    throw error;
  }
}

async function processNewsletter(inputFilePath) {
  try {
    const fileExtension = extname(inputFilePath).toLowerCase();
    let articlesJsonPath = '';
    let downloadDir = '';

    if (fileExtension === '.html') {
      const filenameWithoutExt = basename(inputFilePath, '.html');
      downloadDir = join(RESULTS_DIR, filenameWithoutExt);
      await mkdir(downloadDir, { recursive: true });

      // Extract articles from the newsletter
      console.log(`Processing newsletter file: ${inputFilePath}`);
      const articles = await processNewsletterFile(inputFilePath);
      console.log(`Found ${articles.length} articles`);

      // Save articles to JSON for reference
      articlesJsonPath = `${downloadDir}/extracted-articles.json`;
      await writeFile(articlesJsonPath, JSON.stringify(articles, null, 2), 'utf-8');
      console.log(`Extracted articles saved to: ${articlesJsonPath}`);
    } else if (fileExtension === '.json') {
      articlesJsonPath = inputFilePath;
      downloadDir = dirname(articlesJsonPath);
    } else {
      throw new Error(`Unsupported file type: ${fileExtension}. Please provide a .json or .html file.`);
    }

    // Load articles from JSON file
    console.log(`Loading articles from JSON file: "${articlesJsonPath}"`);
    const jsonContent = await readFile(articlesJsonPath, 'utf-8');
    const articles = JSON.parse(jsonContent);
    console.log(`Loaded ${articles.length} articles from JSON`);

    // Download articles
    const downloadResults = await downloadArticles(articles, `${downloadDir}/downloads`);

    // Process html files to extract article content
    const extractedArticles = [];
    const extractedPath = join(downloadDir, 'processed-articles.json');
    for (let i = 0; i < downloadResults.length; i++) {
      // Skip failed downloads
      if (downloadResults[i].status !== 'success') continue;

      const file = downloadResults[i];
      const article = articles.find((a) => a.url === file.url) || {};
      try {
        console.log(`Processing article content...`);
        console.log(file.filepath);
        const htmlContent = await readFile(file.filepath, 'utf-8');
        const webArticle = await extractWebArticleFullText(htmlContent, file.url);

        // Generate summaries from the full text
        console.log(`Generating article summaries...`);
        const summaries = await generateArticleSummaries(webArticle.fullText);

        // Merge the summaries with the web article data
        const enrichedArticle = {
          ...webArticle,
          ...summaries,
          coverImg: article.coverImg || webArticle.coverImg || '',
          originalHeader: article.header || '',
          originalAbstract: article.summary || '',
        };

        extractedArticles.push(enrichedArticle);
        console.log(`✓ Extracted article data with summaries`);
      } catch (extractError) {
        console.error(`✗ Failed to extract article data: ${extractError.message}`);
      }

      // Save extracted articles at every iteration
      await writeFile(extractedPath, JSON.stringify(extractedArticles, null, 2), 'utf-8');
      console.log(`\nExtracted articles saved to: ${extractedPath}\n`);
    }

    // Add articles left out (failed downloads) to the json save
    const missingArticles = downloadResults
      .filter((r) => !extractedArticles.find((a) => a.url === r.url))
      .map((a) => ({
        originalHeader: a.title,
        originalAbstract: a.fullText,
        sourceName: a.sourceName,
      }));

    console.log(`Adding ${missingArticles.length} articles that were not downloaded to the final JSON`);
    extractedArticles.push(...missingArticles);
    await writeFile(extractedPath, JSON.stringify(extractedArticles, null, 2), 'utf-8');
    console.log(`\nFinal extracted articles saved to: ${extractedPath}\n`);
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

/**
 * Processes all HTML newsletter files in a folder
 * @param {string} folderPath - Path to the folder containing HTML files
 * @param {string} baseOutputDir - Base directory for outputs (default: 'results')
 * @returns {Promise<Array>} Array of processing results
 */
async function processNewsletterFolder(folderPath = 'samples', baseOutputDir = RESULTS_DIR) {
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
