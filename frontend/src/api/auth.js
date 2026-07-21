import client from "./client";

export async function register({ name, email, password }) {
  const { data } = await client.post("/auth/register", { name, email, password });
  return data; // { token, user }
}

export async function login({ email, password }) {
  const { data } = await client.post("/auth/login", { email, password });
  return data; // { token, user }
}

export async function googleLogin(credential) {
  const { data } = await client.post("/auth/google", { credential });
  return data; // { token, user }
}

export async function getMe() {
  const { data } = await client.get("/auth/me");
  return data.user;
}

export async function updateMe(updates) {
  const { data } = await client.patch("/auth/me", updates);
  return data.user;
}

export async function changePassword({ currentPassword, newPassword }) {
  const { data } = await client.patch("/auth/password", { currentPassword, newPassword });
  return data;
}

export async function deleteAccount(password) {
  const { data } = await client.delete("/auth/me", { data: { password } });
  return data;
}
