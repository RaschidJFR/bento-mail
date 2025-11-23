/**
 * This file is excluded from regular test runs.
 * To run these tests, use:
 *
 *    npx vitest tests/ai-article-analyzer
 */

import { describe, expect, it } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import dotenv from 'dotenv';
dotenv.config({ path: '.env', override: true }); // Override globalSetup.ts settings

describe.concurrent('AI Article Analyzer', () => {
  it('identify multi-article newsletter', { timeout: 60e3 }, async () => {
    const analyzer = await import('@lib/ai-article-analyzer');
    const content = await fs.readFile(path.resolve(__dirname, './assets/newsletter_multi_article-wired.md'), 'utf-8');

    // Run three parallel classification calls and expect each to be 'newsletter'
    const tasks = Array.from({ length: 5 }, () => analyzer.classifyContent(content));
    const results = await Promise.all(tasks);

    for (const classification of results) {
      console.log('Multi-article newsletter result:\n', classification);
      expect(classification.type).toBe('newsletter');
    }
  });

  it('identify single-article newsletter', { timeout: 60e3 }, async () => {
    const analyzer = await import('@lib/ai-article-analyzer');
    const content = await fs.readFile(path.resolve(__dirname, './assets/newsletter_single_article-wired.md'), 'utf-8');

    // Run three parallel classification calls and expect each to be 'article'
    const tasks = Array.from({ length: 5 }, () => analyzer.classifyContent(content));
    const results = await Promise.all(tasks);

    for (const classification of results) {
      console.log('Single-article newsletter result:\n', classification);
      expect(classification.type).toBe('article');
    }
  });
});
