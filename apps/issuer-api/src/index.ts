import { config } from "dotenv";
import { resolve } from "path";
// Load .env from monorepo root (three levels up from apps/issuer-api/src/)
config({ path: resolve(__dirname, "../../../.env") });
import express from "express";
import cors from "cors";
import { cardanoRouter } from "./routes/cardano.js";
import { agentProxyRouter } from "./routes/agentProxy.js";

const app = express();
const PORT = process.env.PORT ?? 3010;

// ── Middleware ─────────────────────────────────────────────────────────────────
app.use(
  cors({
    // Allow any localhost origin in dev (Vite may use varying ports on restarts)
    origin: (origin, callback) => {
      if (!origin || origin.startsWith("http://localhost:")) {
        callback(null, true);
      } else {
        callback(new Error("CORS not allowed from " + origin));
      }
    },
    methods: ["GET", "POST", "PUT", "DELETE"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);
app.use(express.json({ limit: "2mb" }));

// ── DIDComm proxy ──────────────────────────────────────────────────────────────
// The student wallet (browser) sends DIDComm messages to the issuer.
// Browser → localhost:8001 is blocked by CORS; we proxy via this server which
// has CORS headers, forwarding raw bytes to the issuer agent's DIDComm port.
const ISSUER_DIDCOMM_URL = process.env.ISSUER_DIDCOMM_URL ?? "http://127.0.0.1:8001";
app.post("/didcomm", express.raw({ type: "*/*", limit: "4mb" }), async (req, res) => {
  try {
    const upstream = await fetch(ISSUER_DIDCOMM_URL, {
      method: "POST",
      headers: {
        "Content-Type": req.headers["content-type"] ?? "application/didcomm-encrypted+json",
      },
      body: req.body as Buffer,
    });
    const body = await upstream.arrayBuffer();
    res.status(upstream.status);
    const ct = upstream.headers.get("content-type");
    if (ct) res.setHeader("Content-Type", ct);
    res.send(Buffer.from(body));
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[didcomm-proxy] error:", msg);
    res.status(502).json({ error: "DIDComm upstream unreachable" });
  }
});

// ── Routes ─────────────────────────────────────────────────────────────────────
app.use("/api/cardano", cardanoRouter);
app.use("/api/agent", agentProxyRouter);

// ── Health ─────────────────────────────────────────────────────────────────────
app.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    blockfrostConfigured: Boolean(process.env.BLOCKFROST_PROJECT_ID?.startsWith("preprod")),
    walletConfigured: Boolean(process.env.CARDANO_WALLET_MNEMONIC),
  });
});

app.listen(PORT, () => {
  console.log(`issuer-api running on http://localhost:${PORT}`);
  if (!process.env.BLOCKFROST_PROJECT_ID || process.env.BLOCKFROST_PROJECT_ID === "preprodXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX") {
    console.warn("⚠  BLOCKFROST_PROJECT_ID not set — Cardano hash writing will fail");
  }
  if (!process.env.CARDANO_WALLET_MNEMONIC) {
    console.warn("⚠  CARDANO_WALLET_MNEMONIC not set — Cardano hash writing will fail");
  }
});
