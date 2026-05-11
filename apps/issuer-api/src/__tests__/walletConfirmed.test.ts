/**
 * Integration tests for the wallet-confirmed route and the credentials
 * POST endpoint.
 *
 * These tests use:
 *  - vi.mock to stub studentStore and cardanoWriter (no file I/O, no Blockfrost)
 *  - supertest to drive the Express router
 *  - jsonwebtoken to mint valid auth tokens using the dev secret
 *
 * Critical invariant tested here: the wallet-confirmed handler must pass a
 * CardanoVcHashPayload (with a pre-computed string vcHash) to
 * writeVcHashToCardano — NOT a raw VC object. The previous bug silently
 * passed the wrong shape, which caused a Buffer type error at Blockfrost.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import express from "express";
import request from "supertest";
import jwt from "jsonwebtoken";

// ── Mocks (must appear before any imports that pull in the mocked modules) ────

vi.mock("../services/studentStore.js", () => ({
  getIssuedCredentials: vi.fn(),
  addIssuedCredential: vi.fn(),
  updateDeliveryState: vi.fn(),
  updateIssuedCredentialCardano: vi.fn(),
  findById: vi.fn(),
  listStudents: vi.fn(() => []),
  markRevocationPending: vi.fn(),
  confirmRevocation: vi.fn(),
  updateIssuedCredentialRevocationCardano: vi.fn(),
  markCredentialFailed: vi.fn(),
  addPendingDiploma: vi.fn(),
  getPendingDiplomas: vi.fn(() => []),
  removePendingDiploma: vi.fn(),
  getWalletData: vi.fn(() => ({ seed: null, backup: null })),
  updateWalletData: vi.fn(),
  updateWalletSeed: vi.fn(),
  updateWalletDid: vi.fn(),
  clearConnection: vi.fn(),
  updateConnection: vi.fn(),
  createStudent: vi.fn(),
  verifyPassword: vi.fn(),
}));

vi.mock("../services/cardanoWriter.js", () => ({
  writeVcHashToCardano: vi.fn().mockResolvedValue({
    txHash: "abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890",
    cardanoscanUrl: "https://preprod.cardanoscan.io/transaction/abcdef1234567890",
  }),
  hashVc: vi.fn().mockReturnValue(
    "deadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef"
  ),
  writeRevocationToCardano: vi.fn(),
}));

// ── Imports (after mocks are registered) ─────────────────────────────────────

import { studentsRouter } from "../routes/students.js";
import * as store from "../services/studentStore.js";
import * as cardanoWriter from "../services/cardanoWriter.js";

// ── Test helpers ──────────────────────────────────────────────────────────────

const JWT_SECRET = "dev-jwt-secret-change-in-prod-please";

function makeToken(studentId: string) {
  return jwt.sign({ sub: studentId }, JWT_SECRET);
}

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use("/api/students", studentsRouter);
  return app;
}

function makeCred(overrides: Record<string, unknown> = {}) {
  return {
    credentialRecordId: "rec-1",
    degree: "BSc Computer Science",
    graduationDate: "2024-06-01",
    issuedAt: "2025-01-01T00:00:00.000Z",
    revoked: false,
    issuingDid: "did:prism:abc123",
    schemaId: "http://localhost:8085/schema-registry/schemas/v1",
    studentName: "Alice Test",
    studentIdField: "S001",
    ...overrides,
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("POST /api/students/:id/credentials", () => {
  const app = makeApp();

  it("returns 400 when required fields are missing", async () => {
    const res = await request(app)
      .post("/api/students/stu-1/credentials")
      .send({ degree: "BSc" }); // missing credentialRecordId + graduationDate

    expect(res.status).toBe(400);
    expect(res.body.error).toContain("required");
  });

  it("calls addIssuedCredential with all provided fields", async () => {
    vi.mocked(store.addIssuedCredential).mockImplementation(() => undefined);

    const res = await request(app)
      .post("/api/students/stu-1/credentials")
      .send({
        credentialRecordId: "rec-1",
        degree: "BSc Computer Science",
        graduationDate: "2024-06-01",
        issuingDid: "did:prism:abc123",
        schemaId: "http://schema/v1",
        studentName: "Alice Test",
        studentIdField: "S001",
      });

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);

    const call = vi.mocked(store.addIssuedCredential).mock.calls[0];
    expect(call[0]).toBe("stu-1");
    expect(call[1].issuingDid).toBe("did:prism:abc123");
    expect(call[1].schemaId).toBe("http://schema/v1");
    expect(call[1].studentName).toBe("Alice Test");
    expect(call[1].studentIdField).toBe("S001");
    expect(call[1].degree).toBe("BSc Computer Science");
  });

  it("returns 404 when student not found", async () => {
    vi.mocked(store.addIssuedCredential).mockImplementation(() => {
      throw new Error("Student not found");
    });

    const res = await request(app)
      .post("/api/students/stu-999/credentials")
      .send({
        credentialRecordId: "rec-x",
        degree: "BSc",
        graduationDate: "2024-06-01",
      });

    expect(res.status).toBe(404);
  });
});

describe("POST /api/students/:id/credentials/:recordId/wallet-confirmed", () => {
  let app: ReturnType<typeof makeApp>;

  beforeEach(() => {
    app = makeApp();
    vi.clearAllMocks();
    // Reset cardano mock to the default resolved value
    vi.mocked(cardanoWriter.writeVcHashToCardano).mockResolvedValue({
      txHash: "abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890",
      cardanoscanUrl: "https://preprod.cardanoscan.io/transaction/abcdef1234567890",
    });
    vi.mocked(cardanoWriter.hashVc).mockReturnValue(
      "deadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef"
    );
  });

  it("returns 403 when JWT is missing", async () => {
    const res = await request(app)
      .post("/api/students/stu-1/credentials/rec-1/wallet-confirmed");

    expect(res.status).toBe(403);
  });

  it("returns 403 when JWT sub does not match the student id in the URL", async () => {
    const token = makeToken("stu-DIFFERENT");
    const res = await request(app)
      .post("/api/students/stu-1/credentials/rec-1/wallet-confirmed")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(403);
  });

  it("returns 404 when credential record is not found", async () => {
    vi.mocked(store.getIssuedCredentials).mockReturnValue([]);

    const token = makeToken("stu-1");
    const res = await request(app)
      .post("/api/students/stu-1/credentials/rec-1/wallet-confirmed")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(404);
  });

  it("returns 200 and marks WalletConfirmed", async () => {
    vi.mocked(store.getIssuedCredentials).mockReturnValue([makeCred()]);
    vi.mocked(store.updateDeliveryState).mockImplementation(() => undefined);

    const token = makeToken("stu-1");
    const res = await request(app)
      .post("/api/students/stu-1/credentials/rec-1/wallet-confirmed")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(vi.mocked(store.updateDeliveryState)).toHaveBeenCalledWith(
      "stu-1",
      "rec-1",
      "WalletConfirmed"
    );
  });

  it("calls writeVcHashToCardano with CardanoVcHashPayload (not a raw VC object)", async () => {
    // Credential has issuingDid but no cardanoTxHash — should trigger anchor
    vi.mocked(store.getIssuedCredentials).mockReturnValue([makeCred()]);
    vi.mocked(store.updateDeliveryState).mockImplementation(() => undefined);
    vi.mocked(store.updateIssuedCredentialCardano).mockImplementation(() => undefined);

    const token = makeToken("stu-1");
    await request(app)
      .post("/api/students/stu-1/credentials/rec-1/wallet-confirmed")
      .set("Authorization", `Bearer ${token}`);

    // The fire-and-forget block is async — wait for it to settle
    await vi.waitFor(() => {
      expect(vi.mocked(cardanoWriter.writeVcHashToCardano)).toHaveBeenCalled();
    });

    const [payload] = vi.mocked(cardanoWriter.writeVcHashToCardano).mock.calls[0];

    // Must be a CardanoVcHashPayload — vcHash must be a string (not a Buffer or object)
    expect(typeof payload.vcHash).toBe("string");
    expect(payload.vcHash).toHaveLength(64); // SHA-256 hex

    // Must include all required fields
    expect(payload).toHaveProperty("label", 674);
    expect(payload.vcId).toContain("urn:credential:");
    expect(typeof payload.universityDid).toBe("string");
    expect(typeof payload.studentId).toBe("string");
    expect(typeof payload.issuedAt).toBe("string");
  });

  it("does NOT call writeVcHashToCardano when issuingDid is missing", async () => {
    // Credential without issuingDid — should NOT anchor
    vi.mocked(store.getIssuedCredentials).mockReturnValue([
      makeCred({ issuingDid: undefined }),
    ]);
    vi.mocked(store.updateDeliveryState).mockImplementation(() => undefined);

    const token = makeToken("stu-1");
    const res = await request(app)
      .post("/api/students/stu-1/credentials/rec-1/wallet-confirmed")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);

    // Flush microtasks
    await new Promise((r) => setTimeout(r, 20));
    expect(vi.mocked(cardanoWriter.writeVcHashToCardano)).not.toHaveBeenCalled();
  });

  it("does NOT call writeVcHashToCardano when anchor already exists (idempotent)", async () => {
    // Credential already anchored — should NOT anchor again
    vi.mocked(store.getIssuedCredentials).mockReturnValue([
      makeCred({ cardanoTxHash: "existing-tx-hash" }),
    ]);
    vi.mocked(store.updateDeliveryState).mockImplementation(() => undefined);

    const token = makeToken("stu-1");
    const res = await request(app)
      .post("/api/students/stu-1/credentials/rec-1/wallet-confirmed")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);

    await new Promise((r) => setTimeout(r, 20));
    expect(vi.mocked(cardanoWriter.writeVcHashToCardano)).not.toHaveBeenCalled();
  });
});
