import { chromium } from 'playwright';
import { openai } from '@ai-sdk/openai';
import LLMScraper from 'llm-scraper';

/**
 * Scrapes a webpage for newsletter articles using a headless browser and AI
 * @param {string} url - The URL of the webpage to scrape
 * @returns {Promise<Array>} Array of article objects
 */
export async function scrapeWebpageForArticles(url) {
  const prompt = `
Analyze the web content and extract all newsletter articles. For each article, identify:

1. **header**: The main title/headline of the article
2. **url**: Any external links to the full article (look for markdown link syntax [text](url))
3. **coverImg**: URLs to article cover images (look for markdown image syntax ![alt](url))
4. **fullText**: Extract the article's full text or abstract based on available content
5. **sourceName**: The newsletter name (look for branding/header information)

Rules:
- Only extract actual articles, not advertisements or footer content
- If no external URL is found, omit the url field
- If no cover image is found, omit the coverImg field
- Create meaningful summaries based on available content
`;

  // Launch a browser instance
  const browser = await chromium.launch();

  // Initialize LLM provider
  const llm = openai.chat('gpt-5');

  // Create a new LLMScraper
  const scraper = new LLMScraper(llm);

  // Open new page
  const page = await browser.newPage();
  await page.goto(url);

  // Run the scraper
  const { data } = await scraper.run(page, ArticleListSchema, {
    prompt,
    format: 'html',
  });

  await page.close();
  await browser.close();

  return data;
}