/**
 * AI analyzer tests that require a real OPENROUTER_API_KEY.
 * Skipped by default when OPENROUTER_API_KEY is not set.
 *
 * To run these tests:
 *    OPENROUTER_API_KEY=your_key npx vitest tests/ai-article-analyzer
 */

import { describe, expect, it } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';

describe.skipIf(!process.env.OPENROUTER_API_KEY).concurrent('AI Article Analyzer', () => {
  describe('multi-article newsletters', () => {
    it('identify multi-article newsletter from Wired', { timeout: 60e3 }, async () => {
      const analyzer = await import('@lib/ai-article-analyzer');
      const content = await fs.readFile(path.resolve(__dirname, './assets/newsletter_multi_article-wired.md'), 'utf-8');

      // Run three parallel classification calls and expect each to be 'newsletter'
      const tasks = Array.from({ length: 5 }, () => analyzer.classifyContent(content));
      const results = await Promise.all(tasks);

      for (const classification of results) {
        console.log('Multi-article newsletter result for Wired:\n', classification);
        expect(classification.type).toBe('newsletter');
      }
    });

    it('identify multi-article newsletter from G&M', { timeout: 60e3 }, async () => {
      const analyzer = await import('@lib/ai-article-analyzer');
      const { default: jsonArticles } = await import('./assets/gnm.lately.json', { assert: { type: 'json' } });
      const rndIndex = Math.floor(Math.random() * jsonArticles.length);
      const content = jsonArticles[rndIndex].content;

      // Run three parallel classification calls and expect each to be 'newsletter'
      const tasks = Array.from({ length: 5 }, () => analyzer.classifyContent(content));
      const results = await Promise.all(tasks);

      for (const classification of results) {
        console.log('Multi-article newsletter result for G&M:\n', classification);
        expect(classification.type).toBe('newsletter');
      }
    });
  });

  it('identify single-article newsletter', { timeout: 60e3 }, async () => {
    const analyzer = await import('@lib/ai-article-analyzer');
    const content = await fs.readFile(path.resolve(__dirname, './assets/newsletter_single_article-wired.md'), 'utf-8');

    // Run five parallel classification calls and expect each to be 'article'
    const tasks = Array.from({ length: 5 }, () => analyzer.classifyContent(content));
    const results = await Promise.all(tasks);

    for (const classification of results) {
      console.log('Single-article newsletter result for Wired:\n', classification);
      expect(classification.type).toBe('article');
    }
  });

  it('classify link-only content as link', { timeout: 60e3 }, async () => {
    const analyzer = await import('@lib/ai-article-analyzer');
    const linkContent = 'Check this out: https://example.com/article';

    // Run five parallel classification calls and expect each to be 'link'
    const tasks = Array.from({ length: 5 }, () => analyzer.classifyContent(linkContent));
    const results = await Promise.all(tasks);

    for (const classification of results) {
      console.log('Link classification result:\n', classification);
      expect(classification.type).toBe('link');
      expect(classification).toHaveProperty('reason');
      expect(classification).toHaveProperty('data');
      expect(typeof classification.data).toBe('string');
    }
  });
});
