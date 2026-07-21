import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import * as serversApi from "../api/servers";

export default function LaunchServer() {
  const navigate = useNavigate();
  const [meta, setMeta] = useState(null);
  const [loadingMeta, setLoadingMeta] = useState(true);

  const [name, setName] = useState("");
  const [os, setOs] = useState("");
  const [size, setSize] = useState("");
  const [region, setRegion] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    serversApi
      .getMeta()
      .then((m) => {
        setMeta(m);
        setOs(m.osOptions[0]);
        setSize(Object.keys(m.sizes)[0]);
        setRegion(m.regions[0]);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoadingMeta(false));
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      const server = await serversApi.launchServer({ name, os, size, region });
      navigate("/", { state: { launched: server.name } });
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  const estimatedCost = meta && size ? meta.sizes[size].monthly_inr : null;

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark">☁</span>
          <span className="brand-name">MeghaCloud</span>
        </div>
        <Link to="/" className="btn btn-ghost">Cancel</Link>
      </header>

      <main className="content">
        <h1>Launch New Server</h1>
        <p className="subtitle">Deploy your cloud infrastructure in seconds.</p>

        {error && <div className="form-error">{error}</div>}

        {loadingMeta ? (
          <p className="text-muted">Loading options…</p>
        ) : (
          <div className="card">
            <form onSubmit={handleSubmit} className="profile-form">
              <label>
                Server Name
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="web-server-prod-01"
                  required
                />
              </label>

              <label>
                Operating System
                <select value={os} onChange={(e) => setOs(e.target.value)}>
                  {meta.osOptions.map((opt) => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
              </label>

              <label>
                Server Size
                <select value={size} onChange={(e) => setSize(e.target.value)}>
                  {Object.entries(meta.sizes).map(([key, s]) => (
                    <option key={key} value={key}>
                      {s.label} — {s.vcpu} vCPU, {s.ram_gb} GB RAM — ₹{s.monthly_inr}/mo
                    </option>
                  ))}
                </select>
              </label>

              <label>
                Region
                <select value={region} onChange={(e) => setRegion(e.target.value)}>
                  {meta.regions.map((r) => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
                <span className="hint">More Indian regions (Delhi NCR, Hyderabad) coming soon.</span>
              </label>

              <div className="cost-preview">
                <span>Estimated Monthly Cost</span>
                <strong>₹{estimatedCost?.toLocaleString("en-IN")}/month</strong>
              </div>

              <button type="submit" className="btn btn-primary" disabled={submitting}>
                {submitting ? "Launching…" : "Launch Server"}
              </button>
            </form>
          </div>
        )}
      </main>
    </div>
  );
}
