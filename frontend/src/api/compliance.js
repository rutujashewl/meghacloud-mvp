import client from "./client";

export async function getCompliance() {
  const { data } = await client.get("/compliance");
  return data;
}
