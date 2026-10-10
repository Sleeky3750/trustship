"use client";
import { useState } from "react";
import Logo from "../components/Logo";
export default function Signup() {
 const [password, setPassword] = useState("") ;
  const [businessName, setBusinessName] = useState("");
  const [message, setMessage] = useState(""); 
  const [loading, setLoading] = useState(false);
  return ( 
    <main className="min-h-screen flex items-center justify-center bg-zinc-50">
      <div className="w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-8 shadow-lg">
        <Logo />
<p className="mt-3 text-sm uppercase tracking-widest text-zinc-500">
  Trusted by modern businesses
</p>
<div className="mt-4 flex flex-wrap gap-2">
  <span className="rounded-full bg-zinc-100 px-3 py-1 text-sm">
    ⚡ Fast Setup
  </span>

  <span className="rounded-full bg-zinc-100 px-3 py-1 text-sm">
    🔒 Secure
  </span>

  <span className="rounded-full bg-zinc-100 px-3 py-1 text-sm">
    🤖 AI Powered
  </span>

  <span className="rounded-full bg-zinc-100 px-3 py-1 text-sm">
    🌍 24/7 Available
  </span>
</div>
        <h1 className="mt-6 text-3xl font-bold text-black">
          Register Your Business
        </h1>

        <p className="mt-2 text-zinc-500">
          Let's create your Pulse workspace.
        </p>

        <form className="mt-8 space-y-5">
          <input
  type="text"
  placeholder="Business Name"
  value={businessName}
  onChange={(e) => setBusinessName(e.target.value)}
  className="w-full rounded-lg border border-zinc-300 px-4 py-3 outline-none focus:border-black"
/>

          <input
            type="email"
            placeholder="Email Address"
            className="w-full rounded-lg border border-zinc-300 px-4 py-3 outline-none focus:border-black"
          />

          <input
            type="tel"
            placeholder="WhatsApp Number"
            className="w-full rounded-lg border border-zinc-300 px-4 py-3 outline-none focus:border-black"
          />

          <input 
          type="business type"
          placeholder="Business Type"
        className="w-full rounded-lg border border-zinc-300 px-4 py-3 outline-none focus:border-black"
          />
<input
  type="password"
  placeholder="Password"
  value={password}
  onChange={(e) => setPassword(e.target.value)}
  className="w-full rounded-lg border border-zinc-300 px-4 py-3 outline-none focus:border-black"
/>
<input
type="password"
placeholder="Confirm Password"
value={password}
onChange={(e) => setPassword(e.target.value)}
className="w-full rounded-lg border border-zinc-300 px-4 py-3 outline-none focus:border-black"
/>


          <button
  type="button"
  disabled={loading}
  onClick={() => {
    if (!businessName.trim()) {
      setMessage("❌ Please enter your business name.");
      return;
    }

    setLoading(true);
    setMessage("");

    setTimeout(() => {
      setLoading(false);
     setMessage(`Workspace for "${businessName}" created successfully!`);
    }, 2000);
  }}
  className={`w-full rounded-lg py-3 text-white transition ${
    loading
      ? "bg-zinc-400 cursor-not-allowed"
      : "bg-black hover:bg-zinc-800"
  }`}
>
  {loading ? "Creating Workspace..." : "Create Workspace"}
</button>
{message && (
  <p className="mt-4 text-center text-green-600 font-medium">
    {message}
  </p>
)}
        </form>
      </div>
    </main>
  );
}