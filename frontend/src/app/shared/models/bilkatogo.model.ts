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

export interface BilkaToGoUnmatchedItem {
  itemName: string;
  reason: string;
}

export interface BilkaToGoSendResult {
  matched: BilkaToGoMatchedItem[];
  unmatched: BilkaToGoUnmatchedItem[];
  cartUrl: string;
}
