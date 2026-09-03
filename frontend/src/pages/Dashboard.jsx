import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import * as serversApi from "../api/servers";
import NotificationBell from "../components/NotificationBell";
import LanguageToggle from "../components/LanguageToggle";
import { useLanguage } from "../context/LanguageContext";

const STATUS_STYLES = {
  running: { bg: "#F0FDF4", color: "#15803D", label: "Running" },
  stopped: { bg: "#F3F4F6", color: "#6B7280", label: "Stopped" },
};

export default function Dashboard() {
  const { user, logout } = useAuth();
  const { t, language } = useLanguage();
  const [servers, setServers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState(null); // server currently mid-action, disables its buttons

  useEffect(() => {
    refresh();
  }, []);

  async function refresh() {
    setLoading(true);
    setError("");
    try {
      const list = await serversApi.listServers();
      setServers(list);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleAction(id, action) {
    setBusyId(id);
    setError("");
    try {
      const fn = { start: serversApi.startServer, stop: serversApi.stopServer, restart: serversApi.restartServer }[action];
      const updated = await fn(id);
      setServers((prev) => prev.map((s) => (s.id === id ? updated : s)));
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyId(null);
    }
  }

  async function handleDelete(id, name) {
    if (!window.confirm(`Delete "${name}"? This cannot be undone.`)) return;
    setBusyId(id);
    setError("");
    try {
      await serversApi.deleteServer(id);
      setServers((prev) => prev.filter((s) => s.id !== id));
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyId(null);
    }
  }

  const totalMonthly = servers
    .filter((s) => s.status === "running")
    .reduce((sum, s) => sum + s.monthly_cost, 0);

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark">☁</span>
          <span className="brand-name">MeghaCloud</span>
        </div>
        <nav className="topnav">
          <Link to="/monitoring" className="btn btn-ghost">{t.monitoring}</Link>
          <Link to="/billing" className="btn btn-ghost">{t.billing}</Link>
          <Link to="/settings" className="btn btn-ghost">{t.settings}</Link>
          <Link to="/team" className="btn btn-ghost">{t.team}</Link>
          <LanguageToggle />
          <NotificationBell />
          <button className="btn btn-ghost" onClick={logout}>{t.logout}</button>
        </nav>
      </header>

      <main className="content content--wide">
        <div className="page-header">
          <div>
            <h1>Namaste, {user?.name?.split(" ")[0] || "there"}</h1>
            <p className="subtitle">Here's a simplified view of your cloud infrastructure in India.</p>
          </div>
          <Link to="/servers/launch" className="btn btn-primary">{t.launch}</Link>
        </div>

        <div className="stat-row">
          <div className="stat-card">
            <span className="stat-label">{t.active}</span>
            <span className="stat-value">{servers.filter((s) => s.status === "running").length}</span>
          </div>
          <div className="stat-card">
            <span className="stat-label">{t.total}</span>
            <span className="stat-value">{servers.length}</span>
          </div>
          <div className="stat-card">
            <span className="stat-label">{t.cost}</span>
            <span className="stat-value">₹{totalMonthly.toLocaleString("en-IN")}</span>
          </div>
        </div>

        {error && <div className="form-error">{error}</div>}

        <div className="card card--table">
          <h2>{t.servers}</h2>

          {loading ? (
            <p className="text-muted">Loading servers…</p>
          ) : servers.length === 0 ? (
            <div className="empty-state">
              <p>No servers yet. Launch your first one to get started.</p>
              <Link to="/servers/launch" className="btn btn-primary">Launch New Server</Link>
            </div>
          ) : (
            <table className="server-table">
              <thead>
                <tr>
                  <th>Server Identity</th>
                  <th>Status</th>
                  <th>Region</th>
                  <th>Monthly Cost</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {servers.map((s) => {
                  const style = STATUS_STYLES[s.status];
                  const isBusy = busyId === s.id;
                  return (
                    <tr key={s.id}>
                      <td>
                        <div className="server-name">{s.name}</div>
                        <div className="server-meta">{s.os} · {s.size}</div>
                      </td>
                      <td>
                        <span className="status-pill" style={{ background: style.bg, color: style.color }}>
                          ● {style.label}
                        </span>
                      </td>
                      <td>{s.region}</td>
                      <td>₹{s.monthly_cost.toLocaleString("en-IN")}/mo</td>
                      <td className="action-cell">
                        {s.status === "running" ? (
                          <>
                            <button className="btn-link" disabled={isBusy} onClick={() => handleAction(s.id, "restart")}>Restart</button>
                            <button className="btn-link" disabled={isBusy} onClick={() => handleAction(s.id, "stop")}>Stop</button>
                          </>
                        ) : (
                          <button className="btn-link" disabled={isBusy} onClick={() => handleAction(s.id, "start")}>Start</button>
                        )}
                        <button className="btn-link btn-link--danger" disabled={isBusy} onClick={() => handleDelete(s.id, s.name)}>Delete</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        <div className="badge-row">
          <span className="badge">DPDPA Ready</span>
          <span className="badge">Data in India</span>
        </div>
      </main>
    </div>
  );
}
