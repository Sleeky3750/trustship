import axios, { AxiosInstance } from "axios"

// WhatsApp Cloud API base URL
const WHATSAPP_BASE_URL = "https://graph.facebook.com/v18.0"
const PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID
const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN

if (!PHONE_NUMBER_ID || !WHATSAPP_TOKEN) {
  throw new Error(
    "Missing WhatsApp environment variables: WHATSAPP_PHONE_NUMBER_ID and WHATSAPP_TOKEN"
  )
}

// Axios instance configured for WhatsApp API
const api: AxiosInstance = axios.create({
  baseURL: WHATSAPP_BASE_URL,
  timeout: 10000,
  headers: {
    "Content-Type": "application/json",
  },
})

api.interceptors.response.use(
  (response) => response,
  (error) => {
    console.error("WhatsApp API error:", error.response?.data || error.message)
    return Promise.reject(error)
  }
)

// Types for WhatsApp messages
export interface WhatsAppButton {
  id: string
  title: string
}

export interface WhatsAppInteractiveButtons {
      type: "button"
      buttons: WhatsAppButton[]
    }

export interface WhatsAppListItem {
      id: string
      title: string
      description?: string
    }

export interface WhatsAppInteractiveList {
      type: "list"
      sections: Array<{
        title: string
        rows: WhatsAppListItem[]
      }>
    }

export interface SendWhatsAppMessageResponse {
      status: "sent" | "error"
      messageId?: string
      error?: string
    }

/**
 * Send a simple text message via WhatsApp Cloud API
 */
export async function sendWhatsAppMessage(
  to: string,
  text: string
): Promise<SendWhatsAppMessageResponse> {
  try {
    const payload = {
      messaging_product: "whatsapp",
      to,
      text,
    }

    const response = await api.post<
      SendWhatsAppMessageResponse,
      SendWhatsAppMessageResponse
    >("/messages", payload)

    return response.data
  } catch (error) {
    console.error("Failed to send WhatsApp message:", error)
    return {
      status: "error",
      error:
        error.response?.data?.error?.message || "Failed to send WhatsApp message",
    }
  }
}

/**
 * Send an interactive message with buttons via WhatsApp Cloud API
 */
export async function sendInteractiveButtons(
  to: string,
  bodyText: string,
  buttons: WhatsAppButton[]
): Promise<SendWhatsAppMessageResponse> {
  try {
    const payload = {
      messaging_product: "whatsapp",
      to,
      type: "button" as const,
      body: { text: bodyText },
      action: {
        buttons: buttons.map((btn) => ({
          type: "reply" as const,
          reply: { id: btn.id, title: btn.title },
        })),
      },
    }

    const response = await api.post<
      SendWhatsAppMessageResponse,
      SendWhatsAppMessageResponse
    >("/messages", payload)

    return response.data
  } catch (error) {
    console.error("Failed to send WhatsApp interactive buttons:", error)
    return {
      status: "error",
      error:
        error.response?.data?.error?.message || "Failed to send WhatsApp buttons",
    }
  }
}

/**
 * Send an interactive list message via WhatsApp Cloud API
 */
export async function sendInteractiveList(
  to: string,
  headerText: string,
  sections: Array<{
    title: string
    rows: WhatsAppListItem[]
  }>
): Promise<SendWhatsAppMessageResponse> {
  try {
    const payload = {
      messaging_product: "whatsapp",
      to,
      type: "list" as const,
      header: { type: "text" as const, text: headerText },
      list: {
        sections,
      },
    }

    const response = await api.post<
      SendWhatsAppMessageResponse,
      SendWhatsAppMessageResponse
    >("/messages", payload)

    return response.data
  } catch (error) {
    console.error("Failed to send WhatsApp interactive list:", error)
    return {
      status: "error",
      error:
        error.response?.data?.error?.message || "Failed to send WhatsApp list",
    }
  }
}

export default api