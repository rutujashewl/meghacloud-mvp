import { createContext, useContext, useEffect, useState } from "react";
import * as authApi from "../api/auth";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true); // true while we check for an existing session

  useEffect(() => {
    const token = localStorage.getItem("mc_token");
    if (!token) {
      setLoading(false);
      return;
    }
    authApi
      .getMe()
      .then(setUser)
      .catch(() => {
        // stale/expired token — clear it
        localStorage.removeItem("mc_token");
      })
      .finally(() => setLoading(false));
  }, []);

  function saveSession({ token, user }) {
    localStorage.setItem("mc_token", token);
    setUser(user);
  }

  async function loginWithPassword(email, password) {
    const result = await authApi.login({ email, password });
    saveSession(result);
    return result.user;
  }

  async function registerWithPassword(name, email, password) {
    const result = await authApi.register({ name, email, password });
    saveSession(result);
    return result.user;
  }

  async function loginWithGoogle(credential) {
    const result = await authApi.googleLogin(credential);
    saveSession(result);
    return result.user;
  }

  async function updateProfile(updates) {
    const updated = await authApi.updateMe(updates);
    setUser(updated);
    return updated;
  }

  function logout() {
    localStorage.removeItem("mc_token");
    setUser(null);
  }

  const value = {
    user,
    loading,
    isAuthenticated: !!user,
    loginWithPassword,
    registerWithPassword,
    loginWithGoogle,
    updateProfile,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
