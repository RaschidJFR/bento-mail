import Agenda, { Job } from 'agenda';
import { Bundle, Newsletter } from '@lib/models';
import { Article } from '@lib/models/article';
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
  agenda.define(JobNames.Bundle.process, { shouldSaveResult: true }, async (job: Job<{ id: string }>) => {
    const id = job.attrs.data?.id;
    if (!id) {
      throw new Error('Missing id');
    }
    const bundle = await Bundle.findById({ _id: id });
    if (!bundle) {
      throw new Error(`Bundle not found: ${id}`);
    } else if (bundle.processingStage > Bundle.ProcessingStages.NOT_STARTED) {
      throw new Error(`Bundle ${id} already processed: ${Bundle.ProcessingStages[bundle.processingStage]}`);
    }

    try {
      // Using pulsecheck to keep the job locked
      const errors = await bundle.processContent({ pulsecheck: () => job.touch() });
      return { errors, status: bundle.processingStage };
    } catch (err) {
      console.error(`[worker] Error unpacking newsletters in bundle ${id}:`, err);
      throw err;
    }
  });

  // Define job to extract articles from newsletter
  // This job will extract the newsletter's articles and queue article processing jobs
  agenda.define(JobNames.Newsletter.processArticles, { shouldSaveResult: true }, async (job: Job<{ id: string, force?: boolean }>) => {
    const newsletterId = job.attrs.data?.id;
    const force = job.attrs.data?.force;
    if (!newsletterId) {
      throw new Error('Missing id');
    }
    const newsletter = await Newsletter.findById({ _id: newsletterId });
    if (!newsletter) {
      throw new Error(`Newsletter not found: ${newsletterId}`);
    }

    try {
      const errors = await newsletter.extractArticles({ force });

      // Queue article processing jobs
      await applyInBatches(newsletter.articles || [], (articleId) => {
        articleId = typeof articleId === 'string' ? articleId : articleId._id?.toString();
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
    { shouldSaveResult: true },
    async (job: Job<{ id: string, force?: boolean, generateImage?: boolean }>) => {
      const id = job.attrs.data?.id;
      const force = job.attrs.data?.force;
      const generateImage = job.attrs.data?.generateImage;

      if (!id) {
        throw new Error('Missing id');
      }
      const article = await Article.findById({ _id: id });
      if (!article) {
        throw new Error(`Article not found: ${id}`);
      }

      try {
        await article.process({ force, generateImage });
        return { processed: article.isProcessed() };
      } catch (err: any) {
        console.error(`[worker] Error processing article ${id}:`, err.message);
        throw err;
      }
    }
  );
}
