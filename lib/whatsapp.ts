export async function sendWhatsAppMessage(to: string, message: string) {
  const token = process.env.WHATSAPP_ACCESS_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;

  if (!token || !phoneNumberId) {
    console.warn("WhatsApp credentials (TOKEN or PHONE_NUMBER_ID) are missing. Skipping WhatsApp message.");
    return { success: false, error: "Missing WhatsApp configuration" };
  }

  // Format recipient phone number (remove any leading '+' or spaces)
  const formattedPhone = to.replace(/\D/g, "");

  try {
    const response = await fetch(`https://graph.facebook.com/v17.0/${phoneNumberId}/messages`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: formattedPhone,
        type: "text",
        text: {
          body: message,
        },
      }),
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