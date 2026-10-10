"use client";

export default function ErrorPage({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <div className="text-center max-w-md px-6">
        <h1 className="text-3xl font-bold">
          Something went wrong
        </h1>

        <p className="text-gray-500 mt-3">
          Pulse ran into an unexpected problem. Please try again.
        </p>

        <button
          onClick={() => reset()}
          className="mt-6 bg-black text-white px-5 py-2.5 rounded-lg hover:bg-gray-800 transition"
        >
          Try again
        </button>
      </div>
    </div>
  );
}