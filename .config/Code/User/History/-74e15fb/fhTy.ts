export async function askGroq(
  prompt: string,
  options?: {
    json?: boolean;
  }
) {
  const apiKey = process.env.GROQ_API_KEY;

  if (!apiKey) {
    throw new Error(
      "GROQ_API_KEY is not configured."
    );
  }

  const wantsJson = options?.json ?? false;

  const systemPrompt = wantsJson
    ? `
You are Pulse AI, an intelligent business assistant.

Follow the user's instructions exactly.

When JSON is requested:
- Return ONLY valid JSON.
- Do not use markdown.
- Do not use code fences.
- Do not add explanations before or after the JSON.
- Do not invent information.
- Make sure all strings are valid JSON strings.
- Make sure the JSON is complete and properly closed.
`
    : `
You are Pulse AI, an intelligent business assistant.

Follow the user's instructions exactly.
`;

  let response: Response;

  try {
    response = await fetch(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "llama-3.3-70b-versatile",
          temperature: wantsJson ? 0.1 : 0.2,

          ...(wantsJson && {
            response_format: {
              type: "json_object",
            },
          }),

          messages: [
            {
              role: "system",
              content: systemPrompt,
            },
            {
              role: "user",
              content: prompt,
            },
          ],
        }),
      }
    );
  } catch (error) {
    console.error("Groq network error:", error);

    throw new Error(
      "Pulse AI could not connect to the AI service."
    );
  }

  let data: any;

  try {
    data = await response.json();
  } catch (error) {
    console.error(
      "Groq response parsing error:",
      error
    );

    throw new Error(
      "Pulse AI returned an unreadable response."
    );
  }

  if (!response.ok) {
    console.error(
      "Groq API error:",
      data
    );

    throw new Error(
      data?.error?.message ||
        `Pulse AI request failed (${response.status}).`
    );
  }

  const content =
    data?.choices?.[0]?.message?.content;

  if (
    typeof content !== "string" ||
    !content.trim()
  ) {
    console.error(
      "Groq returned no usable content:",
      data
    );

    throw new Error(
      "Pulse AI returned an empty response."
    );
  }

  return content.trim();
}