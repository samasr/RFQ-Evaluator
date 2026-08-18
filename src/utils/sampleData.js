// Sample RFQ data for manual testing — the 8-supplier packaging scenario from
// the "Supplier Evaluation Practice Kit" (Al-Majd FMCG Distribution Co., Riyadh).
// Lets you exercise the supplier table, currency normalization, and scoring
// without running the AI extraction or typing 8 rows by hand.

export const SAMPLE_RFQ_HEADER = {
  title: "Packaging Materials RFQ — Al-Majd FMCG Distribution Co.",
  product: "Corrugated cartons (3-ply/5-ply), bubble wrap, stretch film",
  annualVolume: "",
  baseCurrency: "SAR",
  evaluationDate: new Date().toISOString().slice(0, 10),
};

const rawSuppliers = [
  {
    name: "Al-Nakheel Packaging Co.",
    country: "Saudi Arabia",
    currency: "SAR",
    unitPrice: "4.20",
    leadTime: "21",
    paymentTerms: "50% advance",
    moq: "5000",
    sasoStatus: "SASO + ISO",
    deliveryTerms: "DDP",
    portCity: "Riyadh",
    notes:
      "Reliable local supplier. Price excludes VAT. Has supplied us before.",
  },
  {
    name: "Sino Pack International",
    country: "China",
    currency: "CNY",
    unitPrice: "7.80",
    leadTime: "53",
    paymentTerms: "50% advance",
    moq: "10000",
    sasoStatus: "Not stated",
    deliveryTerms: "FOB",
    portCity: "Shenzhen",
    notes:
      "Lead time quoted as 45-60 days (midpoint used). Payment as quoted: T/T 30% deposit, 70% BL copy. Has CE, no SASO mentioned. Need to add freight + customs.",
  },
  {
    name: "Gulf Wrap & Pack LLC",
    country: "UAE",
    currency: "USD",
    unitPrice: "0.95",
    leadTime: "14",
    paymentTerms: "Net 30",
    moq: "3000",
    sasoStatus: "SASO only",
    deliveryTerms: "DAP",
    portCity: "Riyadh",
    notes:
      "Price includes freight to Riyadh but excludes Saudi customs (5%). Strong references in KSA.",
  },
  {
    name: "Al-Rashidi Industrial Pack",
    country: "Saudi Arabia",
    currency: "SAR",
    unitPrice: "3.85",
    leadTime: "32",
    paymentTerms: "100% upfront",
    moq: "20000",
    sasoStatus: "Not stated",
    deliveryTerms: "EXW",
    portCity: "Jeddah",
    notes:
      "Lead time quoted as 28-35 days (midpoint used). Cheapest SAR price but very high MOQ and 100% upfront. No cert info provided.",
  },
  {
    name: "PackTech Egypt",
    country: "Egypt",
    currency: "USD",
    unitPrice: "1.05",
    leadTime: "30",
    paymentTerms: "LC at sight",
    moq: "2000",
    sasoStatus: "ISO only",
    deliveryTerms: "CIF",
    portCity: "Jeddah",
    notes:
      "Payment as quoted: LC at sight or 50% TT. Price is CIF Jeddah — add land freight Jeddah to Riyadh ~SAR 0.30/unit. SASO not certified.",
  },
  {
    name: "Zhejiang Best Carton Co.",
    country: "China",
    currency: "USD",
    unitPrice: "0.78",
    leadTime: "55",
    paymentTerms: "50% advance",
    moq: "15000",
    sasoStatus: "None",
    deliveryTerms: "FOB",
    portCity: "Ningbo",
    notes:
      "Payment as quoted: 30% TT in advance, 70% before shipment. Lowest price but longest lead time. No certs. Buyer flagged communication issues.",
  },
  {
    name: "Al-Wafa Packaging Solutions",
    country: "Saudi Arabia",
    currency: "SAR",
    unitPrice: "4.50",
    leadTime: "10",
    paymentTerms: "Net 60",
    moq: "1000",
    sasoStatus: "SASO + ISO",
    deliveryTerms: "DDP",
    portCity: "Riyadh",
    notes:
      "Premium price, best terms and certs (SASO + ISO 14001 + ISO 9001). Low MOQ. Fastest delivery. Good for urgent orders.",
  },
  {
    name: "IndoPack Manufacturing",
    country: "India",
    currency: "USD",
    unitPrice: "0.88",
    leadTime: "35",
    paymentTerms: "50% advance",
    moq: "8000",
    sasoStatus: "ISO only",
    deliveryTerms: "CFR",
    portCity: "Dammam",
    notes:
      "ISO 9001, BIS certified. Needs SASO compliance check. Price CFR Dammam — add Dammam to Riyadh freight ~SAR 0.45/unit.",
  },
];

export function getSampleSuppliers() {
  return rawSuppliers.map((supplier) => ({ id: crypto.randomUUID(), ...supplier }));
}
