import {
  extractArticlesFromNewsletter,
  extractArticleDetails,
} from './ai-article-analyzer.ts';
import { fetchHtmlContent } from './utils.mjs';

/**
 * Downloads and processes a single article
 * @param {Object} article - Article object with header and url
 * @param {Object} options - Options for download and processing
 * @returns {Promise<Object>} Processed article or null if failed
 */
export async function processArticle(article, options = {}) {
  const { timeout = 15000 } = options;

  try {
    console.log(`Processing: ${article.header || article.url}`);

    // Download HTML content
    const htmlContent = await fetchHtmlContent(article.url, {
      timeout,
      headers: {
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
    });

    // Extract article content with summaries included
    const webArticle = await extractArticleDetails(htmlContent);

    // Merge the web article data with original article data
    const enrichedArticle = {
      ...webArticle,
      coverImg: article.coverImg || webArticle.coverImg || '',
      oneliner: webArticle.summaries?.oneliner || article.header || '',
      overview: webArticle.summaries?.overview || '',
      details: webArticle.summaries?.details || '',
      url: article.url || '',
      sourceName: article.sourceName || '',
    };

    console.log(`✓ Completed: ${article.header || article.url}`);
    return enrichedArticle;
  } catch (error) {
    console.log(`✗ Failed: ${article.header || article.url} - ${error.message}`);
    // Return minimal article data for failed processing
    return {
      coverImg: article.coverImg || '',
      oneliner: article.header || '',
      url: article.url || '',
      sourceName: article.sourceName || '',
      error: error.message,
    };
  }
}

/**
 * Processes articles in parallel with controlled concurrency
 * @param {Array} articles - Array of article objects
 * @param {Object} options - Processing options
 * @returns {Promise<Array>} Array of processed articles
 */
async function processArticlesInParallel(articles, options = {}) {
  const { concurrency = 3, delay = 500, maxArticles } = options;

  let articlesWithUrls = articles.filter((article) => article.url);
  
  // Limit articles if maxArticles is specified
  if (maxArticles && maxArticles > 0) {
    articlesWithUrls = articlesWithUrls.slice(0, maxArticles);
    console.log(`Limited to processing first ${maxArticles} articles`);
  }

  if (articlesWithUrls.length === 0) {
    console.log('No articles with URLs to process');
    return [];
  }

  console.log(`Processing ${articlesWithUrls.length} articles with concurrency: ${concurrency}`);
  const processedArticles = [];

  // Process articles in batches to control concurrency
  for (let i = 0; i < articlesWithUrls.length; i += concurrency) {
    const batch = articlesWithUrls.slice(i, i + concurrency);

    console.log(
      `Processing batch ${Math.floor(i / concurrency) + 1}/${Math.ceil(articlesWithUrls.length / concurrency)} (${
        batch.length
      } articles)`
    );

    // Process batch in parallel
    const batchPromises = batch.map((article) => processArticle(article, options));
    const batchResults = await Promise.allSettled(batchPromises);

    // Extract successful results
    const batchArticles = batchResults
      .filter((result) => result.status === 'fulfilled' && result.value)
      .map((result) => result.value);

    processedArticles.push(...batchArticles);

    // Add delay between batches to be respectful to servers
    if (i + concurrency < articlesWithUrls.length && delay > 0) {
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  // Add articles without URLs as basic entries
  const articlesWithoutUrls = articles
    .filter((article) => !article.url)
    .map((article) => ({
      coverImg: article.coverImg || '',
      oneliner: article.header || '',
      url: '',
      sourceName: article.sourceName || '',
    }));

  if (articlesWithoutUrls.length > 0) {
    console.log(`Added ${articlesWithoutUrls.length} articles without URLs`);
  }

  const successful = processedArticles.filter((a) => !a.error).length;
  const failed = processedArticles.filter((a) => a.error).length;
  console.log(`Processing complete: ${successful} successful, ${failed} failed`);

  return [...processedArticles, ...articlesWithoutUrls];
}

/**
 * Main function to process newsletter HTML and return extracted articles
 * @param {string} input - Either HTML content of the newsletter or a URL to fetch it from
 * @param {Object} options - Processing options
 * @returns {Promise<Array>} Array of extracted and processed articles
 */
export async function processNewsletterHtml(input, options = {}) {
  const { concurrency = 3, timeout = 15000, delay = 500, retries = 2, maxArticles } = options;

  try {
    let newsletterHtml;

    // Check if input is a URL or HTML content
    if (input.startsWith('http://') || input.startsWith('https://')) {
      console.log(`Fetching newsletter from URL: ${input}`);
      newsletterHtml = await fetchHtmlContent(input, { timeout });
    } else {
      newsletterHtml = input;
    }

    console.log('Extracting articles from newsletter...');
    // Extract articles from the newsletter HTML
    const articles = await extractArticlesFromNewsletter(newsletterHtml);

    if (articles.length === 0) {
      console.log('No articles found in newsletter');
      return [];
    }

    console.log(`Found ${articles.length} articles to process`);

    // Process articles in parallel
    const processedArticles = await processArticlesInParallel(articles, {
      concurrency,
      timeout,
      delay,
      retries,
      maxArticles,
    });

    console.log(`Newsletter processing complete: ${processedArticles.length} total articles`);
    return processedArticles;
  } catch (error) {
    console.error(`Newsletter processing failed: ${error.message}`);
    throw new Error(`Failed to process newsletter: ${error.message}`);
  }
}
