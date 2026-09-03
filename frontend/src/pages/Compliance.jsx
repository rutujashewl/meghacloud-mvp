import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import * as complianceApi from "../api/compliance";

export default function Compliance() {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  useEffect(() => { complianceApi.getCompliance().then(setData).catch((err) => setError(err.message)); }, []);

  return <div className="app-shell"><header className="topbar"><div className="brand"><span className="brand-mark">☁</span><span className="brand-name">MeghaCloud</span></div><nav className="topnav"><Link to="/" className="btn btn-ghost">Dashboard</Link><Link to="/settings" className="btn btn-ghost">Settings</Link></nav></header><main className="content content--wide"><div className="page-header"><div><h1>Compliance Dashboard</h1><p className="subtitle">Review your current platform compliance posture.</p></div></div>{error && <div className="form-error">{error}</div>}{data && <><div className="stat-row"><div className="stat-card"><span className="stat-label">Compliance Score</span><span className="stat-value">{data.score}%</span></div><div className="stat-card"><span className="stat-label">Checks Passed</span><span className="stat-value">{data.checks.filter((check) => check.status === "pass").length}/{data.checks.length}</span></div></div><div className="card"><h2>Compliance Checks</h2>{data.checks.map((check) => <div className="list-row" key={check.id}><span><strong>{check.label}</strong><br /><span className="text-muted">{check.detail}</span></span><span className={`status-pill ${check.status === "pass" ? "status-pill--success" : "status-pill--warning"}`}>{check.status === "pass" ? "Passed" : "Needs review"}</span></div>)}</div><p className="text-muted">Updated {new Date(data.generated_at).toLocaleString()}</p></>}</main></div>;
}
