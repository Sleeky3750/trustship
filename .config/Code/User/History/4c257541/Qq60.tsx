"use client";

import { CSS } from "@dnd-kit/utilities";
import { useDraggable } from "@dnd-kit/core";

import type { Task } from "@/types/models";

import TaskStatus from "../TaskStatus";
import TaskActions from "../TaskActions";

export default function TaskCard({
  task,
}: {
  task: Task;
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

  const overdue =
    task.dueDate &&
    new Date(task.dueDate) < new Date();

  function priorityColor() {
    switch (task.priority) {
      case "HIGH":
        return "bg-red-100 text-red-700";

      case "LOW":
        return "bg-green-100 text-green-700";

      default:
        return "bg-yellow-100 text-yellow-700";
    }
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className="bg-white rounded-xl shadow p-4 cursor-grab active:cursor-grabbing select-none"
    >
    <div className="flex justify-between items-start">

  <div>

    <h3 className="font-bold">
      {task.title}
    </h3>

  </div>

  <TaskActions
    task={task}
  />

</div>

        <span
          className={`text-xs px-2 py-1 rounded-full ${priorityColor()}`}
        >
          {task.priority}
        </span>

      

      <p className="text-gray-600 mt-2">
        {task.description || "No description"}
      </p>

      {task.dueDate && (
        <div
          className={`mt-3 text-sm ${
            overdue
              ? "text-red-600 font-semibold"
              : "text-gray-500"
          }`}
        >
          {overdue ? "🚨" : "📅"}{" "}
          {new Date(task.dueDate).toLocaleDateString()}
        </div>
      )}

      <div className="mt-4">
        <TaskStatus
          taskId={task.id}
          status={task.status}
        />
      </div>

    
    </div>
  );
}