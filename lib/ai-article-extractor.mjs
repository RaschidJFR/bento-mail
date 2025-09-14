import { ChatOpenAI } from '@langchain/openai';
import { HumanMessage } from '@langchain/core/messages';
import { z } from 'zod';
import { htmlToMarkdown } from './utils.mjs';
import { chromium } from 'playwright';
import { openai } from '@ai-sdk/openai';
import LLMScraper from 'llm-scraper';
import 'dotenv/config';

const model = new ChatOpenAI({
  modelName: 'gpt-5-mini',
  apiKey: process.env.OPENAI_API_KEY,
});

// Define the article schema
const BasicArticleSchema = z.object({
  header: z.string().describe('The title of the article. 100 characters max.'),
  url: z.string().describe('External link to the original article'),
  coverImg: z.string().optional().describe('URL to the cover image of the article.'),
  fullText: z.string().optional().describe('Abstract or full text of the article'),
  sourceName: z.string().describe('The name of the newsletter'),
});

const ArticleListSchema = z.object({
  articles: z.array(BasicArticleSchema),
});

// New schema for single article response
const ComplementaryArticleSchema = z.object({
  coverImg: z.string().optional().nullable().describe('URL to the cover image of the article. Null if not found.'),
  date: z.string().optional().nullable().describe('Date when the article was created (ISO format). Null if not found.'),
  fullText: z.string().describe('The full text content of the article'),
});

// New schema for article summaries
const ArticleSummariesSchema = z.object({
  oneliner: z.string().describe('The most accurate header/title for the article in one line'),
  overview: z.string().describe('Complete conclusion and key takeaways in less than 200 characters'),
  details: z
    .string()
    .describe('Supporting details and evidence that complement the overview in less than 500 characters'),
});

/**
 * Extracts newsletter articles from HTML content using AI
 * @param {string} newsletterHtml - The HTML content of the newsletter
 * @returns {Promise<Array>} Array of article objects
 */
export async function extractArticlesFromNewsletter(newsletterHtml) {
  // Check if API key is available
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY environment variable is required. Please set it in your .env file or environment.');
  }

  // Convert HTML to Markdown
  const markdownContent = htmlToMarkdown(newsletterHtml);

  const prompt = `
You are an expert at extracting structured information from newsletter Markdown content. 

Analyze the provided Markdown content and extract all newsletter articles. For each article, identify:

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

Markdown Content:

\`\`\`markdown
${markdownContent}
\`\`\`
`;

  try {
    const result = await model.withStructuredOutput(ArticleListSchema).invoke([new HumanMessage(prompt)]);

    // Convert date strings to Date objects where they exist
    const processedArticles = result.articles.map((article) => ({
      ...article,
      date: article.date ? new Date(article.date) : undefined,
    }));

    return processedArticles;
  } catch (error) {
    console.error('Error extracting newsletter articles:', error);
    error.stack && console.error(error.stack);
    throw new Error(`Failed to extract newsletter articles: ${error.message}`);
  }
}

/**
 * Extracts a single article from HTML content using AI
 * @param {string} htmlContent - The HTML content of a single article
 * @returns {Promise<Object>} Single article object
 */
export async function extractWebArticleFullText(htmlContent) {
  // Check if API key is available
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY environment variable is required. Please set it in your .env file or environment.');
  }

  // Convert HTML to Markdown
  const markdownContent = htmlToMarkdown(htmlContent);

  const prompt = `
You are an expert at extracting structured information from web article content. 

Analyze the provided Markdown content extracted from web article and extract the article information:

1. **coverImg**: Look for the main article image (markdown image syntax ![alt](url))
2. **date**: Extract the publication date if mentioned in the content (ISO format)
3. **fullText**: Extract the complete article text verbatim from the markdown. Ignore any ads, navigation, or unrelated content

Rules:
- Extract the fullText completely and accurately from the markdown

Markdown Content:

\`\`\`markdown
${markdownContent}
\`\`\`
`;

  try {
    const result = await model.withStructuredOutput(ComplementaryArticleSchema).invoke([new HumanMessage(prompt)]);

    // Process the single article
    const processedArticle = {
      ...result,
      date: result.date ? new Date(result.date) : undefined,
    };

    return processedArticle;
  } catch (error) {
    console.error('Error extracting article:', error);
    error.stack && console.error(error.stack);
    throw new Error(`Failed to extract article: ${error.message}`);
  }
}

/**
 * Generates three types of summaries from an article's full text using AI
 * @param {string} fullText - The complete article text
 * @returns {Promise<Object>} Object containing oneliner, overview, and details summaries
 * @deprecated Can we deprecate this function to extract the summaries directly in the extractWebArticleFullText function?
 */
export async function generateArticleSummaries(fullText) {
  // Check if API key is available
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY environment variable is required. Please set it in your .env file or environment.');
  }

  const prompt = `
You are an expert at creating concise and accurate article summaries. 

Analyze the provided article text and create three different summaries:

1. **oneliner**: Create the most accurate and compelling header/title for this article in less than 100 characters
2. **overview**: Write the most complete conclusion and key takeaways in less than 200 characters
3. **details**: Add supporting details and evidence that complement the overview summary in less than 500 characters

Rules:
- The oneliner should be more accurate than the original title if needed
- The overview must be under 200 characters and capture the essence
- The details summary must be under 500 characters and provide supporting context
- Focus on actionable insights and key facts
- Be precise and avoid fluff

Article Text:

\`\`\`
${fullText}
\`\`\`
`;

  try {
    const result = await model.withStructuredOutput(ArticleSummariesSchema).invoke([new HumanMessage(prompt)]);

    return result;
  } catch (error) {
    console.error('Error generating article summaries:', error);
    error.stack && console.error(error.stack);
    throw new Error(`Failed to generate article summaries: ${error.message}`);
  }
}

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
