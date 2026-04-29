import { useState, type CSSProperties } from "react";
import { login, register } from "../services/authApi.js";
import type { StudentUser } from "../services/authApi.js";

interface Props {
  onAuth: (token: string, user: StudentUser, publicDevice: boolean) => void;
}

const inputStyle: CSSProperties = {
  width: "100%",
  padding: "10px 12px",
  border: "1px solid #cbd5e1",
  borderRadius: "6px",
  fontSize: "0.95rem",
  boxSizing: "border-box",
};

const btnStyle: CSSProperties = {
  width: "100%",
  padding: "12px",
  background: "#0f3460",
  color: "#fff",
  border: "none",
  borderRadius: "6px",
  fontSize: "1rem",
  fontWeight: 700,
  cursor: "pointer",
};

const labelStyle: CSSProperties = {
  display: "block",
  marginBottom: "4px",
  fontWeight: 600,
  fontSize: "0.875rem",
  color: "#374151",
};

export function LoginPage({ onAuth }: Props) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [studentNumber, setStudentNumber] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [publicDevice, setPublicDevice] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      let result;
      if (mode === "login") {
        result = await login(email, password);
      } else {
        result = await register(email, password, name, studentNumber);
      }
      onAuth(result.token, result.student, publicDevice);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#f1f5f9",
        padding: "1rem",
      }}
    >
      <div
        style={{
          background: "#fff",
          borderRadius: "12px",
          padding: "2.5rem",
          width: "100%",
          maxWidth: "420px",
          boxShadow: "0 8px 30px rgba(0,0,0,0.12)",
        }}
      >
        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: "2rem" }}>
          <div style={{ fontSize: "2.5rem", marginBottom: "0.5rem" }}>🎓</div>
          <h1 style={{ margin: 0, fontSize: "1.5rem", color: "#0f3460" }}>
            Diploma Wallet
          </h1>
          <p style={{ margin: "0.5rem 0 0", color: "#64748b", fontSize: "0.9rem" }}>
            {mode === "login"
              ? "Sign in to access your diplomas"
              : "Create an account to receive diplomas"}
          </p>
        </div>

        {/* Tab toggle */}
        <div
          style={{
            display: "flex",
            background: "#f1f5f9",
            borderRadius: "8px",
            padding: "4px",
            marginBottom: "1.5rem",
          }}
        >
          {(["login", "register"] as const).map((m) => (
            <button
              key={m}
              onClick={() => { setMode(m); setError(""); }}
              style={{
                flex: 1,
                padding: "8px",
                border: "none",
                borderRadius: "6px",
                fontWeight: 600,
                fontSize: "0.875rem",
                cursor: "pointer",
                background: mode === m ? "#fff" : "transparent",
                color: mode === m ? "#0f3460" : "#64748b",
                boxShadow: mode === m ? "0 1px 4px rgba(0,0,0,0.1)" : "none",
              }}
            >
              {m === "login" ? "Sign In" : "Register"}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit}>
          {mode === "register" && (
            <>
              <div style={{ marginBottom: "1rem" }}>
                <label style={labelStyle}>Full Name</label>
                <input
                  style={inputStyle}
                  type="text"
                  placeholder="Jane Smith"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  disabled={loading}
                />
              </div>
              <div style={{ marginBottom: "1rem" }}>
                <label style={labelStyle}>Student Number <span style={{ color: "#94a3b8", fontWeight: 400 }}>(optional)</span></label>
                <input
                  style={inputStyle}
                  type="text"
                  placeholder="S12345678"
                  value={studentNumber}
                  onChange={(e) => setStudentNumber(e.target.value)}
                  disabled={loading}
                />
              </div>
            </>
          )}

          <div style={{ marginBottom: "1rem" }}>
            <label style={labelStyle}>Email</label>
            <input
              style={inputStyle}
              type="email"
              placeholder="jane@university.edu"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              disabled={loading}
            />
          </div>

          <div style={{ marginBottom: "1.5rem" }}>
            <label style={labelStyle}>Password</label>
            <input
              style={inputStyle}
              type="password"
              placeholder={mode === "register" ? "At least 6 characters" : ""}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              disabled={loading}
            />
          </div>

          {/* Public device toggle — only shown on login, not register */}
          {mode === "login" && (
            <label
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: "10px",
                marginBottom: "1.25rem",
                cursor: "pointer",
                padding: "10px 12px",
                borderRadius: "8px",
                background: publicDevice ? "#fff7ed" : "#f8fafc",
                border: `1px solid ${publicDevice ? "#fed7aa" : "#e2e8f0"}`,
                transition: "background 0.15s, border-color 0.15s",
              }}
            >
              <input
                type="checkbox"
                checked={publicDevice}
                onChange={(e) => setPublicDevice(e.target.checked)}
                disabled={loading}
                style={{ marginTop: "2px", accentColor: "#ea580c", flexShrink: 0 }}
              />
              <span style={{ fontSize: "0.875rem", lineHeight: "1.4" }}>
                <strong style={{ color: publicDevice ? "#c2410c" : "#374151" }}>
                  This is a shared or public device
                </strong>
                <br />
                <span style={{ color: "#64748b" }}>
                  Your wallet data will be deleted when you close the tab.
                </span>
              </span>
            </label>
          )}

          {error && (
            <div
              style={{
                background: "#fef2f2",
                border: "1px solid #fca5a5",
                borderRadius: "6px",
                padding: "10px 14px",
                marginBottom: "1rem",
                fontSize: "0.875rem",
                color: "#dc2626",
              }}
            >
              {error}
            </div>
          )}

          <button style={btnStyle} type="submit" disabled={loading}>
            {loading
              ? mode === "login"
                ? "Signing in…"
                : "Creating account…"
              : mode === "login"
              ? "Sign In"
              : "Create Account"}
          </button>
        </form>
      </div>
    </div>
  );
}
