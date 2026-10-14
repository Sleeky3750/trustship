export default function TermsPage() {
  const supportEmail = process.env.NEXT_PUBLIC_SUPPORT_EMAIL || "trustship.app@gmail.com";

  return (
    <div className="bg-[#030611] text-slate-200 min-h-screen px-6 py-12 font-sans max-w-4xl mx-auto space-y-8">
      {/* Header Section */}
      <div className="border-b border-slate-800 pb-6">
        <h1 className="text-3xl font-extrabold text-white tracking-tight">
          TrustShip Escrow Terms of Service & Privacy Policy
        </h1>
        <p className="text-xs text-slate-400 mt-2">
          Effective Date: October 2026 | TrustShip Escrow Technologies
        </p>
      </div>

      {/* Terms Content */}
      <section className="space-y-4">
        <h2 className="text-xl font-bold text-white flex items-center gap-2">
          1. Escrow & Fund Holding Policy
        </h2>
        <p className="text-sm text-slate-300 leading-relaxed">
          TrustShip operates as a neutral third-party escrow provider. Buyer funds are held securely in escrow upon payment initialization via Paystack. Funds are locked until delivery conditions are verified or the buyer explicitly issues a release PIN via WhatsApp.
        </p>
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-bold text-white flex items-center gap-2">
          2. Release PIN & Inspection Period
        </h2>
        <p className="text-sm text-slate-300 leading-relaxed">
          Upon successful deposit, a unique 4-digit Release PIN is issued to the buyer. The buyer agrees to share or text this PIN back to the TrustShip WhatsApp bot only after receiving and verifying the physical condition of the item. Once the 4-digit PIN is entered and validated, funds are permanently released to the seller and cannot be recalled or refunded.
        </p>
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-bold text-white flex items-center gap-2">
          3. Disputes & Refund Mediation
        </h2>
        <p className="text-sm text-slate-300 leading-relaxed">
          If an item is damaged, incomplete, or not as described, the buyer must refrain from sharing their Release PIN and contact support immediately. TrustShip administrators will review waybill evidence, photo proof, and chat records before rendering an escrow refund or release ruling.
        </p>
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-bold text-white flex items-center gap-2">
          4. Privacy & Data Handling
        </h2>
        <p className="text-sm text-slate-300 leading-relaxed">
          We collect phone numbers, transaction values, and delivery statuses solely to facilitate order completion via Meta’s WhatsApp Business Cloud API and Paystack payment processing. We do not sell or expose user contact information to third parties.
        </p>
      </section>

      {/* Support Section */}
      <section className="border-t border-slate-800 pt-6 space-y-2">
        <h2 className="text-lg font-bold text-white">Need Assistance?</h2>
        <p className="text-sm text-slate-400">
          For help, dispute arbitration, or legal inquiries, reach out directly to our help desk:
        </p>
        <a
          href={`mailto:${supportEmail}`}
          className="inline-block text-blue-400 hover:text-blue-300 font-semibold text-sm underline"
        >
          {supportEmail}
        </a>
      </section>
    </div>
  );
}
