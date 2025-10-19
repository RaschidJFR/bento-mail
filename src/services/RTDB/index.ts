import { Server } from 'socket.io';
import { setupTaskChangestream } from './task';
import { setupArticleChangestream } from './article';

let io: Server;

/**
 * Sets up and starts the real-time database socket server.
 * If the server is already running, it returns the existing instance.
 */
export async function setupAndStart(port = 4001) {
  if (io) {
    console.warn('RTDB server is already running on port %o\n', port);
    return io;
  }

  io = new Server({
    cors: { origin: '*' },
  });

  await setupArticleChangestream(io);
  await setupTaskChangestream(io);

  io.on('connection', (client) => {
    console.log('Client %o connected', client.id);
    client.on('disconnect', () => console.log(`Client %o disconnected`, client.id));
  });

  io.listen(port);
  console.log(`Database socket server listening on port %o\n`, port);

  return io;
}
