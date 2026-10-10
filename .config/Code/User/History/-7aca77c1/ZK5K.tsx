export default function Logo() {
  return (
    <div className="text-center">
      <h1 className="text-5xl font-extrabold tracking-tight">
        Pulse
      </h1>

      <p className="mt-2 text-sm uppercase tracking-[0.3em] text-zinc-500">
        Trusted by Modern Businesses
      </p>

      <div className="mt-6 flex flex-wrap justify-center gap-4 text-sm text-zinc-600">
        <span>⚡ Fast Setup</span>
        <span>🔒 Secure</span>
        <span>🤖 AI Powered</span>
        <span>🌍 24/7 Available</span>
      </div>
    </div>
  );
}