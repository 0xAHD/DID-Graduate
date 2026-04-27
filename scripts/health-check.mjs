#!/usr/bin/env node
/**
 * Health check for all Identus PoC services.
 * Usage: node scripts/health-check.mjs
 */

const ISSUER_AGENT  = process.env.ISSUER_AGENT_URL  ?? "http://localhost:8000";
const VERIFIER_AGENT = process.env.VERIFIER_AGENT_URL ?? "http://localhost:9000";
const MEDIATOR_URL  = process.env.MEDIATOR_URL       ?? "http://localhost:8080";

async function checkHealth(label, url) {
  try {
    const res = await fetch(`${url}/_system/health`, { signal: AbortSignal.timeout(5000) });
    if (res.ok) {
      const data = await res.json();
      console.log(`✅  ${label}: OK  (version: ${data.version ?? "unknown"})`);
      return true;
    }
    console.log(`❌  ${label}: HTTP ${res.status}`);
    return false;
  } catch (err) {
    console.log(`❌  ${label}: ${err.message}`);
    return false;
  }
}

async function getMediatorDid(url) {
  try {
    const res = await fetch(`${url}/invitation`, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) { console.log(`❌  Mediator invitation endpoint: HTTP ${res.status}`); return null; }
    const text = await res.text();
    // The raw OOB URL contains the base64 payload; extract the Peer DID from it
    // The invitation URL itself is what the SDK needs — print it for the user
    const match = text.match(/did:peer:[^\s"]+/);
    if (match) {
      console.log(`✅  Mediator: OK`);
      console.log(`\n    Mediator Peer DID:\n    ${match[0]}`);
      return match[0];
    }
    // Fallback: print the full response
    console.log(`✅  Mediator: OK (raw invitation below)`);
    console.log(`    ${text.slice(0, 200)}`);
    return null;
  } catch (err) {
    console.log(`❌  Mediator: ${err.message}`);
    return null;
  }
}

async function main() {
  console.log("=== Identus PoC — Service Health Check ===\n");

  const issuerOk   = await checkHealth("Issuer Cloud Agent  ", ISSUER_AGENT);
  const verifierOk = await checkHealth("Verifier Cloud Agent", VERIFIER_AGENT);
  const mediatorDid = await getMediatorDid(MEDIATOR_URL);

  console.log("");

  if (!issuerOk || !verifierOk) {
    console.log("⚠️  One or more agents are not reachable.");
    console.log("   Make sure the infrastructure is running:");
    console.log("   pnpm run infra:dev\n");
  }

  if (mediatorDid) {
    console.log("📋  Next step: copy the Mediator Peer DID into your .env file:");
    console.log(`   MEDIATOR_DID=${mediatorDid}\n`);
    console.log("   Then run the initialisation scripts:");
    console.log("   bash scripts/01-init-university-did.sh");
    console.log("   bash scripts/02-register-diploma-schema.sh\n");
  }
}

main().catch(console.error);
