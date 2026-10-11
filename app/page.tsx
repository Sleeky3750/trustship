"use client"

import Image from "next/image"
import { Button } from "@/components/ui/button"

export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-between p-24">
      <div className="flex flex-col items-center gap-4">
        <h1 className="text-4xl font-bold">TrustShip</h1>
        <p className="text-gray-600">WhatsApp-Native Escrow Platform</p>
        <Button onClick={() => alert("Welcome to TrustShip!")}>Get Started</Button>
      </div>
    </main>
  )
}
