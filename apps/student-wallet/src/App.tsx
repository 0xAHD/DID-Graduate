import type { CSSProperties } from "react";
import { Routes, Route, NavLink } from "react-router-dom";
import { Home } from "./pages/Home.js";
import { Claim } from "./pages/Claim.js";
import { Present } from "./pages/Present.js";
import { WalletProvider } from "./context/WalletContext.js";

const navStyle: CSSProperties = {
  display: "flex",
  gap: "1.5rem",
  padding: "1rem 2rem",
  background: "#0f3460",
  color: "#fff",
  alignItems: "center",
};

const linkStyle = ({ isActive }: { isActive: boolean }): CSSProperties => ({
  color: isActive ? "#63b3ed" : "#a0aec0",
  textDecoration: "none",
  fontWeight: isActive ? 700 : 400,
  fontSize: "0.95rem",
});

export default function App() {
  return (
    <WalletProvider>
      <nav style={navStyle}>
        <span style={{ fontWeight: 700, fontSize: "1.1rem", marginRight: "1rem" }}>
          🎓 Diploma Wallet
        </span>
        <NavLink to="/" style={linkStyle} end>My Diplomas</NavLink>
        <NavLink to="/claim" style={linkStyle}>Claim Diploma</NavLink>
        <NavLink to="/present" style={linkStyle}>Present Diploma</NavLink>
      </nav>
      <main style={{ padding: "2rem", maxWidth: "800px", margin: "0 auto" }}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/claim" element={<Claim />} />
          <Route path="/present" element={<Present />} />
        </Routes>
      </main>
    </WalletProvider>
  );
}
