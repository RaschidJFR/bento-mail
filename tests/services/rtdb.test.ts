import { Newsletter, Article, ITask } from '@lib/models';
import { JobNames, Task } from '@services/worker';
import { Server } from 'socket.io';
import { io } from 'socket.io-client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ObjectId } from 'mongodb';

describe('RTDB Service', () => {
  const port = 12899;
  let server: Server;

  beforeEach(async () => {
    const startServer = (await import('@services/RTDB')).setupAndStart;
    server = await startServer(port);
  });

  afterEach(() => {
    server.disconnectSockets();
    server.close();
  });

  describe('Basic connectivity', () => {
    it('Server can receive events from a client', async () => {
      let finishTest: (value: unknown) => void;
      const forTestToFinish = new Promise((resolve) => (finishTest = resolve));

      server.on('connection', (socket) => socket.on('testEvent', finishTest));
      const client = io(`http://localhost:${port}`);

      client.emit('testEvent', { data: 'test' });
      await expect(forTestToFinish).resolves.toEqual({ data: 'test' });
    });

    it('Server can send events to a client', async () => {
      let finishTest!: (value: unknown) => void;
      const forTestToFinish = new Promise((resolve) => (finishTest = resolve));

      server.on('connection', (socket) => socket.emit('testEvent', { data: 'test' }));

      const client = io(`http://localhost:${port}`);
      client.on('testEvent', finishTest);

      await expect(forTestToFinish).resolves.toEqual({ data: 'test' });
    });

    it('Server can broadcast events', async () => {
      let finishTest!: (value: unknown) => void;
      const forTestToFinish = new Promise((resolve) => (finishTest = resolve));

      const client = io(`http://localhost:${port}`);
      client.on('testEvent', finishTest);

      // Wait for client to actually connect before emitting
      await new Promise((resolve) => client.once('connect', () => resolve('')));

      server.emit('testEvent', { data: 'test' });
      await expect(forTestToFinish).resolves.toEqual({ data: 'test' });
    });

    it('Server can send events to a specific room', async () => {
      let finishTest!: (value: unknown) => void;
      const forTestToFinish = new Promise((resolve) => (finishTest = resolve));

      server.on('connection', (socket) => socket.join('testRoom'));

      const client = io(`http://localhost:${port}`);
      client.on('testEvent', finishTest);

      // Wait for client to actually connect before emitting
      await new Promise((resolve) => client.once('connect', () => resolve('')));

      server.to('testRoom').emit('testEvent', { data: 'test' });
      await expect(forTestToFinish).resolves.toEqual({ data: 'test' });
    });
  });

  describe('Task ChangeStream', () => {
    interface TaskChange {
      _id: ObjectId;
      data: Partial<ITask<{ id: string }>>;
    }

    let article: Article;
    let newsletter: Newsletter;

    beforeEach(async () => {
      article = (await Article.create({ content: ' Article content' })) as Article;
      newsletter = (await Newsletter.create({
        content: 'newsletter content',
        articles: [article],
      })) as Newsletter;
    });

    it('Emit when an article processing task is created', async () => {
      let onTaskChanged!: (value: TaskChange) => void;
      const taskChangePromise = new Promise<TaskChange>((resolve) => (onTaskChanged = vi.fn(resolve)));

      // Connect client and join newsletter room
      const client = io(`http://localhost:${port}`);
      client.on('taskChanged', onTaskChanged);
      client.emit('joinNewsletter', newsletter._id);

      // Wait for client to actually connect before emitting
      await new Promise((resolve: any) => client.once('connect', resolve));

      // Update task to trigger the change stream
      const taskData = { name: JobNames.Article.process, data: { id: article._id } };
      const task = await Task.create(taskData);
      const { _id, data } = await taskChangePromise;
      expect(_id).toBe(task.id);
      expect(data).toMatchObject(taskData);
      expect(onTaskChanged).toHaveBeenCalledOnce();
    });

    it('Emit when an article processing task is updated', async () => {
      let onTaskChanged!: (value: TaskChange) => void;
      const taskChangePromise = new Promise<TaskChange>((resolve) => (onTaskChanged = vi.fn(resolve)));

      // Create a task for the article in the newsletter
      const taskData = { name: JobNames.Article.process, data: { id: article._id } };
      const task = await Task.create(taskData);

      // Connect client and join newsletter room
      const client = io(`http://localhost:${port}`);
      client.on('taskChanged', onTaskChanged);
      client.emit('joinNewsletter', newsletter._id);

      // Wait for client to actually connect before emitting
      await new Promise((resolve: any) => client.once('connect', resolve));

      // Update task to trigger the change stream
      await task.set({ lockedAt: Date.now() }).save();
      const { _id, data } = await taskChangePromise;
      expect(_id).toBe(task.id);
      expect(data).toMatchObject({ ...taskData, lockedAt: task.lockedAt!.toISOString() });
      expect(onTaskChanged).toHaveBeenCalledOnce();
    });

    it(
      'Emit when an article processing task is deleted',
      async () => {
        let onTaskChanged!: (value: TaskChange) => void;
        const taskChangePromise = new Promise<TaskChange>((resolve) => (onTaskChanged = vi.fn(resolve)));

        const task = await Task.create({ name: JobNames.Article.process, data: { id: article._id } });

        // Connect client and join newsletter room
        const client = io(`http://localhost:${port}`);
        client.emit('joinNewsletter', newsletter._id);

        // Wait for client to actually connect before emitting
        await new Promise((resolve: any) => client.once('connect', resolve));

        // Set up listener and delete task to trigger the change stream
        client.on('taskChanged', onTaskChanged);
        await task.deleteOne();

        // Wait for change to be processed
        const { _id, data } = await taskChangePromise;
        expect(_id).toBe(task.id);
        expect(data).toBeNull();
        expect(onTaskChanged).toHaveBeenCalledOnce();
      },
      { todo: true }
    ); // Deletion currently not implemented

    it('Emit only to clients in a newsletter rooms', async () => {
      // Create a task for the article in the newsletter
      const task = await Task.create({ name: JobNames.Article.process, data: { id: article._id } });

      // Set up a mock to track calls
      let onTaskChanged!: (value: TaskChange) => void;
      const taskChangePromise = new Promise<TaskChange>((resolve) => (onTaskChanged = vi.fn(resolve)));

      // Connect client and join newsletter room
      const client = io(`http://localhost:${port}`);
      client.on('taskChanged', onTaskChanged);

      // Wait for client to actually connect before emitting
      await new Promise((resolve: any) => client.once('connect', resolve));

      // Update task to trigger the change stream
      await task.set({ lockedAt: Date.now() }).save();
      await new Promise((resolve: any) => setTimeout(resolve, 500)); // wait a bit for change to be processed
      expect(onTaskChanged).not.toHaveBeenCalled();

      client.emit('joinNewsletter', newsletter._id);
      await new Promise((resolve: any) => setTimeout(resolve, 500)); // wait a bit for join to be processed
      await task.set({ lockedAt: Date.now() }).save();
      await taskChangePromise;
      expect(onTaskChanged).toHaveBeenCalledOnce();
    });
  });
});
