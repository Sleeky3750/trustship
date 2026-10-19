"use client";

import React from 'react';

export default function TermsOfServicePage() {
  return (
    <div className="bg-[#03070A] text-slate-100 min-h-screen font-sans selection:bg-[#00FF9D] selection:text-black">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-[#03070A]/85 backdrop-blur-md border-b border-emerald-950/40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
          <a href="/" className="flex items-center gap-2 text-white font-black text-xl">
            <span className="w-8 h-8 rounded-xl bg-emerald-500 flex items-center justify-center text-black font-bold">TS</span>
            TrustShip{" "}
            <span className="text-xs text-emerald-400 font-semibold px-2 py-0.5 rounded bg-emerald-950/60">
              Terms of Service
            </span>
          </a>
          <a href="/" className="text-xs font-bold text-[#00FF9D] hover:underline">
            ← Back to Home
          </a>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-4xl mx-auto px-4 py-16">
        <div className="bg-white text-slate-900 rounded-3xl p-8 sm:p-12 shadow-2xl space-y-8">
          <div className="border-b border-slate-200 pb-6">
            <h1 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight">
              Terms of Service & Escrow Policy
            </h1>
            <p className="text-xs text-slate-500 mt-2">Last updated: October 2026</p>
          </div>

          <nav className="flex flex-wrap gap-2 border-b border-slate-200 pb-6 text-[11px] uppercase tracking-wide font-semibold">
            {[
              ["#introduction", "Introduction"],
              ["#escrow", "Escrow Mechanics & Fees"],
              ["#delivery", "Inspection & Delivery"],
              ["#auto-release", "Automated Release"],
              ["#disputes", "Disputes & Arbitration"],
              ["#compliance", "Prohibited & Compliance"],
              ["#liability", "Liability & Indemnification"],
              ["#contact", "Contact"],
            ].map(([href, label]) => (
              <a
                key={href}
                href={href}
                className="px-3 py-1.5 rounded-full bg-slate-100 hover:bg-emerald-100 text-slate-700 hover:text-emerald-800 transition border border-slate-200"
              >
                {label}
              </a>
            ))}
          </nav>

          <div className="space-y-10 text-sm text-slate-700 leading-relaxed">
            <section id="introduction" className="space-y-3">
              <h2 className="text-lg font-black text-slate-900">
                1. Introduction & Platform Role
              </h2>
              <p>
                TrustShip is a technology platform that provides automated escrow,
                payment verification, and delivery tracking services for online
                transactions conducted through the Web and WhatsApp. TrustShip acts as a
                neutral third-party escrow agent, holding funds in trust via its
                licensed payment infrastructure (Flutterwave) until the agreed terms of a
                transaction are fulfilled.
              </p>
            </section>

            <section id="escrow" className="space-y-4">
              <h2 className="text-lg font-black text-slate-900">
                2. Escrow Mechanics & Fee Structure
              </h2>
              <h3 className="text-base font-bold text-slate-900">2.1 Deposits & Holds</h3>
              <p>
                When a buyer initiates payment via a TrustShip-generated checkout link,
                the funds are processed by Flutterwave and locked in escrow. A
                transaction enters <strong>PENDING_DEPOSIT</strong>, becomes
                <strong> ESCROW_LOCKED</strong> once the payment is confirmed, and only
                moves to release after delivery confirmation or successful dispute
                resolution.
              </p>
              <h3 className="text-base font-bold text-slate-900">2.2 Fee Breakdown</h3>
              <p>
                TrustShip charges a platform escrow fee (computed server-side at the time
                of escrow creation). Payment gateway fees may be applied by Flutterwave.
                The <strong>platform escrow fee is non-refundable</strong> once the
                escrow is created, and all fee deductions are applied when funds are
                released to the seller (payout = total escrow – platform fee), as
                reflected in the transaction record.
              </p>
            </section>

            <section id="delivery" className="space-y-4">
              <h2 className="text-lg font-black text-slate-900">
                3. Inspection Period & Waybill / Delivery Tracking
              </h2>
              <h3 className="text-base font-bold text-slate-900">
                3.1 Delivery Responsibility
              </h3>
              <p>
                The seller must provide accurate and verifiable delivery/tracking
                information (including a valid waybill/courier reference) when dispatching
                the order. The seller is responsible for marking delivery in accordance
                with the agreed terms.
              </p>
              <h3 className="text-base font-bold text-slate-900">3.2 Inspection Window</h3>
              <p>
                Upon the seller marking the order as <strong>Delivered</strong>, the buyer
                is granted a reasonable inspection window (typically 24–48 hours) to
                inspect the goods. During this window, the buyer may either approve
                release (by submitting the 4-digit release PIN) or file a dispute with
                supporting evidence.
              </p>
            </section>

            <section id="auto-release" className="space-y-3">
              <h2 className="text-lg font-black text-slate-900">
                4. Automated Release Policy (Cron Rules)
              </h2>
              <p>
                If, after delivery, the buyer fails to approve or dispute the transaction
                within the inspection window, TrustShip's automated protocol will
                <strong> auto-release funds to the seller after 7 days</strong> from the
                date the transaction was marked <strong>Delivered</strong> (subject to
                system availability and the escrow's eligibility criteria). This automated
                release is executed by TrustShip's scheduled jobs and is treated as an
                approved release under these Terms when no timely dispute exists.
              </p>
            </section>

            <section id="disputes" className="space-y-4">
              <h2 className="text-lg font-black text-slate-900">
                5. Dispute Resolution & Admin Arbitration
              </h2>
              <h3 className="text-base font-bold text-slate-900">5.1 Filing a Dispute</h3>
              <p>
                A party may raise a dispute via Web or WhatsApp, providing clear
                supporting evidence (photos, videos, waybill receipts, tracking logs, or
                other relevant documentation). Disputes must be filed within a reasonable
                time after delivery or discovery of the issue. Incomplete or unsubstantiated
                disputes may delay resolution.
              </p>
              <h3 className="text-base font-bold text-slate-900">5.2 Admin Ruling</h3>
              <p>
                TrustShip compliance administrators shall have
                <strong> final binding arbitration authority</strong> to determine the
                outcome of any escrow dispute. Based on submitted proof, the
                administrators may, in their sole discretion, (a) release funds to the
                seller, (b) refund funds to the buyer (less applicable non-refundable
                fees where permitted by policy), or (c) take any other action consistent
                with these Terms and applicable law. Parties agree to abide by the
                administrator's ruling.
              </p>
            </section>

            <section id="compliance" className="space-y-4">
              <h2 className="text-lg font-black text-slate-900">
                6. Prohibited Transactions & Compliance
              </h2>
              <h3 className="text-base font-bold text-slate-900">6.1 Prohibited Items</h3>
              <p>
                Users may not use TrustShip for illegal goods, counterfeit items,
                stolen property, weapons restricted by law, prescription medications
                without authorisation, adult content prohibited by payment processors,
                or any goods/services that facilitate fraud, money laundering, or
                other unlawful activity.
              </p>
              <h3 className="text-base font-bold text-slate-900">6.2 AML & KYC</h3>
              <p>
                TrustShip operates in line with applicable Anti-Money Laundering (AML)
                and Know Your Customer (KYC) requirements. TrustShip may request
                verification information from users when necessary to comply with
                regulatory obligations or mitigate risk. Failure to comply may result
                in transaction suspension or account restrictions.
              </p>
            </section>

            <section id="liability" className="space-y-3">
              <h2 className="text-lg font-black text-slate-900">
                7. Limitation of Liability & Indemnification
              </h2>
              <p>
                To the fullest extent permitted by law, TrustShip disclaims liability for
                third-party courier delays, lost/damaged items in transit, WhatsApp
                service outages, payment gateway network disruptions, or other events
                outside TrustShip's reasonable control. Users agree to indemnify and
                hold TrustShip, its affiliates, and administrators harmless from claims
                arising from their use of the platform, violation of these Terms, or
                infringement of third-party rights.
              </p>
            </section>

            <section id="contact" className="space-y-2">
              <h2 className="text-lg font-black text-slate-900">8. Contact Us</h2>
              <p>
                Questions about these Terms? Contact support at{" "}
                <a
                  href="mailto:trustship.app@gmail.com"
                  className="text-emerald-600 font-bold underline"
                >
                  trustship.app@gmail.com
                </a>
              </p>
            </section>
          </div>

          <div className="pt-8 border-t border-slate-200">
            <a
              href="/"
              className="inline-block bg-slate-900 text-white text-xs font-bold px-6 py-3 rounded-xl hover:bg-slate-800 transition"
            >
              Return to TrustShip Home
            </a>
          </div>
        </div>
      </main>
    </div>
  );
}
