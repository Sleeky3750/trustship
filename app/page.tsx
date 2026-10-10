import Image from "next/image"
import { Button } from "@//components/ui/button"

export default function HomePage() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-indigo-50 to-white p-8">
      <div className="max-w-2xl mx-auto">
        <div className="text-center">
          <Image
            src="/placeholder.svg"
            alt="TrustShip"
            width={120}
            height={120}
            className="mx-auto mb-6"
            priority
          />

          <h1 className="text-4xl md:text-5xl font-bold text-indigo-600 mb-4">
            TrustShip
          </h1>

          <p className="text-lg text-gray-600 mb-8">
            100% WhatsApp-native escrow and waybill tracking for informal social commerce
          </p>

          <div className="space-y-4">
            <Button
              variant="primary"
              onClick={() => {
                // TODO: Navigate to escrow creation
              }}
            >
              Create Escrow Contract
            </Button>

            <Button variant="outline" onClick={() => {
              // TODO: Navigate to documentation
            }}>
              Learn More
            </Button>
          </div>
        </div>
      </div>
    </main>
  )
}