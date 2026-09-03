import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import * as databasesApi from "../api/databases";

const options = { postgres: ["16", "15"], mysql: ["8.0", "5.7"] };

export default function Databases() {
  const [databases, setDatabases] = useState([]);
  const [form, setForm] = useState({ name: "", engine: "postgres", version: "16", size: "small", region: "Mumbai" });
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  useEffect(() => { databasesApi.listDatabases().then(setDatabases).catch((err) => setError(err.message)); }, []);
  function updateEngine(engine) { setForm({ ...form, engine, version: options[engine][0] }); }
  async function create(event) {
    event.preventDefault(); setError(""); setMessage("");
    try { const database = await databasesApi.createDatabase(form); setDatabases((current) => [database, ...current]); setMessage(`${database.name} database created`); setForm({ ...form, name: "" }); }
    catch (err) { setError(err.message); }
  }
  async function remove(id) {
    try { await databasesApi.deleteDatabase(id); setDatabases((current) => current.filter((database) => database.id !== id)); }
    catch (err) { setError(err.message); }
  }
  return <div className="app-shell"><header className="topbar"><div className="brand"><span className="brand-mark">☁</span><span className="brand-name">MeghaCloud</span></div><nav className="topnav"><Link to="/" className="btn btn-ghost">Dashboard</Link><Link to="/billing" className="btn btn-ghost">Billing</Link></nav></header><main className="content content--wide"><div className="page-header"><div><h1>Managed Databases</h1><p className="subtitle">Deploy and manage database instances in Mumbai.</p></div></div>{error && <div className="form-error">{error}</div>}{message && <div className="form-success">{message}</div>}<div className="card"><h2>Create database</h2><form onSubmit={create} className="form-grid"><input placeholder="Database name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /><select value={form.engine} onChange={(e) => updateEngine(e.target.value)}><option value="postgres">PostgreSQL</option><option value="mysql">MySQL</option></select><select value={form.version} onChange={(e) => setForm({ ...form, version: e.target.value })}>{options[form.engine].map((version) => <option key={version}>{version}</option>)}</select><select value={form.size} onChange={(e) => setForm({ ...form, size: e.target.value })}><option value="small">Small</option><option value="medium">Medium</option><option value="large">Large</option></select><button className="btn btn-primary">Create database</button></form></div><div className="card"><h2>Your databases</h2>{databases.length === 0 ? <p className="text-muted">No managed databases yet.</p> : databases.map((database) => <div className="list-row" key={database.id}><span><strong>{database.name}</strong><br /><span className="text-muted">{database.engine} {database.version} · {database.size} · {database.region}</span></span><span>₹{database.monthly_cost}/mo</span><button className="btn btn-ghost" onClick={() => remove(database.id)}>Delete</button></div>)}</div></main></div>;
}
