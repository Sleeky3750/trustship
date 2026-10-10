import { askGroq } from "@/lib/ai/groq";

export type ProjectTask = {
  title: string;
  description: string;
  priority: "LOW" | "MEDIUM" | "HIGH";
};

export type ProjectPlan = {
  name: string;
  description: string;
  tasks: ProjectTask[];
};

function validateProjectPlan(
  parsed: unknown
): ProjectPlan {
  if (!parsed || typeof parsed !== "object") {
    throw new Error(
      "AI returned an invalid project plan"
    );
  }

  const plan = parsed as Partial<ProjectPlan>;

  if (
    typeof plan.name !== "string" ||
    !plan.name.trim()
  ) {
    throw new Error(
      "AI returned a project plan without a name"
    );
  }

  if (
    typeof plan.description !== "string" ||
    !plan.description.trim()
  ) {
    throw new Error(
      "AI returned a project plan without a description"
    );
  }

  if (!Array.isArray(plan.tasks)) {
    throw new Error(
      "AI returned a project plan without tasks"
    );
  }

  const tasks: ProjectTask[] = plan.tasks.map(
    (task) => {
      if (!task || typeof task !== "object") {
        throw new Error(
          "AI returned an invalid task"
        );
      }

      const item = task as Partial<ProjectTask>;

      if (
        typeof item.title !== "string" ||
        !item.title.trim()
      ) {
        throw new Error(
          "AI returned a task without a title"
        );
      }

      if (
        typeof item.description !== "string" ||
        !item.description.trim()
      ) {
        throw new Error(
          "AI returned a task without a description"
        );
      }

      if (
        item.priority !== "LOW" &&
        item.priority !== "MEDIUM" &&
        item.priority !== "HIGH"
      ) {
        throw new Error(
          "AI returned an invalid task priority"
        );
      }

      return {
        title: item.title.trim(),
        description: item.description.trim(),
        priority: item.priority,
      };
    }
  );

  if (tasks.length < 1) {
    throw new Error(
      "AI returned a project plan with no tasks"
    );
  }

  return {
    name: plan.name.trim(),
    description: plan.description.trim(),
    tasks,
  };
}

function parseProjectPlan(
  result: string
): ProjectPlan {
  try {
    const parsed = JSON.parse(result);

    return validateProjectPlan(parsed);
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.startsWith("AI returned")
    ) {
      throw error;
    }

    throw new Error(
      "AI returned invalid project plan JSON"
    );
  }
}

export async function generateProjectPlan(
  projectIdea: string
): Promise<ProjectPlan> {
  const prompt = `
Create a practical project plan for the following business project:

"${projectIdea}"

Return ONLY valid JSON.

Use exactly this structure:

{
  "name": "Project name",
  "description": "Short project description",
  "tasks": [
    {
      "title": "Task title",
      "description": "What needs to be done",
      "priority": "LOW"
    }
  ]
}

Rules:

- Generate between 5 and 10 useful tasks.
- Tasks must be practical and actionable.
- Use only LOW, MEDIUM, or HIGH for priority.
- Do not include markdown.
- Do not include explanations outside the JSON.
`;

  const result = await askGroq(prompt);

  return parseProjectPlan(result);
}

export async function refineProjectPlan({
  currentPlan,
  instruction,
}: {
  currentPlan: unknown;
  instruction: string;
}): Promise<ProjectPlan> {
  const plan = validateProjectPlan(currentPlan);

  const prompt = `
You are refining an existing business project plan.

CURRENT PROJECT PLAN:

${JSON.stringify(plan, null, 2)}

USER'S REFINEMENT REQUEST:

"${instruction}"

Modify the project plan according to the user's request.

Important rules:

- Keep the plan practical and actionable.
- Preserve useful existing information unless the user's request asks you to change it.
- You may add, remove, rename, reorder, or rewrite tasks when appropriate.
- Keep task priorities limited to LOW, MEDIUM, or HIGH.
- Generate between 5 and 10 tasks.
- Return ONLY valid JSON.
- Do not include markdown.
- Do not include explanations outside the JSON.

Use exactly this structure:

{
  "name": "Project name",
  "description": "Short project description",
  "tasks": [
    {
      "title": "Task title",
      "description": "What needs to be done",
      "priority": "LOW"
    }
  ]
}
`;

  const result = await askGroq(prompt);

  return parseProjectPlan(result);
}