import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import GoogleButton from "../components/GoogleButton";

export default function Register() {
  const { registerWithPassword, loginWithGoogle } = useAuth();
  const navigate = useNavigate();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      await registerWithPassword(name, email, password);
      navigate("/");
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleGoogleCredential(credential) {
    setError("");
    try {
      await loginWithGoogle(credential);
      navigate("/");
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="auth-shell">
      <div className="auth-card">
        <div className="brand">
          <span className="brand-mark">☁</span>
          <span className="brand-name">MeghaCloud</span>
        </div>

        <h1>Create your account</h1>
        <p className="subtitle">Start your 7-day free trial — no credit card required</p>

        {error && <div className="form-error">{error}</div>}

        <form onSubmit={handleSubmit}>
          <label>
            Full Name
            <input
              type="text"
              placeholder="Rutu Shewale"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </label>

          <label>
            Business Email
            <input
              type="email"
              placeholder="name@company.in"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </label>

          <label>
            Password
            <input
              type="password"
              placeholder="At least 8 characters"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={8}
              required
            />
          </label>

          <button type="submit" className="btn btn-primary" disabled={submitting}>
            {submitting ? "Creating account…" : "Create Account"}
          </button>
        </form>

        <div className="divider">
          <span>OR CONTINUE WITH</span>
        </div>

        <GoogleButton onCredential={handleGoogleCredential} onError={setError} />

        <p className="switch-link">
          Already have an account? <Link to="/login">Login</Link>
        </p>
      </div>

      <p className="compliance-note">🛡 100% Data Sovereignty Compliance — all data stored in India</p>
    </div>
  );
}
