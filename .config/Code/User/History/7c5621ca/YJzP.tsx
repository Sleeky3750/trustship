import Image from "next/image";

export default function Home() {
  return (
    <div className="flex flex-col flex-1 items-center justify-center bg-zinc-50 font-sans dark:bg-black">
  <main className="flex min-h-screen items-center justify-center">
        
        <div className="flex flex-col items-center gap-6 max-w-2xl text-center">
          <h1 className="max-w-xs text-3xl font-semibold leading-10 tracking-tight text-black dark:text-zinc-50">
            Pulse 
          </h1>
          <p className="max-w-md text-lg leading-8 text-zinc-600 dark:text-zinc-400">
            Your AI Workforce.
          </p> 
          <p className="max-w-md text-base text-zinc-500">
  An AI employee for modern businesses.
</p>
<p className="mt-3 text-lg text-gray-500">

  Automate customer support, bookings and business operations with AI that works 24/7.

</p>

<button className="mt-8 rounded-xl bg-black px-6 py-3 text-white hover:bg-gray-800">

  Get Started

</button>
        </div>
      </main>
    </div>
  );
}
