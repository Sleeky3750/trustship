"use client";

import { useState } from "react";

type Message = {
  role: "user" | "assistant";
  content: string;
};

type Confirmation = {
  type: "DELETE_TASK";
  taskId: string;
  taskTitle: string;
};

export default function PulseAssistant() {
  const [messages, setMessages] =
    useState<Message[]>([
      {
        role: "assistant",
        content:
          "Hey 👋 I'm Pulse AI. Ask me about your projects, tasks, priorities, or business plans.",
      },
    ]);

  const [input, setInput] = useState("");
  const [loading, setLoading] =
    useState(false);

  const [confirmation, setConfirmation] =
    useState<Confirmation | null>(null);

  async function sendMessage(
    messageOverride?: string
  ) {
    const message = (
      messageOverride ?? input
    ).trim();

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
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            message,
            history: messages,
          }),
        }
      );

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data.message ||
            "Failed to contact Pulse AI."
        );
      }

      setMessages([
        ...updatedMessages,
        {
          role: "assistant",
          content:
            data.answer ||
            "Done.",
        },
      ]);

      setConfirmation(
        data.confirmation ?? null
      );
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

  async function confirmDelete() {
    if (!confirmation || loading) {
      return;
    }

    const confirmedTask =
      confirmation;

    setConfirmation(null);
    setLoading(true);

    try {
      const response = await fetch(
        "/api/ai/assistant",
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            confirmDelete: true,
            taskId:
              confirmedTask.taskId,
          }),
        }
      );

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data.message ||
            "Failed to delete task."
        );
      }

      setMessages((current) => [
        ...current,
        {
          role: "assistant",
          content:
            data.answer ||
            `Deleted "${confirmedTask.taskTitle}".`,
        },
      ]);
    } catch (error) {
      setMessages((current) => [
        ...current,
        {
          role: "assistant",
          content:
            error instanceof Error
              ? error.message
              : "Something went wrong.",
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  function cancelDelete() {
    setConfirmation(null);

    setMessages((current) => [
      ...current,
      {
        role: "assistant",
        content:
          "Okay, I won't delete it.",
      },
    ]);
  }

  return (
    <section className="rounded-2xl bg-white p-6 shadow">
      <div>
        <h2 className="text-2xl font-bold">
          🤖 Pulse AI Assistant
        </h2>

        <p className="mt-1 text-sm text-gray-500">
          Your business assistant, connected
          to your Pulse workspace.
        </p>
      </div>

      <div className="mb-4 mt-6 max-h-[420px] space-y-4 overflow-y-auto rounded-xl bg-gray-50 p-4">
        {messages.map(
          (message, index) => (
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
          )
        )}

        {loading && (
          <div className="flex justify-start">
            <div className="rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-500">
              Pulse is thinking...
            </div>
          </div>
        )}
      </div>

      {confirmation && (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-4">
          <p className="text-sm font-semibold text-red-800">
            Delete task?
          </p>

          <p className="mt-1 text-sm text-red-700">
            "{confirmation.taskTitle}"
            will be permanently deleted.
          </p>

          <div className="mt-4 flex gap-3">
            <button
              type="button"
              onClick={confirmDelete}
              disabled={loading}
              className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
            >
              Delete
            </button>

            <button
              type="button"
              onClick={cancelDelete}
              disabled={loading}
              className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

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
          onClick={() => sendMessage()}
          disabled={
            loading || !input.trim()
          }
          className="rounded-lg bg-black px-5 py-3 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
        >
          Send
        </button>
      </div>
    </section>
  );
}