import { createContext, useContext, ReactNode } from "react";
import { useWallet, UseWalletResult } from "../hooks/useWallet.js";
import type { StudentUser } from "../services/authApi.js";

interface WalletContextValue extends UseWalletResult {
  currentUser: StudentUser | null;
  token: string | null;
  logout: () => void;
}

const WalletContext = createContext<WalletContextValue | null>(null);

interface WalletProviderProps {
  children: ReactNode;
  currentUser: StudentUser | null;
  token: string | null;
  logout: () => void;
}

export function WalletProvider({ children, currentUser, token, logout }: WalletProviderProps) {
  const wallet = useWallet(currentUser, token);
  return (
    <WalletContext.Provider value={{ ...wallet, currentUser, token, logout }}>
      {children}
    </WalletContext.Provider>
  );
}

export function useWalletContext(): WalletContextValue {
  const ctx = useContext(WalletContext);
  if (!ctx) throw new Error("useWalletContext must be used inside <WalletProvider>");
  return ctx;
}

