// ─── Diploma Credential Types ─────────────────────────────────────────────────

export interface DiplomaCredentialSubject {
  /** Student's DID (did:peer or did:prism) — set when claim is accepted */
  id?: string;
  studentName: string;
  studentId: string;
  /** e.g. "Bachelor of Science in Computer Science" */
  degree: string;
  /** ISO-8601 date, e.g. "2024-06-15" */
  graduationDate: string;
  /** GPA on a 4.0 scale, optional */
  gpa?: number;
  universityName: string;
  universityDid: string;
}

/** W3C VC structure as returned by the Identus Cloud Agent (JWT-VC) */
export interface DiplomaCredential {
  "@context": string[];
  id: string;
  type: string[];
  issuer: string | { id: string; name?: string };
  issuanceDate: string;
  credentialSubject: DiplomaCredentialSubject;
  credentialSchema?: {
    id: string;
    type: string;
  };
  proof?: {
    type: string;
    jwt: string;
    [key: string]: unknown;
  };
}

// ─── Issuer Portal Types ───────────────────────────────────────────────────────

export interface DiplomaIssuanceRequest {
  studentName: string;
  studentId: string;
  degree: string;
  graduationDate: string;
  gpa?: number;
  /** DIDComm connection ID (from Cloud Agent) — links to a specific student wallet */
  connectionId: string;
}

export type DiplomaStatus =
  | "pending"        // Credential offer sent, waiting for student to accept
  | "RequestPending" // Cloud Agent internal state
  | "RequestSent"
  | "OfferSent"
  | "CredentialSent"
  | "issued"         // Fully issued and stored by student
  | "failed";

export interface IssuedDiploma {
  /** Cloud Agent credential record ID */
  credentialRecordId: string;
  studentName: string;
  studentId: string;
  degree: string;
  graduationDate: string;
  gpa?: number;
  connectionId: string;
  status: DiplomaStatus;
  /** Cardano preprod transaction hash for the VC hash metadata */
  cardanoTxHash?: string;
  /** Cardanoscan URL for the above tx */
  cardanoscanUrl?: string;
  issuedAt: string;
  vcHash?: string;
}

// ─── Verifier Portal Types ─────────────────────────────────────────────────────

export interface ProofRequest {
  presentationId: string;
  connectionId: string;
  status: "RequestPending" | "RequestSent" | "PresentationVerified" | "PresentationFailed";
  credential?: DiplomaCredentialSubject;
  cardanoHashVerified?: boolean;
}

// ─── Cardano Types ─────────────────────────────────────────────────────────────

export interface CardanoVcHashPayload {
  /** Metadata label — we use 674 (CIP-0020 message standard) */
  label: number;
  vcId: string;
  vcHash: string;
  universityDid: string;
  studentId: string;
  issuedAt: string;
}

export interface CardanoWriteResult {
  txHash: string;
  cardanoscanUrl: string;
}

// ─── Cloud Agent API shims ─────────────────────────────────────────────────────

/** Subset of the Cloud Agent's /connections response */
export interface AgentConnection {
  connectionId: string;
  label?: string;
  state: string;
  theirDid?: string;
  myDid?: string;
  createdAt: string;
}

/** Cloud Agent credential record */
export interface AgentCredentialRecord {
  recordId: string;
  thid?: string;
  connectionId?: string;
  protocolState: string;
  claims?: Record<string, unknown>;
  issuingDID?: string;
  subjectId?: string;
  credentialFormat: string;
  jwt?: string;
  createdAt: string;
  updatedAt: string;
}

/** Cloud Agent presentation record */
export interface AgentPresentationRecord {
  presentationId: string;
  connectionId?: string;
  status: string;
  data?: string[];
  createdAt: string;
  updatedAt: string;
}
