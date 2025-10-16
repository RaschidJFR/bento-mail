import { Newsletter, INewsletter } from '@lib/models';
import { Server, Socket } from 'socket.io';
import { JobNames, Task, ITask } from '@services/worker';
import type { ChangeStreamDocument } from 'mongodb';

export type TaskArticleProcess = ITask<{ id: string }>;

export async function joinNewsletterTasks(client: Socket, newsletterId: string) {
  console.log(`Client %o joining newsletter %o`, client.id, roomName(newsletterId));

  const newsletter: INewsletter | null = await Newsletter.findById(newsletterId).select('articles').lean();
  if (!newsletter) {
    console.warn('Newsletter not found: %o', newsletterId);
    client.emit('error', { message: 'Newsletter not found', newsletterId });
    return;
  }

  client.join(roomName(newsletterId));
}

export function setupTaskChangestream(io: Server) {
  io.on('connection', (client) => {
    client.on('joinNewsletter', (newsletterId: string) => joinNewsletterTasks(client, newsletterId));
  });

  const pipeline = [
    {
      $match: {
        'fullDocument.name': JobNames.Article.process,
        operationType: { $in: ['insert', 'update'] },
      },
    },
  ];

  const taskChangeStream = Task.watch<TaskArticleProcess, ChangeStreamDocument<TaskArticleProcess>>(pipeline, {
    fullDocument: 'updateLookup',
  });
  taskChangeStream.on('change', (change) => onArticleProcessTaskChange(io, change));
  return taskChangeStream;
}

async function onArticleProcessTaskChange(io: Server, change: ChangeStreamDocument<TaskArticleProcess>) {
  const taskId = 'documentKey' in change ? change.documentKey._id : null;
  const task = 'fullDocument' in change ? change.fullDocument : null;
  const articleId = task?.data?.id;

  const newsletters: INewsletter[] = await Newsletter.find({ articles: articleId }).select('_id').lean();
  if (!newsletters.length) {
    console.warn('No newsletters found for article %o in task %o', articleId, taskId);
    return;
  }

  newsletters.forEach((newsletter) => {
    io.to(roomName(newsletter._id)).emit('taskChanged', { _id: taskId, data: task });
  });
}

function roomName(newsletterId: string) {
  return `newsletter:${newsletterId}:tasks`;
}
