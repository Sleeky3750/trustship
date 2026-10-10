export default function DashboardPage() {
  return (
    <main className="min-h-screen bg-gray-100 flex items-center justify-center p-6">
      <div className="bg-white shadow-xl rounded-2xl p-10 w-full max-w-2xl">
        <h1 className="text-4xl font-bold mb-4">
          Welcome to Pulse 🚀
        </h1>

        <p className="text-gray-600 text-lg mb-8">
          You have successfully logged in.
        </p>

        <div className="border rounded-xl p-6">
          <h2 className="text-2xl font-semibold mb-2">
            Dashboard
          </h2>

          <p className="text-gray-500">
            Your AI employees, customers, analytics, and business tools
            will appear here.
          </p>
        </div>
      </div>
    </main>
  );
}