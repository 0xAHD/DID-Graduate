import { createContext, useContext, ReactNode } from "react";
import { useWallet, UseWalletResult } from "../hooks/useWallet.js";

const WalletContext = createContext<UseWalletResult | null>(null);

export function WalletProvider({ children }: { children: ReactNode }) {
  const wallet = useWallet();
  return (
    <WalletContext.Provider value={wallet}>
      {children}
    </WalletContext.Provider>
  );
}

export function useWalletContext(): UseWalletResult {
  const ctx = useContext(WalletContext);
  if (!ctx) throw new Error("useWalletContext must be used inside <WalletProvider>");
  return ctx;
}
