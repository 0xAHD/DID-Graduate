import { randomBytes } from "crypto";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { resolve } from "path";

export interface ShareEntry {
  token: string;
  studentId: string;
  credentialRecordId: string;
  createdAt: string;
}

const DATA_DIR = process.env.TEST_DATA_DIR ?? resolve(__dirname, "../../data");
const SHARES_PATH = resolve(DATA_DIR, "shares.json");

function loadShares(): ShareEntry[] {
  if (!existsSync(SHARES_PATH)) return [];
  try {
    return JSON.parse(readFileSync(SHARES_PATH, "utf-8")) as ShareEntry[];
  } catch {
    return [];
  }
}

function saveShares(shares: ShareEntry[]): void {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
  writeFileSync(SHARES_PATH, JSON.stringify(shares, null, 2), "utf-8");
}

/** Create (or return existing) share link for a credential. */
export function createShare(
  studentId: string,
  credentialRecordId: string
): ShareEntry {
  const shares = loadShares();
  const existing = shares.find(
    (s) => s.studentId === studentId && s.credentialRecordId === credentialRecordId
  );
  if (existing) return existing;

  // 20 random bytes → 40 hex chars; unguessable but URL-safe
  const token = randomBytes(20).toString("hex");
  const entry: ShareEntry = {
    token,
    studentId,
    credentialRecordId,
    createdAt: new Date().toISOString(),
  };
  shares.push(entry);
  saveShares(shares);
  return entry;
}

export function getShare(token: string): ShareEntry | undefined {
  return loadShares().find((s) => s.token === token);
}

/** Delete a share. Only succeeds if the share belongs to `studentId`. */
export function deleteShare(token: string, studentId: string): boolean {
  const shares = loadShares();
  const idx = shares.findIndex(
    (s) => s.token === token && s.studentId === studentId
  );
  if (idx === -1) return false;
  shares.splice(idx, 1);
  saveShares(shares);
  return true;
}

export function getSharesForStudent(studentId: string): ShareEntry[] {
  return loadShares().filter((s) => s.studentId === studentId);
}
