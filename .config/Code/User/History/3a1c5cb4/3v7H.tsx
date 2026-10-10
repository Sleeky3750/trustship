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
  const [refining, setRefining] = useState(false);
  const [creating, setCreating] = useState(false);
  const [refinement, setRefinement] = useState("");
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
    setRefinement("");

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

  function updatePlan(
    field: keyof ProjectPlan,
    value: string
  ) {
    if (!plan) return;

    setPlan({
      ...plan,
      [field]: value,
    });
  }

  function updateTask(
    index: number,
    field: keyof GeneratedTask,
    value: string
  ) {
    if (!plan) return;

    const updatedTasks = [...plan.tasks];

    updatedTasks[index] = {
      ...updatedTasks[index],
      [field]: value,
    } as GeneratedTask;

    setPlan({
      ...plan,
      tasks: updatedTasks,
    });
  }

  function addTask() {
    if (!plan) return;

    setPlan({
      ...plan,
      tasks: [
        ...plan.tasks,
        {
          title: "",
          description: "",
          priority: "MEDIUM",
        },
      ],
    });
  }

  function removeTask(index: number) {
    if (!plan) return;

    setPlan({
      ...plan,
      tasks: plan.tasks.filter(
        (_, taskIndex) => taskIndex !== index
      ),
    });
  }

  async function refinePlan() {
    if (!jobId || !plan) {
      setError("Generate a plan first.");
      return;
    }

    if (!refinement.trim()) {
      setError(
        "Tell Pulse how you want to improve the plan."
      );
      return;
    }

    setRefining(true);
    setError("");

    try {
      const response = await fetch(
        "/api/ai/refine-plan",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
        body: JSON.stringify({
  jobId,
  instruction: refinement.trim(),
  currentPlan: plan,
}),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message ||
            "Failed to refine project plan"
        );
      }

      if (!data.output) {
        throw new Error(
          "Pulse did not return a refined plan."
        );
      }

      setPlan(data.output);
      setRefinement("");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to refine project plan."
      );
    } finally {
      setRefining(false);
    }
  }

  async function createProject() {
    if (!jobId || !plan) {
      setError("No AI plan is available.");
      return;
    }

    if (!workspaceId) {
      setError("Choose a workspace first.");
      return;
    }

    if (!plan.name.trim()) {
      setError("Project name is required.");
      return;
    }

    if (!plan.description.trim()) {
      setError("Project description is required.");
      return;
    }

    if (plan.tasks.length === 0) {
      setError(
        "Add at least one task to the project."
      );
      return;
    }

    const invalidTask = plan.tasks.some(
      (task) =>
        !task.title.trim() ||
        !task.description.trim()
    );

    if (invalidTask) {
      setError(
        "Every task needs a title and description."
      );
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
            plan,
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

  const busy =
    loading || refining || creating;

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
            disabled={busy}
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
            disabled={busy}
            className="w-full rounded-lg border border-gray-300 p-3 text-sm outline-none focus:border-black"
          />
        </div>

        <button
          type="button"
          onClick={generatePlan}
          disabled={busy}
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
        <div className="space-y-6 rounded-xl border border-gray-200 p-5">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
              Pulse AI Plan
            </p>

            <div className="mt-3 space-y-4">
              <div>
                <label
                  htmlFor="planName"
                  className="mb-2 block text-sm font-medium"
                >
                  Project name
                </label>

                <input
                  id="planName"
                  value={plan.name}
                  onChange={(event) =>
                    updatePlan(
                      "name",
                      event.target.value
                    )
                  }
                  disabled={busy}
                  className="w-full rounded-lg border border-gray-300 p-3 text-sm outline-none focus:border-black"
                />
              </div>

              <div>
                <label
                  htmlFor="planDescription"
                  className="mb-2 block text-sm font-medium"
                >
                  Description
                </label>

                <textarea
                  id="planDescription"
                  value={plan.description}
                  onChange={(event) =>
                    updatePlan(
                      "description",
                      event.target.value
                    )
                  }
                  rows={3}
                  disabled={busy}
                  className="w-full rounded-lg border border-gray-300 p-3 text-sm outline-none focus:border-black"
                />
              </div>
            </div>
          </div>

          <div className="rounded-xl bg-gray-50 p-4">
            <div className="mb-3">
              <h4 className="text-sm font-semibold">
                🤖 Refine with Pulse AI
              </h4>

              <p className="mt-1 text-xs text-gray-500">
                Tell Pulse what you want changed.
              </p>
            </div>

            <div className="flex flex-col gap-3 md:flex-row">
              <input
                value={refinement}
                onChange={(event) =>
                  setRefinement(event.target.value)
                }
                onKeyDown={(event) => {
                  if (
                    event.key === "Enter" &&
                    !event.shiftKey
                  ) {
                    event.preventDefault();
                    refinePlan();
                  }
                }}
                placeholder="e.g. Make the plan more focused on marketing"
                disabled={busy}
                className="flex-1 rounded-lg border border-gray-300 bg-white p-3 text-sm outline-none focus:border-black"
              />

              <button
                type="button"
                onClick={refinePlan}
                disabled={busy}
                className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {refining
                  ? "Refining..."
                  : "Refine"}
              </button>
            </div>
          </div>

          <div>
            <div className="mb-3 flex items-center justify-between">
              <h4 className="text-sm font-semibold">
                Tasks ({plan.tasks.length})
              </h4>

              <button
                type="button"
                onClick={addTask}
                disabled={busy}
                className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium hover:bg-gray-50 disabled:opacity-50"
              >
                + Add task
              </button>
            </div>

            <div className="space-y-4">
              {plan.tasks.map((task, index) => (
                <div
                  key={index}
                  className="rounded-lg border border-gray-200 p-4"
                >
                  <div className="mb-3 flex items-center justify-between">
                    <span className="text-xs font-medium text-gray-400">
                      Task {index + 1}
                    </span>

                    <button
                      type="button"
                      onClick={() =>
                        removeTask(index)
                      }
                      disabled={busy}
                      className="text-xs font-medium text-red-600 hover:text-red-800 disabled:opacity-50"
                    >
                      Remove
                    </button>
                  </div>

                  <div className="space-y-3">
                    <input
                      value={task.title}
                      onChange={(event) =>
                        updateTask(
                          index,
                          "title",
                          event.target.value
                        )
                      }
                      placeholder="Task title"
                      disabled={busy}
                      className="w-full rounded-lg border border-gray-300 p-3 text-sm outline-none focus:border-black"
                    />

                    <textarea
                      value={task.description}
                      onChange={(event) =>
                        updateTask(
                          index,
                          "description",
                          event.target.value
                        )
                      }
                      placeholder="Task description"
                      rows={3}
                      disabled={busy}
                      className="w-full rounded-lg border border-gray-300 p-3 text-sm outline-none focus:border-black"
                    />

                    <select
                      value={task.priority}
                      onChange={(event) =>
                        updateTask(
                          index,
                          "priority",
                          event.target.value
                        )
                      }
                      disabled={busy}
                      className="w-full rounded-lg border border-gray-300 bg-white p-3 text-sm outline-none focus:border-black"
                    >
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
                </div>
              ))}
            </div>
          </div>

          <div className="flex gap-3 border-t border-gray-200 pt-4">
            <button
              type="button"
              onClick={() => {
                setPlan(null);
                setJobId("");
                setError("");
                setRefinement("");
              }}
              disabled={busy}
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium disabled:opacity-50"
            >
              Cancel
            </button>

            <button
              type="button"
              onClick={createProject}
              disabled={busy}
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