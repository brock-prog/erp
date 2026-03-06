/**
 * BarcodeUtils.ts
 * Pure encode/decode utilities for CoatPro barcode system.
 *
 * Barcode value format: TYPE:entity_id
 *   INV:inv01         → inventory item
 *   RCV:rcv-001       → receipt (received goods)
 *   SHP:shp-001       → outbound shipment
 *   JOB:j3            → job traveler
 *   JO:jo-001         → job order (scan-in queue)
 */

import type { BarcodeLabel, InventoryItem, Receipt, Shipment, Job } from '../types';

export type BarcodePrefix = 'INV' | 'RCV' | 'SHP' | 'JOB' | 'JO';

export interface DecodedBarcode {
  prefix: BarcodePrefix;
  entityId: string;
  raw: string;
}

/**
 * Encode an entity into a barcode string.
 */
export function encodeBarcode(prefix: BarcodePrefix, entityId: string): string {
  return `${prefix}:${entityId}`;
}

/**
 * Decode a scanned barcode string into prefix + entity ID.
 * Returns null if the format is not recognised.
 */
export function decodeBarcode(raw: string): DecodedBarcode | null {
  const parts = raw.trim().split(':');
  if (parts.length < 2) return null;
  const prefix = parts[0].toUpperCase() as BarcodePrefix;
  const entityId = parts.slice(1).join(':');
  if (!['INV', 'RCV', 'SHP', 'JOB', 'JO'].includes(prefix)) return null;
  return { prefix, entityId, raw };
}

/**
 * Build a label data object for an InventoryItem.
 */
export function buildInventoryLabel(item: InventoryItem): BarcodeLabel {
  return {
    type: 'inventory_item',
    code: encodeBarcode('INV', item.id),
    line1: item.name,
    line2: `SKU: ${item.sku}${item.colorCode ? '  |  Color: ' + item.colorCode : ''}`,
    line3: `Loc: ${item.location || '—'}  |  ${item.quantityOnHand} ${item.unit}`,
    colorSwatch: item.colorHex,
    quantity: `${item.quantityOnHand} ${item.unit}`,
  };
}

/**
 * Build a label data object for a Receipt (received goods).
 */
export function buildReceiptLabel(receipt: Receipt): BarcodeLabel {
  const firstItem = receipt.items[0];
  return {
    type: 'received_goods',
    code: encodeBarcode('RCV', receipt.id),
    line1: `Receipt ${receipt.receiptNumber}`,
    line2: receipt.vendorName ?? receipt.customerName ?? 'Unknown Vendor',
    line3: firstItem ? `${firstItem.quantityReceived} ${firstItem.unit} – ${firstItem.description}` : '',
  };
}

/**
 * Build a label data object for an outbound Shipment.
 */
export function buildShipmentLabel(shipment: Shipment): BarcodeLabel {
  return {
    type: 'outbound_shipment',
    code: encodeBarcode('SHP', shipment.id),
    line1: `Shipment ${shipment.shipmentNumber}`,
    line2: shipment.customerName,
    line3: `${shipment.carrier.toUpperCase()}  |  ${shipment.totalBoxes} box(es)`,
  };
}

/**
 * Build a label data object for a Job traveler.
 */
export function buildJobLabel(job: Job): BarcodeLabel {
  return {
    type: 'job_traveler',
    code: encodeBarcode('JOB', job.id),
    line1: `Job ${job.jobNumber}`,
    line2: job.customerName,
    line3: `${job.serviceType.replace('_', ' ')} | ${job.status.toUpperCase()}`,
  };
}

/**
 * Generate a sequential ID with a prefix and zero-padded number.
 * e.g. generateId('jo', 5) → 'jo-005'
 */
export function generateId(prefix: string, seq: number): string {
  return `${prefix}-${String(seq).padStart(3, '0')}`;
}

/**
 * Generate a human-readable order number.
 * e.g. generateOrderNumber('JO', 2026, 1) → 'JO-2026-0001'
 */
export function generateOrderNumber(prefix: string, year: number, seq: number): string {
  return `${prefix}-${year}-${String(seq).padStart(4, '0')}`;
}
