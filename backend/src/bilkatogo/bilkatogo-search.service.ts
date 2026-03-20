/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import type { BilkaToGoProduct } from './interfaces/bilkatogo.interfaces.js';

const ALGOLIA_APP_ID = 'F9VBJLR1BK';
const ALGOLIA_API_KEY = '1deaf41c87e729779f7695c00f190cc9';
const ALGOLIA_INDEX = 'prod_BILKATOGO_PRODUCTS';
const ALGOLIA_ENDPOINT = `https://f9vbjlr1bk-dsn.algolia.net/1/indexes/*/queries`;

@Injectable()
export class BilkaToGoSearchService {
  private readonly logger = new Logger(BilkaToGoSearchService.name);

  constructor(private readonly httpService: HttpService) {}

  async searchProduct(query: string): Promise<BilkaToGoProduct[]> {
    const params = new URLSearchParams({
      query,
      hitsPerPage: '5',
      attributesToRetrieve:
        'objectID,name,productName,brand,price,units,netcontent,isInStock',
    }).toString();

    const response = await firstValueFrom(
      this.httpService.post(
        ALGOLIA_ENDPOINT,
        {
          requests: [
            {
              indexName: ALGOLIA_INDEX,
              params,
            },
          ],
        },
        {
          headers: {
            'x-algolia-application-id': ALGOLIA_APP_ID,
            'x-algolia-api-key': ALGOLIA_API_KEY,
          },
        },
      ),
    );

    const hits: BilkaToGoProduct[] = response.data.results?.[0]?.hits ?? [];
    const inStock = hits.filter((product) => product.isInStock === 1);

    this.logger.debug(
      `Search "${query}": ${hits.length} hit(s), ${inStock.length} in stock`,
    );

    return inStock;
  }
}
