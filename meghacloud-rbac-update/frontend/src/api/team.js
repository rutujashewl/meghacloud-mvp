import client from "./client";

export async function listTeam() {
  const { data } = await client.get("/team");
  return data.members;
}

export async function inviteMember({ name, email, role }) {
  const { data } = await client.post("/team/invite", { name, email, role });
  return data; // { member, tempPassword }
}

export async function updateMemberRole(id, role) {
  const { data } = await client.patch(`/team/${id}/role`, { role });
  return data.member;
}

export async function removeMember(id) {
  await client.delete(`/team/${id}`);
}
