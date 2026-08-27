import client from "./client";

export async function getServerMonitoring(id) {
  const { data } = await client.get(`/servers/${id}/monitoring`);
  return data; // { current, trend, incidents }
}
