// lib/support-scripts.ts
//
// Support script rendering + the canonical script catalogue.
//
// Scripts are customer-facing message templates with `{{placeholder}}` tokens.
// Rendering is deliberately strict about safety:
//   * Unknown placeholders are LEFT INTACT (so an agent notices) rather than
//     silently blanked — but `missingPlaceholders()` reports them so the UI can
//     warn before copy.
//   * Internal notes (`isInternal`) are NEVER rendered as customer text; the
//     caller must check the flag. `renderForCustomer()` refuses internal rows.

export interface SupportScriptSeed {
  slug: string;
  title: string;
  category: string;
  body: string;
  usageNotes: string;
  isInternal?: boolean;
}

const PLACEHOLDER_RE = /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g;

/** Every distinct placeholder name used in a template body. */
export function placeholdersIn(body: string): string[] {
  const found = new Set<string>();
  let match: RegExpExecArray | null;
  const re = new RegExp(PLACEHOLDER_RE.source, "g");
  while ((match = re.exec(body)) !== null) {
    found.add(match[1]);
  }
  return Array.from(found);
}

/** Placeholder names with no value supplied (missing from `values`). */
export function missingPlaceholders(
  body: string,
  values: Record<string, string | undefined>
): string[] {
  return placeholdersIn(body).filter(
    (name) => values[name] === undefined || values[name] === ""
  );
}

/**
 * Substitute `{{name}}` tokens. Unknown/missing tokens are left intact so a
 * half-filled template is visibly incomplete rather than silently misleading.
 */
export function renderTemplate(
  body: string,
  values: Record<string, string | undefined>
): string {
  return body.replace(PLACEHOLDER_RE, (whole, name: string) => {
    const value = values[name];
    return value === undefined || value === "" ? whole : value;
  });
}

/**
 * Render a script for a customer. Refuses to render an internal note as
 * customer-facing text — internal notes are for agents only.
 */
export function renderForCustomer(
  script: { body: string; isInternal?: boolean },
  values: Record<string, string | undefined>
): { text: string; missing: string[] } {
  if (script.isInternal) {
    throw new Error(
      "Refusing to render an internal note as customer-facing text."
    );
  }
  return {
    text: renderTemplate(script.body, values),
    missing: missingPlaceholders(script.body, values),
  };
}

/** Canonical placeholder documentation shown to agents. */
export const PLACEHOLDER_DOCS: { name: string; description: string }[] = [
  { name: "customer_name", description: "The recipient's first name or display name." },
  { name: "transaction_id", description: "The Trustship transaction reference (e.g. TS-ESCROW-…)." },
  { name: "refund_status", description: "The CURRENT refund status from the refund record (never invented)." },
  { name: "dispute_id", description: "The dispute case reference." },
];

/**
 * The eight standard support scripts from the product brief. Bodies are the
 * verbatim approved copy; usage notes encode the safety rules so agents cannot
 * send a message that overstates what the system has actually verified.
 */
export const STANDARD_SCRIPTS: SupportScriptSeed[] = [
  {
    slug: "payment-pending",
    title: "Payment Pending",
    category: "Payment",
    body:
      "Hello {{customer_name}}, your Trustship transaction {{transaction_id}} is currently awaiting payment confirmation.\n\n" +
      "Please allow us some time to verify the payment status.\n\n" +
      "If you have already completed your payment, kindly avoid making another payment until we confirm the outcome.\n\n" +
      "We'll update you once verification is complete.\n\n" +
      "Thank you for your patience.",
    usageNotes:
      "Only use when payment is genuinely pending or under verification.",
  },
  {
    slug: "payment-failed",
    title: "Payment Failed",
    category: "Payment",
    body:
      "Hello {{customer_name}}, we couldn't confirm a successful payment for your Trustship transaction {{transaction_id}}.\n\n" +
      "Please check your transaction status before attempting another payment.\n\n" +
      "If your account was debited, kindly let us know and provide the requested transaction reference through our secure support process so we can investigate.\n\n" +
      "We're here to help.",
    usageNotes:
      "Do not describe a payment as failed solely because a webhook was delayed or temporarily unavailable.",
  },
  {
    slug: "transaction-funded",
    title: "Transaction Funded",
    category: "Transaction",
    body:
      "Hello {{customer_name}}, your Trustship transaction {{transaction_id}} has been confirmed as funded under the applicable transaction arrangement.\n\n" +
      "You can review your transaction details and next steps using your secure transaction link.\n\n" +
      "Thank you for choosing Trustship.",
    usageNotes:
      "Only use if payment and the relevant funding arrangement have actually been verified. Do not imply funds are held in a protected escrow arrangement unless that is accurate and legally supported.",
  },
  {
    slug: "seller-delivery-followup",
    title: "Seller Delivery Follow-up",
    category: "Delivery",
    body:
      "Hello {{customer_name}}, we're sorry your Trustship transaction {{transaction_id}} hasn't been completed as expected.\n\n" +
      "We're reviewing the transaction and will help you understand the available next steps.\n\n" +
      "If you have any updates or delivery evidence, please share them through our approved support process.\n\n" +
      "If the matter remains unresolved, you may request a review under our dispute policy.",
    usageNotes: "Do not accuse the seller of fraud without evidence.",
  },
  {
    slug: "buyer-confirmation-pending",
    title: "Buyer Confirmation Pending",
    category: "Delivery",
    body:
      "Hello {{customer_name}}, we're following up regarding Trustship transaction {{transaction_id}}.\n\n" +
      "Our records indicate that buyer confirmation is still pending.\n\n" +
      "Please review the transaction and confirm the delivery status when appropriate.\n\n" +
      "If there's an issue with the item or delivery, please contact support or use the applicable dispute process.",
    usageNotes:
      "Do not pressure buyers into falsely confirming receipt. Do not automatically release funds based solely on an unanswered message or arbitrary assumption.",
  },
  {
    slug: "refund-request-received",
    title: "Refund Request Received",
    category: "Refund",
    body:
      "Hello {{customer_name}}, we've received your refund request for Trustship transaction {{transaction_id}}.\n\n" +
      "Your request is currently {{refund_status}}.\n\n" +
      "We'll review the transaction and update you as the process progresses.\n\n" +
      "Please note that submitting a refund request does not automatically mean the refund has been approved or completed.",
    usageNotes:
      "Populate {{refund_status}} using the ACTUAL refund record, never an assumed status.",
  },
  {
    slug: "dispute-raised",
    title: "Dispute Received",
    category: "Dispute",
    body:
      "Hello {{customer_name}}, your dispute regarding Trustship transaction {{transaction_id}} has been received.\n\n" +
      "Your case reference is {{dispute_id}}.\n\n" +
      "Our support team will review the information provided and contact you if additional details are required.\n\n" +
      "Please keep any relevant evidence available.\n\n" +
      "We'll keep you informed of the next steps.",
    usageNotes: "Do not promise a specific resolution or outcome.",
  },
  {
    slug: "transaction-completed",
    title: "Transaction Completed",
    category: "Transaction",
    body:
      "Hello {{customer_name}}, your Trustship transaction {{transaction_id}} has been marked as completed.\n\n" +
      "You can review your transaction summary and relevant details using your secure transaction link.\n\n" +
      "Thank you for using Trustship.",
    usageNotes:
      "Only use when the transaction completion conditions have actually been satisfied. Do not equate a completed database status with confirmed settlement unless those are equivalent under the actual financial model.",
  },
];
