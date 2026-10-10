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

  async function handleDragEnd(
    event: DragEndEvent
  ) {
    const { active, over } = event;

    if (!over) return;

    const taskId = String(active.id);
    const newStatus =
      String(over.id) as TaskStatus;

    console.log("Updating task:", {
      taskId,
      newStatus,
    });

    setTaskList((current) =>
      current.map((task) =>
        task.id === taskId
          ? {
              ...task,
              status: newStatus,
            }
          : task
      )
    );

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

      console.log(
        "Update API response:",
        {
          status: response.status,
          data,
        }
      );

      if (!response.ok || !data.success) {
        throw new Error(
          data.message ||
            "Failed to update task."
        );
      }
    } catch (error) {
      console.error(
        "Task update failed:",
        error
      );

      setTaskList(tasks);
    }
  }

  return (
    <DndContext
      onDragEnd={handleDragEnd}
    >
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
  );
}

