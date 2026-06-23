import { io } from 'socket.io-client';

const SOCKET_URL = (typeof process !== 'undefined' && process.env.NEXT_PUBLIC_SOCKET_URL) || '';
if (!SOCKET_URL) {
  console.info('Socket not initialized, real-time task updates not available');
}

export const getSocket = () => (!!SOCKET_URL ? io(SOCKET_URL, { autoConnect: true }) : null);
