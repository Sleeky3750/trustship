import { askGroq } from "@/lib/ai/groq";
import {
  getBusinessAIContext,
} from "@/lib/ai/businessContext";

export type AIInsight = {
  type:
    | "PROGRESS"
    | "BOTTLENECK"
    | "RISK"
    | "OPPORTUNITY";
  title: string;
  description: string;
  severity:
    | "LOW"
    | "MEDIUM"
    | "HIGH";
};

export type AIIntelligenceResult = {
  summary: string;
  insights: AIInsight[];
};

const VALID_TYPES = new Set([
  "PROGRESS",
  "BOTTLENECK",
  "RISK",
  "OPPORTUNITY",
]);

const VALID_SEVERITIES = new Set([
  "LOW",
  "MEDIUM",
  "HIGH",
]);

function validateIntelligenceResult(
  value: unknown
): AIIntelligenceResult {
  if (
    !value ||
    typeof value !== "object"
  ) {
    throw new Error(
      "Invalid intelligence response."
    );
  }

  const result = value as {
    summary?: unknown;
    insights?: unknown;
  };

  if (
    typeof result.summary !== "string" ||
    !result.summary.trim()
  ) {
    throw new Error(
      "Invalid intelligence summary."
    );
  }

  if (!Array.isArray(result.insights)) {
    throw new Error(
      "Invalid intelligence insights."
    );
  }

  if (
    result.insights.length < 1 ||
    result.insights.length > 7
  ) {
    throw new Error(
      "Invalid number of intelligence insights."
    );
  }

  const insights: AIInsight[] =
    result.insights.map((item) => {
      if (
        !item ||
        typeof item !== "object"
      ) {
        throw new Error(
          "Invalid intelligence insight."
        );
      }

      const insight = item as {
        type?: unknown;
        title?: unknown;
        description?: unknown;
        severity?: unknown;
      };

      if (
        typeof insight.type !== "string" ||
        !VALID_TYPES.has(
          insight.type
        )
      ) {
        throw new Error(
          "Invalid intelligence insight type."
        );
      }

      if (
        typeof insight.title !== "string" ||
        !insight.title.trim()
      ) {
        throw new Error(
          "Invalid intelligence insight title."
        );
      }

      if (
        typeof insight.description !==
          "string" ||
        !insight.description.trim()
      ) {
        throw new Error(
          "Invalid intelligence insight description."
        );
      }

      if (
        typeof insight.severity !==
          "string" ||
        !VALID_SEVERITIES.has(
          insight.severity
        )
      ) {
        throw new Error(
          "Invalid intelligence insight severity."
        );
      }

      return {
        type: insight.type as AIInsight["type"],
        title: insight.title.trim(),
        description:
          insight.description.trim(),
        severity:
          insight.severity as AIInsight["severity"],
      };
    });

  return {
    summary: result.summary.trim(),
    insights,
  };
}

export async function analyzeBusiness(
  businessId: string
): Promise<AIIntelligenceResult> {
  const context =
    await getBusinessAIContext(
      businessId
    );

  const hasWork =
    context.totals.workspaces > 0 ||
    context.totals.projects > 0 ||
    context.totals.tasks > 0;

  /*
   * Empty business state.
   *
   * We don't need to spend an AI request
   * when there is absolutely no work to analyze.
   */
  if (!hasWork) {
    return {
      summary:
        `${context.business.name} has no ongoing projects or tasks.`,
      insights: [
        {
          type: "PROGRESS",
          title: "No Ongoing Work",
          description:
            "There are no projects or tasks currently being worked on.",
          severity: "LOW",
        },
        {
          type: "OPPORTUNITY",
          title: "Start a Project",
          description:
            "Create a project and add tasks to begin tracking business work.",
          severity: "LOW",
        },
      ],
    };
  }

  const prompt = `
You are Pulse AI's business intelligence engine.

Analyze ONLY the business data provided below.

BUSINESS:
${JSON.stringify(
  context.business,
  null,
  2
)}

TOTALS:
${JSON.stringify(
  context.totals,
  null,
  2
)}

PROJECT SUMMARIES:
${JSON.stringify(
  context.projectSummaries,
  null,
  2
)}

PROJECT DATA:
${JSON.stringify(
  context.projects,
  null,
  2
)}

Identify:

1. Overall progress.
2. Bottlenecks.
3. Risks.
4. Useful opportunities.
5. Projects needing attention.
6. Important unfinished work.
7. High-priority work being ignored.

IMPORTANT:

- Use ONLY information in the supplied data.
- Do not invent tasks.
- Do not invent deadlines.
- Do not invent projects.
- Do not assume information that is not provided.
- Be practical.
- Do not exaggerate.

Return ONLY JSON.

Required structure:

{
  "summary": "Short overall business summary",
  "insights": [
    {
      "type": "PROGRESS",
      "title": "Insight title",
      "description": "Useful explanation",
      "severity": "LOW"
    }
  ]
}

Rules:

- Return between 3 and 7 insights.
- Use only these types:
  PROGRESS
  BOTTLENECK
  RISK
  OPPORTUNITY

- Use only these severities:
  LOW
  MEDIUM
  HIGH
`;

  let raw: string;

  try {
    raw = await askGroq(prompt, {
      json: true,
    });
  } catch (error) {
    console.error(
      "Pulse Intelligence AI error:",
      error
    );

    throw new Error(
      "Pulse AI could not analyze the business right now."
    );
  }

  try {
    const parsed = JSON.parse(raw);

    return validateIntelligenceResult(
      parsed
    );
  } catch (error) {
    console.error(
      "Invalid Pulse Intelligence JSON:",
      error
    );

    throw new Error(
      "Pulse AI returned an invalid intelligence response."
    );
  }
}