import axios, { AxiosResponse } from "axios";

// Initialize Flutterwave Payment Link (Standard Checkout)
export async function initializeFlutterwavePayment(params: {
  txRef: string;
  amount: number;
  email: string;
  name: string;
  title: string;
  description: string;
}): Promise<AxiosResponse> {
  const FLUTTERWAVE_SECRET_KEY = process.env.FLUTTERWAVE_SECRET_KEY;

  if (!FLUTTERWAVE_SECRET_KEY) {
    console.error("Flutterwave: FLUTTERWAVE_SECRET_KEY is not configured");
    throw new Error("Flutterwave secret key not configured");
  }

  try {
    const response: AxiosResponse = await axios.post(
      "https://api.flutterwave.com/v3/payments",
      {
        tx_ref: params.txRef,
        amount: params.amount,
        currency: "NGN",
        redirect_url: `${process.env.NEXT_PUBLIC_APP_URL}/escrow/${params.txRef}`,
        payment_method: "card",
        customer: {
          email: params.email,
          name: params.name,
        },
        customizations: {
          title: params.title,
          description: params.description,
        },
      },
      {
        headers: {
          Authorization: `Bearer ${FLUTTERWAVE_SECRET_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );

    return response;
  } catch (error: any) {
    console.error("Flutterwave payment initialization error:", error.response?.data || error.message);
    throw error;
  }
}

// Initiate Flutterwave Bank Transfer (Payout to Seller)
export async function initiateFlutterwaveTransfer(params: {
  accountBank: string;
  accountNumber: string;
  amount: number;
  narration: string;
  reference: string;
  beneficiaryName: string;
}): Promise<AxiosResponse> {
  const FLUTTERWAVE_SECRET_KEY = process.env.FLUTTERWAVE_SECRET_KEY;

  if (!FLUTTERWAVE_SECRET_KEY) {
    console.error("Flutterwave: FLUTTERWAVE_SECRET_KEY is not configured");
    throw new Error("Flutterwave secret key not configured");
  }

  try {
    const response: AxiosResponse = await axios.post(
      "https://api.flutterwave.com/v3/transfers",
      {
        account_bank: params.accountBank,
        account_number: params.accountNumber,
        amount: params.amount,
        narration: params.narration,
        reference: params.reference,
        beneficiary_name: params.beneficiaryName,
        currency: "NGN",
        status: "completed",
      },
      {
        headers: {
          Authorization: `Bearer ${FLUTTERWAVE_SECRET_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );

    return response;
  } catch (error: any) {
    console.error("Flutterwave transfer error:", error.response?.data || error.message);
    throw error;
  }
}

/**
 * Independently verify a transaction against Flutterwave's verify endpoint.
 *
 * Used as defence-in-depth on the webhook path: signature verification proves
 * the event is genuine, but re-reading the authoritative record from the
 * provider catches any mismatch between the webhook body and reality
 * (amount, currency, status, tx_ref ownership).
 *
 * Returns `null` when the transaction cannot be found, and throws only on a
 * transport/configuration error so callers can decide whether to fail open.
 */
export async function verifyFlutterwaveTransaction(transactionId: string | number) {
  const FLUTTERWAVE_SECRET_KEY = process.env.FLUTTERWAVE_SECRET_KEY;
  if (!FLUTTERWAVE_SECRET_KEY) {
    throw new Error("Flutterwave secret key not configured");
  }

  try {
    const response = await axios.get(
      `https://api.flutterwave.com/v3/transactions/${encodeURIComponent(String(transactionId))}/verify`,
      {
        headers: {
          Authorization: `Bearer ${FLUTTERWAVE_SECRET_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );

    const data = response.data?.data;
    if (!data) return null;

    return {
      id: data.id as number,
      txRef: data.tx_ref as string,
      status: data.status as string, // "successful" | "failed" | ...
      amount: Number(data.amount),
      chargedAmount: Number(data.charged_amount ?? data.amount),
      currency: data.currency as string,
    };
  } catch (error: any) {
    console.error(
      "Flutterwave verify transaction error:",
      error.response?.data || error.message
    );
    throw error;
  }
}

/**
 * Initiate a refund against a settled Flutterwave transaction.
 *
 * IMPORTANT: refunds are executed against the ORIGINAL provider transaction id
 * (`flwTransactionId` captured from the settlement webhook), never against a
 * client-supplied value. `amount` is in major units (naira) because that is
 * what the Flutterwave API expects; the caller converts from integer minor
 * units at the boundary.
 *
 * Only called by the refund workflow AFTER an approval, and only when a real
 * `flwTransactionId` exists. When it does not (e.g. a manually funded escrow),
 * the workflow records a manual/pending refund rather than fabricating a
 * provider call.
 */
export async function initiateFlutterwaveRefund(params: {
  transactionId: string | number;
  amount?: number;
  comments?: string;
}): Promise<{ id: number | string; status: string; raw: unknown }> {
  const FLUTTERWAVE_SECRET_KEY = process.env.FLUTTERWAVE_SECRET_KEY;
  if (!FLUTTERWAVE_SECRET_KEY) {
    throw new Error("Flutterwave secret key not configured");
  }

  try {
    const response = await axios.post(
      `https://api.flutterwave.com/v3/transactions/${encodeURIComponent(
        String(params.transactionId)
      )}/refund`,
      {
        ...(params.amount != null ? { amount: params.amount } : {}),
        ...(params.comments ? { comments: params.comments } : {}),
      },
      {
        headers: {
          Authorization: `Bearer ${FLUTTERWAVE_SECRET_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );

    const data = response.data?.data ?? {};
    return {
      id: data.id ?? data.refund_id ?? "unknown",
      status: String(data.status ?? response.data?.status ?? "unknown"),
      raw: response.data,
    };
  } catch (error: any) {
    console.error(
      "Flutterwave refund error:",
      error.response?.data || error.message
    );
    throw error;
  }
}