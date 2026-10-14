import axios from "axios";

export interface CreateRecipientInput {
  accountNumber: string;
  bankCode: string;
  name: string;
}

/**
 * Creates a Paystack Transfer Recipient for payouts.
 * Returns the recipient_code (e.g., "RCP_1a2b3c4d5e")
 */
export async function createPaystackRecipient({
  accountNumber,
  bankCode,
  name,
}: CreateRecipientInput): Promise<string | null> {
  try {
    const response = await axios.post(
      "https://api.paystack.co/transferrecipient",
      {
        type: "nuban",
        name,
        account_number: accountNumber,
        bank_code: bankCode,
        currency: "NGN",
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );

    if (response.data.status && response.data.data.recipient_code) {
      return response.data.data.recipient_code;
    }

    return null;
  } catch (error: any) {
    console.error("Paystack recipient creation error:", error?.response?.data || error.message);
    return null;
  }
}
