interface GetMessageResponse {
  response: {
    content: string;
  };
}

/**
 * Call the /chat endpoint with a message history
 * @param messages - Array of chat messages in OpenAI format
 * @returns The assistant's response content
 */
export async function getMessage(
  articleId: string,
  messages: { role: 'system' | 'user' | 'assistant'; content: string }[]
): Promise<string> {
  try {
    const response = await fetch(`/api/article/${articleId}/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messages,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `HTTP ${response.status}`);
    }

    const data: GetMessageResponse = await response.json();
    return data.response.content;
  } catch (error) {
    console.error('Error calling chat API:', error);
    throw error;
  }
}
