import { askGroq } from "@/lib/ai/groq";
import {
  getBusinessAIContext,
} from "@/lib/ai/businessContext";

export type AIRecommendation = {
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

export async function generateRecommendations(
  businessId: string
) {
  const context =
    await getBusinessAIContext(
      businessId
    );

  const prompt = `
You are Pulse AI's task recommendation
engine.

BUSINESS:
${JSON.stringify(
  context.business,
  null,
  2
)}

PROJECTS:
${JSON.stringify(
  context.projects,
  null,
  2
)}

TOTALS:
${JSON.stringify(
  context.totals,
  null,
  2
)}

Recommend the most useful unfinished
tasks the business owner should work on.

Consider:

- HIGH priority tasks
- IN_PROGRESS tasks
- overdue tasks
- project progress
- unfinished work
- dependencies implied by task descriptions
- projects with little progress

Do not invent tasks.

Only recommend tasks that actually
exist in the supplied data.

Return ONLY valid JSON.

Structure:

{
  "summary": "Short recommendation summary",
  "recommendations": [
    {
      "taskId": "existing task id",
      "taskTitle": "existing task title",
      "projectId": "existing project id",
      "projectName": "existing project name",
      "reason": "Why this should be worked on",
      "priority": "HIGH"
    }
  ]
}

Rules:

- Return between 1 and 5 recommendations.
- Never recommend DONE tasks.
- Never invent IDs.
- Never invent projects.
- Never invent tasks.
- Keep reasons short and practical.
`;

  const raw =
    await askGroq(prompt);

  try {
    const parsed =
      JSON.parse(raw);

    if (
      !parsed.summary ||
      !Array.isArray(
        parsed.recommendations
      )
    ) {
      throw new Error(
        "Invalid recommendation response"
      );
    }

    /*
     * SERVER-SIDE VALIDATION
     */

    const validTasks =
      new Set(
        context.projects.flatMap(
          (project) =>
            project.tasks
              .filter(
                (task) =>
                  task.status !==
                  "DONE"
              )
              .map(
                (task) => task.id
              )
        )
      );

    parsed.recommendations =
      parsed.recommendations.filter(
        (recommendation: AIRecommendation) =>
          validTasks.has(
            recommendation.taskId
          )
      );

    return parsed;
  } catch {
    throw new Error(
      "Pulse AI returned invalid recommendation JSON."
    );
  }
}