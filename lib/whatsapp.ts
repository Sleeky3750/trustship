// lib/whatsapp.ts
// Meta WhatsApp Cloud API senders (graph.facebook.com/v17.0).
//
// sendWhatsAppMessage is the plain text sender used across the app.
// sendWhatsAppInteractiveReplyButtons posts an interactive reply-button
// message (used by the bot engine for the seller ACCEPT/DECLINE invitation);
// callers fall back to a text message when the interactive send fails.

interface MetaSendResult {
  success: boolean;
  data?: unknown;
  error?: unknown;
}

/** Shared POST to the Meta Cloud API messages endpoint. */
async function postToMeta(payload: Record<string, unknown>): Promise<MetaSendResult> {
  const token = process.env.WHATSAPP_ACCESS_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;

  if (!token || !phoneNumberId) {
    console.warn("WhatsApp credentials (TOKEN or PHONE_NUMBER_ID) are missing. Skipping WhatsApp message.");
    return { success: false, error: "Missing WhatsApp configuration" };
  }

  try {
    const response = await fetch(`https://graph.facebook.com/v17.0/${phoneNumberId}/messages`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("WhatsApp API Error:", data);
      return { success: false, error: data };
    }

    return { success: true, data };
  } catch (error: any) {
    console.error("WhatsApp send exception:", error);
    return { success: false, error: error.message };
  }
}

export async function sendWhatsAppMessage(to: string, message: string): Promise<MetaSendResult> {
  // Format recipient phone number (remove any leading '+' or spaces)
  const formattedPhone = to.replace(/\D/g, "");

  return postToMeta({
    messaging_product: "whatsapp",
    to: formattedPhone,
    type: "text",
    text: {
      body: message,
    },
  });
}

export interface InteractiveReplyButton {
  /** Developer-defined payload id echoed back on tap (e.g. "ACCEPT:TS-ESCROW-..."). */
  id: string;
  /** Button label — WhatsApp limits this to 20 characters. */
  title: string;
}

/**
 * Send an interactive quick-reply button message (max 3 buttons per WhatsApp
 * Cloud API rules). Returns { success: false } on API errors or missing
 * configuration so callers can fall back to a plain text message.
 */
export async function sendWhatsAppInteractiveReplyButtons(
  to: string,
  bodyText: string,
  buttons: InteractiveReplyButton[]
): Promise<MetaSendResult> {
  if (buttons.length < 1 || buttons.length > 3) {
    return { success: false, error: "Interactive messages allow 1-3 buttons" };
  }

  const formattedPhone = to.replace(/\D/g, "");

  return postToMeta({
    messaging_product: "whatsapp",
    to: formattedPhone,
    type: "interactive",
    interactive: {
      type: "button",
      body: { text: bodyText.slice(0, 1024) },
      action: {
        buttons: buttons.slice(0, 3).map((button) => ({
          type: "reply",
          reply: { id: button.id.slice(0, 64), title: button.title.slice(0, 20) },
        })),
      },
    },
  });
}
