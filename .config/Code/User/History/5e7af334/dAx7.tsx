"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import dynamic from "next/dynamic";

import CreateTaskForm from "@/components/CreateTaskForm";
import PulseAiPanel from "@/components/ai/PulseAiPanel";
import type {
  Task,
  TaskStatus,
  TaskPriority,
} from "@/types/models";

const KanbanBoard = dynamic(
  () => import("@/components/kanban/KanbanBoard"),
  {
    ssr: false,
  }
);

interface ProjectInfo {
  id: string;
  name: string;
  description: string | null;
  workspaceId: string;
  workspaceName: string;
}

export default function ProjectWorkspace({
  project,
  initialTasks,
}: {
  project: ProjectInfo;
  initialTasks: Task[];
}) {
  const [tasks] = useState<Task[]>(initialTasks);

  const [search, setSearch] = useState("");

  const [statusFilter, setStatusFilter] =
    useState<"ALL" | TaskStatus>("ALL");

  const [priorityFilter, setPriorityFilter] =
    useState<"ALL" | TaskPriority>("ALL");

  /*
   * -------------------------
   * TASK FILTERING
   * -------------------------
   */

  const filteredTasks = useMemo(() => {
    const searchTerm =
      search.trim().toLowerCase();

    return tasks.filter((task) => {
      const matchesSearch =
        !searchTerm ||
        task.title
          .toLowerCase()
          .includes(searchTerm) ||
        (task.description || "")
          .toLowerCase()
          .includes(searchTerm);

      const matchesStatus =
        statusFilter === "ALL" ||
        task.status === statusFilter;

      const matchesPriority =
        priorityFilter === "ALL" ||
        task.priority === priorityFilter;

      return (
        matchesSearch &&
        matchesStatus &&
        matchesPriority
      );
    });
  }, [
    tasks,
    search,
    statusFilter,
    priorityFilter,
  ]);

  /*
   * -------------------------
   * TASK STATISTICS
   * -------------------------
   */

  const totalTasks = tasks.length;

  const todoTasks = tasks.filter(
    (task) => task.status === "TODO"
  ).length;

  const inProgressTasks = tasks.filter(
    (task) => task.status === "IN_PROGRESS"
  ).length;

  const completedTasks = tasks.filter(
    (task) => task.status === "DONE"
  ).length;

  const highPriorityTasks = tasks.filter(
    (task) => task.priority === "HIGH"
  ).length;

  const mediumPriorityTasks = tasks.filter(
    (task) => task.priority === "MEDIUM"
  ).length;

  const lowPriorityTasks = tasks.filter(
    (task) => task.priority === "LOW"
  ).length;

  const completionPercentage =
    totalTasks === 0
      ? 0
      : Math.round(
          (completedTasks / totalTasks) * 100
        );

  /*
   * -------------------------
   * DATE STATISTICS
   * -------------------------
   */

  const now = new Date();

  const upcomingTasks = tasks.filter((task) => {
    if (!task.dueDate) return false;

    return (
      task.dueDate >= now &&
      task.status !== "DONE"
    );
  }).length;

  const overdueTasks = tasks.filter((task) => {
    if (!task.dueDate) return false;

    return (
      task.dueDate < now &&
      task.status !== "DONE"
    );
  }).length;

  /*
   * -------------------------
   * PROJECT HEALTH
   * -------------------------
   */

  let projectHealth = "On track";

  if (overdueTasks > 0) {
    projectHealth = "Needs attention";
  }

  if (
    totalTasks > 0 &&
    completedTasks === totalTasks
  ) {
    projectHealth = "Completed";
  }

  /*
   * -------------------------
   * RESET FILTERS
   * -------------------------
   */

  const hasActiveFilters =
    search.length > 0 ||
    statusFilter !== "ALL" ||
    priorityFilter !== "ALL";

  function clearFilters() {
    setSearch("");
    setStatusFilter("ALL");
    setPriorityFilter("ALL");
  }

  return (
    <main className="min-h-screen bg-gray-50 py-10">
      <div className="max-w-7xl mx-auto px-6">

        {/* =========================
            PROJECT HEADER
        ========================== */}

        <div className="bg-white border rounded-2xl p-6 mb-8">
          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-6">

            <div>
              <Link
  href={`/workspace/${project.workspaceId}`}
  className="mb-3 inline-flex items-center gap-2 text-sm font-medium text-gray-500 transition hover:text-gray-950"
>
  <span>←</span>
  <span>{project.workspaceName}</span>
</Link>

              <h1 className="text-4xl font-bold tracking-tight">
                {project.name}
              </h1>

              <p className="text-gray-600 mt-2 max-w-2xl">
                {project.description ||
                  "No project description has been added yet."}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <span
                className={`px-3 py-2 rounded-full text-sm font-medium ${
                  projectHealth === "Completed"
                    ? "bg-green-100 text-green-700"
                    : projectHealth ===
                      "Needs attention"
                    ? "bg-red-100 text-red-700"
                    : "bg-blue-100 text-blue-700"
                }`}
              >
                {projectHealth}
              </span>
            </div>
          </div>

          {/* Progress */}

          <div className="mt-8">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-medium text-gray-700">
                Project progress
              </p>

              <p className="text-sm font-semibold">
                {completionPercentage}%
              </p>
            </div>

            <div className="w-full h-3 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-black rounded-full transition-all duration-500"
                style={{
                  width: `${completionPercentage}%`,
                }}
              />
            </div>
          </div>
        </div>

        {/* =========================
            MAIN STATISTICS
        ========================== */}

        <PulseAiPanel scope={{ projectId: project.id }} />

        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">

          <StatCard
            label="Total Tasks"
            value={totalTasks}
            icon="📋"
          />

          <StatCard
            label="To Do"
            value={todoTasks}
            icon="🟡"
          />

          <StatCard
            label="In Progress"
            value={inProgressTasks}
            icon="🔵"
          />

          <StatCard
            label="Completed"
            value={completedTasks}
            icon="🟢"
          />

          <StatCard
            label="Completion"
            value={`${completionPercentage}%`}
            icon="📈"
          />

        </div>

        {/* =========================
            PROJECT HEALTH
        ========================== */}

        <div className="grid md:grid-cols-4 gap-4 mb-8">

          <InfoCard
            label="Upcoming"
            value={upcomingTasks}
            description="unfinished tasks"
          />

          <InfoCard
            label="Overdue"
            value={overdueTasks}
            description="need attention"
            danger={overdueTasks > 0}
          />

          <InfoCard
            label="High Priority"
            value={highPriorityTasks}
            description="high priority tasks"
          />

          <InfoCard
            label="Project Health"
            value={projectHealth}
            description="current status"
          />

        </div>

        {/* =========================
            PRIORITY BREAKDOWN
        ========================== */}

        {totalTasks > 0 && (
          <div className="bg-white border rounded-2xl p-6 mb-8">

            <div className="flex items-center justify-between mb-5">
              <div>
                <h2 className="text-xl font-bold">
                  Task Breakdown
                </h2>

                <p className="text-sm text-gray-500 mt-1">
                  Current task priority distribution
                </p>
              </div>
            </div>

            <div className="space-y-4">

              <PriorityRow
                label="High"
                count={highPriorityTasks}
                total={totalTasks}
              />

              <PriorityRow
                label="Medium"
                count={mediumPriorityTasks}
                total={totalTasks}
              />

              <PriorityRow
                label="Low"
                count={lowPriorityTasks}
                total={totalTasks}
              />

            </div>
          </div>
        )}

        {/* =========================
            TASK SEARCH / FILTERS
        ========================== */}

        <div className="bg-white border rounded-2xl p-6 mb-8">

          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-5">

            <div>
              <h2 className="text-xl font-bold">
                Find Tasks
              </h2>

              <p className="text-sm text-gray-500 mt-1">
                Search and filter tasks in this project.
              </p>
            </div>

            {hasActiveFilters && (
              <button
                type="button"
                onClick={clearFilters}
                className="text-sm text-red-600 hover:underline self-start md:self-auto"
              >
                Clear filters
              </button>
            )}

          </div>

          <div className="grid md:grid-cols-3 gap-3">

            <input
              type="text"
              placeholder="Search tasks..."
              value={search}
              onChange={(e) =>
                setSearch(e.target.value)
              }
              className="border rounded-lg px-4 py-3 outline-none focus:ring-2 focus:ring-black"
            />

            <select
              value={statusFilter}
              onChange={(e) =>
                setStatusFilter(
                  e.target.value as
                    | "ALL"
                    | TaskStatus
                )
              }
              className="border rounded-lg px-4 py-3 bg-white"
            >
              <option value="ALL">
                All statuses
              </option>

              <option value="TODO">
                TODO
              </option>

              <option value="IN_PROGRESS">
                IN PROGRESS
              </option>

              <option value="DONE">
                DONE
              </option>
            </select>

            <select
              value={priorityFilter}
              onChange={(e) =>
                setPriorityFilter(
                  e.target.value as
                    | "ALL"
                    | TaskPriority
                )
              }
              className="border rounded-lg px-4 py-3 bg-white"
            >
              <option value="ALL">
                All priorities
              </option>

              <option value="LOW">
                LOW
              </option>

              <option value="MEDIUM">
                MEDIUM
              </option>

              <option value="HIGH">
                HIGH
              </option>
            </select>

          </div>

          <div className="flex items-center justify-between mt-4">

            <p className="text-sm text-gray-500">
              Showing{" "}
              <span className="font-semibold text-gray-900">
                {filteredTasks.length}
              </span>{" "}
              of{" "}
              <span className="font-semibold text-gray-900">
                {totalTasks}
              </span>{" "}
              tasks
            </p>

          </div>
        </div>

        {/* =========================
            CREATE TASK
        ========================== */}

        <div className="bg-white border rounded-2xl p-6 mb-8">

          <h2 className="text-2xl font-bold mb-1">
            Create Task
          </h2>

          <p className="text-sm text-gray-500 mb-5">
            Add a new task to this project.
          </p>

          <CreateTaskForm
            projectId={project.id}
          />

        </div>

        {/* =========================
            KANBAN
        ========================== */}

        <div className="mb-5">

          <h2 className="text-2xl font-bold">
            Project Tasks
          </h2>

          <p className="text-gray-500 mt-1">
            Drag tasks between columns to update
            their status.
          </p>

        </div>

        {filteredTasks.length === 0 ? (

          <div className="bg-white border rounded-2xl p-12 text-center">

            <div className="text-4xl mb-3">
              🔎
            </div>

            <h3 className="text-xl font-semibold">
              No matching tasks
            </h3>

            <p className="text-gray-500 mt-2">
              Try changing your search or filters.
            </p>

            {hasActiveFilters && (
              <button
                type="button"
                onClick={clearFilters}
                className="mt-5 px-4 py-2 rounded-lg bg-black text-white text-sm hover:bg-gray-800"
              >
                Clear filters
              </button>
            )}

          </div>

        ) : (

          <KanbanBoard
            tasks={filteredTasks}
          />

        )}

      </div>
    </main>
  );
}

/*
 * =========================
 * STAT CARD
 * =========================
 */

function StatCard({
  label,
  value,
  icon,
}: {
  label: string;
  value: string | number;
  icon: string;
}) {
  return (
    <div className="bg-white border rounded-2xl p-5">

      <div className="text-2xl">
        {icon}
      </div>

      <p className="text-sm text-gray-500 mt-3">
        {label}
      </p>

      <p className="text-2xl font-bold mt-1">
        {value}
      </p>

    </div>
  );
}

/*
 * =========================
 * INFO CARD
 * =========================
 */

function InfoCard({
  label,
  value,
  description,
  danger = false,
}: {
  label: string;
  value: string | number;
  description: string;
  danger?: boolean;
}) {
  return (
    <div className="bg-white border rounded-2xl p-5">

      <p className="text-sm text-gray-500">
        {label}
      </p>

      <p
        className={`text-2xl font-bold mt-2 ${
          danger ? "text-red-600" : ""
        }`}
      >
        {value}
      </p>

      <p className="text-sm text-gray-500 mt-1">
        {description}
      </p>

    </div>
  );
}

/*
 * =========================
 * PRIORITY ROW
 * =========================
 */

function PriorityRow({
  label,
  count,
  total,
}: {
  label: string;
  count: number;
  total: number;
}) {
  const percentage =
    total === 0
      ? 0
      : Math.round((count / total) * 100);

  return (
    <div>

      <div className="flex items-center justify-between mb-2">

        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">
            {label}
          </span>

          <span className="text-xs text-gray-500">
            {count} tasks
          </span>
        </div>

        <span className="text-sm font-semibold">
          {percentage}%
        </span>

      </div>

      <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">

        <div
          className="h-full bg-gray-900 rounded-full transition-all duration-500"
          style={{
            width: `${percentage}%`,
          }}
        />

      </div>

    </div>
  );
}
