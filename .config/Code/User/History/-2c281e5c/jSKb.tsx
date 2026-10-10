"use client";
import { toast } from "sonner";
export default function DeleteTaskButton({
  taskId,
}: {
  taskId: string;
}) {
  async function deleteTask() {
    const confirmed = confirm(
      "Delete this task?"
    );

    if (!confirmed) return;

    const response = await fetch("/api/tasks/delete", {
  method: "DELETE",
  headers: {
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    taskId,
  }),
});

const data = await response.json();

if (data.success) {
  toast.success("Task deleted.");
  window.location.reload();
} else {
  toast.error(data.message);
}
  }

  return (
    <button
      onClick={deleteTask}
      className="mt-3 text-red-600 text-sm hover:underline"
    >
      🗑 Delete
    </button>
  );
}
