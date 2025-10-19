import { Newsletter, INewsletter } from '@lib/models';
import { Server, Socket } from 'socket.io';
import { Task, ITask } from '@services/worker';
import type { ChangeStream, ChangeStreamDocument } from 'mongodb';

const EMIT_EVENT_NAME = 'taskChanged';
type TaskArticleProcess = ITask<{ id: string }>;
let taskChangeStream: ChangeStream<TaskArticleProcess>;

async function joinNewsletterTasks(client: Socket, newsletterId: string) {
  console.log(`Client %o joining Tasks room for newsletter %o`, client.id, roomName(newsletterId));

  const newsletter: INewsletter | null = await Newsletter.exists({ _id: newsletterId }).lean();
  if (!newsletter) {
    console.warn('Newsletter not found: %o', newsletterId);
    client.emit('error', { message: 'Newsletter not found', newsletterId });
    return;
  }

  client.join(roomName(newsletterId));
}

export async function setupTaskChangestream(io: Server) {
  io.on('connection', (client) => {
    client.on('joinNewsletter', (newsletterId: string) => joinNewsletterTasks(client, newsletterId));
  });

  const pipeline = [
    {
      $match: {
        $or: [
          {
            'fullDocument.name': 'article.process',
            operationType: { $in: ['insert', 'update', 'replace'] },
          },
          {
            'fullDocumentBeforeChange.name': 'article.process',
            operationType: 'delete',
          },
        ],
      },
    },
  ];

  try {
    if (taskChangeStream) await taskChangeStream.close();
  } catch (e) {
    console.warn('Error closing previous task change stream: %o', e);
  } finally {
    taskChangeStream = Task.watch<TaskArticleProcess, ChangeStreamDocument<TaskArticleProcess>>(pipeline, {
      fullDocument: 'updateLookup',
    }) as any;
  }

  taskChangeStream.on('change', (change) => onArticleProcessTaskChange(io, change));
  return taskChangeStream;
}

async function onArticleProcessTaskChange(io: Server, change: ChangeStreamDocument<TaskArticleProcess>) {
  const taskId = 'documentKey' in change ? change.documentKey._id : null;
  if (!taskId) return; // Should not happen

  const task = 'fullDocument' in change ? change.fullDocument : null;
  const prevTask = 'fullDocumentBeforeChange' in change ? change.fullDocumentBeforeChange : null;
  const articleId = task?.data.id || prevTask?.data.id;
  if (!articleId) {
    console.warn('[%o] No article ID found in task %o', change.operationType, String(taskId));
    return;
  }

  const newsletters: INewsletter[] = await Newsletter.find({ articles: articleId }).select('_id').lean();
  if (!newsletters.length) {
    console.warn('[%o] No newsletters found for article %o in task %o', change.operationType, articleId, taskId);
    return;
  }

  newsletters.forEach((newsletter) => {
    io.to(roomName(newsletter._id)).emit(EMIT_EVENT_NAME, { _id: taskId, data: task });
  });
}

function roomName(newsletterId: string) {
  return `newsletter:${newsletterId}:tasks`;
}
