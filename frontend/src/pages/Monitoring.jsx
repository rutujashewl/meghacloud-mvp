import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { useAuth } from "../context/AuthContext";
import * as serversApi from "../api/servers";
import * as monitoringApi from "../api/monitoring";
import NotificationBell from "../components/NotificationBell";

const INCIDENT_COLORS = {
  healthy: "#16A34A",
  degraded: "#F59E0B",
  stopped: "#9CA3AF",
};

export default function Monitoring() {
  const { logout } = useAuth();
  const [servers, setServers] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    serversApi
      .listServers()
      .then((list) => {
        setServers(list);
        if (list.length > 0) setSelectedId(list[0].id);
        else setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    if (!selectedId) return;
    setLoading(true);
    monitoringApi
      .getServerMonitoring(selectedId)
      .then(setData)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));

    // Poll every 8s so the "current" numbers feel live, like a real monitoring agent.
    const interval = setInterval(() => {
      monitoringApi.getServerMonitoring(selectedId).then(setData).catch(() => {});
    }, 8000);
    return () => clearInterval(interval);
  }, [selectedId]);

  const selectedServer = servers.find((s) => s.id === selectedId);

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark">☁</span>
          <span className="brand-name">MeghaCloud</span>
        </div>
        <nav className="topnav">
          <Link to="/" className="btn btn-ghost">← Dashboard</Link>
          <NotificationBell />
          <button className="btn btn-ghost" onClick={logout}>Logout</button>
        </nav>
      </header>

      <main className="content content--wide">
        <div className="page-header">
          <div>
            <h1>Live Monitoring</h1>
            <p className="subtitle">Detailed health metrics for your Indian cloud instances.</p>
          </div>
          {servers.length > 0 && (
            <select value={selectedId || ""} onChange={(e) => setSelectedId(Number(e.target.value))}>
              {servers.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          )}
        </div>

        {error && <div className="form-error">{error}</div>}

        {servers.length === 0 ? (
          <div className="card">
            <div className="empty-state">
              <p>No servers to monitor yet.</p>
              <Link to="/servers/launch" className="btn btn-primary">Launch New Server</Link>
            </div>
          </div>
        ) : loading || !data ? (
          <p className="text-muted">Loading metrics…</p>
        ) : (
          <>
            <div className="stat-row">
              <div className="stat-card">
                <span className="stat-label">Status</span>
                <span className="stat-value" style={{ fontSize: 16, color: selectedServer?.status === "running" ? "#15803D" : "#6B7280" }}>
                  ● {selectedServer?.status === "running" ? "Running" : "Stopped"}
                </span>
              </div>
              <div className="stat-card">
                <span className="stat-label">System Uptime</span>
                <span className="stat-value">{data.current.uptime_pct}%</span>
              </div>
              <div className="stat-card">
                <span className="stat-label">Average CPU</span>
                <span className="stat-value">{data.current.cpu}%</span>
              </div>
              <div className="stat-card">
                <span className="stat-label">Memory (RAM)</span>
                <span className="stat-value">{data.current.ram}%</span>
              </div>
              <div className="stat-card">
                <span className="stat-label">Disk Usage</span>
                <span className="stat-value">{data.current.disk}%</span>
              </div>
            </div>

            <div className="card">
              <h2>Resource Usage Trend — Last 7 Days</h2>
              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={data.trend} margin={{ top: 10, right: 20, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                  <XAxis dataKey="day" tick={{ fontSize: 12, fill: "#6B7280" }} />
                  <YAxis tick={{ fontSize: 12, fill: "#6B7280" }} unit="%" />
                  <Tooltip />
                  <Line type="monotone" dataKey="cpu" name="CPU Usage" stroke="#1D4ED8" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="ram" name="RAM Usage" stroke="#16A34A" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>

            <div className="card">
              <h2>Today's Incident Timeline</h2>
              <div className="incident-timeline">
                {data.incidents.map((inc, i) => (
                  <div key={i} className="incident-block" style={{ borderLeftColor: INCIDENT_COLORS[inc.status] }}>
                    <span className="incident-dot" style={{ background: INCIDENT_COLORS[inc.status] }} />
                    <div>
                      <div className="incident-label">{inc.label}</div>
                      <div className="incident-time">{inc.time}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
