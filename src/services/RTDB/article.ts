import { Newsletter, INewsletter, Article, IArticle } from '@lib/models';
import { Server, Socket } from 'socket.io';
import type { ChangeStream, ChangeStreamDocument } from 'mongodb';

const EMIT_EVENT_NAME = 'articleChanged';
let articleChangeStream: ChangeStream<IArticle>;
let newsletterChangeStream: ChangeStream<INewsletter>;

export async function setupArticleChangestream(io: Server) {
  io.on('connection', (client) => {
    client.on('joinNewsletter', (newsletterId: string) => joinNewsletterArticles(client, newsletterId));
  });

  const articleChangeStream = await setupArticleCreationStream(io);
  const newsletterChangeStream = await setupNewsletterStream(io);
  return { articleChangeStream, newsletterChangeStream };
}

async function setupNewsletterStream(io: Server) {
  const pipeline = [
    {
      $match: {
        operationType: { $in: ['update', 'replace'] },
      },
    },
  ];

  try {
    if (newsletterChangeStream) await newsletterChangeStream.close();
  } catch (e) {
    console.warn('Error closing previous newsletter change stream: %o', e);
  } finally {
    console.log('Creating newsletter change stream.');
    newsletterChangeStream = Newsletter.watch<INewsletter, ChangeStreamDocument>(pipeline, {
      fullDocument: 'updateLookup',
      fullDocumentBeforeChange: 'whenAvailable',
    }) as any;
  }
  newsletterChangeStream.on('change', (change) => onNewsletterChange(io, change as ChangeStreamDocument<INewsletter>));
  return newsletterChangeStream;
}

async function setupArticleCreationStream(io: Server) {
  const pipeline = [
    {
      $match: {
        // Do not watch 'insert' here: newsletter updates handle adding articles to rooms.
        // Watching 'insert' plus the newsletter update can cause duplicate emits due to timing.
        operationType: { $in: ['update', 'replace', 'delete'] },
      },
    },
  ];

  try {
    if (articleChangeStream) await articleChangeStream.close();
  } catch (e) {
    console.warn('Error setting up article change stream: %o', e);
  } finally {
    console.log('Creating article change stream.');
    articleChangeStream = Article.watch<IArticle, ChangeStreamDocument>(pipeline, {
      fullDocument: 'updateLookup',
    }) as any;
  }

  articleChangeStream.on('change', (change) => onArticleChange(io, change as ChangeStreamDocument<IArticle>));
  return articleChangeStream;
}

async function joinNewsletterArticles(client: Socket, newsletterId: string) {
  console.log(`Client %o joining Articles rooms for newsletter %o`, client.id, roomName(newsletterId));

  const newsletter: INewsletter | null = await Newsletter.exists({ _id: newsletterId }).lean();
  if (!newsletter) {
    console.warn('Newsletter not found: %o', newsletterId);
    client.emit('error', { message: 'Newsletter not found', newsletterId });
    return;
  }

  client.join(roomName(newsletterId));
}

async function onArticleChange(io: Server, change: ChangeStreamDocument<IArticle>) {
  const articleId = 'documentKey' in change ? change.documentKey._id : null;
  if (!articleId) return null; // Should not happen

  const newsletters: INewsletter[] = await Newsletter.find({ articles: articleId }).select('_id').lean();
  if (!newsletters.length) {
    console.warn('[%o] No newsletters found for article %o', change.operationType, articleId);
    return;
  }

  if (change.operationType === 'update' || change.operationType === 'replace' || change.operationType === 'delete') {
    const article = 'fullDocument' in change ? change.fullDocument : null;
    newsletters.forEach((newsletter) => {
      io.to(roomName(newsletter._id)).emit(EMIT_EVENT_NAME, { _id: articleId, data: article });
    });
  }
}

async function onNewsletterChange(io: Server, change: ChangeStreamDocument<INewsletter>) {
  const newsletterId = 'documentKey' in change ? change.documentKey._id : null;
  if (!newsletterId) return; // Should not happen

  if (change.operationType === 'update' || change.operationType === 'replace') {
    const prevArticles = change.fullDocumentBeforeChange?.articles || [];
    const newArticles = change.fullDocument?.articles || [];
    const { added, removed } = arrayDiff(prevArticles as string[], newArticles as string[]);

    removed.forEach((articleId: string) => {
      io.to(roomName(newsletterId)).emit(EMIT_EVENT_NAME, { _id: articleId, data: null });
    });

    const addedArticles = await Article.find({ _id: { $in: added } }).lean();
    addedArticles.forEach((article) => {
      io.to(roomName(newsletterId)).emit(EMIT_EVENT_NAME, { _id: article._id, data: article });
    });
  } else if (change.operationType === 'delete') {
    console.warn('Delete operation not supported for newsletters in change stream');
  }
}

function roomName(newsletterId: string) {
  return `newsletter:${newsletterId}:articles`;
}

function arrayDiff(oldArray: string[], newArray: string[]) {
  const added = newArray.filter((item) => !oldArray.includes(item));
  const removed = oldArray.filter((item) => !newArray.includes(item));
  return { added, removed };
}
