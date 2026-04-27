/**
 * Edge Agent service — wraps @hyperledger/identus-edge-agent-sdk v6.6.0.
 *
 * Architecture:
 *   Apollo   — cryptographic primitives (key generation, signing) + KeyRestoration
 *   Castor   — DID creation & resolution (did:prism, did:peer)
 *   Pluto    — persistent storage (IndexedDB via RxDB + Dexie)
 *   Mercury  — DIDComm V2 messaging
 *   Agent    — top-level orchestrator; runs message loop with mediator
 */

import SDK from "@hyperledger/identus-edge-agent-sdk";
import { getRxStorageDexie } from "rxdb/plugins/storage-dexie";
import { wrappedKeyEncryptionCryptoJsStorage } from "rxdb/plugins/encryption-crypto-js";

const MEDIATOR_PEER_DID = import.meta.env.VITE_MEDIATOR_PEER_DID ?? "";

// Lazily-initialised agent singleton
let _agent: SDK.Agent | null = null;
let _pluto: SDK.Pluto | null = null;
let _apollo: SDK.Apollo | null = null;

/** Returns the Pluto storage handle (initialise once, reuse). */
async function getPluto(): Promise<{ pluto: SDK.Pluto; apollo: SDK.Apollo }> {
  if (_pluto && _apollo) return { pluto: _pluto, apollo: _apollo };

  _apollo = new SDK.Apollo();
  // RxdbStore requires an RxDatabaseCreator config with a storage adapter.
  // getRxStorageDexie() uses IndexedDB under the hood — data survives page refreshes.
  // wrappedKeyEncryptionCryptoSubtleStorage adds AES-GCM encryption via the Web Crypto
  // API so that RxDB encrypted fields (like Pluto's dataJson) work correctly.
  const store = new SDK.Store({
    name: "diploma-wallet-v2",
    storage: wrappedKeyEncryptionCryptoJsStorage({ storage: getRxStorageDexie() }),
    password: "diploma-wallet-pass-1",
  });
  // Apollo implements Domain.KeyRestoration, required as second arg since SDK v6.5
  _pluto = new SDK.Pluto(store, _apollo);
  await _pluto.start();

  return { pluto: _pluto, apollo: _apollo };
}

/**
 * Initialises the Edge Agent and connects to the mediator.
 * Safe to call multiple times — returns the same instance after first call.
 */
export async function startAgent(): Promise<SDK.Agent> {
  if (_agent) return _agent;

  if (!MEDIATOR_PEER_DID) {
    throw new Error(
      "VITE_MEDIATOR_PEER_DID is not set.\n" +
        "Run the infrastructure, then:\n" +
        "  node scripts/health-check.mjs\n" +
        "and paste the Mediator Peer DID into your .env file."
    );
  }

  const { pluto, apollo } = await getPluto();
  const castor = new SDK.Castor(apollo);
  const api = new SDK.ApiImpl();
  const didcomm = new SDK.DIDCommWrapper(apollo, castor, pluto);
  const mercury = new SDK.Mercury(castor, didcomm, api);
  const pollux = new SDK.Pollux(apollo, castor);

  const mediatorDID = SDK.Domain.DID.fromString(MEDIATOR_PEER_DID);
  const mediatorStore = new SDK.PublicMediatorStore(pluto);
  const mediatorHandler = new SDK.BasicMediatorHandler(mediatorDID, mercury, mediatorStore);

  // ConnectionsManager v6.6.0 requires: castor, mercury, pluto, pollux, mediatorHandler
  const connectionsManager = new SDK.ConnectionsManager(
    castor,
    mercury,
    pluto,
    pollux,
    mediatorHandler
  );

  const seed = apollo.createRandomSeed();

  _agent = new SDK.Agent(
    apollo,
    castor,
    pluto,
    mercury,
    mediatorHandler,
    connectionsManager,
    seed.seed
  );

  await _agent.start();
  return _agent;
}

export async function stopAgent(): Promise<void> {
  if (_agent) {
    await _agent.stop();
    _agent = null;
  }
}

export function getAgent(): SDK.Agent | null {
  return _agent;
}

// ── Credential operations ──────────────────────────────────────────────────────

export async function getAllCredentials(): Promise<SDK.Domain.Credential[]> {
  const { pluto } = await getPluto();
  return pluto.getAllCredentials();
}

/**
 * Accepts a DIDComm OOB invitation URL.
 */
export async function acceptInvitation(invitationUrl: string): Promise<void> {
  const agent = await startAgent();
  const parsed = await agent.parseOOBInvitation(new URL(invitationUrl));
  await agent.acceptDIDCommInvitation(parsed);
}

/**
 * Registers listeners for incoming DIDComm messages.
 * Returns an unsubscribe function.
 *
 * EventCallback in v6.6.0: (arg: Message[] | DIDPair | Credential) => void
 * We type-guard with Array.isArray to handle only message events.
 */
export function registerMessageListener(
  onCredentialIssued: (credential: SDK.Domain.Credential) => void,
  onProofRequest: (request: SDK.Domain.Message) => void
): () => void {
  const agent = _agent;
  if (!agent) return () => {};

  const handler: SDK.EventCallback = (arg) => {
    // Only handle Message[] events; ignore DIDPair and Credential events
    if (!Array.isArray(arg)) return;
    const messages = arg as SDK.Domain.Message[];

    void (async () => {
      for (const message of messages) {
        // Credential Offer — auto-accept
        if (message.piuri === "https://didcomm.org/issue-credential/3.0/offer-credential") {
          try {
            const offer = SDK.OfferCredential.fromMessage(message);
            const request = await agent.prepareRequestCredentialWithIssuer(offer);
            await agent.sendMessage(request.makeMessage());
          } catch (e) {
            console.error("Failed to accept credential offer:", e);
          }
        }

        // Issued Credential — store it
        if (message.piuri === "https://didcomm.org/issue-credential/3.0/issue-credential") {
          try {
            const issued = SDK.IssueCredential.fromMessage(message);
            const credential = await agent.processIssuedCredentialMessage(issued);
            onCredentialIssued(credential);
          } catch (e) {
            console.error("Failed to process issued credential:", e);
          }
        }

        // Proof Request — surface to UI
        if (message.piuri === "https://didcomm.atalaprism.io/present-proof/3.0/request-presentation") {
          onProofRequest(message);
        }
      }
    })();
  };

  agent.addListener(SDK.ListenerKey.MESSAGE, handler);
  return () => agent.removeListener(SDK.ListenerKey.MESSAGE, handler);
}

/**
 * Creates and sends a Verifiable Presentation in response to a proof request.
 */
export async function sendPresentation(
  requestMessage: SDK.Domain.Message,
  credential: SDK.Domain.Credential
): Promise<void> {
  const agent = _agent;
  if (!agent) throw new Error("Agent not started");

  const request = SDK.RequestPresentation.fromMessage(requestMessage);
  const presentation = await agent.createPresentationForRequestProof(request, credential);
  await agent.sendMessage(presentation.makeMessage());
}

// ── Local DID info ─────────────────────────────────────────────────────────────

export async function getMediatorDid(): Promise<string | null> {
  const { pluto } = await getPluto();
  const mediators = await pluto.getAllMediators();
  return mediators[0]?.mediatorDID?.toString() ?? null;
}

export async function getPeerDids(): Promise<SDK.Domain.DID[]> {
  const { pluto } = await getPluto();
  return pluto.getAllPeerDIDs().then((dids) => dids.map((d) => d.did));
}

