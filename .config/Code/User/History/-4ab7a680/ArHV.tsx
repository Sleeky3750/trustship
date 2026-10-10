"use client";

import { useState } from "react";

type Message = {
  role: "user" | "assistant";
  content: string;
};

export default function PulseAssistant() {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content:
        "Hey 👋 I'm Pulse AI. Ask me about your projects, tasks, priorities, or business plans.",
    },
  ]);

  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  async function sendMessage() {
    const message = input.trim();

    if (!message || loading) {
      return;
    }

    const userMessage: Message = {
      role: "user",
      content: message,
    };

    const updatedMessages = [
      ...messages,
      userMessage,
    ];

    setMessages(updatedMessages);
    setInput("");
    setLoading(true);

    try {
      const response = await fetch(
        "/api/ai/assistant",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            message,
            history: messages,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message ||
            "Failed to contact Pulse AI"
        );
      }

      let answer =
        data.answer ||
        "Done.";

      if (data.action?.type === "CREATE_TASK") {
        answer =
          data.answer ||
          `Created "${data.action.task.title}" successfully.`;
      }

      if (
        data.action?.type ===
        "UPDATE_TASK_STATUS"
      ) {
        answer =
          data.answer ||
          `Updated "${data.action.task.title}" to ${data.action.task.status}.`;
      }

      setMessages([
        ...updatedMessages,
        {
          role: "assistant",
          content: answer,
        },
      ]);
    } catch (error) {
      setMessages([
        ...updatedMessages,
        {
          role: "assistant",
          content:
            error instanceof Error
              ? error.message
              : "Something went wrong. Please try again.",
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="rounded-2xl bg-white p-6 shadow">
      <div className="mb-5">
        <h2 className="text-2xl font-bold">
          🤖 Pulse AI Assistant
        </h2>

        <p className="mt-1 text-sm text-gray-500">
          Your business assistant, connected to
          your Pulse workspace.
        </p>
      </div>

      <div className="mb-4 max-h-[420px] space-y-4 overflow-y-auto rounded-xl bg-gray-50 p-4">
        {messages.map((message, index) => (
          <div
            key={index}
            className={`flex ${
              message.role === "user"
                ? "justify-end"
                : "justify-start"
            }`}
          >
            <div
              className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-4 py-3 text-sm ${
                message.role === "user"
                  ? "bg-black text-white"
                  : "border border-gray-200 bg-white text-gray-800"
              }`}
            >
              {message.content}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex justify-start">
            <div className="rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-500">
              Pulse is thinking...
            </div>
          </div>
        )}
      </div>

      <div className="flex gap-3">
        <input
          value={input}
          onChange={(event) =>
            setInput(event.target.value)
          }
          onKeyDown={(event) => {
            if (
              event.key === "Enter" &&
              !event.shiftKey
            ) {
              event.preventDefault();
              sendMessage();
            }
          }}
          placeholder="Ask Pulse anything about your business..."
          disabled={loading}
          className="flex-1 rounded-lg border border-gray-300 p-3 text-sm outline-none focus:border-black disabled:bg-gray-100"
        />

        <button
          type="button"
          onClick={sendMessage}
          disabled={
            loading || !input.trim()
          }
          className="rounded-lg bg-black px-5 py-3 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? "..." : "Send"}
        </button>
      </div>
    </section>
  );
}