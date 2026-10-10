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

type Recommendation = {
  taskId: string;
  taskTitle: string;

  projectId: string;
  projectName: string;

  reason: string;

  priority:
    | "LOW"
    | "MEDIUM"
    | "HIGH";
};

export default function PulseInsights() {
  const [summary, setSummary] =
    useState("");

  const [insights, setInsights] =
    useState<Insight[]>([]);

  const [
    recommendationSummary,
    setRecommendationSummary,
  ] = useState("");

  const [
    recommendations,
    setRecommendations,
  ] = useState<
    Recommendation[]
  >([]);

  const [loading, setLoading] =
    useState(true);

  const [
    recommendationLoading,
    setRecommendationLoading,
  ] = useState(true);

  const [error, setError] =
    useState("");

  useEffect(() => {
    async function load() {
      try {
        const [
          insightResponse,
          recommendationResponse,
        ] = await Promise.all([
          fetch(
            "/api/ai/insights"
          ),
          fetch(
            "/api/ai/recommendations"
          ),
        ]);

        const insightData =
          await insightResponse.json();

        const recommendationData =
          await recommendationResponse.json();

        if (!insightResponse.ok) {
          throw new Error(
            insightData.message ||
              "Failed to load AI insights."
          );
        }

        if (
          !recommendationResponse.ok
        ) {
          throw new Error(
            recommendationData.message ||
              "Failed to load recommendations."
          );
        }

        setSummary(
          insightData.summary || ""
        );

        setInsights(
          insightData.insights || []
        );

        setRecommendationSummary(
          recommendationData.summary ||
            ""
        );

        setRecommendations(
          recommendationData.recommendations ||
            []
        );
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Failed to load Pulse intelligence."
        );
      } finally {
        setLoading(false);
        setRecommendationLoading(
          false
        );
      }
    }

    load();
  }, []);

  if (
    loading ||
    recommendationLoading
  ) {
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
      <section className="rounded-2xl border border-red-200 bg-white p-6">
        <h2 className="text-xl font-bold">
          Pulse Intelligence
        </h2>

        <p className="mt-2 text-sm text-red-600">
          {error}
        </p>
      </section>
    );
  }

  return (
    <section className="space-y-6">
      <div className="rounded-2xl bg-black p-6 text-white shadow">
        <div className="flex items-start gap-3">
          <div className="text-2xl">
            🧠
          </div>

          <div>
            <h2 className="text-2xl font-bold">
              Pulse Intelligence
            </h2>

            <p className="mt-2 text-sm leading-6 text-gray-300">
              {summary}
            </p>
          </div>
        </div>
      </div>

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
                    {insight.type ===
                      "PROGRESS" &&
                      "📈"}

                    {insight.type ===
                      "BOTTLENECK" &&
                      "🚧"}

                    {insight.type ===
                      "RISK" &&
                      "⚠️"}

                    {insight.type ===
                      "OPPORTUNITY" &&
                      "💡"}{" "}
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

      <div className="rounded-2xl bg-white p-6 shadow">
        <div className="flex items-start gap-3">
          <div className="text-2xl">
            🎯
          </div>

          <div>
            <h2 className="text-xl font-bold">
              Recommended Next Steps
            </h2>

            {recommendationSummary && (
              <p className="mt-1 text-sm text-gray-500">
                {recommendationSummary}
              </p>
            )}
          </div>
        </div>

        {recommendations.length ===
        0 ? (
          <div className="mt-6 rounded-xl border border-dashed border-gray-300 p-6 text-center">
            <p className="font-medium">
              No urgent recommendations.
            </p>

            <p className="mt-1 text-sm text-gray-500">
              Pulse couldn't find a specific
              unfinished task that needs attention.
            </p>
          </div>
        ) : (
          <div className="mt-6 space-y-3">
            {recommendations.map(
              (recommendation) => (
                <div
                  key={
                    recommendation.taskId
                  }
                  className="rounded-xl border p-4 transition hover:bg-gray-50"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h3 className="font-semibold">
                        {
                          recommendation.taskTitle
                        }
                      </h3>

                      <p className="mt-1 text-xs text-gray-400">
                        {
                          recommendation.projectName
                        }
                      </p>
                    </div>

                    <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium">
                      {
                        recommendation.priority
                      }
                    </span>
                  </div>

                  <p className="mt-3 text-sm leading-6 text-gray-600">
                    {
                      recommendation.reason
                    }
                  </p>
                </div>
              )
            )}
          </div>
        )}
      </div>
    </section>
  );
}