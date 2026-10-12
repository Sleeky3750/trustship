import axios, { AxiosInstance } from "axios"

// WhatsApp Cloud API base URL incorporating the Phone Number ID
const PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID
const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN

if (!PHONE_NUMBER_ID || !WHATSAPP_TOKEN) {
  throw new Error(
    "Missing WhatsApp environment variables: WHATSAPP_PHONE_NUMBER_ID and WHATSAPP_TOKEN"
  )
}

const WHATSAPP_BASE_URL = `https://graph.facebook.com/v18.0/${PHONE_NUMBER_ID}`

// Axios instance configured for WhatsApp API
const api: AxiosInstance = axios.create({
  baseURL: WHATSAPP_BASE_URL,
  timeout: 10000,
  headers: {
    "Content-Type": "application/json",
    Authorization: `Bearer ${WHATSAPP_TOKEN}`,
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
      text: { body: text }, // FIXED: Meta expects text wrapped in an object with a body property
    }

    const response = await api.post("/messages", payload)

    return {
      status: "sent",
      messageId: response.data?.messages?.[0]?.id,
    }
  } catch (error: any) {
    console.error("Failed to send WhatsApp message:", error.response?.data || error.message)
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
      type: "interactive" as const,
      interactive: {
        type: "button" as const,
        body: { text: bodyText },
        action: {
          buttons: buttons.map((btn) => ({
            type: "reply" as const,
            reply: { id: btn.id, title: btn.title },
          })),
        },
      },
    }

    const response = await api.post("/messages", payload)

    return {
      status: "sent",
      messageId: response.data?.messages?.[0]?.id,
    }
  } catch (error: any) {
    console.error("Failed to send WhatsApp interactive buttons:", error.response?.data || error.message)
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
      type: "interactive" as const,
      interactive: {
        type: "list" as const,
        header: { type: "text" as const, text: headerText },
        body: { text: "Please select an option:" },
        action: {
          button: "Select",
          sections,
        },
      },
    }

    const response = await api.post("/messages", payload)

    return {
      status: "sent",
      messageId: response.data?.messages?.[0]?.id,
    }
  } catch (error: any) {
    console.error("Failed to send WhatsApp interactive list:", error.response?.data || error.message)
    return {
      status: "error",
      error:
        error.response?.data?.error?.message || "Failed to send WhatsApp list",
    }
  }
}

export default api