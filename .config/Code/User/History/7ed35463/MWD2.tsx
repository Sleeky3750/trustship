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
  const [taskList, setTaskList] = useState(tasks);

  async function handleDragEnd(
    event: DragEndEvent
  ) {
    const { active, over } = event;

    if (!over) return;

    const taskId = active.id as string;

    const newStatus = over.id as TaskStatus;

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

    await fetch("/api/tasks/update", {
      method: "PATCH",
      headers: {
        "Content-Type":
          "application/json",
      },
      body: JSON.stringify({
        taskId,
        status: newStatus,
      }),
    });
  }

  return (
    <DndContext
      onDragEnd={handleDragEnd}
    >
      <div className="grid grid-cols-3 gap-6">

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