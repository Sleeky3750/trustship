"use client";

import { toast } from "sonner";

export default function DeleteTaskButton({
  taskId,
}: {
  taskId: string;
}) {
  async function deleteTask(
    event: React.MouseEvent<HTMLButtonElement>
  ) {
    event.stopPropagation();

    const confirmed = window.confirm(
      "Delete this task?"
    );

    if (!confirmed) {
      return;
    }

    try {
      const response = await fetch("/api/tasks", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          taskId,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(
          data.message || "Failed to delete task."
        );
      }

      toast.success("Task deleted.");
      window.location.reload();
    } catch (error) {
      console.error(error);

      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to delete task."
      );
    }
  }

  return (
    <button
      type="button"
      onClick={deleteTask}
      onPointerDown={(event) =>
        event.stopPropagation()
      }
      className="mt-3 text-sm text-red-600 hover:underline"
    >
      🗑 Delete
    </button>
  );
}