"use client";

import { useState } from "react";
import {
  DndContext,
  DragEndEvent,
} from "@dnd-kit/core";

import type {
  Task,
  TaskStatus,
} from "@/types/models";

import KanbanColumn from "./KanbanColumn";

export default function KanbanBoard({
  tasks,
}: {
  tasks: Task[];
}) {
  const [taskList, setTaskList] =
    useState<Task[]>(tasks);

  const [updatingTaskId, setUpdatingTaskId] =
    useState<string | null>(null);

  async function handleDragEnd(
    event: DragEndEvent
  ) {
    const { active, over } = event;

    if (!over) return;

    const taskId = String(active.id);
    const newStatus =
      String(over.id) as TaskStatus;

    const currentTask = taskList.find(
      (task) => task.id === taskId
    );

    if (!currentTask) return;

    if (currentTask.status === newStatus) {
      return;
    }

    const previousTasks = taskList;

    // Optimistic update
    setTaskList((current) =>
      current.map((task) =>
        task.id === taskId
          ? {
              ...task,
              status: newStatus,
              updatedAt: new Date(),
            }
          : task
      )
    );

    setUpdatingTaskId(taskId);

    try {
      const response = await fetch(
        "/api/tasks/update",
        {
          method: "PATCH",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            taskId,
            status: newStatus,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(
          data.message ||
            "Failed to update task."
        );
      }

      // Use the server's task if returned.
      if (data.task) {
        setTaskList((current) =>
          current.map((task) =>
            task.id === taskId
              ? {
                  ...task,
                  ...data.task,
                }
              : task
          )
        );
      }
    } catch (error) {
      console.error(
        "Task status update failed:",
        error
      );

      // Roll back if the server rejected it.
      setTaskList(previousTasks);
    } finally {
      setUpdatingTaskId(null);
    }
  }

  return (
    <div className="relative">
      {updatingTaskId && (
        <div className="mb-4 rounded-lg border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-700">
          Saving task status...
        </div>
      )}

      <DndContext
        onDragEnd={handleDragEnd}
      >
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <KanbanColumn
            id="TODO"
            title="🟡 TODO"
            tasks={taskList.filter(
              (task) =>
                task.status === "TODO"
            )}
          />

          <KanbanColumn
            id="IN_PROGRESS"
            title="🔵 IN PROGRESS"
            tasks={taskList.filter(
              (task) =>
                task.status ===
                "IN_PROGRESS"
            )}
          />

          <KanbanColumn
            id="DONE"
            title="🟢 DONE"
            tasks={taskList.filter(
              (task) =>
                task.status === "DONE"
            )}
          />
        </div>
      </DndContext>
    </div>
  );
}