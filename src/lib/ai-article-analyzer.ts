import { OpenRouter } from '@openrouter/sdk';
import type { ChatResult, ImageGenerationResponse } from '@openrouter/sdk/models';
import { z } from 'zod/v4';
import 'dotenv/config';
import type { IArticle, INewsletter } from './models';

const MODEL = 'openai/gpt-5-mini';

const openRouter = new OpenRouter({
  apiKey: process.env.OPENROUTER_API_KEY || 'mock-api-key',
});

if (!process.env.OPENROUTER_API_KEY) {
  console.warn('Warning: OPENROUTER_API_KEY environment variable is not set. Using mock API key.');
}

async function completeStructured<T extends z.ZodType>(
  prompt: string,
  schema: T,
  name: string,
  model = MODEL,
): Promise<z.output<T>> {
  const response = (await openRouter.chat.send({
    chatRequest: {
      model,
      messages: [{ role: 'system', content: prompt }],
      responseFormat: { type: 'json_schema', jsonSchema: { name, schema: z.toJSONSchema(schema) } },
    },
  })) as ChatResult;
  const content = response.choices[0]?.message.content;
  if (typeof content !== 'string') {
    throw new Error(`OpenRouter returned no text content for ${name}`);
  }
  return schema.parse(JSON.parse(content));
}

export type ArticleOrNewsletterResponse = {
  type: 'article' | 'newsletter' | 'unknown';
  reason: string;
};
export type ClassificationResponse = {
  type: 'article' | 'newsletter' | 'link' | 'unknown';
  reason: string;
  data?: string;
};

type NewsLetterExtraction = Pick<INewsletter, 'name' | 'date'> & {
  articles: Pick<IArticle, 'header' | 'url' | 'coverImg' | 'content'>[];
};

type ArticleDetailsExtraction = Pick<IArticle, 'coverImg' | 'sourceName' | 'date' | 'summaries' | 'linkedArticles'>;

const BasicArticleSchema = z.object({
  header: z.string().describe('The title of the article. 100 characters max.'),
  url: z.string().default('').describe('External link to the original article. Empty string if not found.'),
  coverImg: z.string().default('').describe('URL to the cover image of the article. Empty string if not found.'),
  content: z.string().describe('Abstract or full text of the article'),
});

const NewsletterSchema = z.object({
  articles: z.array(BasicArticleSchema),
  name: z.string().describe('The name of the newsletter. Empty string if not found.'),
  date: z.string().default('').describe('The date of the newsletter (yyyy-mm-dd numbers). Empty string if not found.'),
});

const FullArticleSchema = z.object({
  coverImg: z.string().default('').describe('URL to the cover image of the article. Empty string if not found.'),
  sourceName: z.string().default('').describe('The name of the newsletter. Empty string if not found.'),
  date: z
    .string()
    .default('')
    .describe('Date when the article was created (yyyy-mm-dd numbers). Empty string if not found.'),
  summaries: z.object({
    oneliner: z.string().describe('The most accurate header/title for the article in one line'),
    overview: z.string().describe('Complete conclusion and key takeaways in less than 200 characters'),
    details: z
      .string()
      .describe('Supporting details and evidence that complement the overview in less than 500 characters'),
  }),
  linkedArticles: z
    .array(BasicArticleSchema)
    .optional()
    .default([])
    .describe('List of related or linked articles found in the content'),
});

const ArticleOrNewsletterSchema = z.object({
  type: z
    .enum(['article', 'newsletter', 'unknown'])
    .describe('Whether the text is a single article, a newsletter, or unknown'),
  reason: z.string().describe('Brief explanation of the classification decision'),
});

const ClassificationSchema = z.object({
  type: z
    .enum(['article', 'newsletter', 'link', 'unknown'])
    .describe('Whether the text is a single article, a newsletter, or unknown'),
  reason: z.string().describe('Brief explanation of the classification decision'),
  data: z.string().optional().default('').describe('The extracted URL if type is link, else empty'),
});

/**
 * @deprecated
 * Extracts newsletter articles from Markdown content using AI
 * @param textContent - The Markdown content of the newsletter
 * @returns The extracted newsletter information including articles
 */
export async function extractArticlesFromNewsletter(textContent: string): Promise<NewsLetterExtraction>;
/**
 * Extracts newsletter articles from Markdown content using AI
 * @param textContent - The Markdown content of the newsletter
 * @param newsletterNames - An array of known newsletter names to match against
 * @param options.ignoreWithoutAbstract - Whether to ignore articles without an abstract (default: true)
 * @returns The extracted newsletter information including articles
 */
export async function extractArticlesFromNewsletter(
  textContent: string,
  newsletterNames: string[],
  options?: { ignoreWithoutAbstract?: boolean },
): Promise<NewsLetterExtraction>;
export async function extractArticlesFromNewsletter(
  textContent: string,
  newsletterNames: string[] = [],
  { ignoreWithoutAbstract = true } = {},
): Promise<NewsLetterExtraction> {
  let newsletterNameInstructions = '';

  if (!textContent || textContent.trim().length === 0) {
    throw new Error('Text content is empty or invalid.');
  }
  if (!process.env.OPENROUTER_API_KEY) {
    throw new Error('OPENROUTER_API_KEY environment variable is required. Please set it in your .env file or environment.');
  }

  if (newsletterNames.length > 0) {
    newsletterNameInstructions = `For the newsletter name, check if it matches any of the following known newsletter names. 
If a match is found, use that name; otherwise, use what you find in the content (look for branding/header information).

Newsletter names: 

- ${newsletterNames.join('\n - ')}`;
  }

  const prompt = `
Analyze the provided newsletter content and extract all articles.
${ignoreWithoutAbstract ? 'Ignore any articles that do not have an abstract or summary.' : ''}

For each article, identify:

1. **header**: The main title/headline of the article
2. **url**: Any external links to the full article (look for markdown link syntax [text](url))
3. **coverImg**: URLs to article cover images (look for markdown image syntax ![alt](url))
4. **content**: Extract the article's full text or abstract based on available content

${newsletterNameInstructions}

Rules:
- Only extract actual articles, not advertisements or footer content
- If no external URL is found, omit the url field
- If no cover image is found, omit the coverImg field

Content:

\`\`\`markdown
${textContent}
\`\`\`
`;
  const data = await completeStructured(prompt, NewsletterSchema, 'newsletter_extraction');
  return {
    name: data.name,
    date: data.date || null,
    articles:
      data.articles?.map((a) => ({
        content: a.content || '',
        header: a.header || '',
        sourceName: data.name,
        url: a.url || '',
        coverImg: a.coverImg || '',
      })) || [],
  };
}

/**
 * Generates a cover image for an article using OpenRouter's image API
 * @param textContent - The Markdown content of a single article
 * @returns Base64-encoded cover image URL
 */
export async function generateCoverImage(textContent: string) {
  const prompt = `
Create a realistic, editorial-style cover image for a news article.

Guidelines:
- Visual style: realistic, photographic, professional, and modern (avoid illustration or cartoon styles)
- Composition: strong central subject or metaphor, generous negative space for layout flexibility
- Mood: newsworthy, eye-catching
- Do not include any text, logos, or watermarks in the image
- Aspect ratio: 16:9

Article:

\`\`\`markdown
${textContent}
\`\`\``;

  const response = (await openRouter.images.generate({
    imageGenerationRequest: {
      model: 'openai/gpt-image-1',
      prompt,
      aspectRatio: '16:9',
      outputFormat: 'png',
    },
  })) as ImageGenerationResponse;
  const [image] = response.data;
  return `data:${image.mediaType ?? 'image/png'};base64,${image.b64Json}`;
}

/** @deprecated */
export async function extractArticleDetails(
  textContent: string,
  opts?: { skipVerify?: boolean },
): Promise<ArticleDetailsExtraction>;
/**
 * Extracts article details from Markdown content using AI
 * @param textContent - The Markdown content of a single article
 * @param opts.skipVerify - If true, skip the content classification step
 * @param opts.sourceNames - An array of known newsletter names to match against
 * @returns The extracted article details including summaries and linked articles
 */
export async function extractArticleDetails(
  textContent: string,
  opts: { skipVerify?: boolean; sourceNames: string[] },
): Promise<ArticleDetailsExtraction>;
export async function extractArticleDetails(
  textContent: string,
  { skipVerify = false, sourceNames = [] as string[] } = {},
): Promise<ArticleDetailsExtraction> {
  let newsletterNameInstructions = '';

  if (!textContent || textContent.trim().length === 0) {
    throw new Error('Text content is empty or invalid.');
  }
  if (!process.env.OPENROUTER_API_KEY) {
    throw new Error('OPENROUTER_API_KEY environment variable is required. Please set it in your .env file or environment.');
  }

  // First ensure this is an article
  if (skipVerify == false) {
    const result = await classifyContent(textContent);
    if (result.type !== 'article') {
      console.log('[ai-analyzer] Content classification result:', result);
      throw new Error(`[ai-analyzer] Content is not a single article (detected type: ${result.type})`);
    }
  }

  if (sourceNames.length > 0) {
    newsletterNameInstructions = `For the source name, check if it matches any of the following known newsletter names. 
If a match is found, use that; otherwise, use what you find in the content.

Newsletter names: 

- ${sourceNames.join('\n - ')}`;
  }

  const prompt = `
Analyze the provided content extracted from a web article and extract the article information:

1. **coverImg**: Look for the main article image (markdown image syntax ![alt](url)). 
  Ignore the author's avatar image (you can recognize it by its small size or placement near the author name).
2. **date**: Extract the publication date if mentioned in the content (yyyy-mm-dd numbers)
3. **linkedArticles**: Identify any related or linked articles mentioned in the content. These can appear as references, citations, or hyperlinks within the text.

Create three different summaries
1. **oneliner**: Create the most accurate and compelling header/title for this article in less than 100 characters
2. **overview**: Write the most complete conclusion and key takeaways in less than 200 characters
3. **details**: Add supporting details and evidence that complement the overview summary in less than 500 characters

${newsletterNameInstructions}

Rules:
- The oneliner should be more accurate than the original title if needed
- The overview must be under 200 characters and capture the essence. Do not repeat the oneliner.
- The details summary must be under 500 characters and provide supporting context. Do not repeat the overview.
- Focus on actionable insights and key facts
- Be precise and avoid fluff

Content:

\`\`\`markdown
${textContent}
\`\`\`
`;

  const result = await completeStructured(prompt, FullArticleSchema, 'article_details');
  return {
    summaries: result.summaries,
    date: result.date || null,
    coverImg: result.coverImg || '',
    sourceName: result.sourceName || '',
    linkedArticles:
      result.linkedArticles?.map((a) => ({
        ...a,
        url: a.url || '',
        coverImg: a.coverImg || '',
      })) || [],
  };
}

/**
 * @deprecated Use classifyContent() instead
 */
export async function isArticleOrNewsletter(textContent: string): Promise<ArticleOrNewsletterResponse['type']> {
  if (!textContent || textContent.trim().length === 0) {
    throw new Error('Text content is empty or invalid.');
  }
  if (!process.env.OPENROUTER_API_KEY) {
    throw new Error('OPENROUTER_API_KEY environment variable is required. Please set it in your .env file or environment.');
  }

  const prompt = `
Given the following newsletter/article text, determine if there is a main article/featured story or not.
- if there is one **main** article (even if there are other recommended articles), classify it as "article".
- If there are multiple articles with no main featured story, classify it as "newsletter".
- if it is neither, unclear, incomplete, too short, or unrelated (spam, error messages, captchas, or unrelated content), classify it as "unknown".
- Note: a main article must have a substantial content, and a longer length compared to other articles.

Text:

\`\`\`markdown
${textContent}
\`\`\`
`;

  try {
    const result = await completeStructured(prompt, ArticleOrNewsletterSchema, 'article_or_newsletter');
    return result.type;
  } catch (error: any) {
    console.error('[ai-article-analyzer] Error classifying text:');
    console.error(error.stack, '\n');
    return 'unknown';
  }
}

export async function classifyContent(textContent: string): Promise<ClassificationResponse> {
  if (!textContent || textContent.trim().length === 0) {
    throw new Error('Text content is empty or invalid.');
  }
  if (!process.env.OPENROUTER_API_KEY) {
    throw new Error('OPENROUTER_API_KEY environment variable is required. Please set it in your .env file or environment.');
  }

  const prompt = `
Given the following newsletter text, determine if there is a main article/featured story or not.
- if there is one **main** article (even if there are other recommended articles), classify it as "article".
- If there are multiple articles with no main featured story, classify it as "newsletter".
- If there is no article content, only a link or url, classify it as "link".
- if it is neither, unclear, incomplete, too short, or unrelated (spam, error messages, captchas, or unrelated content), classify it as "unknown".

- Notes: 
  - A main article must have more than one paragraph.
  - A main article must be at least twice as long compared to the other articles.
  - Beware of false positives from headers like "The Big Story" or "Breaking News" that do not indicate a main article.

Text:

\`\`\`markdown
${textContent}
\`\`\`
`;

  try {
    const result = await completeStructured(prompt, ClassificationSchema, 'classification', 'typesafe/jev-router');
    return result;
  } catch (error: any) {
    console.error('[ai-article-analyzer] Error classifying text:');
    console.error(error.stack, '\n');
    return { type: 'unknown', reason: error.message };
  }
}
