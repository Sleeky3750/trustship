"use client";

import type { TaskStatus as TaskStatusType } from "@/types/models";

export default function TaskStatus({
  taskId,
  status,
  onStatusChange,
}: {
  taskId: string;
  status: TaskStatusType;
  onStatusChange: (
    taskId: string,
    newStatus: TaskStatusType
  ) => Promise<void>;
}) {
  return (
    <select
      value={status}
      onChange={(e) =>
        onStatusChange(
          taskId,
          e.target.value as TaskStatusType
        )
      }
      className="border border-gray-200 bg-gray-50 rounded-lg px-3 py-2 mt-2 text-sm font-medium text-gray-700 outline-none transition focus:border-gray-400 focus:ring-2 focus:ring-gray-100"
    >
      <option value="TODO">
        TODO
      </option>

      <option value="IN_PROGRESS">
        IN PROGRESS
      </option>

      <option value="DONE">
        DONE
      </option>
    </select>
  );
}