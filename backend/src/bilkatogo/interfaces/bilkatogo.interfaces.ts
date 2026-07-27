export interface BilkaToGoSession {
  cookies: string;
  expiresAt: number;
}

export interface BilkaToGoProduct {
  objectID: string;
  name: string;
  productName: string;
  brand: string;
  price: number; // in øre (cents)
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

/**
 * Why an item could not be added. A stable CODE, not prose: this value is
 * rendered to the user, and a server-side English sentence cannot be translated
 * by the frontend. Any diagnostic detail stays in the server log.
 */
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
