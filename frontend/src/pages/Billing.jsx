import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import client from "../api/client";
import * as billingApi from "../api/billing";
import NotificationBell from "../components/NotificationBell";

const STATUS_STYLES = {
  paid: { bg: "#F0FDF4", color: "#15803D", label: "Paid" },
  pending: { bg: "#FFFBEB", color: "#B45309", label: "Pending" },
};

export default function Billing() {
  const { logout } = useAuth();
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busyId, setBusyId] = useState(null);
  const [generating, setGenerating] = useState(false);
  const [payingId, setPayingId] = useState(null); // invoice id currently showing method picker

  useEffect(() => {
    refresh();
  }, []);

  async function refresh() {
    setLoading(true);
    setError("");
    try {
      setInvoices(await billingApi.listInvoices());
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleGenerate() {
    setGenerating(true);
    setError("");
    setMessage("");
    try {
      const invoice = await billingApi.generateInvoice();
      setInvoices((prev) => [invoice, ...prev]);
      setMessage(`Invoice ${invoice.invoice_number} generated`);
    } catch (err) {
      setError(err.message);
    } finally {
      setGenerating(false);
    }
  }

  async function handlePay(id, method) {
    setBusyId(id);
    setError("");
    setMessage("");
    try {
      const updated = await billingApi.payInvoice(id, method);
      setInvoices((prev) => prev.map((i) => (i.id === id ? updated : i)));
      setMessage(`Payment successful via ${method === "upi" ? "UPI" : "Razorpay"}`);
      setPayingId(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyId(null);
    }
  }

  async function handleDownload(invoice) {
    setError("");
    try {
      const res = await client.get(`/billing/invoices/${invoice.id}/pdf`, { responseType: "blob" });
      const url = window.URL.createObjectURL(new Blob([res.data], { type: "application/pdf" }));
      const link = document.createElement("a");
      link.href = url;
      link.download = `${invoice.invoice_number}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      setError("Could not download invoice PDF");
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
          <button className="btn btn-ghost" onClick={logout}>Logout</button>
        </nav>
      </header>

      <main className="content content--wide">
        <div className="page-header">
          <div>
            <h1>Billing & Invoices</h1>
            <p className="subtitle">Manage your subscription and payment history.</p>
          </div>
          <button className="btn btn-primary" onClick={handleGenerate} disabled={generating}>
            {generating ? "Generating…" : "Generate Invoice"}
          </button>
        </div>

        {message && <div className="form-success">{message}</div>}
        {error && <div className="form-error">{error}</div>}

        <div className="card card--table">
          <h2>Invoices</h2>

          {loading ? (
            <p className="text-muted">Loading invoices…</p>
          ) : invoices.length === 0 ? (
            <div className="empty-state">
              <p>No invoices yet. Generate one from your running servers' monthly cost.</p>
            </div>
          ) : (
            <table className="server-table">
              <thead>
                <tr>
                  <th>Invoice #</th>
                  <th>Date</th>
                  <th>Amount (incl. GST)</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((inv) => {
                  const style = STATUS_STYLES[inv.status];
                  const isBusy = busyId === inv.id;
                  return (
                    <tr key={inv.id}>
                      <td className="server-name">{inv.invoice_number}</td>
                      <td>{inv.created_at?.slice(0, 10)}</td>
                      <td>₹{inv.total_amount.toLocaleString("en-IN")}</td>
                      <td>
                        <span className="status-pill" style={{ background: style.bg, color: style.color }}>
                          ● {style.label}
                        </span>
                      </td>
                      <td className="action-cell">
                        {inv.status === "pending" && payingId !== inv.id && (
                          <button className="btn-link" disabled={isBusy} onClick={() => setPayingId(inv.id)}>
                            Pay Now
                          </button>
                        )}
                        {payingId === inv.id && (
                          <>
                            <button className="btn-link" disabled={isBusy} onClick={() => handlePay(inv.id, "upi")}>
                              Pay via UPI
                            </button>
                            <button className="btn-link" disabled={isBusy} onClick={() => handlePay(inv.id, "razorpay")}>
                              Pay via Razorpay
                            </button>
                            <button className="btn-link btn-link--danger" disabled={isBusy} onClick={() => setPayingId(null)}>
                              Cancel
                            </button>
                          </>
                        )}
                        <button className="btn-link" onClick={() => handleDownload(inv)}>Download PDF</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        <p className="text-muted" style={{ marginTop: 16 }}>
          Payments here are simulated for the MVP demo — no real money moves yet. Live UPI/Razorpay
          integration is a separate milestone requiring production merchant credentials.
        </p>
      </main>
    </div>
  );
}
