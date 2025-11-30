import { io } from 'socket.io-client';

// Add this var to make process accessible in browser
// eslint-disable-next-line no-var
var process;

export const SOCKET_URL = process?.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:4001';
export const socket = io(SOCKET_URL, { autoConnect: true });
