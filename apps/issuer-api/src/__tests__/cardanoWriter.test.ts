/**
 * Unit tests for cardanoWriter — covers the pure hashVc function.
 *
 * The Cardano write functions (writeVcHashToCardano, writeRevocationToCardano)
 * require live Blockfrost + wallet credentials and are tested via integration
 * tests (see walletConfirmed.test.ts where those modules are mocked).
 */

import { describe, it, expect, vi } from "vitest";

// Mock heavy deps that cardanoWriter.ts imports at module level so that
// importing hashVc doesn't trigger the libsodium WASM loader used by MeshSDK.
vi.mock("@meshsdk/core", () => ({
  MeshWallet: vi.fn(),
  Transaction: vi.fn(),
  BlockfrostProvider: vi.fn(),
}));
vi.mock("@blockfrost/blockfrost-js", () => ({
  BlockFrostAPI: vi.fn(),
}));

import { hashVc } from "../services/cardanoWriter.js";

describe("hashVc", () => {
  it("produces a 64-character lowercase hex string (SHA-256)", () => {
    const result = hashVc({ id: "urn:credential:1", issuer: "did:prism:abc" });
    expect(result).toMatch(/^[0-9a-f]{64}$/);
  });

  it("is deterministic — same input always produces the same hash", () => {
    const vc = {
      id: "urn:credential:1",
      issuer: "did:prism:abc",
      issuanceDate: "2025-01-01T00:00:00Z",
    };
    const first = hashVc(vc);
    const second = hashVc({ ...vc }); // different object reference, same values
    expect(first).toBe(second);
  });

  it("is key-order independent — object property order does not affect the hash", () => {
    const hashA = hashVc({
      id: "urn:credential:1",
      issuer: "did:prism:abc",
      issuanceDate: "2025-01-01T00:00:00Z",
    });
    const hashB = hashVc({
      issuanceDate: "2025-01-01T00:00:00Z",
      issuer: "did:prism:abc",
      id: "urn:credential:1",
    });
    expect(hashA).toBe(hashB);
  });

  it("produces different hashes for different degree values", () => {
    const base = {
      id: "urn:credential:1",
      issuer: "did:prism:abc",
      credentialSubject: { degree: "BSc Computer Science", studentId: "S001" },
    };
    const modified = {
      ...base,
      credentialSubject: { degree: "MSc Computer Science", studentId: "S001" },
    };
    expect(hashVc(base)).not.toBe(hashVc(modified));
  });

  it("produces different hashes for different studentId values", () => {
    const base = {
      id: "urn:credential:1",
      credentialSubject: { studentId: "S001", degree: "BSc" },
    };
    const other = {
      id: "urn:credential:1",
      credentialSubject: { studentId: "S002", degree: "BSc" },
    };
    expect(hashVc(base)).not.toBe(hashVc(other));
  });

  it("produces different hashes for different vcId values", () => {
    const a = hashVc({ id: "urn:credential:aaa", degree: "BSc" });
    const b = hashVc({ id: "urn:credential:bbb", degree: "BSc" });
    expect(a).not.toBe(b);
  });

  it("nested key order is also normalised (deep sort)", () => {
    const hashA = hashVc({
      id: "urn:credential:1",
      credentialSubject: { degree: "BSc", studentId: "S001" },
    });
    const hashB = hashVc({
      id: "urn:credential:1",
      credentialSubject: { studentId: "S001", degree: "BSc" },
    });
    // Deep key sorting means nested key order is also normalised
    expect(hashA).toBe(hashB);
  });
});
