import { Article, Newsletter, Bundle, IArticle } from '@lib/models';
import { Server } from 'socket.io';
import http from 'http';
import { setupTaskChangestream } from './task';

// Track change streams so we can close previous instances when restarting server
let articleChangeStream: any = null;
let newsletterChangeStream: any = null;
let bundleChangeStream: any = null;
let taskChangeStream: ReturnType<typeof setupTaskChangestream>;

const server = http.createServer();
const io = new Server(server, {
  cors: { origin: '*' },
});

export async function setupAndStart(port = 4001) {
  server.closeAllConnections();
  io.removeAllListeners();

  try {
    if (taskChangeStream) await taskChangeStream.close();
  } catch (e) {
    console.warn('Error closing previous task change stream: %o', e);
  } finally {
    taskChangeStream = setupTaskChangestream(io);
  }

  // Close any previous change streams to avoid duplicate emits
  try {
    if (articleChangeStream) await articleChangeStream.close();
  } catch (e) {
    /* ignore */
  }
  articleChangeStream = null;

  try {
    if (newsletterChangeStream) await newsletterChangeStream.close();
  } catch (e) {
    /* ignore */
  }
  newsletterChangeStream = null;

  try {
    if (bundleChangeStream) await bundleChangeStream.close();
  } catch (e) {
    /* ignore */
  }
  bundleChangeStream = null;

  const articleCS = Article.watch([], { fullDocument: 'updateLookup' });
  articleChangeStream = articleCS;
  articleCS.on('change', (change) => {
    if (change.operationType === 'update' || change.operationType === 'replace') {
      const article = change.fullDocument;
      io.emit('articleUpdated', {
        _id: article._id,
        coverImg: article.coverImg,
        summaries: article.summaries,
        lastError: article.lastError,
      } as Partial<IArticle>);
    }
  });

  // Newsletter change stream
  const newsletterCS = Newsletter.watch([], { fullDocument: 'updateLookup' });
  newsletterChangeStream = newsletterCS;
  newsletterCS.on('change', (change) => {
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
  const bundleCS = Bundle.watch([], { fullDocument: 'updateLookup' });
  bundleChangeStream = bundleCS;
  bundleCS.on('change', (change) => {
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

  io.on('connection', (client) => {
    console.debug('Client %o connected', client.id);
    client.on('disconnect', () => console.log(`Client %o disconnected`, client.id));
  });

  server.listen(port, () => {
    console.debug(`Database socket server listening on port ${port}...\n`);
  });

  return io;
}
