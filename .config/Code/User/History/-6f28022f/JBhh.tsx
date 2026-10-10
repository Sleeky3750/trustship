"use client";

import { useState } from "react";

export default function CreateWorkspaceForm() {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [message, setMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    setLoading(true);
    setMessage("");
    setSuccessMessage("");

    try {
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

      console.log(data);

      if (data.success) {
        setSuccessMessage("Workspace created successfully!");

        setName("");
        setDescription("");

        window.location.reload();
      } else {
        setMessage(data.message || "Unable to create workspace.");
      }
    } catch (error) {
      console.error("Workspace creation error:", error);

      setMessage("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      {successMessage && (
        <div className="rounded-xl border border-green-200 bg-green-50 p-4 text-green-700">
          {successMessage}
        </div>
      )}

      {message && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-700">
          {message}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <input
          type="text"
          placeholder="Workspace Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full rounded-lg border border-zinc-300 p-3 outline-none focus:border-black focus:ring-2 focus:ring-black/10"
          required
        />

        <textarea
          placeholder="Description (optional)"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="w-full rounded-lg border border-zinc-300 p-3 outline-none focus:border-black focus:ring-2 focus:ring-black/10"
        />

        <button
          type="submit"
          disabled={!name.trim() || loading}
          className={`rounded-lg px-6 py-3 font-semibold text-white transition ${
            !name.trim() || loading
              ? "cursor-not-allowed bg-zinc-400"
              : "bg-black hover:bg-zinc-800"
          }`}
        >
          {loading ? "Creating Workspace..." : "Create Workspace"}
        </button>
      </form>
    </div>
  );
}