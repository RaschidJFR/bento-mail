import { ChatOpenAI } from '@langchain/openai';
import { SystemMessage } from '@langchain/core/messages';
import { z } from 'zod';
import 'dotenv/config';
import type { IArticle, INewsletter } from './models';

const model = new ChatOpenAI({
  modelName: 'gpt-5-mini',
  apiKey: process.env.OPENAI_API_KEY || 'mock-api-key',
});

if (!process.env.OPENAI_API_KEY) {
  console.warn('Warning: OPENAI_API_KEY environment variable is not set. Using mock API key.');
}

export type ArticleDataProps = Omit<IArticle, '_id'>;
export type ArticleDetailsProps = Pick<ArticleDataProps, 'date' | 'summaries' | 'coverImg'>;
export type BasicArticleProps = Omit<ArticleDataProps, 'summaries'> & { content: string };
export type NewsletterDataProps = Omit<INewsletter, '_id' | 'content' | 'articles'> & {
  articles: BasicArticleProps[];
};

const BasicArticleSchema = z.object({
  header: z.string().describe('The title of the article. 100 characters max.'),
  url: z.string().default('').describe('External link to the original article. Empty string if not found.'),
  coverImg: z.string().default('').describe('URL to the cover image of the article. Empty string if not found.'),
  content: z.string().describe('Abstract or full text of the article'),
});

const NewsletterSchema = z.object({
  articles: z.array(BasicArticleSchema),
  name: z.string().describe('The name of the newsletter. Empty string if not found.'),
  date: z.string().optional().describe('The date of the newsletter (yyyy-mm-dd numbers). Empty string if not found.'),
});

const ComplementaryArticleSchema = z.object({
  coverImg: z
    .string()
    .optional()
    .default('')
    .describe('URL to the cover image of the article. Empty string if not found.'),
  date: z
    .string()
    .optional()
    .describe('Date when the article was created (yyyy-mm-dd numbers). Empty string if not found.'),
  summaries: z.object({
    oneliner: z.string().describe('The most accurate header/title for the article in one line'),
    overview: z.string().describe('Complete conclusion and key takeaways in less than 200 characters'),
    details: z
      .string()
      .describe('Supporting details and evidence that complement the overview in less than 500 characters'),
  }),
});

const ArticleOrNewsletterSchema = z.object({
  type: z
    .enum(['article', 'newsletter', 'unknown'])
    .describe('Whether the text is a single article, a newsletter, or unknown'),
});

/**
 * Extracts newsletter articles from Markdown content using AI
 * @param textContent - The Markdown content of the newsletter
 * @returns Array of article objects
 */
export async function extractArticlesFromNewsletter(textContent: string): Promise<NewsletterDataProps> {
  if (!textContent || textContent.trim().length === 0) {
    throw new Error('Text content is empty or invalid.');
  }
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY environment variable is required. Please set it in your .env file or environment.');
  }

  const prompt = `
You are an expert at extracting structured information from newsletter Markdown content. 

Analyze the provided Markdown content and extract all newsletter articles. For each article, identify:

1. **header**: The main title/headline of the article
2. **url**: Any external links to the full article (look for markdown link syntax [text](url))
3. **coverImg**: URLs to article cover images (look for markdown image syntax ![alt](url))
4. **content**: Extract the article's full text or abstract based on available content
5. **sourceName**: The newsletter name (look for branding/header information)

Rules:
- Only extract actual articles, not advertisements or footer content
- If no external URL is found, omit the url field
- If no cover image is found, omit the coverImg field

Content:

\`\`\`markdown
${textContent}
\`\`\`
`;

  const data = await model.withStructuredOutput(NewsletterSchema).invoke([new SystemMessage(prompt)]);
  return {
    ...data,
    articles: data.articles.map((a) => ({ ...a, sourceName: data.name })),
  };
}

/**
 * Extracts article details from Markdown content using AI
 * @param textContent - The Markdown content of a single article
 */
export async function extractArticleDetails(textContent: string) {
  if (!textContent || textContent.trim().length === 0) {
    throw new Error('Text content is empty or invalid.');
  }
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY environment variable is required. Please set it in your .env file or environment.');
  }

  const prompt = `
Analyze the provided Markdown content extracted from a web article and extract the article information:

1. **coverImg**: Look for the main article image (markdown image syntax ![alt](url))
2. **date**: Extract the publication date if mentioned in the content (yyyy-mm-dd numbers)

Create three different summaries
1. **oneliner**: Create the most accurate and compelling header/title for this article in less than 100 characters
2. **overview**: Write the most complete conclusion and key takeaways in less than 200 characters
3. **details**: Add supporting details and evidence that complement the overview summary in less than 500 characters

Rules:
- The oneliner should be more accurate than the original title if needed
- The overview must be under 200 characters and capture the essence
- The details summary must be under 500 characters and provide supporting context
- Focus on actionable insights and key facts
- Be precise and avoid fluff

Markdown Content:

\`\`\`markdown
${textContent}
\`\`\`
`;

  const result: ArticleDetailsProps = await model
    .withStructuredOutput(ComplementaryArticleSchema)
    .invoke([new SystemMessage(prompt)]);
  return result;
}

export async function isArticleOrNewsletter(textContent: string) {
  if (!textContent || textContent.trim().length === 0) {
    throw new Error('Text content is empty or invalid.');
  }
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY environment variable is required. Please set it in your .env file or environment.');
  }

  const prompt = `
Given the following text from a newsletter content, determine if it represents:
- A single "article" (one main story, possibly with sections). 
  Even if it has subsections or links to other articles, it should focus on one main topic.
- A "newsletter" (a list or collection of suggested articles to read, possibly with summaries).
  This focuses on multiple distinct articles or topics.
- "unknown" if it is neither or unclear.

If you are unsure or the text does not clearly fit either category, respond with "unknown".

Respond with a JSON object with a single key "type" whose value is either "article", "newsletter", or "unknown".

Text:

\`\`\`markdown
${textContent}
\`\`\`
`;

  try {
    const result = await model.withStructuredOutput(ArticleOrNewsletterSchema).invoke([new SystemMessage(prompt)]);
    return result.type;
  } catch (error: any) {
    console.error('[ai-article-analyzer] Error classifying text:');
    console.error(error.stack, '\n');
    return 'unknown';
  }
}
