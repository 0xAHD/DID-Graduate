import { useState, useEffect, useCallback } from "react";
import type { AgentCredentialRecord } from "@university-diplomas/common";
import { listCredentialRecords } from "../services/agentApi.js";

interface UseDiplomasResult {
  records: AgentCredentialRecord[];
  loading: boolean;
  error: string | null;
  refresh: () => void;
}

/** Polls the Cloud Agent every 5 s for issued credential records */
export function useDiplomas(): UseDiplomasResult {
  const [records, setRecords] = useState<AgentCredentialRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    try {
      const data = await listCredentialRecords();
      setRecords(data);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load credentials");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetch();
    const id = setInterval(fetch, 5_000);
    return () => clearInterval(id);
  }, [fetch]);

  return { records, loading, error, refresh: fetch };
}
