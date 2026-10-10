"use client";

import { useState } from "react";
import { toast } from "sonner";

export default function ProjectActions({
  projectId,
  projectName,
  projectDescription,
}: {
  projectId: string;
  projectName: string;
  projectDescription: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);

  const [name, setName] = useState(projectName);
  const [description, setDescription] = useState(
    projectDescription ?? ""
  );

  const [loading, setLoading] = useState(false);

  async function updateProject() {
    const trimmedName = name.trim();

    if (!trimmedName) {
      toast.error("Project name is required.");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch("/api/projects", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          projectId,
          name: trimmedName,
          description: description.trim(),
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(
          data.message || "Failed to update project."
        );
      }

      toast.success("Project updated.");

      setEditing(false);
      setOpen(false);

      window.location.reload();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to update project."
      );
    } finally {
      setLoading(false);
    }
  }

  async function deleteProject() {
    setOpen(false);

    const confirmed = window.confirm(
      `Delete "${projectName}"?\n\nThis will permanently delete the project and its tasks.`
    );

    if (!confirmed) {
      return;
    }

    setLoading(true);

    try {
      const response = await fetch("/api/projects", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          projectId,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(
          data.message || "Failed to delete project."
        );
      }

      toast.success("Project deleted.");

      window.location.href = "/dashboard";
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to delete project."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <div className="relative">
        <button
          type="button"
          onClick={() => setOpen((current) => !current)}
          disabled={loading}
          className="rounded-lg border bg-white px-4 py-2 text-sm font-medium hover:bg-gray-50 disabled:opacity-50"
        >
          Project actions
        </button>

        {open && (
          <div className="absolute right-0 top-full z-50 mt-2 w-52 overflow-hidden rounded-xl border bg-white shadow-lg">
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                setEditing(true);
              }}
              className="block w-full px-4 py-3 text-left text-sm hover:bg-gray-50"
            >
              ✏️ Edit project
            </button>

            <button
              type="button"
              onClick={deleteProject}
              className="block w-full px-4 py-3 text-left text-sm text-red-600 hover:bg-red-50"
            >
              🗑️ Delete project
            </button>
          </div>
        )}
      </div>

      {editing && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl">
            <h2 className="text-xl font-bold">
              Edit Project
            </h2>

            <div className="mt-5 space-y-4">
              <input
                value={name}
                onChange={(event) =>
                  setName(event.target.value)
                }
                disabled={loading}
                placeholder="Project name"
                className="w-full rounded-lg border p-3 outline-none focus:border-black"
                autoFocus
              />

              <textarea
                value={description}
                onChange={(event) =>
                  setDescription(event.target.value)
                }
                disabled={loading}
                placeholder="Project description"
                rows={4}
                className="w-full rounded-lg border p-3 outline-none focus:border-black"
              />
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setEditing(false)}
                disabled={loading}
                className="rounded-lg border px-5 py-2"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={updateProject}
                disabled={loading}
                className="rounded-lg bg-black px-5 py-2 text-white disabled:opacity-50"
              >
                {loading ? "Saving..." : "Save changes"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}