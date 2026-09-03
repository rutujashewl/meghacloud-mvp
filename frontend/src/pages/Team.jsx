import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import * as teamApi from "../api/team";

export default function Team() {
  const [members, setMembers] = useState([]);
  const [form, setForm] = useState({ name: "", email: "", role: "developer" });
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function load() {
    try { setMembers(await teamApi.listTeam()); } catch (err) { setError(err.message); }
  }
  useEffect(() => { load(); }, []);

  async function invite(event) {
    event.preventDefault(); setError(""); setMessage("");
    try {
      const result = await teamApi.inviteMember(form);
      setMessage(`Member added. Temporary password: ${result.tempPassword}`);
      setForm({ name: "", email: "", role: "developer" }); await load();
    } catch (err) { setError(err.message); }
  }

  async function changeRole(id, role) {
    try { await teamApi.updateMemberRole(id, role); await load(); } catch (err) { setError(err.message); }
  }

  async function remove(id) {
    if (!window.confirm("Remove this team member?")) return;
    try { await teamApi.removeMember(id); await load(); } catch (err) { setError(err.message); }
  }

  return <main className="page-shell">
    <header className="page-header"><div><Link to="/">Dashboard</Link><h1>Team Management</h1></div></header>
    {error && <p className="error">{error}</p>}
    {message && <p className="success">{message}</p>}
    <section className="panel">
      <h2>Add team member</h2>
      <form onSubmit={invite} className="form-grid">
        <input placeholder="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
        <input type="email" placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
        <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}><option value="developer">Developer</option><option value="admin">Admin</option><option value="auditor">Auditor</option></select>
        <button type="submit" className="btn btn-primary">Add member</button>
      </form>
    </section>
    <section className="panel"><h2>Members</h2>{members.map((member) => <div className="list-row" key={member.id}><span>{member.name} ({member.email})</span><select value={member.role} onChange={(e) => changeRole(member.id, e.target.value)}><option>owner</option><option>admin</option><option>developer</option><option>auditor</option></select><button className="btn btn-ghost" onClick={() => remove(member.id)}>Remove</button></div>)}</section>
  </main>;
}
