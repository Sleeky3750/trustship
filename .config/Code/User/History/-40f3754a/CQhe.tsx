"use client";

import { useEffect, useState } from "react";

interface Activity {
  id: string;
  type:
    | "CREATED"
    | "STATUS_CHANGED"
    | "PRIORITY_CHANGED"
    | "UPDATED"
    | "DELETED";
  message: string;
  createdAt: string;
}

export default function TaskActivity({
  taskId,
}: {
  taskId: string;
}) {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadActivities() {
      try {
        const response = await fetch(
          `/api/tasks/${taskId}/activities`
        );

        if (!response.ok) {
          throw new Error(
            "Failed to load activities."
          );
        }

        const data = await response.json();

        if (data.success) {
          setActivities(data.activities);
        }
      } catch (error) {
        console.error(
          "Failed to load task activities:",
          error
        );
      } finally {
        setLoading(false);
      }
    }

    loadActivities();
  }, [taskId]);

  function getIcon(type: Activity["type"]) {
    switch (type) {
      case "CREATED":
        return "🟢";

      case "STATUS_CHANGED":
        return "🔄";

      case "PRIORITY_CHANGED":
        return "⚡";

      case "UPDATED":
        return "✏️";

      case "DELETED":
        return "🗑️";

      default:
        return "•";
    }
  }

  function formatDate(date: string) {
    return new Date(date).toLocaleString();
  }

  if (loading) {
    return (
      <div className="bg-white border rounded-2xl p-5">
        <h3 className="text-lg font-semibold">
          Activity
        </h3>

        <p className="text-sm text-gray-500 mt-3">
          Loading activity...
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white border rounded-2xl p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold">
          Activity
        </h3>

        <span className="text-xs text-gray-500">
          {activities.length}{" "}
          {activities.length === 1
            ? "event"
            : "events"}
        </span>
      </div>

      {activities.length === 0 ? (
        <p className="text-sm text-gray-500">
          No activity yet.
        </p>
      ) : (
        <div className="space-y-4">
          {activities.map((activity) => (
            <div
              key={activity.id}
              className="flex gap-3"
            >
              <div className="flex-shrink-0 text-lg">
                {getIcon(activity.type)}
              </div>

              <div className="min-w-0">
                <p className="text-sm text-gray-800">
                  {activity.message}
                </p>

                <p className="text-xs text-gray-400 mt-1">
                  {formatDate(
                    activity.createdAt
                  )}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}