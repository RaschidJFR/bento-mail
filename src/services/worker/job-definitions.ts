import { Job, Chronos as Agenda } from 'chronos-jobs';
import { Bundle, Newsletter, Article } from '@lib/models';
import { applyInBatches } from '@lib/utils';

export const JobNames = Object.freeze({
  Bundle: {
    process: 'bundle.process',
  },
  Newsletter: {
    processArticles: 'newsletter.processArticles',
  },
  Article: {
    process: 'article.process',
  },
});

export function defineJobs(agenda: Agenda) {
  // Define job to process bundle
  agenda.define(JobNames.Bundle.process, async (job: Job<{ id: string }>) => {
    const id = job.attrs.data?.id;
    if (!id) {
      throw new Error('Missing id');
    }
    const bundle = await Bundle.findById(id);
    if (!bundle) {
      throw new Error(`Bundle not found: ${id}`);
    } else if (bundle.processingStage > Bundle.ProcessingStages.NOT_STARTED) {
      throw new Error(`Bundle ${id} already processed: ${Bundle.ProcessingStages[bundle.processingStage]}`);
    }

    try {
      // Using pulsecheck to keep the job locked
      const errors = await Bundle.processContent(bundle._id, { pulsecheck: () => job.touch() });
      return { errors, status: bundle.processingStage };
    } catch (err) {
      console.error(`[worker] Error unpacking newsletters in bundle ${id}:`, err);
      throw err;
    }
  });

  // Define job to extract articles from newsletter
  // This job will extract the newsletter's articles and queue article processing jobs
  agenda.define(JobNames.Newsletter.processArticles, async (job: Job<{ id: string; force?: boolean }>) => {
    const newsletterId = job.attrs.data?.id;
    const force = job.attrs.data?.force;
    if (!newsletterId) {
      throw new Error('Missing id');
    }
    const newsletter = await Newsletter.findById(newsletterId);
    if (!newsletter) {
      throw new Error(`Newsletter not found: ${newsletterId}`);
    }

    try {
      const errors = await Newsletter.extractArticles(newsletter._id, { force });

      // Queue article processing jobs
      await applyInBatches(Array.from(newsletter.articles || []), (articleId) => {
        articleId = String(articleId); // Ensure articleId is a string
        return agenda
          .create(JobNames.Article.process, { id: articleId, force })
          .schedule('now')
          .unique({ 'data.id': articleId }, { insertOnly: true }) // Prevent duplicate jobs
          .save();
      });

      return { errors };
    } catch (err) {
      console.error(`[worker] Error extracting articles in newsletter ${newsletterId}:`, err);
      throw err;
    }
  });

  // Define job to process article
  agenda.define(
    JobNames.Article.process,
    async (job: Job<{ id: string; force?: boolean; generateImage?: boolean }>) => {
      const id = job.attrs.data?.id;
      const force = job.attrs.data?.force;
      const generateImage = job.attrs.data?.generateImage;

      if (!id) {
        throw new Error('Missing id');
      }
      const article = await Article.findById(id);
      if (!article) {
        throw new Error(`Article not found: ${id}`);
      }

      try {
        await Article.process(article._id, { force, generateImage });
        return { processed: Article.isProcessed(article) };
      } catch (err: any) {
        console.error(`[worker] Error processing article ${id}:`, err.message);
        throw err;
      }
    }
  );
}
