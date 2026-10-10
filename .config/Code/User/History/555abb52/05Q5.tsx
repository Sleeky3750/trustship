"use client";

import { useState } from "react";

export default function TodayFocus() {
  const [answer, setAnswer] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function getTodayFocus() {
    if (loading) return;

    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/ai/analyze", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          mode: "TODAY",
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(
          data.message ||
            "Pulse AI could not analyze your tasks."
        );
      }

      setAnswer(data.answer);
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Something went wrong."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="mb-10 rounded-2xl bg-white p-6 shadow">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold">
            🧠 What should I do today?
          </h2>

          <p className="mt-1 text-sm text-gray-500">
            Let Pulse AI analyze your current tasks
            and recommend what deserves attention.
          </p>
        </div>

        <button
          type="button"
          onClick={getTodayFocus}
          disabled={loading}
          className="rounded-lg bg-black px-5 py-3 text-sm font-medium text-white transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? "Thinking..." : "Analyze"}
        </button>
      </div>

      {error && (
        <div className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {answer && !error && (
        <div className="mt-6 whitespace-pre-wrap rounded-xl border border-gray-200 bg-gray-50 p-5 text-sm leading-7 text-gray-800">
          {answer}
        </div>
      )}
    </section>
  );
}