import { ChatOpenAI } from '@langchain/openai';
import { HumanMessage } from '@langchain/core/messages';
import { z } from 'zod';
import { readFile } from 'fs/promises';
import 'dotenv/config';

const gpt = new ChatOpenAI({
  modelName: 'gpt-5-mini',
  // temperature: 0,
  apiKey: process.env.OPENAI_API_KEY,
});

// Define the article schema
const ArticleSchema = z.object({
  header: z.string().describe('The title of the article'),
  url: z.string().optional().describe('External link to the original article'),
  coverImg: z.string().optional().describe('URL to the cover image of the article'),
  // date: z.string().optional().describe('Date when the article was created (ISO format)'),
  // fullText: z.string().describe('The full text content of the article'),
  summary: z.string().describe('A summary of the article in under 300 characters'),
  sourceName: z.string().optional().describe('The name of the newsletter'),
});

const ArticlesArraySchema = z.object({
  articles: z.array(ArticleSchema),
});

/**
 * Extracts newsletter articles from HTML content using GPT
 * @param {string} htmlContent - The HTML content of the newsletter
 * @returns {Promise<Array>} Array of article objects
 */
export async function extractNewsletterArticles(htmlContent) {
  // Check if API key is available
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY environment variable is required. Please set it in your .env file or environment.');
  }

  const prompt = `
You are an expert at extracting structured information from newsletter HTML content. 

Analyze the provided HTML content and extract all newsletter articles. For each article, identify:

1. **header**: The main title/headline of the article
2. **url**: Any external links to the full article (look for href attributes and extract the whole uri between quotes)
3. **coverImg**: URLs to article cover images (look for img src attributes)
4. **summary**: Create a concise summary under 300 characters based on available content
5. **sourceName**: The newsletter name (look for branding/header information)

Rules:
- Only extract actual articles, not advertisements or footer content
- If no external URL is found, omit the url field
- If no cover image is found, omit the coverImg field
- Create meaningful summaries based on available content

HTML Content:

\`\`\`html
${htmlContent}
\`\`\`
`;

  try {
    const result = await gpt.withStructuredOutput(ArticlesArraySchema).invoke([new HumanMessage(prompt)]);

    // Convert date strings to Date objects where they exist
    const processedArticles = result.articles.map((article) => ({
      ...article,
      date: article.date ? new Date(article.date) : undefined,
    }));

    return processedArticles;
  } catch (error) {
    console.error('Error extracting newsletter articles:', error);
    throw new Error(`Failed to extract newsletter articles: ${error.message}`);
  }
}

/**
 * Main function to process newsletter HTML file
 * @param {string} htmlFilePath - Path to the HTML file
 * @returns {Promise<Array>} Array of extracted articles
 */
export async function processNewsletterFile(htmlFilePath) {
  try {
    const htmlContent = await readFile(htmlFilePath, 'utf-8');
    return await extractNewsletterArticles(htmlContent);
  } catch (error) {
    console.error('Error processing newsletter file:', error);
    throw error;
  }
}

// Example usage if run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const htmlFilePath = process.argv[2];
  if (!htmlFilePath) {
    console.error('Please provide the path to the HTML file');
    process.exit(1);
  }

  try {
    const articles = await processNewsletterFile(htmlFilePath);
    console.log(JSON.stringify(articles, null, 2));
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}
