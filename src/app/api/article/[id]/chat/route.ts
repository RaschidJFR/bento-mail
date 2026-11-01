import { NextRequest } from 'next/server';
import { createOpenAI } from '@ai-sdk/openai';
import { generateText } from 'ai';
import { Article } from '@lib/models/article';

interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface RequestBody {
  messages: ChatMessage[];
}

const openrouter = createOpenAI({
  baseURL: 'https://openrouter.ai/api/v1',
  apiKey: process.env.OPENROUTER_API_KEY,
});

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: articleId } = await params;
  try {
    const article = await Article.findById(articleId);
    if (!article) {
      return Response.json({ error: 'Article not found' }, { status: 404 });
    }

    const body: RequestBody = await req.json();

    if (!body.messages || !Array.isArray(body.messages) || body.messages.length === 0) {
      return Response.json(
        { error: 'Invalid request: messages array is required and must not be empty' },
        { status: 400 }
      );
    }

    for (const msg of body.messages) {
      if (msg.role !== 'assistant' && msg.role !== 'user') {
        return Response.json(
          { error: `Invalid request: unsupported message role "${msg.role}"` },
          { status: 400 }
        );
      }
    }

    const messages: ChatMessage[] = body.messages.map((msg) => ({
      role: msg.role as 'user' | 'assistant',
      content: msg.content,
    }));

    const articleSummary =
      article.summaries?.oneliner + '\n' + article.summaries?.overview + '\n' + article.summaries?.details;
    const articleContent = article.content || '';

    const systemPrompt = `Your job is to clarify and answer user questions about the following article content.
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
`;

    const result = await generateText({
      model: openrouter('openai/gpt-5-mini'),
      system: systemPrompt,
      messages,
    });

    if (!result.text || typeof result.text !== 'string') {
      console.error('Invalid response from generateText:', result);
      return Response.json({ error: 'Invalid response from AI model' }, { status: 500 });
    }

    return Response.json({ response: { content: result.text } });
  } catch (error: any) {
    console.error('Chat API error:', error);

    // Handle Vercel AI SDK error shapes from OpenRouter API
    // See: https://sdk.vercel.ai/docs/reference/generate-text
    const status = error.status || error.statusCode;

    if (status === 401) {
      return Response.json({ error: 'Unauthorized: Invalid API key' }, { status: 401 });
    }

    if (status === 429) {
      return Response.json({ error: 'Rate limit exceeded' }, { status: 429 });
    }

    return Response.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
