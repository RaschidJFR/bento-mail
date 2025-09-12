import { extractArticlesFromNewsletter, extractWebArticleFullText, generateArticleSummaries } from './lib/ai-article-extractor.mjs';
import { downloadHtml } from './lib/html-downloader.mjs';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { join, extname } from 'node:path';

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

    // Save to resuts directory
    await mkdir(RESULTS_DIR, { recursive: true });
    const outputFilePath = join(RESULTS_DIR, 'extracted-articles.json');
    await writeFile(outputFilePath, JSON.stringify(articles, null, 2), 'utf-8');
    console.log(`Extracted articles saved to: ${outputFilePath}`);
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

async function processAll(inputFilePath = 'samples/Wired Science.html', downloadDir = 'results') {
  try {
    const fileExtension = extname(inputFilePath).toLowerCase();
    let articlesJsonPath = '';

    if (fileExtension === '.html') {
      console.log(`Processing newsletter file: ${inputFilePath}`);
      // Extract articles from the newsletter
      const articles = await processNewsletterFile(inputFilePath);
      console.log(`Found ${articles.length} articles`);
      // Save articles to JSON for reference
      articlesJsonPath = `${RESULTS_DIR}/extracted-articles.json`;
      await mkdir('results', { recursive: true });
      await writeFile(articlesJsonPath, JSON.stringify(articles, null, 2), 'utf-8');
      console.log(`Extracted articles saved to: ${articlesJsonPath}`);
    } else if (fileExtension === '.json') {
      articlesJsonPath = inputFilePath;
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
    for (let i = 0; i < downloadResults.length; i++) {
      
      // Skip failed downloads
      if (downloadResults[i].status !== 'success') continue;

      const file = downloadResults[i];
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
          ...summaries
        };
        
        extractedArticles.push(enrichedArticle);
        console.log(`✓ Extracted article data with summaries`);
      } catch (extractError) {
        console.error(`✗ Failed to extract article data: ${extractError.message}`);
      }
    }

    // Save extracted articles
    const extractedPath = join(downloadDir, 'processed-articles.json');
    await writeFile(extractedPath, JSON.stringify(extractedArticles, null, 2), 'utf-8');
    console.log(`\nExtracted articles saved to: ${extractedPath}`);
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

// run in cli mode
if (import.meta.url === `file://${process.argv[1]}`) {
  await processAll();
}