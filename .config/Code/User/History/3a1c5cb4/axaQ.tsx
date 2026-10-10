"use client";

import { useState } from "react";

type GeneratedTask = {
  title: string;
  description: string;
  priority: "LOW" | "MEDIUM" | "HIGH";
};

type ProjectPlan = {
  name: string;
  description: string;
  tasks: GeneratedTask[];
};

type Workspace = {
  id: string;
  name: string;
};

type ProjectPlannerProps = {
  businessId: string;
  workspaces: Workspace[];
};

export default function ProjectPlanner({
  businessId,
  workspaces,
}: ProjectPlannerProps) {
  const [workspaceId, setWorkspaceId] = useState(
    workspaces[0]?.id ?? ""
  );

  const [projectIdea, setProjectIdea] = useState("");
  const [plan, setPlan] = useState<ProjectPlan | null>(
    null
  );
  const [jobId, setJobId] = useState("");
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");

  async function generatePlan() {
    if (!workspaceId) {
      setError("Choose a workspace first.");
      return;
    }

    if (!projectIdea.trim()) {
      setError(
        "Tell Pulse what you want to accomplish."
      );
      return;
    }

    setLoading(true);
    setError("");
    setPlan(null);
    setJobId("");

    try {
      const createJobResponse = await fetch(
        "/api/ai/create-job",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            businessId,
            type: "PROJECT_PLANNING",
            input: {
              projectIdea: projectIdea.trim(),
            },
          }),
        }
      );

      const createJobData =
        await createJobResponse.json();

      if (!createJobResponse.ok) {
        throw new Error(
          createJobData.message ||
            "Failed to create AI job"
        );
      }

      const newJobId = createJobData.job.id;

      setJobId(newJobId);

      const processResponse = await fetch(
        "/api/ai/process",
        {
          method: "POST",
        }
      );

      const processData =
        await processResponse.json();

      if (!processResponse.ok) {
        throw new Error(
          processData.message ||
            "Failed to generate project plan"
        );
      }

      if (!processData.output) {
        throw new Error(
          "Pulse did not return a project plan."
        );
      }

      setPlan(processData.output);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Something went wrong."
      );
    } finally {
      setLoading(false);
    }
  }

  async function createProject() {
    if (!jobId) {
      setError("No AI plan is available.");
      return;
    }

    if (!workspaceId) {
      setError("Choose a workspace first.");
      return;
    }

    setCreating(true);
    setError("");

    try {
      const response = await fetch(
        "/api/ai/create-project",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            jobId,
            workspaceId,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message ||
            "Failed to create project"
        );
      }

      window.location.href =
        `/project/${data.project.id}`;
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to create project."
      );
    } finally {
      setCreating(false);
    }
  }

  return (
    <section className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">
          ✨ Create with Pulse AI
        </h2>

        <p className="mt-1 text-sm text-gray-500">
          Tell Pulse what you want to accomplish
          and it will create a project plan for you.
        </p>
      </div>

      <div className="space-y-4">
        <div>
          <label
            htmlFor="workspace"
            className="mb-2 block text-sm font-medium"
          >
            Workspace
          </label>

          <select
            id="workspace"
            value={workspaceId}
            onChange={(event) =>
              setWorkspaceId(event.target.value)
            }
            disabled={loading || creating}
            className="w-full rounded-lg border border-gray-300 bg-white p-3 text-sm outline-none focus:border-black"
          >
            {workspaces.map((workspace) => (
              <option
                key={workspace.id}
                value={workspace.id}
              >
                {workspace.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label
            htmlFor="projectIdea"
            className="mb-2 block text-sm font-medium"
          >
            What do you want to accomplish?
          </label>

          <textarea
            id="projectIdea"
            value={projectIdea}
            onChange={(event) =>
              setProjectIdea(event.target.value)
            }
            placeholder="Example: Launch a reliable same-day delivery business in Lagos"
            rows={5}
            disabled={loading || creating}
            className="w-full rounded-lg border border-gray-300 p-3 text-sm outline-none focus:border-black"
          />
        </div>

        <button
          type="button"
          onClick={generatePlan}
          disabled={loading || creating}
          className="rounded-lg bg-black px-5 py-2.5 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading
            ? "Pulse is thinking..."
            : "Generate Plan"}
        </button>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {plan && (
        <div className="space-y-5 rounded-xl border border-gray-200 p-5">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
              Pulse AI Plan
            </p>

            <h3 className="mt-1 text-lg font-semibold">
              {plan.name}
            </h3>

            <p className="mt-1 text-sm text-gray-600">
              {plan.description}
            </p>
          </div>

          <div>
            <h4 className="mb-3 text-sm font-semibold">
              {plan.tasks.length} tasks generated
            </h4>

            <div className="space-y-2">
              {plan.tasks.map((task, index) => (
                <div
                  key={`${task.title}-${index}`}
                  className="rounded-lg border border-gray-200 p-3"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-sm font-medium">
                        {task.title}
                      </p>

                      <p className="mt-1 text-xs text-gray-500">
                        {task.description}
                      </p>
                    </div>

                    <span className="shrink-0 rounded-full bg-gray-100 px-2 py-1 text-[10px] font-medium">
                      {task.priority}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex gap-3 border-t border-gray-200 pt-4">
            <button
              type="button"
              onClick={() => setPlan(null)}
              disabled={creating}
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium"
            >
              Cancel
            </button>

            <button
              type="button"
              onClick={createProject}
              disabled={creating}
              className="rounded-lg bg-black px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              {creating
                ? "Creating..."
                : "Create Project"}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}