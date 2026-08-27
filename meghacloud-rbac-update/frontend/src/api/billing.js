import client from "./client";

export async function listInvoices() {
  const { data } = await client.get("/billing/invoices");
  return data.invoices;
}

export async function generateInvoice() {
  const { data } = await client.post("/billing/invoices/generate");
  return data.invoice;
}

export async function payInvoice(id, method) {
  const { data } = await client.post(`/billing/invoices/${id}/pay`, { method });
  return data.invoice;
}

export function invoicePdfUrl(id) {
  const API_URL = import.meta.env.VITE_API_URL || "http://localhost:4000/api";
  return `${API_URL}/billing/invoices/${id}/pdf`;
}
