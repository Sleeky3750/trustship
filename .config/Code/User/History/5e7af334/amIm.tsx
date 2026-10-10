"use client";

import Link from "next/link";
import ProjectActions from "@/components/project/ProjectActions";
import CreateTaskForm from "@/components/CreateTaskForm";
import { useMemo, useState } from "react";
import type {
  Task,
  TaskStatus,
  TaskPriority,
} from "@/types/models";

interface ProjectInfo {
  id: string;
  name: string;
  description: string | null;
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

  const hasActiveFilters =
    search.trim().length > 0 ||
    statusFilter !== "ALL" ||
    priorityFilter !== "ALL";

  function clearFilters() {
    setSearch("");
    setStatusFilter("ALL");
    setPriorityFilter("ALL");
  }

  function getStatusLabel(status: TaskStatus) {
    switch (status) {
      case "TODO":
        return "To Do";

      case "IN_PROGRESS":
        return "In Progress";

      case "DONE":
        return "Completed";

      default:
        return status;
    }
  }

  function getStatusClass(status: TaskStatus) {
    switch (status) {
      case "TODO":
        return "bg-gray-100 text-gray-700";

      case "IN_PROGRESS":
        return "bg-blue-100 text-blue-700";

      case "DONE":
        return "bg-green-100 text-green-700";

      default:
        return "bg-gray-100 text-gray-700";
    }
  }

  function getPriorityClass(
    priority: TaskPriority
  ) {
    switch (priority) {
      case "HIGH":
        return "bg-red-100 text-red-700";

      case "MEDIUM":
        return "bg-yellow-100 text-yellow-700";

      case "LOW":
        return "bg-gray-100 text-gray-600";

      default:
        return "bg-gray-100 text-gray-600";
    }
  }

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-7xl px-6 py-8">

        {/* Navigation */}
        <div className="mb-6 flex items-center justify-between gap-4">
          <Link
            href="/dashboard"
            className="text-sm font-medium text-gray-500 transition hover:text-black"
          >
            ← Dashboard
          </Link>

          <span className="text-sm text-gray-400">
            {project.workspaceName}
          </span>
        </div>

        {/* Project Header */}
        <section className="rounded-2xl bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">

            <div className="min-w-0">
              <p className="text-sm font-medium uppercase tracking-wide text-gray-400">
                Project
              </p>

              <h1 className="mt-1 text-3xl font-bold tracking-tight">
                {project.name}
              </h1>

              <p className="mt-3 max-w-2xl text-gray-600">
                {project.description ||
                  "No project description has been added yet."}
              </p>
            </div>

            <div className="flex items-center gap-3">
              <ProjectActions
                projectId={project.id}
                projectName={project.name}
                projectDescription={
                  project.description
                }
              />

              <span
                className={`rounded-full px-3 py-2 text-sm font-medium ${
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
            <div className="mb-2 flex items-center justify-between">
              <span className="text-sm font-medium text-gray-600">
                Project progress
              </span>

              <span className="text-sm font-bold">
                {completionPercentage}%
              </span>
            </div>

            <div className="h-3 overflow-hidden rounded-full bg-gray-100">
              <div
                className="h-full rounded-full bg-black transition-all duration-500"
                style={{
                  width: `${completionPercentage}%`,
                }}
              />
            </div>
          </div>
        </section>

        {/* Task Summary */}
        <section className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-5">
          <StatCard
            label="Total"
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
        </section>

        {/* Task Health */}
        <section className="mt-6 grid gap-4 md:grid-cols-4">
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
            danger={highPriorityTasks > 0}
          />

          <InfoCard
            label="Project Health"
            value={projectHealth}
            description="current status"
          />
        </section>

        {/* Create Task */}
        <section className="mt-8 rounded-2xl bg-white p-6 shadow-sm">
          <div className="mb-5">
            <h2 className="text-xl font-bold">
              Add Task
            </h2>

            <p className="mt-1 text-sm text-gray-500">
              Add work to this project and track it
              from start to completion.
            </p>
          </div>

          <CreateTaskForm
            projectId={project.id}
          />
        </section>

        {/* Task Management */}
        <section className="mt-8 rounded-2xl bg-white p-6 shadow-sm">

          <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-xl font-bold">
                Tasks
              </h2>

              <p className="mt-1 text-sm text-gray-500">
                Manage and review the work in this
                project.
              </p>
            </div>

            {hasActiveFilters && (
              <button
                type="button"
                onClick={clearFilters}
                className="text-sm font-medium text-red-600 hover:underline"
              >
                Clear filters
              </button>
            )}
          </div>

          {/* Filters */}
          <div className="grid gap-3 md:grid-cols-3">
            <input
              type="text"
              value={search}
              onChange={(event) =>
                setSearch(event.target.value)
              }
              placeholder="Search tasks..."
              className="rounded-lg border px-4 py-3 outline-none focus:border-black"
            />

            <select
              value={statusFilter}
              onChange={(event) =>
                setStatusFilter(
                  event.target.value as
                    | "ALL"
                    | TaskStatus
                )
              }
              className="rounded-lg border bg-white px-4 py-3 outline-none"
            >
              <option value="ALL">
                All statuses
              </option>

              <option value="TODO">
                To Do
              </option>

              <option value="IN_PROGRESS">
                In Progress
              </option>

              <option value="DONE">
                Completed
              </option>
            </select>

            <select
              value={priorityFilter}
              onChange={(event) =>
                setPriorityFilter(
                  event.target.value as
                    | "ALL"
                    | TaskPriority
                )
              }
              className="rounded-lg border bg-white px-4 py-3 outline-none"
            >
              <option value="ALL">
                All priorities
              </option>

              <option value="HIGH">
                High
              </option>

              <option value="MEDIUM">
                Medium
              </option>

              <option value="LOW">
                Low
              </option>
            </select>
          </div>

          {/* Tasks */}
          <div className="mt-6">
            {totalTasks === 0 ? (
              <div className="rounded-xl border border-dashed border-gray-300 p-10 text-center">
                <div className="text-4xl">
                  ✅
                </div>

                <h3 className="mt-4 font-semibold">
                  No tasks yet
                </h3>

                <p className="mx-auto mt-2 max-w-md text-sm text-gray-500">
                  Add your first task above to start
                  tracking this project.
                </p>
              </div>
            ) : filteredTasks.length === 0 ? (
              <div className="rounded-xl border border-dashed border-gray-300 p-8 text-center">
                <p className="font-medium">
                  No matching tasks
                </p>

                <p className="mt-1 text-sm text-gray-500">
                  Try changing your search or filters.
                </p>

                <button
                  type="button"
                  onClick={clearFilters}
                  className="mt-4 text-sm font-medium underline"
                >
                  Clear filters
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredTasks.map((task) => (
                  <div
                    key={task.id}
                    className="rounded-xl border border-gray-200 p-4 transition hover:bg-gray-50"
                  >
                    <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">

                      <div className="min-w-0">
                        <h3 className="font-semibold">
                          {task.title}
                        </h3>

                        <p className="mt-1 text-sm leading-6 text-gray-600">
                          {task.description ||
                            "No description."}
                        </p>
                      </div>

                      <div className="flex shrink-0 flex-wrap gap-2">
                        <span
                          className={`rounded-full px-3 py-1 text-xs font-medium ${getStatusClass(
                            task.status
                          )}`}
                        >
                          {getStatusLabel(
                            task.status
                          )}
                        </span>

                        <span
                          className={`rounded-full px-3 py-1 text-xs font-medium ${getPriorityClass(
                            task.priority
                          )}`}
                        >
                          {task.priority}
                        </span>
                      </div>
                    </div>

                    <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 border-t pt-3 text-xs text-gray-400">
                      {task.dueDate && (
                        <span>
                          Due{" "}
                          {task.dueDate.toLocaleDateString()}
                        </span>
                      )}

                      <span>
                        Created{" "}
                        {task.createdAt.toLocaleDateString()}
                      </span>

                      {task.updatedAt && (
                        <span>
                          Updated{" "}
                          {task.updatedAt.toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* Priority Breakdown */}
        {totalTasks > 0 && (
          <section className="mt-8 rounded-2xl bg-white p-6 shadow-sm">
            <h2 className="text-xl font-bold">
              Priority Breakdown
            </h2>

            <p className="mt-1 text-sm text-gray-500">
              How work is distributed by priority.
            </p>

            <div className="mt-6 space-y-4">
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
          </section>
        )}

      </div>
    </main>
  );
}

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
    <div className="rounded-2xl bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <span className="text-sm text-gray-500">
          {label}
        </span>

        <span>{icon}</span>
      </div>

      <p className="mt-3 text-3xl font-bold">
        {value}
      </p>
    </div>
  );
}

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
    <div
      className={`rounded-2xl border bg-white p-5 shadow-sm ${
        danger
          ? "border-red-200"
          : "border-gray-200"
      }`}
    >
      <p className="text-sm text-gray-500">
        {label}
      </p>

      <p
        className={`mt-2 text-2xl font-bold ${
          danger ? "text-red-600" : ""
        }`}
      >
        {value}
      </p>

      <p className="mt-1 text-xs text-gray-400">
        {description}
      </p>
    </div>
  );
}

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
      <div className="mb-2 flex items-center justify-between text-sm">
        <span className="font-medium">
          {label}
        </span>

        <span className="text-gray-500">
          {count} ({percentage}%)
        </span>
      </div>

      <div className="h-2 overflow-hidden rounded-full bg-gray-100">
        <div
          className="h-full rounded-full bg-black transition-all"
          style={{
            width: `${percentage}%`,
          }}
        />
      </div>
    </div>
  );
}