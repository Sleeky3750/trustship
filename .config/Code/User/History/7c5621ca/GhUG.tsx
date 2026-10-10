import Link from "next/link";
export default function Home() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-zinc-50">
      <div className="max-w-2xl text-center px-6">
        <h1 className="text-6xl font-bold tracking-tight">
  Pulse
</h1>

        <p className="mt-6 text-2xl text-zinc-700">
          Your AI Workforce.
        </p>

        <p className="mt-4 text-lg text-zinc-500">
          Automate customer support, bookings, and business operations with AI
          that works 24/7.
        
</p>

  <a
  href="/signup"
  className="mt-10 inline-block rounded-xl bg-black px-6 py-3 text-white hover:bg-zinc-800 transition"
>
  Get Started
</a>
      </div>
    </main>
  );
}