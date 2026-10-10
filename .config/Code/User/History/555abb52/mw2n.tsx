"use client";

import { useState } from "react";

type Mode =
  | "TODAY"
  | "PROGRESS"
  | "PRIORITIES"
  | "HEALTH";

const modes: {
  value: Mode;
  label: string;
  description: string;
}[] = [
  {
    value: "TODAY",
    label: "Today",
    description:
      "What deserves your attention today.",
  },
  {
    value: "PROGRESS",
    label: "Progress",
    description:
      "How your projects are moving.",
  },
  {
    value: "PRIORITIES",
    label: "Priorities",
    description:
      "What matters most right now.",
  },
  {
    value: "HEALTH",
    label: "Project Health",
    description:
      "Which projects need attention.",
  },
];

export default function TodayFocus() {
  const [mode, setMode] = useState<Mode>("TODAY");
  const [answer, setAnswer] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function analyze(
    selectedMode: Mode = mode
  ) {
    if (loading) return;

    setLoading(true);
    setError("");

    try {
      const response = await fetch(
        "/api/ai/analyze",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            mode: selectedMode,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(
          data.message ||
            "Pulse AI could not analyze your workspace."
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

  function selectMode(selectedMode: Mode) {
    setMode(selectedMode);
    setAnswer("");
    setError("");
  }

  const currentMode = modes.find(
    (item) => item.value === mode
  );

  return (
    <section className="mb-10 rounded-2xl bg-white p-6 shadow">
      <div>
        <h2 className="text-2xl font-bold">
          🧠 Pulse Intelligence
        </h2>

        <p className="mt-1 text-sm text-gray-500">
          Let Pulse analyze your business activity
          and help you decide what matters next.
        </p>
      </div>

      <div className="mt-6 grid gap-3 md:grid-cols-4">
        {modes.map((item) => (
          <button
            key={item.value}
            type="button"
            onClick={() =>
              selectMode(item.value)
            }
            className={`rounded-xl border p-4 text-left transition ${
              mode === item.value
                ? "border-black bg-black text-white"
                : "border-gray-200 bg-white hover:bg-gray-50"
            }`}
          >
            <div className="font-semibold">
              {item.label}
            </div>

            <div
              className={`mt-1 text-xs ${
                mode === item.value
                  ? "text-gray-300"
                  : "text-gray-500"
              }`}
            >
              {item.description}
            </div>
          </button>
        ))}
      </div>

      <div className="mt-5 flex items-center justify-between gap-4">
        <p className="text-sm text-gray-500">
          {currentMode?.description}
        </p>

        <button
          type="button"
          onClick={() => analyze()}
          disabled={loading}
          className="rounded-lg bg-black px-5 py-3 text-sm font-medium text-white transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading
            ? "Thinking..."
            : "Analyze"}
        </button>
      </div>

      {error && (
        <div className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {answer && !error && (
        <div className="mt-6 rounded-xl border border-gray-200 bg-gray-50 p-5">
          <div className="mb-3 text-sm font-semibold">
            Pulse AI
          </div>

          <div className="whitespace-pre-wrap text-sm leading-7 text-gray-800">
            {answer}
          </div>
        </div>
      )}
    </section>
  );
}