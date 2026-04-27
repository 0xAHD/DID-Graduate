import { useState, useEffect, useCallback, useRef } from "react";
import SDK from "@hyperledger/identus-edge-agent-sdk";
import {
  startAgent,
  stopAgent,
  getAllCredentials,
  registerMessageListener,
} from "../services/edgeAgent.js";

export type WalletStatus = "idle" | "starting" | "ready" | "error";

export interface UseWalletResult {
  status: WalletStatus;
  agent: SDK.Agent | null;
  credentials: SDK.Domain.Credential[];
  pendingProofRequest: SDK.Domain.Message | null;
  error: string | null;
  start: () => void;
  stop: () => void;
  refreshCredentials: () => Promise<void>;
  clearProofRequest: () => void;
}

export function useWallet(): UseWalletResult {
  const [status, setStatus] = useState<WalletStatus>("idle");
  const [agent, setAgent] = useState<SDK.Agent | null>(null);
  const [credentials, setCredentials] = useState<SDK.Domain.Credential[]>([]);
  const [pendingProofRequest, setPendingProofRequest] = useState<SDK.Domain.Message | null>(null);
  const [error, setError] = useState<string | null>(null);
  const unsubscribeRef = useRef<(() => void) | null>(null);

  const refreshCredentials = useCallback(async () => {
    const creds = await getAllCredentials();
    setCredentials(creds);
  }, []);

  const start = useCallback(async () => {
    setStatus("starting");
    setError(null);
    try {
      const a = await startAgent();
      setAgent(a);
      setStatus("ready");

      // Load existing credentials
      await refreshCredentials();

      // Register message listeners
      const unsubscribe = registerMessageListener(
        async (_newCred) => {
          // Refresh credential list whenever a new credential arrives
          await refreshCredentials();
        },
        (request) => {
          setPendingProofRequest(request);
        }
      );
      unsubscribeRef.current = unsubscribe;
    } catch (e) {
      setStatus("error");
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [refreshCredentials]);

  const stop = useCallback(async () => {
    unsubscribeRef.current?.();
    await stopAgent();
    setAgent(null);
    setStatus("idle");
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      unsubscribeRef.current?.();
    };
  }, []);

  return {
    status,
    agent,
    credentials,
    pendingProofRequest,
    error,
    start,
    stop,
    refreshCredentials,
    clearProofRequest: () => setPendingProofRequest(null),
  };
}
