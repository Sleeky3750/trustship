"use client";

import { useState } from "react";
import { toast } from "sonner";

import type { Task } from "@/types/models";

import EditTaskModal from "./EditTaskModal";
import TaskActivity from "./TaskActivity";

export default function TaskActions({
  task,
  onTaskUpdated,
}: {
  task: Task;
  onTaskUpdated: (updatedTask: Task) => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [activityOpen, setActivityOpen] = useState(false);

  async function deleteTask() {
    setMenuOpen(false);

    const confirmed = window.confirm(
      "Delete this task?"
    );

    if (!confirmed) {
      return;
    }

    try {
      const response = await fetch(
        "/api/tasks/delete",
        {
          method: "DELETE",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            taskId: task.id,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(
          data.message ||
            "Failed to delete task."
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
    <>
      <div className="relative flex justify-end">
        <button
          type="button"
          onClick={() =>
            setMenuOpen(
              (current) => !current
            )
          }
          className="text-xl px-2 rounded-lg hover:bg-gray-100"
          aria-label="Task actions"
        >
          ⋮
        </button>

        {menuOpen && (
          <div className="absolute right-0 top-full mt-2 w-44 bg-white rounded-xl shadow-lg border z-50 overflow-hidden">
            <button
              type="button"
              onClick={() => {
                setMenuOpen(false);
                setEditOpen(true);
              }}
              className="block w-full text-left px-4 py-3 hover:bg-gray-100"
            >
              ✏️ Edit
            </button>

            <button
              type="button"
              onClick={() => {
                setMenuOpen(false);
                setActivityOpen(true);
              }}
              className="block w-full text-left px-4 py-3 hover:bg-gray-100"
            >
              🕒 Activity
            </button>

            <button
              type="button"
              onClick={deleteTask}
              className="block w-full text-left px-4 py-3 text-red-600 hover:bg-red-50"
            >
              🗑️ Delete
            </button>
          </div>
        )}
      </div>

      <EditTaskModal
        open={editOpen}
        task={task}
        onClose={() => setEditOpen(false)}
        onTaskUpdated={onTaskUpdated}
      />

      {activityOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg max-h-[85vh] overflow-y-auto rounded-2xl">
            <div className="flex justify-end bg-white rounded-t-2xl px-5 pt-4">
              <button
                type="button"
                onClick={() =>
                  setActivityOpen(false)
                }
                className="text-2xl text-gray-500 hover:text-gray-900"
                aria-label="Close activity"
              >
                ×
              </button>
            </div>

            <TaskActivity taskId={task.id} />
          </div>
        </div>
      )}
    </>
  );
}