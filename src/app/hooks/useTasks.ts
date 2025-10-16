import { useEffect, useState } from 'react';
import type { ITask } from '@lib/models';
import { socket } from './getSocket';

interface TaskChange {
  _id: ITask['_id'];
  data: Partial<ITask> | null;
}

export function useTasks(newsletterId: string, initialTasks: ITask[] = []) {
  console.debug('Initializing useTasks for newsletter %o', newsletterId);
  const [tasks, setTasks] = useState<ITask[]>(initialTasks);

  useEffect(() => {
    console.debug('Setting up task listener for newsletter %o', newsletterId);
    // Handle task updates
    const handler = ({ _id, data }: TaskChange) => {
      console.debug('Received task change: %o', { _id, data });
      if (data) {
        setTasks((prev) => prev.map((task) => (task._id === _id ? { ...task, ...data } : task)));
      } else {
        setTasks((prev) => prev.filter((task) => task._id !== _id));
      }
    };

    socket.emit('joinNewsletter', newsletterId);
    socket.on('taskChanged', console.debug);

    console.debug('Listening for task changes for newsletter %o', newsletterId);

    // Clean up on unmount
    return () => {
      socket.off('taskChanged', handler);
    };
  }, [newsletterId]);

  return [tasks, setTasks];
}
