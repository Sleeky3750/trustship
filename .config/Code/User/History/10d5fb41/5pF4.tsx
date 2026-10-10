"use client";
import { Eye, EyeOff } from "lucide-react";
import { businessTypes } from "../components/BusinessTypes";
import { useState, useRef, useEffect } from "react";
import Logo from "../components/Logo";
export default function Signup() { 
  const dropdownRef = useRef<HTMLDivElement>(null);
 useEffect(() => {
  function handleClickOutside(event: MouseEvent) {
    if (
      dropdownRef.current &&
      !dropdownRef.current.contains(event.target as Node)
    ) {
      setShowBusinessList(false);
    }
  }

  document.addEventListener("mousedown", handleClickOutside);
  return () => {
  document.removeEventListener("mousedown", handleClickOutside);
};
}, []);


const [showPassword, setShowPassword] =useState(false);
const [showConfirmPassword, setShowConfirmPassword] =useState(false);
const [isTypingBusiness, setIsTypingBusiness] = useState(false);
 const [showBusinessList, setShowBusinessList] = useState(false);
  const [businessType, setbusinessType] = useState("") ;
  const [password, setPassword] = useState("") ;
  const [confirmPassword, setConfirmPassword] = useState("") ;
  const [businessName, setBusinessName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState(""); 
  const [successMessage, setSuccessMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const passwordsMatch = password === confirmPassword;
  const passwordStrength =
  password.length < 8
    ? "Weak"
    : password.length < 12
    ? "Medium"
    : "Strong";
const emailValid = email.includes("@") && email.includes(".");
const formIsValid =
  businessName.trim() &&
  emailValid &&
  businessType &&
  password &&
  confirmPassword &&
  passwordsMatch;
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
{successMessage && (
  <div className="mb-4 rounded-lg bg-green-100 border border-green-300 p-3 text-green-700">
    {successMessage}
  </div>
)}
        <form
  className="mt-8 space-y-5"
  onSubmit={(e) => {
    e.preventDefault();

    setLoading(true);

    setTimeout(() => {
      setLoading(false);
    setSuccessMessage("Workspace created successfully!");
    }, 2000);
  }}
>
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
  value={email}
  onChange={(e) => setEmail(e.target.value)}
  className="w-full rounded-lg border border-zinc-300 px-4 py-3 outline-none focus:border-black"
/>
{email && !emailValid && (
  <p className="mt-2 text-sm text-red-500">
    Please enter a valid email address.
  </p>
)}

          <input
            type="tel"
            placeholder="WhatsApp Number"
            className="w-full rounded-lg border border-zinc-300 px-4 py-3 outline-none focus:border-black"
          />

          <input
          type="text"
          placeholder="Business Type"
          value={businessType}
          onChange={(e) => {
            setbusinessType(e.target.value);setIsTypingBusiness(true);}}
        onFocus={() => {
  setShowBusinessList(true);
}}
        className="w-full rounded-lg border border-zinc-300 px-4 py-3 outline-none focus:border-black"
          />
         {showBusinessList && (
          <div
  ref={dropdownRef}
  className="mt-2 max-h-60 overflow-y-auto rounded-xl border border-zinc-300 bg-white shadow-lg"
>
           {businessTypes
  .filter((type) => {
  if (!isTypingBusiness) return true;

  return type
    .toLowerCase()
    .includes(businessType.toLowerCase());
})
  .map((type) => (
    <div
  key={type}
  onClick={() => {
  setbusinessType(type);
  setShowBusinessList(false);
  setIsTypingBusiness(false);
}}
className="cursor-pointer border-b border-zinc-100 px-4 py-3 transition-colors hover:bg-black hover:text-white"
>
  {type}
</div>
  ))}
          </div>
         )}
<div className="relative">
  <input
  type={showPassword ? "text" : "password"}
  placeholder="Password"
  value={password}
  onChange={(e) => setPassword(e.target.value)}
  className="w-full rounded-lg border border-zinc-300 px-4 py-3 pr-12 outline-none focus:border-black"
/> 
{password && (
  <p
    className={`mt-2 text-sm ${
      passwordStrength === "Weak"
        ? "text-red-500"
        : passwordStrength === "Medium"
        ? "text-yellow-500"
        : "text-green-500"
    }`}
  >
    Password Strength: {passwordStrength}
  </p>
)}<button
  type="button"
  onClick={() => setShowPassword(!showPassword)}
  className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-black"
>
  {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
</button>
</div>

<div className="relative">
<input
type={showConfirmPassword ? "text" : "password"}
placeholder="Confirm Password"
value={confirmPassword}
onChange={(e) => setConfirmPassword(e.target.value)}
className="w-full rounded-lg border border-zinc-300 px-4 py-3 pr-12 outline-none focus:border-black"
/> 


<button 
  type="button"
  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
  className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-black"
>
  {showConfirmPassword ? (
  <EyeOff size={20} />
) : (
  <Eye size={20} />
)}
</button>
</div>

{confirmPassword && !passwordsMatch && (
  <p className="mt-2 text-sm text-red-500">
    Passwords do not match.
  </p>
)}



<button
  type="submit"
  disabled={!formIsValid || loading}
  className={`w-full rounded-lg py-3 font-semibold text-white transition-all duration-300 ${
    !formIsValid || loading
      ? "cursor-not-allowed bg-zinc-400"
      : "bg-black hover:scale-[1.02] hover:bg-zinc-800 active:scale-[0.98]"
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