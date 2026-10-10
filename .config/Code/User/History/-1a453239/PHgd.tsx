"use client";

import { useState } from "react";
import { toast } from "sonner";

export default function CreateTaskForm({
  projectId,
}: {
  projectId: string;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] =
    useState("");

  const [priority, setPriority] =
    useState("MEDIUM");

  const [dueDate, setDueDate] =
    useState("");

  const [loading, setLoading] =
    useState(false);

  async function handleSubmit(
    e: React.FormEvent
  ) {
    e.preventDefault();

    setLoading(true);

    const response = await fetch("/api/tasks", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        title,
        description,
        priority,
        dueDate,
        projectId,
      }),
    });

    const data = await response.json();

    setLoading(false);

    if (data.success) {
      toast.success(
        "Task created successfully!"
      );

      setTitle("");
      setDescription("");
      setPriority("MEDIUM");
      setDueDate("");

      window.location.reload();
    } else {
      toast.error(data.message);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-4 mb-8"
    >
      <input
        className="w-full border rounded-lg p-3"
        placeholder="Task title"
        value={title}
        onChange={(e) =>
          setTitle(e.target.value)
        }
        required
      />

      <textarea
        className="w-full border rounded-lg p-3"
        placeholder="Description"
        value={description}
        onChange={(e) =>
          setDescription(e.target.value)
        }
      />

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-sm font-medium">
            Priority
          </label>

          <select
            value={priority}
            onChange={(e) =>
              setPriority(e.target.value)
            }
            className="w-full border rounded-lg p-3 mt-1"
          >
            <option value="LOW">
              🟢 Low
            </option>

            <option value="MEDIUM">
              🟡 Medium
            </option>

            <option value="HIGH">
              🔴 High
            </option>
          </select>
        </div>

        <div>
          <label className="text-sm font-medium">
            Due Date
          </label>

          <input
            type="date"
            value={dueDate}
            onChange={(e) =>
              setDueDate(e.target.value)
            }
            className="w-full border rounded-lg p-3 mt-1"
          />
        </div>
      </div>

      <button
        disabled={loading}
        className="bg-black text-white px-6 py-3 rounded-lg disabled:opacity-50"
      >
        {loading
          ? "Creating..."
          : "Create Task"}
      </button>
    </form>
  );
}