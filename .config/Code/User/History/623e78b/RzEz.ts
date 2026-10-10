export interface Task {
  id: string;
  title: string;
  description: string | null;
  status: string;
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
