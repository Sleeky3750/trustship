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

export async function analyzeBusiness(
  businessId: string
): Promise<AIIntelligenceResult> {
  const context =
    await getBusinessAIContext(
      businessId
    );

  const prompt = `
You are Pulse AI's business intelligence
engine.

Analyze the following business data.

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

Your job is to identify:

1. Overall progress.
2. Bottlenecks.
3. Risks.
4. Useful opportunities.
5. Projects that need attention.
6. Important unfinished work.
7. High-priority work that is being ignored.

Do not invent information.

Only use information contained
in the provided business data.

Return ONLY valid JSON.

Use exactly:

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

- Generate between 3 and 7 insights.
- Use only PROGRESS, BOTTLENECK, RISK, OPPORTUNITY.
- Use only LOW, MEDIUM, HIGH.
- Be practical.
- Do not exaggerate.
- Do not invent deadlines.
- Do not invent business information.
`;

  const raw =
    await askGroq(prompt);

  try {
    const parsed =
      JSON.parse(raw);

    if (
      !parsed.summary ||
      !Array.isArray(
        parsed.insights
      )
    ) {
      throw new Error(
        "Invalid intelligence response"
      );
    }

    return parsed;
  } catch {
    throw new Error(
      "Pulse AI returned invalid intelligence JSON."
    );
  }
}