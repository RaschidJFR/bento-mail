import { Dispatch, SetStateAction, useEffect, useState } from 'react';
import type { ITask } from '@lib/models';
import { socket } from './getSocket';

export type ITaskArticleProcess = Omit<ITask<{ id: string }>, '_id'> & { _id: string };

interface TaskChange {
  _id: ITaskArticleProcess['_id'];
  data: ITaskArticleProcess;
}

export function useTasks(
  newsletterId: string,
  initialTasks: ITaskArticleProcess[]
): [Map<string, ITaskArticleProcess>, Dispatch<SetStateAction<Map<string, ITaskArticleProcess>>>] {
  const [tasks, setTasks] = useState<ITaskArticleProcess[]>(initialTasks);
  const [taskMap, setTaskMap] = useState(new Map(tasks.map((task) => [task.data.id, task])));

  useEffect(() => {
    const newJobMap = new Map(tasks.map((task) => [task.data.id, task]));
    setTaskMap(newJobMap);
  }, [tasks]);

  useEffect(() => {
    // Handle task updates (use functional updater to avoid stale closure)
    const handler = ({ _id: taskId, data: task }: TaskChange) => {
      return task
        ? setTasks((prev) => findAndUpdateTask(taskId, task, prev))
        : setTasks((prev) => findAndRemoveTask(taskId, prev));
    };

    socket.emit('joinNewsletter', newsletterId);
    socket.on('taskChanged', handler);

    // Clean up on unmount / newsletter change: remove listener and leave room
    return () => {
      socket.off('taskChanged', handler);
      socket.emit('leaveNewsletter', newsletterId);
    };
  }, [newsletterId]);

  return [taskMap, setTaskMap];
}

function findAndUpdateTask(
  taskId: ITaskArticleProcess['_id'],
  updatedTask: ITaskArticleProcess,
  tasks: ITaskArticleProcess[]
) {
  const i = tasks.findIndex((task) => task._id === taskId);
  if (i >= 0) {
    tasks = tasks.map((task) => (task._id === taskId ? updatedTask : task));
  } else {
    tasks = [...tasks, updatedTask];
  }
  tasks = tasks.filter(isTaskActive);
  return tasks;
}

function findAndRemoveTask(taskId: ITaskArticleProcess['_id'], tasks: ITaskArticleProcess[]) {
  tasks = tasks.filter((task) => task._id !== taskId);
  return tasks;
}

/**
 * Look at `task.lockedAt` and `task.nextRunAt` to determine if the task is active
 */
export function isTaskActive(task: ITaskArticleProcess) {
  return !!task.lockedAt || !!task.nextRunAt;
}
