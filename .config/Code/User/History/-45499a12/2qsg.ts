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

export type AIRecommendationsResult = {
  summary: string;
  recommendations: AIRecommendation[];
};

const VALID_PRIORITIES = new Set([
  "LOW",
  "MEDIUM",
  "HIGH",
]);

function validateRecommendations(
  value: unknown
): AIRecommendationsResult {
  if (
    !value ||
    typeof value !== "object"
  ) {
    throw new Error(
      "Invalid recommendation response."
    );
  }

  const result = value as {
    summary?: unknown;
    recommendations?: unknown;
  };

  if (
    typeof result.summary !== "string" ||
    !result.summary.trim()
  ) {
    throw new Error(
      "Invalid recommendation summary."
    );
  }

  if (
    !Array.isArray(
      result.recommendations
    )
  ) {
    throw new Error(
      "Invalid recommendations list."
    );
  }

  if (
    result.recommendations.length > 5
  ) {
    throw new Error(
      "Too many recommendations returned."
    );
  }

  const recommendations: AIRecommendation[] =
    result.recommendations.map(
      (item) => {
        if (
          !item ||
          typeof item !== "object"
        ) {
          throw new Error(
            "Invalid recommendation."
          );
        }

        const recommendation =
          item as {
            taskId?: unknown;
            taskTitle?: unknown;
            projectId?: unknown;
            projectName?: unknown;
            reason?: unknown;
            priority?: unknown;
          };

        if (
          typeof recommendation.taskId !==
            "string" ||
          !recommendation.taskId.trim()
        ) {
          throw new Error(
            "Invalid recommendation task ID."
          );
        }

        if (
          typeof recommendation.taskTitle !==
            "string" ||
          !recommendation.taskTitle.trim()
        ) {
          throw new Error(
            "Invalid recommendation task title."
          );
        }

        if (
          typeof recommendation.projectId !==
            "string" ||
          !recommendation.projectId.trim()
        ) {
          throw new Error(
            "Invalid recommendation project ID."
          );
        }

        if (
          typeof recommendation.projectName !==
            "string" ||
          !recommendation.projectName.trim()
        ) {
          throw new Error(
            "Invalid recommendation project name."
          );
        }

        if (
          typeof recommendation.reason !==
            "string" ||
          !recommendation.reason.trim()
        ) {
          throw new Error(
            "Invalid recommendation reason."
          );
        }

        if (
          typeof recommendation.priority !==
            "string" ||
          !VALID_PRIORITIES.has(
            recommendation.priority
          )
        ) {
          throw new Error(
            "Invalid recommendation priority."
          );
        }

        return {
          taskId:
            recommendation.taskId.trim(),

          taskTitle:
            recommendation.taskTitle.trim(),

          projectId:
            recommendation.projectId.trim(),

          projectName:
            recommendation.projectName.trim(),

          reason:
            recommendation.reason.trim(),

          priority:
            recommendation.priority as AIRecommendation["priority"],
        };
      }
    );

  return {
    summary:
      result.summary.trim(),
    recommendations,
  };
}

export async function generateRecommendations(
  businessId: string
): Promise<AIRecommendationsResult> {
  const context =
    await getBusinessAIContext(
      businessId
    );

  const unfinishedTasks =
    context.projects.flatMap(
      (project) =>
        project.tasks.filter(
          (task) =>
            task.status !== "DONE"
        )
    );

  /*
   * Empty-state protection.
   *
   * There is nothing for Pulse AI
   * to recommend, so don't call Groq.
   */
  if (unfinishedTasks.length === 0) {
    return {
      summary:
        "There are no unfinished tasks to recommend yet.",
      recommendations: [],
    };
  }

  const prompt = `
You are Pulse AI's task recommendation engine.

Analyze ONLY the business data provided below.

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

Recommend the most useful unfinished tasks
the business owner should work on.

Consider:

- HIGH priority tasks
- IN_PROGRESS tasks
- overdue tasks
- project progress
- unfinished work
- dependencies implied by task descriptions
- projects with little progress

IMPORTANT:

- Recommend ONLY tasks that exist in the supplied data.
- Never recommend DONE tasks.
- Never invent IDs.
- Never invent projects.
- Never invent tasks.
- Keep reasons short and practical.

Return ONLY valid JSON.

Use exactly:

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
- Use only LOW, MEDIUM, or HIGH for priority.
- Do not include markdown.
- Do not include explanations outside JSON.
`;

  let raw: string;

  try {
    raw = await askGroq(
      prompt,
      {
        json: true,
      }
    );
  } catch (error) {
    console.error(
      "Pulse AI recommendation error:",
      error
    );

    throw new Error(
      "Pulse AI could not generate recommendations right now."
    );
  }

  let parsed: AIRecommendationsResult;

  try {
    parsed =
      validateRecommendations(
        JSON.parse(raw)
      );
  } catch (error) {
    console.error(
      "Invalid recommendation JSON:",
      error
    );

    throw new Error(
      "Pulse AI returned an invalid recommendation response."
    );
  }

  /*
   * SERVER-SIDE VALIDATION
   *
   * The AI is never trusted to decide
   * which tasks actually belong to this
   * business.
   */

  const validTasks = new Map(
    context.projects.flatMap(
      (project) =>
        project.tasks
          .filter(
            (task) =>
              task.status !==
              "DONE"
          )
          .map((task) => [
            task.id,
            {
              taskTitle:
                task.title,
              projectId:
                project.id,
              projectName:
                project.name,
            },
          ])
    )
  );

  const safeRecommendations =
    parsed.recommendations
      .filter(
        (recommendation) =>
          validTasks.has(
            recommendation.taskId
          )
      )
      .map(
        (recommendation) => {
          const task =
            validTasks.get(
              recommendation.taskId
            );

          if (!task) {
            return null;
          }

          return {
            ...recommendation,

            /*
             * Use database values instead
             * of trusting AI-generated names.
             */
            taskTitle:
              task.taskTitle,

            projectId:
              task.projectId,

            projectName:
              task.projectName,
          };
        }
      )
      .filter(
        (
          recommendation
        ): recommendation is AIRecommendation =>
          recommendation !== null
      );

  return {
    summary: parsed.summary,
    recommendations:
      safeRecommendations,
  };
}