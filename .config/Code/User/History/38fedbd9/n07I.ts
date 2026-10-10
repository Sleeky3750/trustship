import { askGroq } from "@/lib/ai/groq";

export type ProjectPlan = {
  name: string;
  description: string;
  tasks: {
    title: string;
    description: string;
    priority: "LOW" | "MEDIUM" | "HIGH";
  }[];
};

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

  let parsed: ProjectPlan;

  try {
    parsed = JSON.parse(result);
  } catch {
    throw new Error("AI returned invalid project plan JSON");
  }

  if (
    !parsed.name ||
    !parsed.description ||
    !Array.isArray(parsed.tasks)
  ) {
    throw new Error("AI returned an invalid project plan structure");
  }

  return parsed;
}