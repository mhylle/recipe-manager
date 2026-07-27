export interface BilkaToGoProduct {
  objectID: string;
  name: string;
  productName: string;
  brand: string;
  price: number;
  units: number;
  netcontent: string;
  isInStock: number;
}

export interface BilkaToGoMatchedItem {
  itemName: string;
  quantity: number;
  unit: string;
  product: BilkaToGoProduct;
}

/** Mirrors the backend union — a code the UI translates, not server-side prose. */
export type BilkaToGoUnmatchedReason = 'noMatch' | 'error';

export interface BilkaToGoUnmatchedItem {
  itemName: string;
  reason: BilkaToGoUnmatchedReason;
}

export interface BilkaToGoSendResult {
  matched: BilkaToGoMatchedItem[];
  unmatched: BilkaToGoUnmatchedItem[];
  cartUrl: string;
}
