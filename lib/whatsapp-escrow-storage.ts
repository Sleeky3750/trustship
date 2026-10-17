// Simple in-memory storage for WhatsApp escrow creation sessions.
// Maps buyer phone number to escrow creation state.
// In production, this would be replaced with a proper database table or Redis.
interface EscrowCreationState {
  step: "awaiting_item_title" | "awaiting_item_amount" | "awaiting_buyer_phone" | "awaiting_seller_phone" | "complete";
  buyerPhone: string;
  sellerPhone: string;
  buyerName?: string;
  sellerName?: string;
  itemTitle?: string;
  itemAmount?: number;
  waybillAmount?: number;
  platformFee?: number;
  waybillPayer?: "BUYER" | "SELLER";
  createdAt: number;
}

// Storage map: buyerPhone -> EscrowCreationState
const sessions: Map<string, EscrowCreationState> = new Map();

// Get session for a buyer phone number
export function getSession(buyerPhone: string): EscrowCreationState | undefined {
  return sessions.get(buyerPhone);
}

// Create a new session
export function createSession(buyerPhone: string): EscrowCreationState {
  const state: EscrowCreationState = {
    step: "awaiting_item_title",
    buyerPhone,
    createdAt: Date.now(),
  };
  sessions.set(buyerPhone, state);
  return state;
}

// Update session step and data
export function updateSession(buyerPhone: string, updates: Partial<EscrowCreationState>): EscrowCreationState | undefined {
  const existing = sessions.get(buyerPhone);
  if (!existing) return undefined;
  const updated = { ...existing, ...updates };
  sessions.set(buyerPhone, updated);
  return updated;
}

// Remove session after completion
export function removeSession(buyerPhone: string): boolean {
  return sessions.delete(buyerPhone);
}

// Get all sessions (for debugging)
export function getAllSessions(): Map<string, EscrowCreationState> {
  return sessions;
}

export type { EscrowCreationState };