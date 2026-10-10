"use client";

import { useMemo, useState } from "react";
import dynamic from "next/dynamic";

import CreateTaskForm from "@/components/CreateTaskForm";
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
  workspaceName: string;
}

export default function ProjectWorkspace({
  project,
  initialTasks,
}: {
  project: ProjectInfo;
  initialTasks: Task[];
}) {
  const [tasks, setTasks] =
    useState<Task[]>(initialTasks);

  const [search, setSearch] = useState("");

  const [statusFilter, setStatusFilter] =
    useState<"ALL" | TaskStatus>("ALL");

  const [priorityFilter, setPriorityFilter] =
    useState<"ALL" | TaskPriority>("ALL");

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

  return (
    <main className="min-h-screen bg-gray-50 py-10">
      <div className="max-w-6xl mx-auto px-6">

        <div className="mb-8">
          <p className="text-sm text-gray-500 mb-2">
            {project.workspaceName}
          </p>

          <h1 className="text-4xl font-bold">
            {project.name}
          </h1>

          <p className="text-gray-600 mt-2">
            {project.description ||
              "No description"}
          </p>
        </div>

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

        <div className="grid md:grid-cols-2 gap-4 mb-6">
          <div className="bg-white border rounded-2xl p-5">
            <p className="text-sm text-gray-500">
              Upcoming
            </p>

            <p className="text-2xl font-bold mt-1">
              {upcomingTasks}
            </p>

            <p className="text-sm text-gray-500 mt-1">
              unfinished tasks
            </p>
          </div>

          <div className="bg-white border rounded-2xl p-5">
            <p className="text-sm text-gray-500">
              Overdue
            </p>

            <p className="text-2xl font-bold text-red-600 mt-1">
              {overdueTasks}
            </p>

            <p className="text-sm text-gray-500 mt-1">
              unfinished overdue tasks
            </p>
          </div>
        </div>

        <div className="bg-white border rounded-2xl p-5 mb-8">
          <h2 className="text-lg font-semibold mb-4">
            Find Tasks
          </h2>

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
              className="border rounded-lg px-4 py-3"
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
              className="border rounded-lg px-4 py-3"
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

            {(search ||
              statusFilter !== "ALL" ||
              priorityFilter !== "ALL") && (
              <button
                type="button"
                onClick={() => {
                  setSearch("");
                  setStatusFilter("ALL");
                  setPriorityFilter("ALL");
                }}
                className="text-sm text-red-600 hover:underline"
              >
                Clear filters
              </button>
            )}
          </div>
        </div>

        <div className="bg-white border rounded-2xl p-6 mb-8">
          <h2 className="text-2xl font-bold mb-4">
            Create Task
          </h2>

          <CreateTaskForm
            projectId={project.id}
          />
        </div>

        <div className="mb-4">
          <h2 className="text-2xl font-bold">
            Tasks
          </h2>

          <p className="text-gray-500 mt-1">
            Drag tasks between columns to update their
            status.
          </p>
        </div>

        {filteredTasks.length === 0 ? (
          <div className="bg-white border rounded-2xl p-10 text-center">
            <div className="text-4xl mb-3">
              🔎
            </div>

            <h3 className="text-xl font-semibold">
              No matching tasks
            </h3>

            <p className="text-gray-500 mt-2">
              Try changing your search or filters.
            </p>
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