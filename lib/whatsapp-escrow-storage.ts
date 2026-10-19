// Simple in-memory storage for WhatsApp escrow creation sessions.
// Maps a buyer's phone number to their in-progress escrow creation state.
// In production this would be replaced with a database table or Redis.
//
// The module deliberately has no dependencies so it can be imported from route
// handlers without pulling in anything Node- or browser-specific.

export type EscrowStep =
  | "awaiting_item_title"
  | "awaiting_item_amount"
  | "awaiting_seller_phone";

export interface EscrowCreationState {
  /** Which field the conversational flow is currently waiting for. */
  step: EscrowStep;
  /** Session key — the WhatsApp number the buyer is messaging from. */
  buyerPhone: string;
  // Fields collected progressively as the flow advances (optional until set).
  // Mirrors the nullable EscrowTransaction columns while the escrow is built;
  // buyerPhone is always known because it is the session key.
  sellerPhone?: string;
  buyerName?: string;
  sellerName?: string;
  itemTitle?: string;
  itemAmount?: number;
  waybillAmount?: number;
  platformFee?: number;
  waybillPayer?: "BUYER" | "SELLER";
  createdAt: number;
  updatedAt: number;
}

/** Abandoned sessions are dropped after 30 minutes of inactivity. */
export const SESSION_TTL_MS = 30 * 60 * 1000;

// Storage map: buyerPhone -> EscrowCreationState
const sessions = new Map<string, EscrowCreationState>();

function isExpired(state: EscrowCreationState): boolean {
  return Date.now() - state.updatedAt > SESSION_TTL_MS;
}

/** Get the active session for a buyer, evicting it if it has expired. */
export function getSession(buyerPhone: string): EscrowCreationState | undefined {
  const state = sessions.get(buyerPhone);
  if (!state) return undefined;
  if (isExpired(state)) {
    sessions.delete(buyerPhone);
    return undefined;
  }
  return state;
}

/** Start (or reset) the conversational escrow flow for a buyer. */
export function createSession(buyerPhone: string): EscrowCreationState {
  const now = Date.now();
  const state: EscrowCreationState = {
    step: "awaiting_item_title",
    buyerPhone,
    createdAt: now,
    updatedAt: now,
  };
  sessions.set(buyerPhone, state);
  return state;
}

/**
 * Merge updates into an existing session. The session key and creation time
 * are always preserved; returns `undefined` when there is no session.
 */
export function updateSession(
  buyerPhone: string,
  updates: Partial<Omit<EscrowCreationState, "buyerPhone" | "createdAt">>
): EscrowCreationState | undefined {
  const existing = sessions.get(buyerPhone);
  if (!existing) return undefined;

  const updated: EscrowCreationState = {
    ...existing,
    ...updates,
    buyerPhone: existing.buyerPhone,
    createdAt: existing.createdAt,
    updatedAt: Date.now(),
  };
  sessions.set(buyerPhone, updated);
  return updated;
}

/** Remove a session (called once an escrow is created or the flow restarts). */
export function removeSession(buyerPhone: string): boolean {
  return sessions.delete(buyerPhone);
}

/** Get all sessions (for debugging). */
export function getAllSessions(): Map<string, EscrowCreationState> {
  return sessions;
}
