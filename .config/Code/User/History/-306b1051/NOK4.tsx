"use client";

import { useEffect, useState } from "react";

type Insight = {
  type:
    | "PROGRESS"
    | "BOTTLENECK"
    | "RISK"
    | "OPPORTUNITY";
  title: string;
  description: string;
  severity:
    | "LOW"
    | "MEDIUM"
    | "HIGH";
};

export default function PulseInsights() {
  const [summary, setSummary] = useState("");
  const [insights, setInsights] =
    useState<Insight[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadInsights() {
      try {
        const response = await fetch(
          "/api/ai/insights"
        );

        const data = await response.json();

        if (!response.ok || !data.success) {
          throw new Error(
            data.message ||
              "Failed to load Pulse Intelligence."
          );
        }

        setSummary(data.summary || "");
        setInsights(data.insights || []);
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Pulse AI could not analyze the business."
        );
      } finally {
        setLoading(false);
      }
    }

    loadInsights();
  }, []);

  if (loading) {
    return (
      <section className="rounded-2xl bg-white p-6 shadow">
        <div className="flex items-center gap-3">
          <div className="h-3 w-3 animate-pulse rounded-full bg-black" />

          <div>
            <h2 className="text-xl font-bold">
              Pulse Intelligence
            </h2>

            <p className="text-sm text-gray-500">
              Analyzing your business...
            </p>
          </div>
        </div>
      </section>
    );
  }

  if (error) {
    return (
      <section className="rounded-2xl border border-red-200 bg-white p-6 shadow">
        <div className="flex items-start gap-3">
          <div className="text-2xl">🧠</div>

          <div>
            <h2 className="text-xl font-bold">
              Pulse Intelligence
            </h2>

            <p className="mt-2 text-sm text-red-600">
              {error}
            </p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="space-y-6">
      {/* Main Intelligence */}
      <div className="rounded-2xl bg-black p-6 text-white shadow">
        <div className="flex items-start gap-3">
          <div className="text-2xl">🧠</div>

          <div>
            <h2 className="text-2xl font-bold">
              Pulse Intelligence
            </h2>

            <p className="mt-2 text-sm leading-6 text-gray-300">
              {summary ||
                "Pulse is monitoring your business activity and project progress."}
            </p>
          </div>
        </div>
      </div>

      {/* Insights */}
      {insights.length > 0 && (
        <div className="grid gap-4 md:grid-cols-2">
          {insights.map(
            (insight, index) => (
              <div
                key={`${insight.title}-${index}`}
                className="rounded-2xl bg-white p-5 shadow"
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm font-semibold">
                    {insight.type === "PROGRESS" &&
                      "📈"}

                    {insight.type ===
                      "BOTTLENECK" && "🚧"}

                    {insight.type === "RISK" &&
                      "⚠️"}

                    {insight.type ===
                      "OPPORTUNITY" && "💡"}{" "}
                    {insight.type}
                  </span>

                  <span className="text-xs font-medium text-gray-400">
                    {insight.severity}
                  </span>
                </div>

                <h3 className="mt-4 font-bold">
                  {insight.title}
                </h3>

                <p className="mt-2 text-sm leading-6 text-gray-600">
                  {insight.description}
                </p>
              </div>
            )
          )}
        </div>
      )}
    </section>
  );
}