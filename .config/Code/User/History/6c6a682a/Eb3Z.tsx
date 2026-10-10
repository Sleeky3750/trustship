"use client";

import { useState } from "react";
import { toast } from "sonner";

export default function WorkspaceActions({
workspaceId,
workspaceName,
}: {
workspaceId: string;
workspaceName: string;
}) {
const [open, setOpen] = useState(false);
const [editing, setEditing] = useState(false);
const [name, setName] = useState(workspaceName);
const [loading, setLoading] = useState(false);

async function updateWorkspace() {
const trimmedName = name.trim();


if (!trimmedName) {
  toast.error("Workspace name is required.");
  return;
}

setLoading(true);

try {
  const response = await fetch("/api/workspaces", {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      workspaceId,
      name: trimmedName,
    }),
  });

  const data = await response.json();

  if (!response.ok || !data.success) {
    throw new Error(
      data.message || "Failed to update workspace."
    );
  }

  toast.success("Workspace updated.");
  setEditing(false);
  setOpen(false);
  window.location.reload();
} catch (error) {
  toast.error(
    error instanceof Error
      ? error.message
      : "Failed to update workspace."
  );
} finally {
  setLoading(false);
}


}

async function deleteWorkspace() {
setOpen(false);

const confirmed = window.confirm(
  `Delete "${workspaceName}"?\n\nWorkspace deletion is currently disabled until the database cascade rules are confirmed.`
);

if (!confirmed) {
  return;
}

setLoading(true);

try {
  const response = await fetch("/api/workspaces", {
    method: "DELETE",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      workspaceId,
    }),
  });

  const data = await response.json();

  if (!response.ok || !data.success) {
    throw new Error(
      data.message || "Workspace deletion is not available yet."
    );
  }

  toast.success("Workspace deleted.");
  window.location.href = "/dashboard";
} catch (error) {
  toast.error(
    error instanceof Error
      ? error.message
      : "Workspace deletion is not available yet."
  );
} finally {
  setLoading(false);
}


}

return (
<> <div className="relative">
<button
type="button"
onClick={() => setOpen((current) => !current)}
disabled={loading}
className="rounded-lg border bg-white px-4 py-2 text-sm font-medium hover:bg-gray-50 disabled:opacity-50"
>
Workspace actions </button>

```
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
          ✏️ Edit workspace
        </button>

        <button
          type="button"
          onClick={deleteWorkspace}
          className="block w-full px-4 py-3 text-left text-sm text-red-600 hover:bg-red-50"
        >
          🗑️ Delete workspace
        </button>
      </div>
    )}
  </div>

  {editing && (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
        <h2 className="text-xl font-bold">
          Edit Workspace
        </h2>

        <input
          value={name}
          onChange={(event) => setName(event.target.value)}
          disabled={loading}
          placeholder="Workspace name"
          className="mt-5 w-full rounded-lg border p-3 outline-none focus:border-black"
          autoFocus
        />

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
            onClick={updateWorkspace}
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
