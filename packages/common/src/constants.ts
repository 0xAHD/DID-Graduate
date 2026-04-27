// ─── Application-wide constants ────────────────────────────────────────────────

/** The W3C VC @context values required for our diploma credential */
export const DIPLOMA_VC_CONTEXT = [
  "https://www.w3.org/2018/credentials/v1",
  "https://w3c-ccg.github.io/vc-bbs-bls-signature-expressions/contexts/v1",
];

/** W3C VC type values for the diploma credential */
export const DIPLOMA_VC_TYPES = [
  "VerifiableCredential",
  "UniversityDiplomaCredential",
];

/**
 * Cardano transaction metadata label.
 * 674 is the CIP-0020 standard label for human-readable messages;
 * we repurpose it for VC hash receipts with a structured payload.
 */
export const CARDANO_METADATA_LABEL = 674;

/** Cardano preprod explorer base URL */
export const CARDANOSCAN_PREPROD_BASE = "https://preprod.cardanoscan.io";

/**
 * DIDComm message type URIs used by the Identus SDK.
 * These must match what the Cloud Agent produces.
 */
export const DIDCOMM_MSG_TYPES = {
  CREDENTIAL_OFFER: "https://didcomm.org/issue-credential/2.0/offer-credential",
  CREDENTIAL_ISSUED: "https://didcomm.org/issue-credential/2.0/issue-credential",
  PROOF_REQUEST:
    "https://didcomm.atalaprism.io/present-proof/3.0/request-presentation",
} as const;

/** Credential format used by the Cloud Agent */
export const CREDENTIAL_FORMAT = "JWT" as const;

/** JSON Schema type URI required by Identus schema registry */
export const SCHEMA_TYPE =
  "https://w3c-ccg.github.io/vc-json-schemas/schema/2.0/schema.json";

/** How often to poll the Cloud Agent for credential/presentation status (ms) */
export const POLL_INTERVAL_MS = 3_000;

/** Maximum number of poll attempts before giving up */
export const POLL_MAX_ATTEMPTS = 40;
