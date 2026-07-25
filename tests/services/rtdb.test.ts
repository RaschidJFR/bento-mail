import { Newsletter, Article, ITask, IArticle, INewsletter } from '@lib/models';
import { JobNames, Task } from '@services/worker';
import { Server } from 'socket.io';
import { io, Socket } from 'socket.io-client';
import { afterAll, afterEach, beforeEach, describe, expect, it, Mock, vi } from 'vitest';
import type { ObjectId } from 'mongodb';

describe('RTDB Service', { skip: true }, () => {
  const port = 12899;
  let server: Server;
  let client: Socket;

  function connect(client: Socket) {
    client.connect();
    return new Promise<void>((resolve: any) => client.once('connect', resolve));
  }

  beforeEach(async () => {
    const startServer = (await import('@services/RTDB')).setupAndStart;
    server = await startServer(port);
    client = io(`http://localhost:${port}`, { autoConnect: false });
  });

  afterEach(async () => {
    client.close();
  });

  afterAll(async () => {
    await server.close();
  });

  describe('Basic connectivity', () => {
    it('Server can receive events from a client', async () => {
      let finishTest: (value: unknown) => void;
      const forTestToFinish = new Promise((resolve) => (finishTest = resolve));

      server.on('connection', (socket) => socket.on('testEvent', finishTest));
      client.connect();

      client.emit('testEvent', { data: 'test' });
      await expect(forTestToFinish).resolves.toEqual({ data: 'test' });
    });

    it('Server can send events to a client', async () => {
      let finishTest!: (value: unknown) => void;
      const forTestToFinish = new Promise((resolve) => (finishTest = resolve));

      server.on('connection', (socket) => socket.emit('testEvent', { data: 'test' }));

      client.connect();
      client.on('testEvent', finishTest);

      await expect(forTestToFinish).resolves.toEqual({ data: 'test' });
    });

    it('Server can broadcast events', async () => {
      let finishTest!: (value: unknown) => void;
      const forTestToFinish = new Promise((resolve) => (finishTest = resolve));

      client.connect();
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

      client.connect();
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

    let article: IArticle;
    let newsletter: INewsletter;

    beforeEach(async () => {
      article = await Article.create({
        content: ' Article content',
        sourceName: '',
        header: '',
        date: null,
        url: null,
        linkedArticles: null,
        lastError: null,
        coverImg: null,
        summaries: null,
      });
      newsletter = await Newsletter.create({
        content: 'newsletter content',
        articles: [article._id],
        error: null,
        name: null,
        url: null,
        date: null,
      });
    });

    it('Emit when a task is created', async () => {
      let onTaskChanged!: (value: TaskChange) => void;
      const taskChangePromise = new Promise<TaskChange>((resolve) => (onTaskChanged = vi.fn(resolve)));

      // Connect client and join newsletter room
      client.connect();
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

    it('Emit when a task is updated', async () => {
      let onTaskChanged!: (value: TaskChange) => void;
      const taskChangePromise = new Promise<TaskChange>((resolve) => (onTaskChanged = vi.fn(resolve)));

      // Create a task for the article in the newsletter
      const taskData = { name: JobNames.Article.process, data: { id: article._id } };
      const task = await Task.create(taskData);

      // Connect client and join newsletter room
      client.connect();
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
      'Emit when a task is deleted',
      async () => {
        let onTaskChanged!: (value: TaskChange) => void;
        const taskChangePromise = new Promise<TaskChange>((resolve) => (onTaskChanged = vi.fn(resolve)));

        const task = await Task.create({ name: JobNames.Article.process, data: { id: article._id } });

        // Connect client and join newsletter room
        client.on('taskChanged', onTaskChanged);
        client.emit('joinNewsletter', newsletter._id);
        client.connect();
        await new Promise((resolve: any) => client.once('connect', resolve));

        // Set up listener and delete task to trigger the change stream
        await task.deleteOne();

        // wait for 3 secs
        await new Promise((resolve) => setTimeout(resolve, 3000));

        // Wait for change to be processed
        const { _id, data } = await taskChangePromise;
        expect(_id).toBe(task.id);
        expect(data).toBeNull();
        expect(onTaskChanged).lastCalledWith({ _id: task._id, data: null });
      },
      { todo: true },
    ); // changeStreamPreAndPostImages is required for this test to work

    it('Emit only to clients in a newsletter rooms', async () => {
      // Create a task for the article in the newsletter
      const task = await Task.create({ name: JobNames.Article.process, data: { id: article._id } });

      // Set up a mock to track calls
      let onTaskChanged!: (value: TaskChange) => void;
      const taskChangePromise = new Promise<TaskChange>((resolve) => (onTaskChanged = vi.fn(resolve)));

      // Connect client and join newsletter room
      client.connect();
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

  describe('Article ChangeStream', () => {
    interface ArticleChange {
      _id: ObjectId;
      data: IArticle | null;
    }

    let article: IArticle;
    let newsletter: INewsletter;

    beforeEach(async () => {
      article = await Article.create({
        content: ' Article content',
        sourceName: '',
        header: '',
        date: null,
        url: null,
        linkedArticles: null,
        lastError: null,
        coverImg: null,
        summaries: null,
      });
      newsletter = await Newsletter.create({
        content: 'newsletter content',
        articles: [article._id],
        error: null,
        name: null,
        url: null,
        date: null,
      });
    });

    it('Emit when an article is created', async () => {
      let onArticleChanged!: (value: any) => void;
      const articleChangePromise = new Promise<ArticleChange>((resolve) => (onArticleChanged = resolve));

      // Connect client
      client.emit('joinNewsletter', newsletter._id);
      client.connect();
      await new Promise<void>((resolve: any) => client.once('connect', resolve));

      // Generate a new article and add it to the newsletter
      const newArticle = await Article.create({
        content: 'new article',
        sourceName: '',
        header: '',
        date: null,
        url: null,
        linkedArticles: null,
        lastError: null,
        coverImg: null,
        summaries: null,
      });
      await Newsletter.addArticle(newsletter._id, newArticle._id);

      // Create the article with the pre-shared id to trigger the change stream
      client.on('articleChanged', onArticleChanged);
      const { _id, data } = await articleChangePromise;
      expect(_id).toBe(newArticle._id);
      expect(data?.content).toBe('new article');
    });

    it('Emit when an article is updated', async () => {
      let onArticleChanged!: Mock;
      const articleChangePromise = new Promise<ArticleChange>((resolve) => (onArticleChanged = vi.fn(resolve)));

      // Connect client and join newsletter room
      client.connect();
      client.on('articleChanged', onArticleChanged);
      client.emit('joinNewsletter', newsletter._id);

      // Wait for client to actually connect before emitting
      await new Promise((resolve: any) => client.once('connect', resolve));

      // Update article to trigger the change stream
      await Article.where({ _id: article._id }).update({ content: 'updated content' });
      const { _id, data } = await articleChangePromise;
      expect(_id).toBe(article._id);
      expect(data?.content).toBe('updated content');
      expect(onArticleChanged).toHaveBeenCalledOnce();
    });

    it('Emit when an article is deleted', async () => {
      let onArticleChanged!: Mock;
      const articleChangePromise = new Promise<ArticleChange>((resolve) => (onArticleChanged = vi.fn(resolve)));

      // Connect client and join newsletter room
      client.on('articleChanged', onArticleChanged);
      client.emit('joinNewsletter', newsletter._id);
      client.connect();

      // Wait for client to be ready
      await new Promise((resolve: any) => client.once('connect', resolve));

      // Delete article to trigger the change stream
      await Article.where({ _id: article._id }).delete();

      // Wait for change to be processed
      const { _id, data } = await articleChangePromise;
      expect(_id).toBe(article._id);
      expect(data).toBeNull();
      expect(onArticleChanged).toHaveBeenLastCalledWith({ _id: article._id, data: null });
    });

    it('Emit only to clients in a newsletter rooms', async () => {
      // Set up a mock to track calls
      let onArticleChanged!: Mock;
      const articleChangePromise = new Promise<ArticleChange>((resolve) => (onArticleChanged = vi.fn(resolve)));

      // Connect client and do NOT join newsletter room initially
      client.connect();
      client.on('articleChanged', onArticleChanged);

      // Wait for client to actually connect before emitting
      await new Promise((resolve: any) => client.once('connect', resolve));

      // Update article to trigger the change stream
      await Article.where({ _id: article._id }).update({ content: 'first update' });
      await new Promise((resolve: any) => setTimeout(resolve, 500)); // wait a bit for change to be processed
      expect(onArticleChanged).not.toHaveBeenCalled();

      client.emit('joinNewsletter', newsletter._id);
      await new Promise((resolve: any) => setTimeout(resolve, 500)); // wait a bit for join to be processed
      await Article.where({ _id: article._id }).update({ content: 'second update' });
      await articleChangePromise;
      expect(onArticleChanged).toHaveBeenCalledOnce();
    });
  });
});
