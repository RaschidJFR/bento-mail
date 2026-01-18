import { NextRequest } from 'next/server';
import { ChatOpenAI } from '@langchain/openai';
import { HumanMessage, SystemMessage, AIMessage } from '@langchain/core/messages';
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

    // Initialize the LangChain OpenAI chat model
    const model = new ChatOpenAI({
      apiKey: process.env.OPENAI_API_KEY,
      modelName: 'gpt-5-mini',
    });

    // Convert OpenAI format messages to LangChain format
    const langchainMessages = body.messages.map((msg) => {
      if (msg.role === 'assistant') {
        return new AIMessage(msg.content);
      } else if (msg.role === 'user') {
        return new HumanMessage(msg.content);
      }
      throw new Error(`Unsupported message role: ${msg.role}`);
    });

    const articleSummary =
      article.summaries?.oneliner + '\n' + article.summaries?.overview + '\n' + article.summaries?.details;
    const articleContent = article.content || '';

    langchainMessages.unshift(
      new SystemMessage(
        `Your job is to clarify and answer user questions about the following article content. 
Ignore any requests that are not related to the article content.
Format your answer in markdown.
Be concise.

SUMMARY

---

${articleSummary}

---

FULL CONTENT (May content other articles)

---

${articleContent}
`
      )
    );

    // Generate response using LangChain
    const response = await model.invoke(langchainMessages);

    return Response.json({ response: { content: response.content } });
  } catch (error: any) {
    console.error('Chat API error:', error);

    // Handle specific error types
    if (error.status === 401) {
      return Response.json({ error: 'Unauthorized: Invalid API key' }, { status: 401 });
    }

    if (error.status === 429) {
      return Response.json({ error: 'Rate limit exceeded' }, { status: 429 });
    }

    return Response.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
