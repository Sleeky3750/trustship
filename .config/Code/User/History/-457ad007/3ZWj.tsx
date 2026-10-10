"use client";

import { useDroppable } from "@dnd-kit/core";

import type {
  Task,
  TaskStatus,
} from "@/types/models";

import TaskCard from "./TaskCard";

export default function KanbanColumn({
  id,
  title,
  tasks,
  onStatusChange,
}: {
  id: string;
  title: string;
  tasks: Task[];
  onStatusChange: (
    taskId: string,
    newStatus: TaskStatus
  ) => Promise<void>;
  onTaskUpdated: (updatedTask: Task) => void;
}) {
  const {
    setNodeRef,
    isOver,
  } = useDroppable({
    id,
  });

  return (
    <div
      ref={setNodeRef}
      className={`rounded-xl p-4 min-h-[300px] transition ${
        isOver
          ? "bg-blue-50 ring-2 ring-blue-300"
          : "bg-gray-100"
      }`}
    >
      <h2 className="font-bold text-xl mb-4">
        {title}
      </h2>

      <div className="space-y-4">
        {tasks.map((task) => (
          <TaskCard
  key={task.id}
  task={task}
  onStatusChange={onStatusChange}
  onTaskUpdated={onTaskUpdated}
/>
        ))}

        {tasks.length === 0 && (
          <p className="text-sm text-gray-400 text-center py-8">
            Drop tasks here
          </p>
        )}
      </div>
    </div>
  );
}