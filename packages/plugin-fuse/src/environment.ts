import { elizaLogger } from "@elizaos/core";
import { v4 as uuidv4 } from "uuid";

// -----------------------------------------------------
// CONSTANTS & CONFIGURATION
// -----------------------------------------------------

export const COOPERATIVE_MAP: Record<string, string> = {
  "TESTING": "testing",
  "NSCDCKWACOOP": "nscdckwacoop",
  "NSCDCJOS": "nscdcjos",
  "CTLS": "ctls",
  "FUSION": "fusion",
  "LIFELINEMCS": "lifelinemcs",
  "TFC": "tfc",
  "IMMIGRATION": "immigrationmcs",
  "IMMIGRATIONMCS": "immigrationmcs",
  "OCTICS": "octics",
  "MILLY": "milly",
  "AVIATIONABJ": "aviationabj",
  "FCDAMCS": "fcdamcs",
  "INECBAUCHI": "inecbauchi",
  "INECKWARA": "ineckwara",
  "GPMS": "gpms",
  "INECHQMCS": "inechqmcs",
  "NNMCSL": "nnmcsl",
  "INECSMCS": "inecsmcs",
  "MODACS": "modacs",
  "NCCMCS": "nccmcs",
  "NICNMCS": "nicnmcs",
  "OAGF": "oagf",
  "SAMCOS": "samcos",
  "VALGEECS": "valgeecs"
};

export const FSN_HASH: string = process.env.FSN_HASH as string;
export const AUTH_STATE_TABLE = "auth_state";

// -----------------------------------------------------
// UTILITY FUNCTIONS
// -----------------------------------------------------

export function maskEmail(email: string): string {
  if (!email) return "";
  if (!email.includes('@') || email.split('@').length !== 2) {
    return email.length > 4 ? `${email.substring(0, 2)}${"*".repeat(email.length - 2)}` : email;
  }
  const [name, domain] = email.split('@');
  if (name.length <= 2) return email;
  const maskedName = `${name.substring(0, 2)}${"*".repeat(Math.min(name.length - 2, 6))}`;
  return `${maskedName}@${domain}`;
}

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function stringSimilarity(a: string, b: string): number {
  const longer = a.length > b.length ? a : b;
  const shorter = a.length <= b.length ? a : b;
  const longerLength = longer.length;
  if (longerLength === 0) return 1.0;
  return (longerLength - editDistance(longer, shorter)) / longerLength;
}

export function editDistance(a: string, b: string): number {
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;
  const matrix = Array(b.length + 1).fill(null).map(() => Array(a.length + 1).fill(null));
  for (let i = 0; i <= a.length; i++) { matrix[0][i] = i; }
  for (let j = 0; j <= b.length; j++) { matrix[j][0] = j; }
  for (let j = 1; j <= b.length; j++) {
    for (let i = 1; i <= a.length; i++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[j][i] = Math.min(
        matrix[j][i - 1] + 1,
        matrix[j - 1][i] + 1,
        matrix[j - 1][i - 1] + cost
      );
    }
  }
  return matrix[b.length][a.length];
}

export function validateCooperative(input: string): string | null {
  if (!input) return null;
  const normalizedInput = input.toUpperCase().replace(/[^A-Z0-9]/g, '');
  elizaLogger.debug(`Validating cooperative input: ${input} -> normalized: ${normalizedInput}`);
  if (COOPERATIVE_MAP[normalizedInput]) {
    elizaLogger.info(`Exact match found for ${normalizedInput}`);
    return COOPERATIVE_MAP[normalizedInput];
  }
  for (const [key, value] of Object.entries(COOPERATIVE_MAP)) {
    if (normalizedInput.includes(key) || key.includes(normalizedInput)) {
      elizaLogger.info(`Partial match found: ${normalizedInput} ~ ${key}`);
      return value;
    }
  }
  let bestMatch: { key: string; value: string; score: number } | null = null;
  for (const [key, value] of Object.entries(COOPERATIVE_MAP)) {
    const score = stringSimilarity(normalizedInput, key);
    if (score > 0.6 && (!bestMatch || score > bestMatch.score)) {
      bestMatch = { key, value, score };
    }
  }
  if (bestMatch) {
    elizaLogger.info(`Fuzzy match found: ${normalizedInput} ~ ${bestMatch.key} (score: ${bestMatch.score.toFixed(2)})`);
    return bestMatch.value;
  }
  elizaLogger.warn(`No match found for cooperative: ${input}`);
  return null;
}

// -----------------------------------------------------
// AUTHENTICATION STATE MANAGEMENT
// -----------------------------------------------------

export async function getAuthState(runtime: any, roomId: string): Promise<any> {
  elizaLogger.debug(`Getting auth state for room: ${roomId}`);
  try {
    const memories = await runtime.databaseAdapter.getMemories({
      roomId,
      tableName: AUTH_STATE_TABLE,
      agentId: runtime.agentId,
      count: 1,
      unique: true
    });
    if (memories.length > 0) {
      elizaLogger.debug(`Found auth state for room ${roomId}`, memories[0].content);
      return memories[0].content;
    } else {
      const defaultState = { status: AuthState.NEED_COOPERATIVE, roomId };
      elizaLogger.debug(`No auth state found for room ${roomId}, returning default state`);
      return defaultState;
    }
  } catch (error: any) {
    elizaLogger.error(`Error getting auth state for room ${roomId}:`, error);
    return { status: AuthState.NEED_COOPERATIVE, roomId, error: error.message };
  }
}

export async function setAuthState(runtime: any, roomId: string, stateData: any): Promise<void> {
  elizaLogger.debug(`Setting auth state for room ${roomId}:`, {
    ...stateData,
    token: stateData.token ? "[REDACTED]" : undefined,
    otp: stateData.otp ? "[REDACTED]" : undefined,
    credentials: stateData.credentials
      ? { email: stateData.credentials.email ? maskEmail(stateData.credentials.email) : undefined, employee_number: stateData.credentials.employee_number }
      : undefined
  });
  try {
    const updatedStateData = {
      ...stateData,
      roomId,
      updatedAt: new Date().toISOString()
    };
    const memory = {
      id: uuidv4(),
      roomId,
      userId: runtime.agentId,
      agentId: runtime.agentId,
      createdAt: Date.now(),
      content: updatedStateData,
    };
    await runtime.databaseAdapter.createMemory(memory, AUTH_STATE_TABLE, true);
    elizaLogger.debug(`Successfully set auth state for room ${roomId}`);
  } catch (error: any) {
    elizaLogger.error(`Error setting auth state for room ${roomId}:`, error);
    throw error;
  }
}

export async function resetAuthState(runtime: any, roomId: string): Promise<void> {
  elizaLogger.info(`Resetting auth state for room ${roomId}`);
  try {
    await setAuthState(runtime, roomId, {
      status: AuthState.NEED_COOPERATIVE,
      resetAt: new Date().toISOString()
    });
    elizaLogger.info(`Successfully reset auth state for room ${roomId}`);
  } catch (error: any) {
    elizaLogger.error(`Error resetting auth state for room ${roomId}:`, error);
    throw error;
  }
}

// (Optionally add other helper functions and periodic cleanup here)

import { AuthState } from "./types";
export { AuthState };
