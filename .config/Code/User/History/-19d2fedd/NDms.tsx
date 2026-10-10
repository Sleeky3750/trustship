export default function NotFound() {
  return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <div className="text-center px-6">
        <h1 className="text-6xl font-bold">404</h1>

        <p className="text-xl font-semibold mt-4">
          Page not found
        </p>

        <p className="text-gray-500 mt-2">
          The page you're looking for doesn't exist.
        </p>

        <a
          href="/dashboard"
          className="inline-block mt-6 bg-black text-white px-5 py-2.5 rounded-lg hover:bg-gray-800 transition"
        >
          Back to Dashboard
        </a>
      </div>
    </div>
  );
}