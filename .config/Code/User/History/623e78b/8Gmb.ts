export type TaskStatus =
  | "TODO"
  | "IN_PROGRESS"
  | "DONE";

export type TaskPriority =
  | "LOW"
  | "MEDIUM"
  | "HIGH";

export interface Task {
  id: string;
  title: string;
  description: string | null;

  status: TaskStatus;
  priority: TaskPriority;

  dueDate: Date | null;

  createdAt: Date;
  updatedAt: Date;

  projectId: string;
}

export interface Project {
  id: string;
  name: string;
  description: string | null;
}

export interface Workspace {
  id: string;
  name: string;
  description: string | null;
}