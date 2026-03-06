/**
 * QuickBooks Online — CSV Import Parsers
 *
 * Handles the 4 main QB Online export formats:
 *   Customers  → Customer records
 *   Vendors    → Vendor records
 *   Products   → InventoryItem records
 *   Invoices   → Invoice records (read-only import / reconcile)
 *
 * QB Online exports its CSVs from:
 *   Reports → (Custom report) → Export to CSV
 *   OR Settings → Import Data → (download template for format reference)
 *
 * Each parser:
 *   1. Parses raw CSV text into row objects
 *   2. Maps QB column names → DECORA field names
 *   3. Validates required fields + formats
 *   4. Detects duplicates against existing records
 *   5. Returns QBImportRecord<T>[] with status + errors/warnings
 */

import type {
  Customer, Vendor, InventoryItem, Invoice, InvoiceLineItem,
  CustomerContact, Address,
  QBImportRecord, QBImportSession,
  CustomerType, VendorType, InventoryCategory, Currency,
} from '../types';
import { generateId } from '../utils';
import { inferTaxJurisdiction } from '../types';

// ─── CSV Parsing ──────────────────────────────────────────────────────────────

/**
 * Parses a RFC 4180-compliant CSV string into an array of row objects.
 * Handles quoted fields (including embedded commas + newlines).
 */
export function parseCSV(csv: string): Record<string, string>[] {
  const lines = splitCSVLines(csv);
  if (lines.length < 2) return [];

  const headers = parseCSVRow(lines[0]).map(h => h.trim());
  const rows: Record<string, string>[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const cells = parseCSVRow(line);
    const row: Record<string, string> = {};
    headers.forEach((h, idx) => {
      row[h] = (cells[idx] ?? '').trim();
    });
    rows.push(row);
  }

  return rows;
}

/** Split CSV by lines while respecting quoted fields containing \n */
function splitCSVLines(csv: string): string[] {
  const lines: string[] = [];
  let current = '';
  let inQuote = false;

  for (let i = 0; i < csv.length; i++) {
    const ch = csv[i];
    if (ch === '"') {
      // Check for escaped quote ""
      if (inQuote && csv[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuote = !inQuote;
        current += ch;
      }
    } else if ((ch === '\n' || ch === '\r') && !inQuote) {
      if (ch === '\r' && csv[i + 1] === '\n') i++; // CRLF
      lines.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  if (current) lines.push(current);
  return lines;
}

/** Parse a single CSV row into cells */
function parseCSVRow(row: string): string[] {
  const cells: string[] = [];
  let current = '';
  let inQuote = false;

  for (let i = 0; i < row.length; i++) {
    const ch = row[i];
    if (ch === '"') {
      if (inQuote && row[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuote = !inQuote;
      }
    } else if (ch === ',' && !inQuote) {
      cells.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  cells.push(current);
  return cells;
}

// ─── Utilities ────────────────────────────────────────────────────────────────

function col(row: Record<string, string>, ...keys: string[]): string {
  for (const k of keys) {
    const val = row[k] ?? row[k.toLowerCase()] ?? row[k.toUpperCase()];
    if (val !== undefined && val !== '') return val.trim();
  }
  return '';
}

function colNum(row: Record<string, string>, ...keys: string[]): number {
  const v = col(row, ...keys);
  const n = parseFloat(v.replace(/[$,\s]/g, ''));
  return isNaN(n) ? 0 : n;
}

function parseQBDate(v: string): string {
  // QBO exports dates as MM/DD/YYYY or YYYY-MM-DD
  if (!v) return new Date().toISOString().split('T')[0];
  if (v.includes('/')) {
    const [m, d, y] = v.split('/');
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }
  return v; // already ISO
}

function parseYN(v: string): boolean {
  return /^(yes|true|1|y)$/i.test(v.trim());
}

function mapCurrency(v: string): Currency {
  const supported: Currency[] = ['CAD', 'USD', 'EUR', 'GBP', 'MXN', 'AUD', 'CHF', 'SEK', 'NOK', 'DKK'];
  const upper = v.toUpperCase() as Currency;
  return supported.includes(upper) ? upper : 'CAD';
}

function normalizePaymentTerms(v: string): string {
  if (!v) return 'Net 30';
  const map: Record<string, string> = {
    'due on receipt': 'Net 0',
    'net 10': 'Net 10',
    'net 15': 'Net 15',
    'net 30': 'Net 30',
    'net 45': 'Net 45',
    'net 60': 'Net 60',
    'net 90': 'Net 90',
    '1% 10 net 30': '1% 10 Net 30',
    '2% 10 net 30': '2% 10 Net 30',
    'cod': 'COD',
    'prepaid': 'Prepaid',
  };
  return map[v.toLowerCase()] ?? v;
}

function parseQBAddress(row: Record<string, string>, prefix: string): Address {
  return {
    street: col(row, `${prefix} Line 1`, `${prefix}Line1`, `${prefix} Street`),
    city:   col(row, `${prefix} City`, `${prefix}City`),
    state:  col(row, `${prefix} State`, `${prefix}Province`, `${prefix}State`),
    zip:    col(row, `${prefix} Zip`, `${prefix} Postal Code`, `${prefix}PostalCode`),
    country: col(row, `${prefix} Country`, `${prefix}Country`) || 'CA',
  };
}

// ─── QB Customer Column Map ───────────────────────────────────────────────────
//
// QB Online customer CSV headers (as of 2025):
//   Customer, Company, Display Name, First Name, Last Name,
//   Email, Phone, Mobile, Fax, Website,
//   Billing Address Line 1, Billing City, Billing State, Billing Zip, Billing Country,
//   Shipping Address Line 1, Shipping City, Shipping State, Shipping Zip, Shipping Country,
//   Notes, Terms, Is Taxable, Tax Code, Balance, Currency, Customer Type,
//   Account No, Resale No, QB Customer ID (internal)

export function importQBCustomers(
  csvText: string,
  existingCustomers: Customer[],
): QBImportRecord<Partial<Customer>>[] {
  const rows = parseCSV(csvText);
  const results: QBImportRecord<Partial<Customer>>[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowNum = i + 2; // 1-based + header row
    const errors: string[] = [];
    const warnings: string[] = [];

    // ── Required fields ──
    const name = col(row, 'Customer', 'Company', 'Display Name', 'Full Name');
    if (!name) { errors.push('Missing customer name'); }

    const email   = col(row, 'Email', 'Main Email');
    const phone   = col(row, 'Phone', 'Main Phone', 'Work Phone');
    const mobile  = col(row, 'Mobile', 'Mobile Phone');
    const terms   = normalizePaymentTerms(col(row, 'Terms', 'Payment Terms'));
    const currency = mapCurrency(col(row, 'Currency') || 'CAD');
    const balance  = colNum(row, 'Balance', 'Open Balance');
    const taxable  = col(row, 'Is Taxable', 'IsTaxable');
    const taxExempt = taxable !== '' ? !parseYN(taxable) : false;
    const accountNo = col(row, 'Account No', 'AccountNo', 'Customer No');
    const notes     = col(row, 'Notes', 'Memo', 'Customer Message');
    const qbCustomerId = col(row, 'QB Customer ID', 'ListID', 'Id');

    // QB CustomerType mapping
    const qbType = col(row, 'Customer Type', 'CustomerType').toLowerCase();
    const typeMap: Record<string, CustomerType> = {
      commercial: 'commercial', industrial: 'industrial', retail: 'retail',
      government: 'government', wholesale: 'wholesale',
    };
    const customerType: CustomerType = typeMap[qbType] ?? 'commercial';

    // Addresses
    const billing  = parseQBAddress(row, 'Billing Address');
    const shipping  = parseQBAddress(row, 'Shipping Address');
    if (!billing.street && !billing.city) {
      warnings.push('No billing address — defaulting to empty');
    }

    // Duplicate detection: match by QB ID or name (case-insensitive)
    const dupByQbId = qbCustomerId
      ? existingCustomers.find(c => c.qbCustomerId === qbCustomerId)
      : undefined;
    const dupByName = existingCustomers.find(
      c => c.name.toLowerCase() === name.toLowerCase()
    );
    const dup = dupByQbId ?? dupByName;

    // Build contacts array from QB's flat email/phone fields
    const contacts: CustomerContact[] = [];
    const firstName = col(row, 'First Name', 'FirstName');
    const lastName  = col(row, 'Last Name', 'LastName');
    const contactName = [firstName, lastName].filter(Boolean).join(' ') || name;

    if (email || phone || mobile) {
      contacts.push({
        id: generateId(),
        name: contactName,
        email: email || undefined,
        phone: phone || mobile || undefined,
        isPrimary: true,
      });
    }

    const jurisdiction = inferTaxJurisdiction(
      billing.country || 'CA',
      billing.state,
      taxExempt,
      false, // conservative default — user can update
    );

    const data: Partial<Customer> = {
      id: dup?.id ?? generateId(),
      name,
      type: customerType,
      status: 'active',
      accountNumber: accountNo || `QB-${(i + 1).toString().padStart(4, '0')}`,
      taxExempt,
      taxId: col(row, 'Tax ID', 'TaxId', 'Resale No') || undefined,
      creditLimit: 0,
      currentBalance: balance,
      paymentTerms: terms,
      currency: currency as 'CAD' | 'USD',
      contacts,
      billingAddress: billing,
      shippingAddress: shipping.street ? shipping : billing,
      notes: notes || undefined,
      tags: [],
      totalRevenue: 0,
      jobCount: 0,
      avgJobValue: 0,
      taxJurisdiction: jurisdiction,
      isB2B: customerType !== 'retail',
      vatNumber: col(row, 'VAT Number', 'VATNumber') || undefined,
      qbCustomerId: qbCustomerId || undefined,
      qbSyncedAt: new Date().toISOString(),
      qbSyncStatus: 'synced',
      createdAt: dup?.createdAt ?? new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    results.push({
      row: rowNum,
      data,
      status: errors.length > 0 ? 'error' : dup ? (dupByQbId ? 'update' : 'duplicate') : 'new',
      existingId: dup?.id,
      errors,
      warnings,
    });
  }

  return results;
}

// ─── QB Vendor Column Map ─────────────────────────────────────────────────────
//
// QB Online vendor CSV headers:
//   Vendor, Company, Display Name, First Name, Last Name,
//   Email, Phone, Mobile, Fax, Website,
//   Address Line 1, City, State, Zip, Country,
//   Account No, Notes, Terms, Currency, Tax ID,
//   Is 1099 Vendor, QB Vendor ID

export type VendorImportType = Pick<Vendor,
  'id' | 'name' | 'accountNumber' | 'type' | 'status' | 'country' | 'currency' |
  'contacts' | 'billingAddress' | 'paymentTerms' | 'chargesGst' | 'gstHstNumber' |
  'vatNumber' | 'usEin' | 'notes' | 'tags' | 'qbVendorId' | 'qbSyncedAt' |
  'createdAt' | 'updatedAt'
>;

export function importQBVendors(
  csvText: string,
  existingVendors: Vendor[],
): QBImportRecord<Partial<Vendor>>[] {
  const rows = parseCSV(csvText);
  const results: QBImportRecord<Partial<Vendor>>[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowNum = i + 2;
    const errors: string[] = [];
    const warnings: string[] = [];

    const name = col(row, 'Vendor', 'Company', 'Display Name', 'Full Name');
    if (!name) { errors.push('Missing vendor name'); }

    const email    = col(row, 'Email', 'Main Email');
    const phone    = col(row, 'Phone', 'Main Phone');
    const terms    = normalizePaymentTerms(col(row, 'Terms', 'Payment Terms'));
    const currency = mapCurrency(col(row, 'Currency') || 'CAD');
    const taxId    = col(row, 'Tax ID', 'TaxId', 'Business Number');
    const is1099   = parseYN(col(row, 'Is 1099 Vendor', 'Track1099'));
    const qbVendorId = col(row, 'QB Vendor ID', 'ListID', 'Id');
    const country  = col(row, 'Country', 'Address Country') || 'CA';
    const accountNo = col(row, 'Account No', 'AccountNo', 'Vendor No');

    // Auto-detect vendor type from tax ID and country
    let vendorType: VendorType = 'supplier';
    if (is1099) vendorType = 'contractor';
    if (col(row, 'Vendor Type', 'VendorType').toLowerCase().includes('broker')) vendorType = 'customs_broker';

    // Determine GST registration
    // QB stores Canadian GST numbers in Tax ID field — BN9 format
    const isCanadian = country === 'CA';
    const isGSTRegistered = isCanadian && !!taxId && /^\d{9}/.test(taxId.replace(/[-\s]/g, ''));

    // Address — QB vendors have a single address (billing)
    const address = parseQBAddress(row, 'Address');
    if (!address.street) warnings.push('No address provided');

    // Duplicate detection
    const dupByQbId = qbVendorId ? existingVendors.find(v => v.qbVendorId === qbVendorId) : undefined;
    const dupByName = existingVendors.find(v => v.name.toLowerCase() === name.toLowerCase());
    const dup = dupByQbId ?? dupByName;

    const contacts: CustomerContact[] = [];
    const firstName = col(row, 'First Name');
    const lastName  = col(row, 'Last Name');
    const contactName = [firstName, lastName].filter(Boolean).join(' ') || name;
    if (email || phone) {
      contacts.push({
        id: generateId(),
        name: contactName,
        email: email || undefined,
        phone: phone || undefined,
        isPrimary: true,
      });
    }

    const data: Partial<Vendor> = {
      id: dup?.id ?? generateId(),
      name,
      accountNumber: accountNo || undefined,
      type: vendorType,
      status: 'active',
      country,
      currency,
      contacts,
      billingAddress: address,
      paymentTerms: terms,
      chargesGst: isGSTRegistered,
      gstHstNumber: isGSTRegistered ? taxId : undefined,
      usEin: !isCanadian && is1099 ? taxId : undefined,
      notes: col(row, 'Notes', 'Memo') || undefined,
      tags: [],
      qbVendorId: qbVendorId || undefined,
      qbSyncedAt: new Date().toISOString(),
      createdAt: dup?.createdAt ?? new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    results.push({
      row: rowNum,
      data,
      status: errors.length > 0 ? 'error' : dup ? (dupByQbId ? 'update' : 'duplicate') : 'new',
      existingId: dup?.id,
      errors,
      warnings,
    });
  }

  return results;
}

// ─── QB Products/Services Column Map ─────────────────────────────────────────
//
// QB Online Products & Services CSV headers:
//   Name, Type, Description, Price/Rate, Cost, Quantity On Hand,
//   Inventory Asset Account, Income Account, Expense Account,
//   Preferred Vendor, Unit of Measure, SKU, Sales Tax Code, Notes,
//   QB Item ID

const QB_ITEM_CATEGORY_MAP: Record<string, InventoryCategory> = {
  powder: 'powder',
  'powder coat': 'powder',
  paint: 'powder',
  primer: 'powder',
  chemical: 'chemical',
  'chemical treatment': 'chemical',
  solvent: 'chemical',
  film: 'transfer_paper',
  transfer: 'transfer_paper',
  sublimation: 'sublimation_ink',
  abrasive: 'consumable',
  blast: 'consumable',
  consumable: 'consumable',
  packaging: 'packaging',
  safety: 'consumable',
  ppe: 'consumable',
  part: 'equipment_part',
  component: 'equipment_part',
  equipment: 'equipment_part',
  tool: 'equipment_part',
};

function inferInventoryCategory(name: string, desc: string): InventoryCategory {
  const combined = `${name} ${desc}`.toLowerCase();
  for (const [keyword, cat] of Object.entries(QB_ITEM_CATEGORY_MAP)) {
    if (combined.includes(keyword)) return cat;
  }
  return 'consumable';
}

export function importQBProducts(
  csvText: string,
  existingItems: InventoryItem[],
): QBImportRecord<Partial<InventoryItem>>[] {
  const rows = parseCSV(csvText);
  const results: QBImportRecord<Partial<InventoryItem>>[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowNum = i + 2;
    const errors: string[] = [];
    const warnings: string[] = [];

    const name = col(row, 'Name', 'Product/Service');
    if (!name) { errors.push('Missing product name'); }

    const desc       = col(row, 'Description', 'Sales Description', 'Purchase Description');
    const sku        = col(row, 'SKU', 'Sku') || name.replace(/\s+/g, '-').toUpperCase().slice(0, 20);
    const unitCost   = colNum(row, 'Cost', 'Purchase Price', 'Unit Cost');
    const unitPrice  = colNum(row, 'Price/Rate', 'Price', 'Unit Price', 'Rate');
    const qtyOnHand  = colNum(row, 'Quantity On Hand', 'QTY On Hand', 'Qty On Hand');
    const unit       = col(row, 'Unit of Measure', 'Unit', 'UOM') || 'each';
    const qbItemId   = col(row, 'QB Item ID', 'ListID', 'Id');
    const qbType     = col(row, 'Type', 'Item Type').toLowerCase();
    const supplier   = col(row, 'Preferred Vendor', 'Supplier');
    const suppPartNo = col(row, 'Supplier Part No', 'Mfr Part Number', 'Vendor Part Number');

    // Only import inventory items (not service items)
    if (qbType === 'service' || qbType === 'non-inventory') {
      warnings.push(`Item type "${qbType}" skipped — only inventory items are imported`);
      results.push({ row: rowNum, data: { name }, status: 'error', errors: [], warnings });
      continue;
    }

    const category = inferInventoryCategory(name, desc);

    // Duplicate detection — by QB ID, then by SKU, then by name
    const dupByQbId  = qbItemId ? existingItems.find(it => it.qbItemId === qbItemId) : undefined;
    const dupBySku   = existingItems.find(it => it.sku.toLowerCase() === sku.toLowerCase());
    const dupByName  = existingItems.find(it => it.name.toLowerCase() === name.toLowerCase());
    const dup = dupByQbId ?? dupBySku ?? dupByName;

    if (qtyOnHand < 0) warnings.push('Negative quantity on hand — verify stock levels');

    const data: Partial<InventoryItem> = {
      id: dup?.id ?? generateId(),
      sku,
      name,
      description: desc || undefined,
      category,
      unit,
      quantityOnHand: qtyOnHand,
      quantityAllocated: 0,
      reorderPoint: 0,
      reorderQty: 0,
      unitCost,
      location: '',
      supplier: supplier || undefined,
      supplierPartNumber: suppPartNo || undefined,
      active: true,
      qbItemId: qbItemId || undefined,
      qbSyncedAt: new Date().toISOString(),
      createdAt: dup?.createdAt ?? new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // Include unit price in notes if present (no price field on InventoryItem)
    if (unitPrice > 0 && !data.notes) {
      data.notes = `QB Sales Price: $${unitPrice.toFixed(2)}`;
    }

    results.push({
      row: rowNum,
      data,
      status: errors.length > 0 ? 'error' : dup ? (dupByQbId ? 'update' : 'duplicate') : 'new',
      existingId: dup?.id,
      errors,
      warnings,
    });
  }

  return results;
}

// ─── QB Invoice Column Map ────────────────────────────────────────────────────
//
// QB Online Invoice CSV export headers (Reports > A/R Aging or Invoice List):
//   Invoice No, Customer, Invoice Date, Due Date, Terms,
//   Line# or Product/Service, Description, Qty, Rate, Amount, Tax,
//   Subtotal, Tax Amount, Total, Balance Due, Status, Currency, Memo

export function importQBInvoices(
  csvText: string,
  existingInvoices: Invoice[],
  existingCustomers: Customer[],
): QBImportRecord<Partial<Invoice>>[] {
  const rows = parseCSV(csvText);
  const results: QBImportRecord<Partial<Invoice>>[] = [];

  // Group rows by invoice number (multi-line invoices appear as multiple rows)
  const invoiceGroups = new Map<string, Record<string, string>[]>();
  for (const row of rows) {
    const invNo = col(row, 'Invoice No', 'Num', 'InvoiceNo', 'Transaction No');
    if (!invNo) continue;
    if (!invoiceGroups.has(invNo)) invoiceGroups.set(invNo, []);
    invoiceGroups.get(invNo)!.push(row);
  }

  let rowOffset = 2;
  for (const [invNo, invRows] of invoiceGroups) {
    const firstRow = invRows[0];
    const errors: string[] = [];
    const warnings: string[] = [];

    const customerName = col(firstRow, 'Customer', 'Customer Name');
    if (!customerName) errors.push('Missing customer name');
    if (!invNo) errors.push('Missing invoice number');

    const issueDate = parseQBDate(col(firstRow, 'Invoice Date', 'Date', 'Txn Date'));
    const dueDate   = parseQBDate(col(firstRow, 'Due Date', 'DueDate'));
    const memo      = col(firstRow, 'Memo', 'Message', 'Customer Message');
    const statusRaw = col(firstRow, 'Status', 'Invoice Status').toLowerCase();
    const balance   = colNum(firstRow, 'Balance Due', 'Open Balance', 'Balance');

    type InvoiceStatus = Invoice['status'];
    const statusMap: Record<string, InvoiceStatus> = {
      paid: 'paid',
      unpaid: 'sent',
      overdue: 'overdue',
      voided: 'void',
      void: 'void',
      draft: 'draft',
      partially: 'partial',
      'partially paid': 'partial',
    };
    const status: InvoiceStatus = statusMap[statusRaw] ?? 'sent';

    // Match to existing customer
    const customer = existingCustomers.find(
      c => c.name.toLowerCase() === customerName.toLowerCase()
    );
    if (!customer) warnings.push(`Customer "${customerName}" not found — import customer first`);

    // Line items
    const lineItems: InvoiceLineItem[] = invRows.map((lr, idx) => {
      const itemName = col(lr, 'Product/Service', 'Item', 'Service', 'Description');
      const desc     = col(lr, 'Description', 'Item Description');
      const qty      = colNum(lr, 'Qty', 'Quantity', 'Hours');
      const rate     = colNum(lr, 'Rate', 'Unit Price', 'Price', 'Price/Rate');
      const amount   = colNum(lr, 'Amount', 'Line Amount');
      return {
        id: generateId(),
        description: desc || itemName || `Line ${idx + 1}`,
        quantity: qty || 1,
        unitPrice: rate,
        unit: 'each',
        discount: 0,
        amount: amount || (qty * rate),
      };
    });

    const subtotal    = colNum(firstRow, 'Subtotal', 'Sub Total');
    const taxAmount   = colNum(firstRow, 'Tax Amount', 'Tax', 'GST/HST');
    const totalAmount = colNum(firstRow, 'Total', 'Invoice Total', 'Amount');

    // Computed fallbacks
    const computedSubtotal = subtotal || lineItems.reduce((s, l) => s + (l.amount ?? 0), 0);
    const computedTotal    = totalAmount || computedSubtotal + taxAmount;

    // Duplicate detection — by invoice number
    const dup = existingInvoices.find(
      inv => inv.invoiceNumber.toLowerCase() === invNo.toLowerCase()
    );

    const data: Partial<Invoice> = {
      id: dup?.id ?? generateId(),
      invoiceNumber: invNo,
      customerId: customer?.id ?? '',
      customerName,
      jobIds: dup?.jobIds ?? [],
      status,
      issueDate,
      dueDate,
      lineItems,
      subtotal: computedSubtotal,
      discountAmount: 0,
      taxRate: computedSubtotal > 0 ? taxAmount / computedSubtotal : 0,
      taxAmount,
      total: computedTotal,
      amountPaid: computedTotal - balance,
      balance,
      payments: dup?.payments ?? [],
      notes: memo || undefined,
      createdBy: 'qb_import',
      createdAt: dup?.createdAt ?? new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    results.push({
      row: rowOffset,
      data,
      status: errors.length > 0 ? 'error' : dup ? 'update' : 'new',
      existingId: dup?.id,
      errors,
      warnings,
    });

    rowOffset += invRows.length;
  }

  return results;
}

// ─── Auto-detect QB CSV Type ──────────────────────────────────────────────────

export type QBCSVType = 'customers' | 'vendors' | 'products' | 'invoices' | 'unknown';

/**
 * Sniffs the first header row of a QB CSV and returns the entity type.
 * Used to auto-select the correct parser in the import wizard.
 */
export function detectQBCSVType(csvText: string): QBCSVType {
  const firstLine = csvText.split(/\r?\n/)[0].toLowerCase();
  if (firstLine.includes('invoice no') || firstLine.includes('invoice date') ||
      firstLine.includes('txn date') || firstLine.includes('due date')) return 'invoices';
  if (firstLine.includes('quantity on hand') || firstLine.includes('price/rate') ||
      firstLine.includes('income account') || (firstLine.includes('sku') && firstLine.includes('cost'))) return 'products';
  if (firstLine.includes('account no') && (firstLine.includes('vendor') || firstLine.includes('is 1099'))) return 'vendors';
  if (firstLine.includes('customer') || firstLine.includes('is taxable') || firstLine.includes('billing address')) return 'customers';
  return 'unknown';
}

// ─── Session Factory ──────────────────────────────────────────────────────────

export function buildImportSession(
  type: QBImportSession['type'],
  filename: string,
  records: QBImportRecord<unknown>[],
  userId: string,
): QBImportSession {
  return {
    id: generateId(),
    type,
    filename,
    totalRows: records.length,
    newCount:    records.filter(r => r.status === 'new').length,
    updateCount: records.filter(r => r.status === 'update').length,
    skipCount:   records.filter(r => r.status === 'duplicate').length,
    errorCount:  records.filter(r => r.status === 'error').length,
    completedAt: undefined,
    importedBy: userId,
  };
}
