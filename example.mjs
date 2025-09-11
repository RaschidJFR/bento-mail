import { processNewsletterFile } from './lib/ai-html-extractor.mjs';
import { downloadHtml } from './lib/html-downloader.mjs';
import { mkdir, writeFile, readFile } from 'fs/promises';
import { join, extname } from 'path';

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
 * Downloads a single article and saves it to a file
 * @param {Object} article - Article object with header and url
 * @param {string} downloadDir - Directory to save the article
 * @returns {Promise<Object>} Download result object
 */
export async function downloadArticle(article, downloadDir) {
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
export async function downloadArticles(articles, downloadDir = 'results/downloads') {
  try {
    // Filter articles that have URLs
    const articlesWithUrls = articles.filter((article) => article.url);
    console.log(`${articlesWithUrls.length} articles have URLs to download`);

    if (articlesWithUrls.length === 0) {
      console.log('No articles with URLs found to download');
      return [];
    }

    // Create downloads directory if it doesn't exist
    downloadDir = articlesWithUrls[0].sourceName
      ? `${downloadDir}/${sanitizeFilename(articlesWithUrls[0].sourceName)}`
      : downloadDir;
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
        await new Promise((resolve) => setTimeout(resolve, 1000));
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

// CLI usage
if (import.meta.url === `file://${process.argv[1]}`) {
  const inputFilePath = process.argv[2] || 'results/articles.json';
  const downloadDir = process.argv[3] || 'results/downloads';

  if (!inputFilePath) {
    console.error('Usage: node article-downloader.mjs <input-file-path> [download-directory]');
    console.error('Example: node article-downloader.mjs samples/newsletter.html downloads');
    console.error('Example: node article-downloader.mjs samples/articles.json downloads');
    process.exit(1);
  }

  try {
    const fileExtension = extname(inputFilePath).toLowerCase();
    let articles;

    if (fileExtension === '.json') {
      console.log(`Loading articles from JSON file: ${inputFilePath}`);
      const jsonContent = await readFile(inputFilePath, 'utf-8');
      articles = JSON.parse(jsonContent);
      console.log(`Loaded ${articles.length} articles from JSON`);
    } else if (fileExtension === '.html') {
      console.log(`Processing newsletter file: ${inputFilePath}`);
      // Extract articles from the newsletter
      articles = await processNewsletterFile(inputFilePath);
      console.log(`Found ${articles.length} articles`);
    } else {
      throw new Error(`Unsupported file type: ${fileExtension}. Please provide a .json or .html file.`);
    }

    await downloadArticles(articles, downloadDir);
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}
