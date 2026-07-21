import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import * as authApi from "../api/auth";
import NotificationBell from "../components/NotificationBell";

export default function Profile() {
  const { user, updateProfile, logout } = useAuth();
  const navigate = useNavigate();

  // --- Profile info form ---
  const [name, setName] = useState(user?.name || "");
  const [phone, setPhone] = useState(user?.phone || "");
  const [saving, setSaving] = useState(false);
  const [profileMessage, setProfileMessage] = useState("");
  const [profileError, setProfileError] = useState("");

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);
    setProfileMessage("");
    setProfileError("");
    try {
      await updateProfile({ name, phone });
      setProfileMessage("Profile updated");
    } catch (err) {
      setProfileError(err.message);
    } finally {
      setSaving(false);
    }
  }

  // --- Password change form ---
  const hasPassword = user?.auth_provider !== "google" || user?.has_password;
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState("");
  const [passwordError, setPasswordError] = useState("");

  async function handlePasswordChange(e) {
    e.preventDefault();
    setPasswordMessage("");
    setPasswordError("");

    if (newPassword !== confirmPassword) {
      setPasswordError("New password and confirmation don't match");
      return;
    }

    setChangingPassword(true);
    try {
      await authApi.changePassword({ currentPassword, newPassword });
      setPasswordMessage("Password updated successfully");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      setPasswordError(err.message);
    } finally {
      setChangingPassword(false);
    }
  }

  // --- Delete account ---
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deletePassword, setDeletePassword] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  async function handleDelete(e) {
    e.preventDefault();
    setDeleteError("");
    setDeleting(true);
    try {
      await authApi.deleteAccount(deletePassword);
      logout();
      navigate("/login");
    } catch (err) {
      setDeleteError(err.message);
    } finally {
      setDeleting(false);
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
          <Link to="/" className="btn btn-ghost">← Dashboard</Link>
          <NotificationBell />
          <button className="btn btn-ghost" onClick={logout}>
            Logout
          </button>
        </nav>
      </header>

      <main className="content">
        <h1>Account Settings</h1>
        <p className="subtitle">Manage your profile, security, and account.</p>

        {/* ---------- Profile Information ---------- */}
        <div className="card">
          <h2>Profile Information</h2>
          {profileMessage && <div className="form-success">{profileMessage}</div>}
          {profileError && <div className="form-error">{profileError}</div>}

          <form onSubmit={handleSave} className="profile-form">
            <label>
              Full Name
              <input value={name} onChange={(e) => setName(e.target.value)} required />
            </label>

            <label>
              Phone Number
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+91 98765 43210"
              />
            </label>

            <label>
              Email Address
              <input value={user?.email || ""} disabled />
              <span className="hint">Email cannot be changed for this account.</span>
            </label>

            <label>
              Sign-in Method
              <input
                value={user?.auth_provider === "google" ? "Google Sign-In" : "Email & Password"}
                disabled
              />
            </label>

            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? "Saving…" : "Save Changes"}
            </button>
          </form>
        </div>

        {/* ---------- Password ---------- */}
        <div className="card">
          <h2>{hasPassword ? "Change Password" : "Set a Password"}</h2>
          <p className="text-muted" style={{ marginTop: -12, marginBottom: 16 }}>
            {hasPassword
              ? "Update the password used to sign in with email."
              : "You signed up with Google. Set a password to also enable email/password sign-in."}
          </p>

          {passwordMessage && <div className="form-success">{passwordMessage}</div>}
          {passwordError && <div className="form-error">{passwordError}</div>}

          <form onSubmit={handlePasswordChange} className="profile-form">
            {hasPassword && (
              <label>
                Current Password
                <input
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  required
                />
              </label>
            )}

            <label>
              New Password
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                minLength={8}
                placeholder="At least 8 characters"
                required
              />
            </label>

            <label>
              Confirm New Password
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                minLength={8}
                required
              />
            </label>

            <button type="submit" className="btn btn-primary" disabled={changingPassword}>
              {changingPassword ? "Updating…" : hasPassword ? "Update Password" : "Set Password"}
            </button>
          </form>
        </div>

        {/* ---------- Danger Zone ---------- */}
        <div className="card card--danger">
          <h2>Delete Account</h2>
          <p className="text-muted" style={{ marginTop: -12, marginBottom: 16 }}>
            This permanently deactivates your account. Your servers, billing, and invoice
            history are retained for compliance records but you will no longer be able to
            sign in.
          </p>

          {deleteError && <div className="form-error">{deleteError}</div>}

          {!showDeleteConfirm ? (
            <button className="btn btn-danger" onClick={() => setShowDeleteConfirm(true)}>
              Delete My Account
            </button>
          ) : (
            <form onSubmit={handleDelete} className="profile-form">
              {hasPassword && (
                <label>
                  Confirm your password to continue
                  <input
                    type="password"
                    value={deletePassword}
                    onChange={(e) => setDeletePassword(e.target.value)}
                    required
                  />
                </label>
              )}
              <div style={{ display: "flex", gap: 12 }}>
                <button type="submit" className="btn btn-danger" disabled={deleting}>
                  {deleting ? "Deleting…" : "Confirm Delete"}
                </button>
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => {
                    setShowDeleteConfirm(false);
                    setDeleteError("");
                  }}
                >
                  Cancel
                </button>
              </div>
            </form>
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
