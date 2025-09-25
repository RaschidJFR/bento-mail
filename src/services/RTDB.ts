import { Article } from '@lib/models';
import mongoose from 'mongoose';
import { Server } from 'socket.io';
import http from 'http';

const PORT = 4001;

const server = http.createServer();
const io = new Server(server, {
  cors: { origin: '*' }
});

export async function main() {
  if (mongoose.connection.readyState !== 1) {
    await mongoose.connect(process.env.MONGODB_URI!, { dbName: process.env.DATABASE_NAME || 'development' });
  }

  const changeStream = Article.watch([], { fullDocument: 'updateLookup' });

  changeStream.on('change', (change) => {
    if (change.operationType === 'update' || change.operationType === 'replace') {
      const article = change.fullDocument;
      io.emit('articleUpdated', {
        _id: article._id,
        summaries: article.summaries,
        lastError: article.lastError,
      });
    }
  });

  server.listen(PORT, () => {
    console.log(`Article realtime server listening on port ${PORT}`);
  });
}

