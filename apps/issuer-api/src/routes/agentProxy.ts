/**
 * Thin proxy to the Identus Cloud Agent REST API.
 *
 * Why proxy instead of hitting the Agent directly from the browser?
 *   • Keeps the Agent's API key out of the browser's network requests
 *   • Centralises CORS handling
 *   • Lets us add rate-limiting / audit-logging later without touching the frontend
 */
import { Router } from "express";

export const agentProxyRouter = Router();

const ISSUER_AGENT_URL = process.env.ISSUER_AGENT_URL ?? "http://127.0.0.1:8000";
const ISSUER_API_KEY = process.env.ISSUER_API_KEY ?? "";

/**
 * Generic proxy: forwards any sub-path under /api/agent/* to the Cloud Agent.
 * Example: GET /api/agent/dids → GET {ISSUER_AGENT_URL}/dids
 */
agentProxyRouter.all("/*", async (req, res) => {
  const targetPath = req.path; // e.g. "/dids", "/connections", etc.
  const url = `${ISSUER_AGENT_URL}${targetPath}${req.url.includes("?") ? "?" + req.url.split("?")[1] : ""}`;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
  };
  if (ISSUER_API_KEY) {
    headers["apikey"] = ISSUER_API_KEY;
  }

  try {
    const agentRes = await fetch(url, {
      method: req.method,
      headers,
      body: ["GET", "HEAD"].includes(req.method)
        ? undefined
        : JSON.stringify(req.body),
    });

    const body = await agentRes.text();
    res.status(agentRes.status);
    agentRes.headers.forEach((value, key) => {
      if (key !== "transfer-encoding") res.setHeader(key, value);
    });
    res.send(body);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[agent-proxy] error:", message);
    res.status(502).json({ error: "Cloud Agent unreachable" });
  }
});
