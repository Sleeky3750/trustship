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
        redirect_url: `${process.env.NEXT_PUBLIC_APP_URL}/escrow/status?ref=${params.txRef}`,
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