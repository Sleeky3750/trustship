"use client";

import { CSS } from "@dnd-kit/utilities";
import { useDraggable } from "@dnd-kit/core";

import type {
  Task,
  TaskStatus,
} from "@/types/models";

import TaskStatus from "../TaskStatus";
import TaskActions from "../TaskActions";

export default function TaskCard({
  task,
  onStatusChange,
}: {
  task: Task;
  onStatusChange: (
    taskId: string,
    newStatus: TaskStatus
  ) => Promise<void>;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    isDragging,
  } = useDraggable({
    id: task.id,
  });

  const style = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className="bg-white rounded-xl shadow p-4 cursor-grab active:cursor-grabbing select-none"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-bold break-words">
            {task.title}
          </h3>
        </div>

        <div
          onPointerDown={(e) =>
            e.stopPropagation()
          }
          onKeyDown={(e) =>
            e.stopPropagation()
          }
        >
          <TaskActions task={task} />
        </div>
      </div>

      <p className="text-gray-600 mt-2">
        {task.description || "No description"}
      </p>

      <div className="mt-4 flex flex-wrap gap-2">
        <span className="text-xs px-2 py-1 rounded-full bg-gray-100">
          {task.priority}
        </span>

        {task.dueDate && (
          <span className="text-xs px-2 py-1 rounded-full bg-gray-100">
            📅{" "}
            {task.dueDate.toLocaleDateString()}
          </span>
        )}
      </div>

      <div
        className="mt-4"
        onPointerDown={(e) =>
          e.stopPropagation()
        }
      >
        <TaskStatus
          taskId={task.id}
          status={task.status}
          onStatusChange={onStatusChange}
        />
      </div>
    </div>
  );
}