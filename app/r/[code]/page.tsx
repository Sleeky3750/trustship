import Link from "next/link";
import { prisma } from "@/lib/prisma";

// Referral landing page: /r/<code> — the shareable TrustShip referral link
// sent to buyers by the WhatsApp bot once their first trade completes.
// Resolving the code server-side lets us greet the invitee with the
// referrer's display name while keeping the rest of the page static-ish.
export default async function ReferralPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;

  let referrerName: string | null = null;
  try {
    const referrer = await prisma.user.findUnique({
      where: { referralCode: code },
      select: { name: true },
    });
    referrerName = referrer?.name ?? null;
  } catch {
    // DB blip — fall through to the generic invite copy.
  }

  const valid = referrerName !== null;

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="bg-white p-8 rounded-xl shadow-md border border-slate-200 text-center max-w-md w-full">
        <div className="text-4xl mb-3">🛡️</div>
        <h1 className="text-xl font-bold text-slate-800 mb-2">
          {valid ? `${referrerName} invited you to TrustShip` : "You're invited to TrustShip"}
        </h1>
        <p className="text-sm text-slate-500 mb-6">
          TrustShip is a WhatsApp-first escrow platform — funds stay locked until
          the buyer receives what they paid for. No app downloads, no guesswork.
        </p>

        <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 text-left text-sm text-slate-600 mb-6">
          <p className="font-semibold text-slate-800 mb-2">Start your first protected deal:</p>
          <ol className="list-decimal list-inside space-y-1">
            <li>Open WhatsApp and message TrustShip</li>
            <li>Send <code className="bg-slate-200 px-1 rounded">escrow</code> to begin</li>
            <li>Follow the prompts — item, amount, seller</li>
          </ol>
        </div>

        <div className="flex flex-col gap-2">
          <Link
            href="/"
            className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2.5 px-4 rounded-lg transition"
          >
            Visit TrustShip
          </Link>
          {valid && (
            <span className="text-xs text-slate-400">Referral code: {code}</span>
          )}
        </div>
      </div>
    </div>
  );
}
