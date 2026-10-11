import { NextRequest } from 'next/server';
import { OpenRouter } from '@openrouter/sdk';
import type { ChatResult } from '@openrouter/sdk/models';
import { Article } from '@lib/models/article';

/**
 * OpenAI-compatible chat message format
 */
interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

/**
 * OpenAI-compatible chat completion request
 */
interface RequestBody {
  messages: ChatMessage[];
}

// TODO: Add testing
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: articleId } = await params;
  try {
    const article = await Article.findById(articleId);
    if (!article) {
      return Response.json({ error: 'Article not found' }, { status: 404 });
    }

    const body: RequestBody = await req.json();

    // Validate required fields
    if (!body.messages || !Array.isArray(body.messages) || body.messages.length === 0) {
      return Response.json(
        { error: 'Invalid request: messages array is required and must not be empty' },
        { status: 400 }
      );
    }

    const openRouter = new OpenRouter({ apiKey: process.env.OPENROUTER_API_KEY });

    const messages: ChatMessage[] = body.messages.map((msg) => {
      if (msg.role !== 'assistant' && msg.role !== 'user') {
        throw new Error(`Unsupported message role: ${msg.role}`);
      }
      return { role: msg.role, content: msg.content };
    });

    const articleSummary =
      article.summaries?.oneliner + '\n' + article.summaries?.overview + '\n' + article.summaries?.details;
    const articleContent = article.content || '';

    messages.unshift({
      role: 'system',
      content: `Your job is to clarify and answer user questions about the following article content.
Ignore any requests that are not related to the article content.
If the answer is not in the article but you know it, call it out and answer it **only if it is related to the article**.
Format your answer in markdown. Images and links as well.
Be concise, limit your answer to 300 chars.

SUMMARY

---

${articleSummary}

---

FULL CONTENT (May content other articles)

---

${articleContent}
`,
    });

    const response = (await openRouter.chat.send({
      chatRequest: { model: 'openai/gpt-5-mini', messages },
    })) as ChatResult;

    return Response.json({ response: { content: response.choices[0]?.message.content } });
  } catch (error: any) {
    console.error('Chat API error:', error);

    // Handle specific error types
    if (error.statusCode === 401) {
      return Response.json({ error: 'Unauthorized: Invalid API key' }, { status: 401 });
    }

    if (error.statusCode === 429) {
      return Response.json({ error: 'Rate limit exceeded' }, { status: 429 });
    }

    return Response.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
