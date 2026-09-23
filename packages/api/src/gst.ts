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
      ...(input.note === undefined ? {} : { note: input.note }),
    },
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
export function supplierFromEnv(env: Readonly<Record<string, string | undefined>>): Supplier | null {
  const legalName = env["PARIKSHAA_SUPPLIER_NAME"] ?? "";
  const gstin = (env["PARIKSHAA_SUPPLIER_GSTIN"] ?? "").toUpperCase();
  if (legalName === "" && gstin === "") return null;
  if (!validGstin(gstin)) throw new Error("PARIKSHAA_SUPPLIER_GSTIN is not a valid GSTIN");
  const address = env["PARIKSHAA_SUPPLIER_ADDRESS"] ?? "";
  if (legalName === "" || address === "") throw new Error("PARIKSHAA_SUPPLIER_NAME and PARIKSHAA_SUPPLIER_ADDRESS are both needed with a GSTIN");
  return { legalName, gstin, address, sac: env["PARIKSHAA_SUPPLIER_SAC"] ?? "998399" };
}
