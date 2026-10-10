export default function Loading() {
  return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <div className="text-center">
        <div className="w-10 h-10 border-4 border-gray-300 border-t-black rounded-full animate-spin mx-auto" />

        <p className="mt-4 text-gray-500">
          Loading Pulse...
        </p>
      </div>
    </div>
  );
}