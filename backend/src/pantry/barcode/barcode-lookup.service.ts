import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import {
  productFrom,
  type OffProduct,
  type ScannedProduct,
} from './product-from-off.js';

/** Open Food Facts answers this shape; `status` is 1 when it knows the code. */
interface OffResponse {
  status?: number;
  product?: OffProduct;
}

const OFF_BASE = 'https://world.openfoodfacts.org/api/v2/product';
/** Only the fields we read. Asking for the whole product is a megabyte of JSON. */
const FIELDS = 'product_name,generic_name,brands,categories_tags,quantity';
/** A cook is standing in the kitchen holding a tin. Waiting is worse than typing. */
const TIMEOUT_MS = 6000;

/**
 * What a barcode is, according to Open Food Facts.
 *
 * Proxied here rather than called from the browser for two reasons that outlast
 * the convenience: the OFF response shape is theirs to change and the mapping to
 * a pantry shelf is ours to test, and a scan from someone's kitchen should not
 * hand a third party their IP address.
 *
 * A code nobody has heard of is NOT an error — most of a Danish supermarket is
 * missing from an open database, and the honest answer is "no idea, type it in".
 */
@Injectable()
export class BarcodeLookupService {
  private readonly logger = new Logger(BarcodeLookupService.name);

  async lookup(barcode: string): Promise<ScannedProduct | null> {
    const code = barcode.trim();
    // Barcodes are digits. Anything else is a scanner misfire or someone poking
    // the endpoint, and neither should reach a third party as a URL path.
    if (!/^[0-9]{6,14}$/.test(code)) {
      throw new BadRequestException('A barcode is 6 to 14 digits');
    }

    try {
      const response = await fetch(
        `${OFF_BASE}/${code}.json?fields=${FIELDS}`,
        {
          signal: AbortSignal.timeout(TIMEOUT_MS),
          headers: {
            // OFF asks callers to identify themselves so they can tell traffic
            // apart. Being a known caller is what keeps the free API free.
            'User-Agent':
              'AtelierKitchen/1.0 (https://mhylle.com/recipe-manager)',
          },
        },
      );

      // 404 is their answer for "not in the database", which is an ordinary
      // outcome rather than a failure.
      if (!response.ok) {
        return null;
      }

      const body = (await response.json()) as OffResponse;
      if (body.status !== 1 || !body.product) {
        return null;
      }

      return productFrom(code, body.product);
    } catch (error) {
      // A slow or unreachable OFF must not become a 500 in a kitchen. The
      // caller gets "no idea" and the form stays fillable by hand.
      this.logger.warn(
        `Barcode ${code} could not be looked up: ${String(error)}`,
      );
      return null;
    }
  }
}
