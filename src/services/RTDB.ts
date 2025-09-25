import { Article, Newsletter, Bundle } from '@lib/models';
import { Server } from 'socket.io';
import http from 'http';

const PORT = 4001;

const server = http.createServer();
const io = new Server(server, {
  cors: { origin: '*' },
});

export async function main() {
  const articleChangeStream = Article.watch([], { fullDocument: 'updateLookup' });
  articleChangeStream.on('change', (change) => {
    if (change.operationType === 'update' || change.operationType === 'replace') {
      const article = change.fullDocument;
      console.log(`Article updated:`, article._id);
      io.emit('articleUpdated', {
        _id: article._id,
        summaries: article.summaries,
        lastError: article.lastError,
      });
    }
  });

  // Newsletter change stream
  const newsletterChangeStream = Newsletter.watch([], { fullDocument: 'updateLookup' });
  newsletterChangeStream.on('change', (change) => {
    if (
      (change.operationType === 'update' || change.operationType === 'replace') &&
      change.fullDocument &&
      Array.isArray(change.fullDocument.articles)
    ) {
      const newsletter = change.fullDocument;
      io.emit('newsletterUpdated', {
        newsletterId: newsletter._id,
        articles: newsletter.articles,
      });
    }
  });

  // Bundle change stream
  const bundleNewslettersChangeStream = Bundle.watch([], { fullDocument: 'updateLookup' });
  bundleNewslettersChangeStream.on('change', (change) => {
    if (
      (change.operationType === 'update' || change.operationType === 'replace') &&
      change.fullDocument &&
      Array.isArray(change.fullDocument.newsletters)
    ) {
      const bundle = change.fullDocument;
      io.emit('bundleUpdated', {
        bundleId: bundle._id,
        newsletters: bundle.newsletters,
        articles: bundle.articles,
      });
    }
  });

  server.listen(PORT, () => {
    console.log(`Article realtime server listening on port ${PORT}`);
  });
}
