"use client";

import { useMemo, useState } from "react";

type TaskStatus = "TODO" | "IN_PROGRESS" | "DONE";
type TaskPriority = "LOW" | "MEDIUM" | "HIGH";

interface Task {
  id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  dueDate: string | null;
  createdAt: string;
  updatedAt: string;
  projectId: string;
}

export default function ProjectOverview({
  tasks,
}: {
  tasks: Task[];
}) {
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

  const completionPercentage =
    totalTasks === 0
      ? 0
      : Math.round((completedTasks / totalTasks) * 100);

  const upcomingTasks = useMemo(() => {
    const now = new Date();

    return tasks.filter((task) => {
      if (!task.dueDate) return false;

      const dueDate = new Date(task.dueDate);

      return dueDate >= now && task.status !== "DONE";
    }).length;
  }, [tasks]);

  const overdueTasks = useMemo(() => {
    const now = new Date();

    return tasks.filter((task) => {
      if (!task.dueDate) return false;

      const dueDate = new Date(task.dueDate);

      return dueDate < now && task.status !== "DONE";
    }).length;
  }, [tasks]);

  const filteredTasks = useMemo(() => {
    return tasks.filter((task) => {
      const searchTerm = search.toLowerCase();

      const matchesSearch =
        task.title.toLowerCase().includes(searchTerm) ||
        (task.description || "").toLowerCase().includes(searchTerm);

      const matchesStatus =
        statusFilter === "ALL" || task.status === statusFilter;

      const matchesPriority =
        priorityFilter === "ALL" || task.priority === priorityFilter;

      return matchesSearch && matchesStatus && matchesPriority;
    });
  }, [tasks, search, statusFilter, priorityFilter]);

  return (
    <section className="mb-8">
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
            tasks with upcoming due dates
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

      <div className="bg-white border rounded-2xl p-5">
        <h3 className="text-lg font-semibold mb-4">
          Find Tasks
        </h3>

        <div className="grid md:grid-cols-3 gap-3">
          <input
            type="text"
            placeholder="Search tasks..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="border rounded-lg px-4 py-3 outline-none focus:ring-2 focus:ring-black"
          />

          <select
            value={statusFilter}
            onChange={(e) =>
              setStatusFilter(
                e.target.value as "ALL" | TaskStatus
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
                e.target.value as "ALL" | TaskPriority
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

        <div className="mt-4 text-sm text-gray-500">
          Showing{" "}
          <span className="font-semibold text-gray-900">
            {filteredTasks.length}
          </span>{" "}
          of{" "}
          <span className="font-semibold text-gray-900">
            {totalTasks}
          </span>{" "}
          tasks
        </div>
      </div>
    </section>
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