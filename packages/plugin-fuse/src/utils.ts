import { elizaLogger } from "@elizaos/core";
import { COOPERATIVE_MAP } from "./constants";

export function maskEmail(email: string): string {
  if (!email) return "";
  if (!email.includes("@") || email.split("@").length !== 2) {
    return email.length > 4 ? `${email.substring(0, 2)}${"*".repeat(email.length - 2)}` : email;
  }
  const [name, domain] = email.split("@");
  if (name.length <= 2) return email;
  const maskedName = `${name.substring(0, 2)}${"*".repeat(Math.min(name.length - 2, 6))}`;
  return `${maskedName}@${domain}`;
}

export function validateCooperative(input: string): string | null {
  if (!input) return null;
  const normalizedInput = input.toUpperCase().replace(/[^A-Z0-9]/g, "");
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
  const matrix = Array(b.length + 1)
    .fill(null)
    .map(() => Array(a.length + 1).fill(null));
  for (let i = 0; i <= a.length; i++) {
    matrix[0][i] = i;
  }
  for (let j = 0; j <= b.length; j++) {
    matrix[j][0] = j;
  }
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

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}