import { JSDOM, VirtualConsole } from 'jsdom';
import TurndownService from 'turndown';
import axios from 'axios';
import crypto from 'crypto';

/**
 * Generates a SHA-256 hash of the given text
 * @param {string} text - The input text to hash
 * @returns {string} The SHA-256 hash in hexadecimal format
 */
export function hash(text: string) {
  if (!text || typeof text !== 'string' || !text.trim()) {
    throw new Error('Input must be a non-empty string: ' + text);
  }
  text = text.trim();
  const hash = crypto.createHash('sha256').update(text).digest('hex');
  return hash;
}

/**
 * Downloads HTML content from a given URL
 * @param {string} url - The URL to download HTML from
 * @param {object} options - Optional configuration
 * @returns {Promise<string>} The HTML content as a string
 */
export async function fetchHtmlContent(url: string, options: any = {}) {
  try {
    const config = {
      timeout: options.timeout || 10000,
      headers: {
        'User-Agent':
          options.userAgent ||
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        ...options.headers,
      },
      ...options,
    };

    const response = await axios.get(url, config);
    return response.data;
  } catch (error: any) {
    if (error.response) {
      throw new Error(`HTTP ${error.response.status}: ${error.response.statusText} for URL: ${url}`);
    } else if (error.request) {
      throw new Error(`Network error when requesting URL: ${url}`);
    } else {
      throw new Error(`Error downloading HTML from ${url}: ${error.message}`);
    }
  }
}

/**
 * Converts HTML content to Markdown
 * @param {string} htmlContent - The HTML content to convert
 * @returns {string} Markdown content
 */
export function htmlToMarkdown(htmlContent: string) {
  // Filter HTML content to remove non-renderable elements
  const virtualConsole = new VirtualConsole();
  virtualConsole.on('error', () => {});
  const dom = new JSDOM(htmlContent, { virtualConsole });
  const document = dom.window.document;

  // Get body content, fallback to entire document if no body
  const bodyElement = document.body || document.documentElement;

  // Remove non-renderable elements
  const elementsToRemove = ['script', 'style', 'noscript', 'meta', 'link', 'title'];
  elementsToRemove.forEach((tagName) => {
    const elements = bodyElement.querySelectorAll(tagName);
    elements.forEach((element) => element.remove());
  });

  const filteredHtml = bodyElement.innerHTML;
  return new TurndownService().turndown(filteredHtml);
}

/**
 * Processes an array of items in batches with a specified concurrency limit.
 * @param items - Array of items to process
 * @param fn - Async function to process each item
 * @param concurrency - Number of items to process concurrently (default: 5)
 * @returns Promise that resolves when all items have been processed
 */
export async function applyInBatches<T = any, U = any>(
  items: T[],
  fn: (item: T) => Promise<U>,
  { concurrency = 5, pulsecheck = () => {} } = {}
): Promise<U[]> {
  const arr = [];
  for (let i = 0; i < items.length; i += concurrency) {
    const batch = items.slice(i, i + concurrency);
    const results = await Promise.all(batch.map((item) => fn(item)));
    arr.push(...results);
    pulsecheck?.();
  }
  return arr;
}
