/**
 * Thin proxy to the Verifier Identus Cloud Agent REST API.
 *
 * Mirrors agentProxy.ts but targets the verifier agent.
 * Required because the Cloud Agent at port 9000 has no CORS headers,
 * so browser-side fetch calls are blocked.
 */
import { Router } from "express";

export const verifierProxyRouter = Router();

const VERIFIER_AGENT_URL = process.env.VERIFIER_AGENT_URL ?? "http://127.0.0.1:9000";
const VERIFIER_API_KEY = process.env.VERIFIER_API_KEY ?? "";

verifierProxyRouter.all("/*", async (req, res) => {
  const targetPath = req.path;
  const query = req.url.includes("?") ? "?" + req.url.split("?")[1] : "";
  const url = `${VERIFIER_AGENT_URL}${targetPath}${query}`;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
  };
  if (VERIFIER_API_KEY) {
    headers["apikey"] = VERIFIER_API_KEY;
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
    console.error("[verifier-proxy] error:", message);
    res.status(502).json({ error: "Verifier Cloud Agent unreachable" });
  }
});
