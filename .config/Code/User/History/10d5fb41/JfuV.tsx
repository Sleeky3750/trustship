"use client";
import { businessTypes } from "../components/BusinessTypes";
import { useState } from "react";
import Logo from "../components/Logo";
export default function Signup() {
 const [showBusinessList, setShowBusinessList] = useState(false);
  const [businessType, setbusinessType] = useState("") ;
  const [password, setPassword] = useState("") ;
  const [businessName, setBusinessName] = useState("");
  const [message, setMessage] = useState(""); 
  const [loading, setLoading] = useState(false);
  return ( 
    <main className="min-h-screen flex items-center justify-center bg-zinc-50">
      <div className="w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-8 shadow-lg">
        <Logo />

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
          type="text"
          placeholder="Business Type"
          value={businessType}
          onChange={(e) => setbusinessType(e.target.value)}
        onFocus={() => setShowBusinessList(true)}
          className="w-full rounded-lg border border-zinc-300 px-4 py-3 outline-none focus:border-black"
          />
         {showBusinessList && (
           <div>
           {businessTypes
  .filter((type) =>
    type.toLowerCase().includes(businessType.toLowerCase())
  )
  .map((type) => (
    <div
  key={type}
  onClick={() => setbusinessType(type)}
  className="cursor-pointer rounded-md px-4 py-2 hover:bg-zinc-100"
>
  {type}
</div>
  ))}
          </div>
         )}
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