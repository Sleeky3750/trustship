export interface Task {
  id: string;
  title: string;
  description: string | null;

  status: "TODO" | "IN_PROGRESS" | "DONE";

  priority: "LOW" | "MEDIUM" | "HIGH";

  dueDate: string | null;

  createdAt?: string;
  updatedAt?: string;
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