"use client";

import { useState } from "react";

export default function CreateWorkspaceForm() {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    const response = await fetch("/api/workspaces", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name,
        description,
      }),
    });

    const data = await response.json();

    if (data.success) {
      alert("Workspace created successfully!");

      setName("");
      setDescription("");

      window.location.reload();
    } else {
      alert(data.message);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <input
        type="text"
        placeholder="Workspace Name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="w-full border rounded-lg p-3"
        required
      />

      <textarea
        placeholder="Description (optional)"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        className="w-full border rounded-lg p-3"
      />

      <button
        type="submit"
        className="bg-black text-white px-6 py-3 rounded-lg"
      >
        Create Workspace
      </button>
    </form>
  );
}