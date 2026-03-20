import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { BilkaToGoAuthService } from './bilkatogo-auth.service.js';
import { BilkaToGoSearchService } from './bilkatogo-search.service.js';
import { BilkaToGoCartService } from './bilkatogo-cart.service.js';
import { ShoppingListService } from '../shopping-list/shopping-list.service.js';
import type {
  BilkaToGoSendResult,
  BilkaToGoMatchedItem,
  BilkaToGoUnmatchedItem,
} from './interfaces/bilkatogo.interfaces.js';

const CART_URL = 'https://www.bilkatogo.dk/checkout/cart';
const DELAY_BETWEEN_CALLS_MS = 200;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

@Injectable()
export class BilkaToGoOrchestratorService {
  private readonly logger = new Logger(BilkaToGoOrchestratorService.name);

  constructor(
    private readonly authService: BilkaToGoAuthService,
    private readonly searchService: BilkaToGoSearchService,
    private readonly cartService: BilkaToGoCartService,
    private readonly shoppingListService: ShoppingListService,
  ) {}

  async sendToCart(
    shoppingListId: string,
    sessionId: string,
  ): Promise<BilkaToGoSendResult> {
    const cookies = this.authService.getSessionCookies(sessionId);
    if (!cookies) {
      throw new UnauthorizedException('BilkaToGo session expired or invalid');
    }

    const shoppingList =
      await this.shoppingListService.findById(shoppingListId);

    const matched: BilkaToGoMatchedItem[] = [];
    const unmatched: BilkaToGoUnmatchedItem[] = [];

    const uncheckedItems = shoppingList.items.filter((item) => !item.checked);

    for (let i = 0; i < uncheckedItems.length; i++) {
      const item = uncheckedItems[i];

      try {
        const products = await this.searchService.searchProduct(item.name);

        if (products.length === 0) {
          unmatched.push({
            itemName: item.name,
            reason: 'No matching products found',
          });
          continue;
        }

        const product = products[0];
        await this.cartService.addItem(cookies, product.objectID, 1);

        matched.push({
          itemName: item.name,
          quantity: item.quantity,
          unit: item.unit,
          product,
        });

        if (i < uncheckedItems.length - 1) {
          await delay(DELAY_BETWEEN_CALLS_MS);
        }
      } catch (error) {
        this.logger.warn(
          `Failed to process item "${item.name}": ${error instanceof Error ? error.message : String(error)}`,
        );
        unmatched.push({
          itemName: item.name,
          reason: `Error: ${error instanceof Error ? error.message : String(error)}`,
        });
      }
    }

    this.logger.log(
      `Sent to BilkaToGo: ${matched.length} matched, ${unmatched.length} unmatched`,
    );

    return {
      matched,
      unmatched,
      cartUrl: CART_URL,
    };
  }
}
