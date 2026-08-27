// config/pricing.js
// Simple flat-rate pricing table for v1.0 MVP.
// Phase 4 (Pricing) will formalize this into a proper `pricing_rules` DB table
// with real-time cost breakdown (compute/bandwidth/storage) per TAD Section 12
// (Unit Economics). For now this unblocks Phase 2/3 so the dashboard can show
// a monthly cost per server.

const SIZES = {
  small:  { label: "Small",  vcpu: 1, ram_gb: 1, monthly_inr: 999 },
  medium: { label: "Medium", vcpu: 2, ram_gb: 4, monthly_inr: 2999 },
  large:  { label: "Large",  vcpu: 4, ram_gb: 8, monthly_inr: 5999 },
};

const REGIONS = ["Mumbai"]; // Delhi NCR / Hyderabad phased in later per TAD Section 11.1

const OS_OPTIONS = ["Ubuntu 22.04", "Debian 12", "Ubuntu 24.04", "AlmaLinux 9"];

function priceFor(size) {
  const entry = SIZES[size];
  if (!entry) return null;
  return entry.monthly_inr;
}

module.exports = { SIZES, REGIONS, OS_OPTIONS, priceFor };
