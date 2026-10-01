/**
 * GST, as a tax invoice for Parikshaa's service needs it (ROADMAP §12).
 *
 * One supply, of one service, at 18%: within the supplier's own state it is
 * split into CGST and SGST at 9% each; to a buyer in another state it is IGST
 * at 18%. The place of supply for a service to a business is where the buyer
 * is registered; for a buyer with no state on record, it is the supplier's.
 * Amounts are integer paise throughout, rounded half up, once per tax.
 */

/** GST state and union-territory codes, as the first two digits of a GSTIN carry them. */
export const STATES: Readonly<Record<string, string>> = {
  "01": "Jammu and Kashmir",
  "02": "Himachal Pradesh",
  "03": "Punjab",
  "04": "Chandigarh",
  "05": "Uttarakhand",
  "06": "Haryana",
  "07": "Delhi",
  "08": "Rajasthan",
  "09": "Uttar Pradesh",
  "10": "Bihar",
  "11": "Sikkim",
  "12": "Arunachal Pradesh",
  "13": "Nagaland",
  "14": "Manipur",
  "15": "Mizoram",
  "16": "Tripura",
  "17": "Meghalaya",
  "18": "Assam",
  "19": "West Bengal",
  "20": "Jharkhand",
  "21": "Odisha",
  "22": "Chhattisgarh",
  "23": "Madhya Pradesh",
  "24": "Gujarat",
  "26": "Dadra and Nagar Haveli and Daman and Diu",
  "27": "Maharashtra",
  "29": "Karnataka",
  "30": "Goa",
  "31": "Lakshadweep",
  "32": "Kerala",
  "33": "Tamil Nadu",
  "34": "Puducherry",
  "35": "Andaman and Nicobar Islands",
  "36": "Telangana",
  "37": "Andhra Pradesh",
  "38": "Ladakh",
  "97": "Other Territory",
};

export const GST_RATE_PERCENT = 18;

const GSTIN_CHARS = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";

/**
 * A GSTIN's shape and its check character (the last), computed the way the
 * GST network does: a weighted sum of the first fourteen characters in base 36.
 */
export function validGstin(gstin: string): boolean {
  if (!/^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/.test(gstin)) return false;
  if (STATES[gstin.slice(0, 2)] === undefined) return false;
  let sum = 0;
  for (let i = 0; i < 14; i += 1) {
    const product = GSTIN_CHARS.indexOf(gstin[i]!) * (i % 2 === 0 ? 1 : 2);
    sum += Math.floor(product / 36) + (product % 36);
  }
  return GSTIN_CHARS[(36 - (sum % 36)) % 36] === gstin[14];
}

/** `rate`% of `paise`, rounded half up. */
const percent = (paise: number, rate: number) => Math.floor((paise * rate + 50) / 100);

export interface Taxes {
  readonly intraState: boolean;
  readonly cgstPaise: number;
  readonly sgstPaise: number;
  readonly igstPaise: number;
  readonly taxPaise: number;
  readonly totalPaise: number;
}

export function taxesOn(taxablePaise: number, supplierState: string, buyerState: string | null): Taxes {
  const intraState = (buyerState ?? supplierState) === supplierState;
  const half = GST_RATE_PERCENT / 2;
  const cgstPaise = intraState ? percent(taxablePaise, half) : 0;
  const sgstPaise = intraState ? percent(taxablePaise, half) : 0;
  const igstPaise = intraState ? 0 : percent(taxablePaise, GST_RATE_PERCENT);
  const taxPaise = cgstPaise + sgstPaise + igstPaise;
  return { intraState, cgstPaise, sgstPaise, igstPaise, taxPaise, totalPaise: taxablePaise + taxPaise };
}

const ONES = [
  "", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten",
  "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen",
];
const TENS = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

function belowHundred(n: number): string {
  return n < 20 ? ONES[n]! : `${TENS[Math.floor(n / 10)]}${n % 10 === 0 ? "" : ` ${ONES[n % 10]}`}`;
}

function belowThousand(n: number): string {
  const hundreds = Math.floor(n / 100);
  const rest = n % 100;
  return [hundreds > 0 ? `${ONES[hundreds]} Hundred` : "", rest > 0 ? belowHundred(rest) : ""].filter(Boolean).join(" ");
}

/** A whole number in words, grouped the Indian way: crore, lakh, thousand. */
export function inWords(n: number): string {
  if (n === 0) return "Zero";
  const parts: string[] = [];
  const crore = Math.floor(n / 10_000_000);
  const lakh = Math.floor((n % 10_000_000) / 100_000);
  const thousand = Math.floor((n % 100_000) / 1000);
  const rest = n % 1000;
  if (crore > 0) parts.push(`${inWords(crore)} Crore`);
  if (lakh > 0) parts.push(`${belowHundred(lakh)} Lakh`);
  if (thousand > 0) parts.push(`${belowHundred(thousand)} Thousand`);
  if (rest > 0) parts.push(belowThousand(rest));
  return parts.join(" ");
}

/** `Rupees One Thousand One Hundred Eighty and Fifty Paise Only`. */
export function rupeesInWords(paise: number): string {
  const rupees = Math.floor(paise / 100);
  const rest = paise % 100;
  return `Rupees ${inWords(rupees)}${rest > 0 ? ` and ${inWords(rest)} Paise` : ""} Only`;
}

/** Who issues the invoice: Parikshaa's operator, from the environment. */
export interface Supplier {
  readonly legalName: string;
  readonly gstin: string;
  readonly address: string;
  /** Services Accounting Code for the supply. */
  readonly sac: string;
}

export const stateOf = (gstin: string): string => gstin.slice(0, 2);

export interface Buyer {
  readonly legalName: string;
  readonly gstin: string | null;
  readonly stateCode: string | null;
  readonly address: string;
}

export interface InvoiceLine {
  readonly description: string;
  readonly quantity: number;
  readonly ratePaise: number;
}

/**
 * Everything printed on a tax invoice (CGST Rules, r.46), fixed at issue:
 * the supplier and buyer as they were that day, the place of supply, each
 * line with its SAC, the taxable value, each tax at its rate, and the total
 * in figures and in words.
 */
export function taxInvoice(input: {
  readonly number: string;
  readonly issuedAt: Date;
  readonly supplier: Supplier;
  readonly buyer: Buyer;
  readonly lines: readonly InvoiceLine[];
  readonly note?: string;
  /** Section 194J: what the buyer deducts at source, on the value before GST. */
  readonly tdsPercent?: number;
}): { document: Record<string, unknown>; totalPaise: number } {
  const supplierState = stateOf(input.supplier.gstin);
  const placeOfSupply = input.buyer.stateCode ?? supplierState;
  const lines = input.lines.map((l) => ({ ...l, sac: input.supplier.sac, amountPaise: l.quantity * l.ratePaise }));
  const taxablePaise = lines.reduce((sum, l) => sum + l.amountPaise, 0);
  const taxes = taxesOn(taxablePaise, supplierState, input.buyer.stateCode);
  const half = GST_RATE_PERCENT / 2;
  return {
    totalPaise: taxes.totalPaise,
    document: {
      title: "Tax Invoice",
      number: input.number,
      date: new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium" }).format(input.issuedAt),
      supplier: { ...input.supplier, state: STATES[supplierState] ?? supplierState, stateCode: supplierState },
      buyer: {
        legalName: input.buyer.legalName,
        gstin: input.buyer.gstin,
        address: input.buyer.address,
        state: input.buyer.stateCode === null ? null : (STATES[input.buyer.stateCode] ?? input.buyer.stateCode),
        stateCode: input.buyer.stateCode,
      },
      placeOfSupply: { code: placeOfSupply, state: STATES[placeOfSupply] ?? placeOfSupply },
      reverseCharge: false,
      lines,
      taxablePaise,
      taxes: taxes.intraState
        ? [
            { name: "CGST", ratePercent: half, amountPaise: taxes.cgstPaise },
            { name: "SGST", ratePercent: half, amountPaise: taxes.sgstPaise },
          ]
        : [{ name: "IGST", ratePercent: GST_RATE_PERCENT, amountPaise: taxes.igstPaise }],
      totalPaise: taxes.totalPaise,
      totalInWords: rupeesInWords(taxes.totalPaise),
      ...(input.tdsPercent === undefined || input.tdsPercent === 0 ? {} : { tds: tdsOn(taxablePaise, taxes.totalPaise, input.tdsPercent) }),
      ...(input.note === undefined ? {} : { note: input.note }),
    },
  };
}

/**
 * A tax invoice for a sale whose price already includes GST, as a learner's
 * plan is sold: the tax is the price's 18/118 share, rounded once, and split
 * into CGST and SGST (the odd paisa to SGST) unless the buyer's state differs
 * from the supplier's, when it is IGST. The total is always what was paid.
 */
export function inclusiveInvoice(input: {
  readonly number: string;
  readonly issuedAt: Date;
  readonly supplier: Supplier;
  readonly buyer: Buyer;
  readonly description: string;
  readonly totalPaise: number;
  readonly taxPaise: number;
  readonly note?: string;
}): { document: Record<string, unknown>; totalPaise: number } {
  const supplierState = stateOf(input.supplier.gstin);
  const placeOfSupply = input.buyer.stateCode ?? supplierState;
  const intraState = placeOfSupply === supplierState;
  const half = GST_RATE_PERCENT / 2;
  const taxablePaise = input.totalPaise - input.taxPaise;
  const cgst = Math.floor(input.taxPaise / 2);
  return {
    totalPaise: input.totalPaise,
    document: {
      title: "Tax Invoice",
      number: input.number,
      date: new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium" }).format(input.issuedAt),
      supplier: { ...input.supplier, state: STATES[supplierState] ?? supplierState, stateCode: supplierState },
      buyer: {
        legalName: input.buyer.legalName,
        gstin: input.buyer.gstin,
        address: input.buyer.address,
        state: input.buyer.stateCode === null ? null : (STATES[input.buyer.stateCode] ?? input.buyer.stateCode),
        stateCode: input.buyer.stateCode,
      },
      placeOfSupply: { code: placeOfSupply, state: STATES[placeOfSupply] ?? placeOfSupply },
      reverseCharge: false,
      lines: [{ description: input.description, quantity: 1, ratePaise: taxablePaise, sac: input.supplier.sac, amountPaise: taxablePaise }],
      taxablePaise,
      taxes: intraState
        ? [
            { name: "CGST", ratePercent: half, amountPaise: cgst },
            { name: "SGST", ratePercent: half, amountPaise: input.taxPaise - cgst },
          ]
        : [{ name: "IGST", ratePercent: GST_RATE_PERCENT, amountPaise: input.taxPaise }],
      totalPaise: input.totalPaise,
      totalInWords: rupeesInWords(input.totalPaise),
      ...(input.note === undefined ? {} : { note: input.note }),
    },
  };
}

/**
 * TDS under section 194J: the buyer deducts it from what they pay, on the
 * value before GST (CBDT circular 23/2017, where GST is shown separately),
 * and pays it to the government in the supplier's name. The invoice says
 * what to deduct and what to pay.
 */
export function tdsOn(taxablePaise: number, totalPaise: number, ratePercent: number) {
  const amountPaise = percent(taxablePaise, ratePercent);
  return { section: "194J", ratePercent, amountPaise, netPayablePaise: totalPaise - amountPaise };
}

/**
 * A GST credit note (section 34, CGST Rules r.53) against a tax invoice:
 * what is credited back, taxed as the invoice was — same place of supply,
 * same split — and naming the invoice it reduces.
 */
export function creditNote(input: {
  readonly number: string;
  readonly issuedAt: Date;
  readonly supplier: Supplier;
  readonly buyer: Buyer;
  readonly original: { readonly number: string; readonly date: string };
  readonly description: string;
  readonly quantity: number;
  readonly taxablePaise: number;
  readonly taxPaise: number;
  readonly reason: string;
}): { document: Record<string, unknown>; totalPaise: number } {
  const supplierState = stateOf(input.supplier.gstin);
  const placeOfSupply = input.buyer.stateCode ?? supplierState;
  const intraState = placeOfSupply === supplierState;
  const half = GST_RATE_PERCENT / 2;
  // The tax was split when the amount was fixed; halves for CGST and SGST, the odd paisa to SGST.
  const cgst = Math.floor(input.taxPaise / 2);
  const totalPaise = input.taxablePaise + input.taxPaise;
  return {
    totalPaise,
    document: {
      title: "Credit Note",
      number: input.number,
      date: new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium" }).format(input.issuedAt),
      against: input.original,
      reason: input.reason,
      supplier: { ...input.supplier, state: STATES[supplierState] ?? supplierState, stateCode: supplierState },
      buyer: {
        legalName: input.buyer.legalName,
        gstin: input.buyer.gstin,
        address: input.buyer.address,
        state: input.buyer.stateCode === null ? null : (STATES[input.buyer.stateCode] ?? input.buyer.stateCode),
        stateCode: input.buyer.stateCode,
      },
      placeOfSupply: { code: placeOfSupply, state: STATES[placeOfSupply] ?? placeOfSupply },
      reverseCharge: false,
      lines: [
        {
          description: input.description,
          quantity: input.quantity,
          ratePaise: input.quantity === 0 ? 0 : Math.round(input.taxablePaise / input.quantity),
          sac: input.supplier.sac,
          amountPaise: input.taxablePaise,
        },
      ],
      taxablePaise: input.taxablePaise,
      taxes: intraState
        ? [
            { name: "CGST", ratePercent: half, amountPaise: cgst },
            { name: "SGST", ratePercent: half, amountPaise: input.taxPaise - cgst },
          ]
        : [{ name: "IGST", ratePercent: GST_RATE_PERCENT, amountPaise: input.taxPaise }],
      totalPaise,
      totalInWords: rupeesInWords(totalPaise),
    },
  };
}

/** A six-digit PIN code from an address, as the e-invoice schema requires one. */
export const pinOf = (address: string): number | null => {
  const match = /\b([1-9]\d{5})\b/.exec(address);
  return match === null ? null : Number(match[1]);
};

const rupees = (paise: number) => Math.round(paise) / 100;
const ddmmyyyy = (at: Date) => {
  const ist = new Date(at.getTime() + 330 * 60_000);
  return `${String(ist.getUTCDate()).padStart(2, "0")}/${String(ist.getUTCMonth() + 1).padStart(2, "0")}/${ist.getUTCFullYear()}`;
};

export class EInvoiceNotPossible extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EInvoiceNotPossible";
  }
}

/**
 * An invoice or credit note as the e-invoice schema (INV-01, version 1.1)
 * wants it, for the Invoice Registration Portal: upload it there — or through
 * a GST Suvidha Provider — and record the IRN and signed QR it returns. Only
 * a B2B supply is e-invoiced, so the buyer must have a GSTIN.
 */
export function eInvoicePayload(document: Record<string, unknown>, issuedAt: Date): Record<string, unknown> {
  const d = document as {
    title: string;
    number: string;
    supplier: { legalName: string; gstin: string; address: string; stateCode: string };
    buyer: { legalName: string; gstin: string | null; address: string; stateCode: string | null };
    placeOfSupply: { code: string };
    lines: { description: string; quantity: number; ratePaise: number; sac: string; amountPaise: number }[];
    taxablePaise: number;
    taxes: { name: string; ratePercent: number; amountPaise: number }[];
    totalPaise: number;
    against?: { number: string; date: string };
  };
  if (d.buyer.gstin === null) throw new EInvoiceNotPossible("The buyer has no GSTIN: e-invoicing covers business-to-business supplies only");
  const sellerPin = pinOf(d.supplier.address);
  const buyerPin = pinOf(d.buyer.address);
  if (sellerPin === null || buyerPin === null) throw new EInvoiceNotPossible("Both addresses need a six-digit PIN code for the e-invoice");
  const tax = (name: string) => d.taxes.find((t) => t.name === name)?.amountPaise ?? 0;
  const rate = d.taxes.reduce((sum, t) => sum + t.ratePercent, 0);
  const line = (address: string) => address.split(/,|\n/)[0]!.trim().slice(0, 100);
  const place = (address: string) => (address.split(/,|\n/).map((p) => p.trim()).filter(Boolean).at(-2) ?? line(address)).replace(/\d{6}/, "").trim().slice(0, 50) || "India";
  const credit = d.title === "Credit Note";
  return {
    Version: "1.1",
    TranDtls: { TaxSch: "GST", SupTyp: "B2B", RegRev: "N", IgstOnIntra: "N" },
    DocDtls: { Typ: credit ? "CRN" : "INV", No: d.number, Dt: ddmmyyyy(issuedAt) },
    SellerDtls: { Gstin: d.supplier.gstin, LglNm: d.supplier.legalName, Addr1: line(d.supplier.address), Loc: place(d.supplier.address), Pin: sellerPin, Stcd: d.supplier.stateCode },
    BuyerDtls: {
      Gstin: d.buyer.gstin,
      LglNm: d.buyer.legalName,
      Pos: d.placeOfSupply.code,
      Addr1: line(d.buyer.address),
      Loc: place(d.buyer.address),
      Pin: buyerPin,
      Stcd: d.buyer.stateCode ?? d.buyer.gstin.slice(0, 2),
    },
    ItemList: d.lines.map((l, i) => {
      const share = d.taxablePaise === 0 ? 0 : l.amountPaise / d.taxablePaise;
      const igst = rupees(tax("IGST") * share);
      const cgst = rupees(tax("CGST") * share);
      const sgst = rupees(tax("SGST") * share);
      return {
        SlNo: String(i + 1),
        PrdDesc: l.description.slice(0, 300),
        IsServc: "Y",
        HsnCd: l.sac,
        Qty: l.quantity,
        Unit: "OTH",
        UnitPrice: rupees(l.ratePaise),
        TotAmt: rupees(l.amountPaise),
        AssAmt: rupees(l.amountPaise),
        GstRt: rate,
        IgstAmt: igst,
        CgstAmt: cgst,
        SgstAmt: sgst,
        TotItemVal: Math.round((rupees(l.amountPaise) + igst + cgst + sgst) * 100) / 100,
      };
    }),
    ValDtls: {
      AssVal: rupees(d.taxablePaise),
      CgstVal: rupees(tax("CGST")),
      SgstVal: rupees(tax("SGST")),
      IgstVal: rupees(tax("IGST")),
      TotInvVal: rupees(d.totalPaise),
    },
    ...(credit && d.against !== undefined ? { RefDtls: { PrecDocDtls: [{ InvNo: d.against.number, InvDt: d.against.date }] } } : {}),
  };
}

/**
 * The supplier from the environment, or null if it is not set: then nothing
 * can be sold or invoiced, though credits granted are still spent.
 *
 *   PARIKSHAA_SUPPLIER_NAME     the registered legal name
 *   PARIKSHAA_SUPPLIER_GSTIN    checked, check digit included, at boot
 *   PARIKSHAA_SUPPLIER_ADDRESS  the registered address
 *   PARIKSHAA_SUPPLIER_SAC      default 998399 (other professional, technical and business services)
 */
/** Where a bank transfer against a quotation goes: printed on the quotation. */
export interface BankDetails {
  readonly accountName: string;
  readonly accountNumber: string;
  readonly ifsc: string;
  readonly bank: string;
}

export function bankFromEnv(env: Readonly<Record<string, string | undefined>>): BankDetails | null {
  const accountNumber = (env["PARIKSHAA_BANK_ACCOUNT"] ?? "").replace(/\s+/g, "");
  if (accountNumber === "") return null;
  const ifsc = (env["PARIKSHAA_BANK_IFSC"] ?? "").toUpperCase();
  if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(ifsc)) throw new Error("PARIKSHAA_BANK_IFSC is not an IFSC like HDFC0001234");
  if (!/^\d{6,18}$/.test(accountNumber)) throw new Error("PARIKSHAA_BANK_ACCOUNT is not an account number");
  return { accountName: env["PARIKSHAA_BANK_ACCOUNT_NAME"] ?? env["PARIKSHAA_SUPPLIER_NAME"] ?? "", accountNumber, ifsc, bank: env["PARIKSHAA_BANK_NAME"] ?? "" };
}

export function supplierFromEnv(env: Readonly<Record<string, string | undefined>>): Supplier | null {
  const legalName = env["PARIKSHAA_SUPPLIER_NAME"] ?? "";
  const gstin = (env["PARIKSHAA_SUPPLIER_GSTIN"] ?? "").toUpperCase();
  if (legalName === "" && gstin === "") return null;
  if (!validGstin(gstin)) throw new Error("PARIKSHAA_SUPPLIER_GSTIN is not a valid GSTIN");
  const address = env["PARIKSHAA_SUPPLIER_ADDRESS"] ?? "";
  if (legalName === "" || address === "") throw new Error("PARIKSHAA_SUPPLIER_NAME and PARIKSHAA_SUPPLIER_ADDRESS are both needed with a GSTIN");
  return { legalName, gstin, address, sac: env["PARIKSHAA_SUPPLIER_SAC"] ?? "998399" };
}
