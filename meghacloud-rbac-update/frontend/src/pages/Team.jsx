import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import * as teamApi from "../api/team";
import NotificationBell from "../components/NotificationBell";

const ROLES = ["owner", "admin", "developer", "auditor"];

const ROLE_STYLES = {
  owner: { bg: "#EFF6FF", color: "#1D4ED8" },
  admin: { bg: "#F0FDF4", color: "#15803D" },
  developer: { bg: "#FEFCE8", color: "#A16207" },
  auditor: { bg: "#F3F4F6", color: "#6B7280" },
};

export default function Team() {
  const { user, logout } = useAuth();
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState(null);

  const [showInvite, setShowInvite] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("developer");
  const [inviting, setInviting] = useState(false);
  const [tempPassword, setTempPassword] = useState(null);

  const canManage = user?.role === "owner" || user?.role === "admin";
  const canChangeRoles = user?.role === "owner";

  useEffect(() => {
    refresh();
  }, []);

  async function refresh() {
    setLoading(true);
    setError("");
    try {
      setMembers(await teamApi.listTeam());
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleInvite(e) {
    e.preventDefault();
    setError("");
    setInviting(true);
    try {
      const { member, tempPassword } = await teamApi.inviteMember({ name, email, role });
      setMembers((prev) => [...prev, member]);
      setTempPassword({ email: member.email, password: tempPassword });
      setName("");
      setEmail("");
      setRole("developer");
      setShowInvite(false);
    } catch (err) {
      setError(err.message);
    } finally {
      setInviting(false);
    }
  }

  async function handleRoleChange(id, newRole) {
    setBusyId(id);
    setError("");
    try {
      const updated = await teamApi.updateMemberRole(id, newRole);
      setMembers((prev) => prev.map((m) => (m.id === id ? updated : m)));
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyId(null);
    }
  }

  async function handleRemove(id, memberName) {
    if (!window.confirm(`Remove ${memberName} from the team?`)) return;
    setBusyId(id);
    setError("");
    try {
      await teamApi.removeMember(id);
      setMembers((prev) => prev.filter((m) => m.id !== id));
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark">☁</span>
          <span className="brand-name">MeghaCloud</span>
        </div>
        <nav className="topnav">
          <Link to="/" className="btn btn-ghost">Dashboard</Link>
          <Link to="/monitoring" className="btn btn-ghost">Monitoring</Link>
          <Link to="/billing" className="btn btn-ghost">Billing</Link>
          <Link to="/settings" className="btn btn-ghost">Settings</Link>
          <NotificationBell />
          <button className="btn btn-ghost" onClick={logout}>Logout</button>
        </nav>
      </header>

      <main className="content content--wide">
        <div className="page-header">
          <div>
            <h1>Team</h1>
            <p className="subtitle">Who has access to this MeghaCloud account, and what they can do.</p>
          </div>
          {canManage && (
            <button className="btn btn-primary" onClick={() => setShowInvite((v) => !v)}>
              + Add Team Member
            </button>
          )}
        </div>

        {error && <div className="form-error">{error}</div>}

        {tempPassword && (
          <div className="card" style={{ borderLeft: "4px solid #16A34A", marginBottom: 16 }}>
            <p>
              Added <strong>{tempPassword.email}</strong>. Temporary password (share this with them,
              they should change it after logging in):
            </p>
            <code style={{ fontSize: 16 }}>{tempPassword.password}</code>
            <div style={{ marginTop: 8 }}>
              <button className="btn-link" onClick={() => setTempPassword(null)}>Dismiss</button>
            </div>
          </div>
        )}

        {showInvite && (
          <div className="card" style={{ marginBottom: 16 }}>
            <h2>Add Team Member</h2>
            <form onSubmit={handleInvite} className="profile-form">
              <label>
                Name
                <input value={name} onChange={(e) => setName(e.target.value)} required />
              </label>
              <label>
                Email
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
              </label>
              <label>
                Role
                <select value={role} onChange={(e) => setRole(e.target.value)}>
                  {ROLES.filter((r) => r !== "owner" || user?.role === "owner").map((r) => (
                    <option key={r} value={r}>{r[0].toUpperCase() + r.slice(1)}</option>
                  ))}
                </select>
              </label>
              <button className="btn btn-primary" type="submit" disabled={inviting}>
                {inviting ? "Adding…" : "Add Member"}
              </button>
            </form>
          </div>
        )}

        <div className="card card--table">
          <h2>Members</h2>

          {loading ? (
            <p className="text-muted">Loading team…</p>
          ) : (
            <table className="server-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Role</th>
                  {(canManage || canChangeRoles) && <th>Actions</th>}
                </tr>
              </thead>
              <tbody>
                {members.map((m) => {
                  const style = ROLE_STYLES[m.role];
                  const isBusy = busyId === m.id;
                  const isSelf = m.id === user?.id;
                  return (
                    <tr key={m.id}>
                      <td>{m.name}{isSelf && <span className="text-muted"> (you)</span>}</td>
                      <td>{m.email}</td>
                      <td>
                        {canChangeRoles && !isSelf ? (
                          <select
                            value={m.role}
                            disabled={isBusy}
                            onChange={(e) => handleRoleChange(m.id, e.target.value)}
                          >
                            {ROLES.map((r) => (
                              <option key={r} value={r}>{r[0].toUpperCase() + r.slice(1)}</option>
                            ))}
                          </select>
                        ) : (
                          <span className="status-pill" style={{ background: style.bg, color: style.color }}>
                            {m.role[0].toUpperCase() + m.role.slice(1)}
                          </span>
                        )}
                      </td>
                      {(canManage || canChangeRoles) && (
                        <td className="action-cell">
                          {canManage && !isSelf && m.role !== "owner" && (
                            <button
                              className="btn-link btn-link--danger"
                              disabled={isBusy}
                              onClick={() => handleRemove(m.id, m.name)}
                            >
                              Remove
                            </button>
                          )}
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        <p className="text-muted" style={{ marginTop: 12 }}>
          <strong>Owner</strong> — full access incl. billing & team. <strong>Admin</strong> — manage
          servers, billing, team. <strong>Developer</strong> — manage servers, view billing.{" "}
          <strong>Auditor</strong> — read-only across everything.
        </p>
      </main>
    </div>
  );
}
