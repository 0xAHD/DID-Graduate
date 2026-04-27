import type { CSSProperties } from "react";
import { Routes, Route, NavLink } from "react-router-dom";
import { Verify } from "./pages/Verify.js";
import { History } from "./pages/History.js";

const navStyle: CSSProperties = {
  display: "flex",
  gap: "1.5rem",
  padding: "1rem 2rem",
  background: "#1a3c2e",
  color: "#fff",
  alignItems: "center",
};

const linkStyle = ({ isActive }: { isActive: boolean }): CSSProperties => ({
  color: isActive ? "#6ee7b7" : "#a0aec0",
  textDecoration: "none",
  fontWeight: isActive ? 700 : 400,
  fontSize: "0.95rem",
});

export default function App() {
  return (
    <>
      <nav style={navStyle}>
        <span style={{ fontWeight: 700, fontSize: "1.1rem", marginRight: "1rem" }}>
          ✅ Diploma Verifier Portal
        </span>
        <NavLink to="/" style={linkStyle} end>Verify Diploma</NavLink>
        <NavLink to="/history" style={linkStyle}>History</NavLink>
      </nav>
      <main style={{ padding: "2rem", maxWidth: "900px", margin: "0 auto" }}>
        <Routes>
          <Route path="/" element={<Verify />} />
          <Route path="/history" element={<History />} />
        </Routes>
      </main>
    </>
  );
}
