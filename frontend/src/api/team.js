import client from "./client";

export async function listTeam() {
  const { data } = await client.get("/team");
  return data.members;
}

export async function inviteMember(payload) {
  const { data } = await client.post("/team/invite", payload);
  return data;
}

export async function updateMemberRole(id, role) {
  const { data } = await client.patch(`/team/${id}/role`, { role });
  return data.member;
}

export async function removeMember(id) {
  await client.delete(`/team/${id}`);
}
