import type {
  CanadianProvince, ProvinceTaxInfo, CustomerCurrency,
  Currency, TaxJurisdiction, Vendor,
} from '../types';
import { QB_TAX_CODE, JURISDICTION_RATE, inferTaxJurisdiction } from '../types';

// ─── Province Tax Rates (2025) ────────────────────────────────────────────────

export const PROVINCE_TAX: Record<CanadianProvince, ProvinceTaxInfo> = {
  ON: { province: 'ON', label: 'Ontario',                        gstRate: 0,    pstRate: 0,      hstRate: 0.13,  totalRate: 0.13 },
  BC: { province: 'BC', label: 'British Columbia',               gstRate: 0.05, pstRate: 0.07,                   totalRate: 0.12 },
  AB: { province: 'AB', label: 'Alberta',                        gstRate: 0.05, pstRate: 0,                      totalRate: 0.05 },
  QC: { province: 'QC', label: 'Quebec',                         gstRate: 0.05, pstRate: 0,      qstRate: 0.09975, totalRate: 0.14975 },
  NS: { province: 'NS', label: 'Nova Scotia',                    gstRate: 0,    pstRate: 0,      hstRate: 0.15,  totalRate: 0.15 },
  NB: { province: 'NB', label: 'New Brunswick',                  gstRate: 0,    pstRate: 0,      hstRate: 0.15,  totalRate: 0.15 },
  NL: { province: 'NL', label: 'Newfoundland & Labrador',        gstRate: 0,    pstRate: 0,      hstRate: 0.15,  totalRate: 0.15 },
  PE: { province: 'PE', label: 'Prince Edward Island',           gstRate: 0,    pstRate: 0,      hstRate: 0.15,  totalRate: 0.15 },
  MB: { province: 'MB', label: 'Manitoba',                       gstRate: 0.05, pstRate: 0.07,                   totalRate: 0.12 },
  SK: { province: 'SK', label: 'Saskatchewan',                   gstRate: 0.05, pstRate: 0.06,                   totalRate: 0.11 },
  NT: { province: 'NT', label: 'Northwest Territories',          gstRate: 0.05, pstRate: 0,                      totalRate: 0.05 },
  NU: { province: 'NU', label: 'Nunavut',                        gstRate: 0.05, pstRate: 0,                      totalRate: 0.05 },
  YT: { province: 'YT', label: 'Yukon',                         gstRate: 0.05, pstRate: 0,                      totalRate: 0.05 },
};

export const CA_PROVINCES: Array<{ code: CanadianProvince; label: string }> = [
  { code: 'AB', label: 'Alberta' },
  { code: 'BC', label: 'British Columbia' },
  { code: 'MB', label: 'Manitoba' },
  { code: 'NB', label: 'New Brunswick' },
  { code: 'NL', label: 'Newfoundland & Labrador' },
  { code: 'NS', label: 'Nova Scotia' },
  { code: 'NT', label: 'Northwest Territories' },
  { code: 'NU', label: 'Nunavut' },
  { code: 'ON', label: 'Ontario' },
  { code: 'PE', label: 'Prince Edward Island' },
  { code: 'QC', label: 'Quebec' },
  { code: 'SK', label: 'Saskatchewan' },
  { code: 'YT', label: 'Yukon' },
];

export const US_STATES: Array<{ code: string; label: string }> = [
  { code: 'AL', label: 'Alabama' }, { code: 'AK', label: 'Alaska' }, { code: 'AZ', label: 'Arizona' },
  { code: 'AR', label: 'Arkansas' }, { code: 'CA', label: 'California' }, { code: 'CO', label: 'Colorado' },
  { code: 'CT', label: 'Connecticut' }, { code: 'DE', label: 'Delaware' }, { code: 'FL', label: 'Florida' },
  { code: 'GA', label: 'Georgia' }, { code: 'HI', label: 'Hawaii' }, { code: 'ID', label: 'Idaho' },
  { code: 'IL', label: 'Illinois' }, { code: 'IN', label: 'Indiana' }, { code: 'IA', label: 'Iowa' },
  { code: 'KS', label: 'Kansas' }, { code: 'KY', label: 'Kentucky' }, { code: 'LA', label: 'Louisiana' },
  { code: 'ME', label: 'Maine' }, { code: 'MD', label: 'Maryland' }, { code: 'MA', label: 'Massachusetts' },
  { code: 'MI', label: 'Michigan' }, { code: 'MN', label: 'Minnesota' }, { code: 'MS', label: 'Mississippi' },
  { code: 'MO', label: 'Missouri' }, { code: 'MT', label: 'Montana' }, { code: 'NE', label: 'Nebraska' },
  { code: 'NV', label: 'Nevada' }, { code: 'NH', label: 'New Hampshire' }, { code: 'NJ', label: 'New Jersey' },
  { code: 'NM', label: 'New Mexico' }, { code: 'NY', label: 'New York' }, { code: 'NC', label: 'North Carolina' },
  { code: 'ND', label: 'North Dakota' }, { code: 'OH', label: 'Ohio' }, { code: 'OK', label: 'Oklahoma' },
  { code: 'OR', label: 'Oregon' }, { code: 'PA', label: 'Pennsylvania' }, { code: 'RI', label: 'Rhode Island' },
  { code: 'SC', label: 'South Carolina' }, { code: 'SD', label: 'South Dakota' }, { code: 'TN', label: 'Tennessee' },
  { code: 'TX', label: 'Texas' }, { code: 'UT', label: 'Utah' }, { code: 'VT', label: 'Vermont' },
  { code: 'VA', label: 'Virginia' }, { code: 'WA', label: 'Washington' }, { code: 'WV', label: 'West Virginia' },
  { code: 'WI', label: 'Wisconsin' }, { code: 'WY', label: 'Wyoming' }, { code: 'DC', label: 'Washington D.C.' },
];

// ─── Tax Rate Lookup ──────────────────────────────────────────────────────────

export interface TaxRates {
  gstRate: number;
  pstRate: number;
  qstRate: number;
  hstRate: number;
  totalRate: number;
  label: string;
  breakdown: string; // e.g. "HST 13%" or "GST 5% + PST 7%"
}

export function getTaxRates(deliveryCountry: string, deliveryStateProvince: string): TaxRates {
  // US or international: no Canadian taxes
  if (deliveryCountry !== 'CA') {
    return { gstRate: 0, pstRate: 0, qstRate: 0, hstRate: 0, totalRate: 0, label: 'No Canadian Tax', breakdown: 'Export — 0%' };
  }

  const prov = PROVINCE_TAX[deliveryStateProvince as CanadianProvince];
  if (!prov) {
    // Default to GST only if province not recognized
    return { gstRate: 0.05, pstRate: 0, qstRate: 0, hstRate: 0, totalRate: 0.05, label: 'GST', breakdown: 'GST 5%' };
  }

  const hst = prov.hstRate ?? 0;
  const qst = prov.qstRate ?? 0;
  let breakdown = '';
  if (hst > 0) {
    breakdown = `HST ${(hst * 100).toFixed(0)}%`;
  } else if (qst > 0) {
    breakdown = `GST ${(prov.gstRate * 100).toFixed(0)}% + QST ${(qst * 100).toFixed(3)}%`;
  } else {
    const parts = [];
    if (prov.gstRate > 0) parts.push(`GST ${(prov.gstRate * 100).toFixed(0)}%`);
    if (prov.pstRate > 0) parts.push(`PST ${(prov.pstRate * 100).toFixed(0)}%`);
    breakdown = parts.join(' + ') || '0%';
  }

  return {
    gstRate: prov.gstRate,
    pstRate: prov.pstRate,
    qstRate: qst,
    hstRate: hst,
    totalRate: prov.totalRate,
    label: prov.label,
    breakdown,
  };
}

// ─── Formatting ───────────────────────────────────────────────────────────────

export function formatPostalCode(code: string): string {
  const clean = code.replace(/\s/g, '').toUpperCase();
  if (clean.length === 6 && /^[A-Z]\d[A-Z]\d[A-Z]\d$/.test(clean)) {
    return `${clean.slice(0, 3)} ${clean.slice(3)}`;
  }
  return code.toUpperCase();
}

export function formatCAD(amount: number, decimals = 2): string {
  return new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD', minimumFractionDigits: decimals, maximumFractionDigits: decimals }).format(amount);
}

export function formatUSD(amount: number, decimals = 2): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: decimals, maximumFractionDigits: decimals }).format(amount);
}

export function formatCurrencyByCode(amount: number, currency: CustomerCurrency = 'CAD', decimals = 2): string {
  return currency === 'USD' ? formatUSD(amount, decimals) : formatCAD(amount, decimals);
}

// ─── Address Helpers ──────────────────────────────────────────────────────────

export function getStateProvinceOptions(country: string): Array<{ code: string; label: string }> {
  if (country === 'CA') return CA_PROVINCES;
  if (country === 'US') return US_STATES;
  return [];
}

export function getStateProvinceLabel(country: string): string {
  if (country === 'CA') return 'Province';
  if (country === 'US') return 'State';
  return 'Region';
}

export function getZipLabel(country: string): string {
  if (country === 'CA') return 'Postal Code';
  if (country === 'US') return 'ZIP Code';
  return 'Postal Code';
}

export const COUNTRIES = [
  { code: 'CA', label: '🇨🇦 Canada' },
  { code: 'US', label: '🇺🇸 United States' },
  { code: 'GB', label: '🇬🇧 United Kingdom' },
  { code: 'AU', label: '🇦🇺 Australia' },
  { code: 'DE', label: '🇩🇪 Germany' },
  { code: 'FR', label: '🇫🇷 France' },
  { code: 'NL', label: '🇳🇱 Netherlands' },
  { code: 'IT', label: '🇮🇹 Italy' },
  { code: 'ES', label: '🇪🇸 Spain' },
  { code: 'SE', label: '🇸🇪 Sweden' },
  { code: 'NO', label: '🇳🇴 Norway' },
  { code: 'DK', label: '🇩🇰 Denmark' },
  { code: 'CH', label: '🇨🇭 Switzerland' },
  { code: 'MX', label: '🇲🇽 Mexico' },
  { code: 'JP', label: '🇯🇵 Japan' },
  { code: 'CN', label: '🇨🇳 China' },
  { code: 'KR', label: '🇰🇷 South Korea' },
  { code: 'IN', label: '🇮🇳 India' },
  { code: 'BR', label: '🇧🇷 Brazil' },
  { code: 'ZA', label: '🇿🇦 South Africa' },
  { code: 'Other', label: '🌐 Other' },
];

// ─── QB Tax Code Resolution ────────────────────────────────────────────────────

/**
 * Get the QB Online Canada tax code string for a given jurisdiction.
 * This is what gets sent to the QBO API as TxnTaxDetail.TxnTaxCodeRef.
 */
export function getQBTaxCode(jurisdiction: TaxJurisdiction): string {
  return QB_TAX_CODE[jurisdiction] ?? 'OUT OF SCOPE';
}

/**
 * Get the effective tax rate for invoice calculations.
 * Note: For CA_QC, returns the combined rate; QB handles the split internally.
 */
export function getEffectiveTaxRate(jurisdiction: TaxJurisdiction): number {
  return JURISDICTION_RATE[jurisdiction] ?? 0;
}

/**
 * Resolve a customer's tax jurisdiction from their billing address.
 * Use this when creating/editing invoices to pre-fill the tax code.
 */
export function resolveCustomerJurisdiction(
  country: string,
  stateProvince: string,
  taxExempt: boolean,
  isB2B = true,
): TaxJurisdiction {
  return inferTaxJurisdiction(country, stateProvince, taxExempt, isB2B);
}

// ─── EU VAT Validation ────────────────────────────────────────────────────────

const EU_VAT_PATTERNS: Record<string, RegExp> = {
  AT: /^ATU\d{8}$/,
  BE: /^BE0\d{9}$/,
  BG: /^BG\d{9,10}$/,
  CY: /^CY\d{8}[A-Z]$/,
  CZ: /^CZ\d{8,10}$/,
  DE: /^DE\d{9}$/,
  DK: /^DK\d{8}$/,
  EE: /^EE\d{9}$/,
  ES: /^ES[A-Z0-9]\d{7}[A-Z0-9]$/,
  FI: /^FI\d{8}$/,
  FR: /^FR[A-Z0-9]{2}\d{9}$/,
  GB: /^GB(\d{9}|\d{12}|GD\d{3}|HA\d{3})$/, // UK (post-Brexit still same format)
  GR: /^EL\d{9}$/,
  HR: /^HR\d{11}$/,
  HU: /^HU\d{8}$/,
  IE: /^IE\d[A-Z0-9+*]\d{5}[A-Z]{1,2}$/,
  IT: /^IT\d{11}$/,
  LT: /^LT(\d{9}|\d{12})$/,
  LU: /^LU\d{8}$/,
  LV: /^LV\d{11}$/,
  MT: /^MT\d{8}$/,
  NL: /^NL\d{9}B\d{2}$/,
  PL: /^PL\d{10}$/,
  PT: /^PT\d{9}$/,
  RO: /^RO\d{2,10}$/,
  SE: /^SE\d{12}$/,
  SI: /^SI\d{8}$/,
  SK: /^SK\d{10}$/,
};

/**
 * Validate EU/UK VAT number format.
 * Returns true if format is valid, false otherwise.
 * Does NOT do live VIES lookup (requires backend).
 */
export function validateVATNumber(vatNumber: string): { valid: boolean; countryCode?: string; message: string } {
  const clean = vatNumber.replace(/\s/g, '').toUpperCase();
  if (!clean || clean.length < 4) {
    return { valid: false, message: 'VAT number too short' };
  }
  const countryCode = clean.slice(0, 2);
  const pattern = EU_VAT_PATTERNS[countryCode];
  if (!pattern) {
    return { valid: false, message: `Unknown country prefix: ${countryCode}` };
  }
  if (!pattern.test(clean)) {
    return { valid: false, countryCode, message: `Invalid format for ${countryCode} VAT number` };
  }
  return { valid: true, countryCode, message: 'Valid format' };
}

/**
 * Validate Canadian GST/HST registration number.
 * Format: 9-digit BN + "RT" + 4-digit account number (e.g. 123456789RT0001)
 * Or just the 9-digit BN for display purposes.
 */
export function validateGSTNumber(gstNumber: string): { valid: boolean; message: string } {
  const clean = gstNumber.replace(/\s|-/g, '').toUpperCase();
  // Full format with RT account: 123456789RT0001
  if (/^\d{9}RT\d{4}$/.test(clean)) {
    return { valid: true, message: 'Valid GST/HST number (full format)' };
  }
  // BN only: 9 digits
  if (/^\d{9}$/.test(clean)) {
    return { valid: true, message: 'Valid Business Number (add RT0001 for full GST#)' };
  }
  return { valid: false, message: 'GST/HST number must be 9-digit BN or 9-digit BN + RT + 4 digits' };
}

/**
 * Validate US EIN format: XX-XXXXXXX
 */
export function validateUSEIN(ein: string): { valid: boolean; message: string } {
  const clean = ein.replace(/\s|-/g, '');
  if (/^\d{9}$/.test(clean)) {
    return { valid: true, message: 'Valid EIN format' };
  }
  return { valid: false, message: 'EIN must be 9 digits (XX-XXXXXXX)' };
}

// ─── Multi-Currency Formatting ────────────────────────────────────────────────

/** Format amount in any supported currency */
export function formatByCurrency(amount: number, currency: Currency = 'CAD', decimals = 2): string {
  const localeMap: Partial<Record<Currency, string>> = {
    CAD: 'en-CA', USD: 'en-US', EUR: 'de-DE', GBP: 'en-GB',
    MXN: 'es-MX', AUD: 'en-AU', CHF: 'de-CH',
    SEK: 'sv-SE', NOK: 'nb-NO', DKK: 'da-DK',
  };
  const locale = localeMap[currency] ?? 'en-CA';
  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(decimals)}`;
  }
}

/** Extended formatCurrencyByCode to handle all Currency values */
export function formatCurrencyFull(
  amount: number,
  currency: Currency | CustomerCurrency = 'CAD',
  decimals = 2,
): string {
  return formatByCurrency(amount, currency as Currency, decimals);
}

// ─── Brokerage / Customs Helpers ─────────────────────────────────────────────

/** Common HS codes used by powder coating / finishing shops */
export const COMMON_HS_CODES = [
  { code: '3208.20', description: 'Paints/varnishes based on acrylic/vinyl polymers' },
  { code: '3208.90', description: 'Other paints/varnishes (incl. powder coatings)' },
  { code: '3209.10', description: 'Paints/varnishes based on acrylic/vinyl, aqueous' },
  { code: '7610.90', description: 'Aluminum structures / architectural aluminum' },
  { code: '7308.90', description: 'Steel structures and parts' },
  { code: '8302.10', description: 'Hinges, brackets, and mounting hardware' },
  { code: '3926.90', description: 'Other articles of plastics (masking caps/plugs)' },
  { code: '5603.94', description: 'Nonwovens (masking materials, wipers)' },
  { code: '8421.39', description: 'Filtering/purifying machinery (powder recovery)' },
  { code: '8514.40', description: 'Microwave/induction industrial heating equipment (cure ovens)' },
];

/** Common Incoterms with descriptions */
export const INCOTERM_OPTIONS = [
  { code: 'EXW', label: 'EXW — Ex Works',             description: 'Buyer arranges all transport from seller\'s premises' },
  { code: 'FCA', label: 'FCA — Free Carrier',         description: 'Seller delivers to named carrier' },
  { code: 'FOB', label: 'FOB — Free On Board',        description: 'Seller loads goods on ship; buyer pays ocean + import' },
  { code: 'CFR', label: 'CFR — Cost & Freight',       description: 'Seller pays ocean freight; buyer pays import duties' },
  { code: 'CIF', label: 'CIF — Cost, Insurance & Freight', description: 'Seller pays freight + insurance; buyer pays duties' },
  { code: 'CPT', label: 'CPT — Carriage Paid To',     description: 'Seller pays freight to named destination' },
  { code: 'CIP', label: 'CIP — Carriage & Insurance Paid', description: 'Seller pays freight + insurance to destination' },
  { code: 'DAP', label: 'DAP — Delivered At Place',   description: 'Seller delivers to named place; buyer pays import duties' },
  { code: 'DPU', label: 'DPU — Delivered at Place Unloaded', description: 'Seller unloads at named destination' },
  { code: 'DDP', label: 'DDP — Delivered Duty Paid',  description: 'Seller pays all costs including import duties (highest seller risk)' },
  { code: 'FAS', label: 'FAS — Free Alongside Ship',  description: 'Seller delivers alongside vessel; buyer pays loading + freight' },
];

// ─── Vendor Tax Helpers ───────────────────────────────────────────────────────

/**
 * Determine if ITC (Input Tax Credit) can be claimed on a vendor invoice.
 * Canadian businesses can claim ITCs on GST/HST paid to GST-registered vendors.
 */
export function canClaimITC(vendor: Vendor, invoiceCountry: string): boolean {
  // Only for Canadian vendors who are GST/HST registered
  if (invoiceCountry !== 'CA') return false;
  return vendor.chargesGst && !!vendor.gstHstNumber;
}
