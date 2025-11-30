import { io } from 'socket.io-client';

export const SOCKET_URL =
  (typeof process !== 'undefined' && process.env.NEXT_PUBLIC_SOCKET_URL) || 'http://localhost:4001';
export const socket = io(SOCKET_URL, { autoConnect: true });
