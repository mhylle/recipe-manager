import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

const BILKATOGO_CART_URL =
  'https://api.bilkatogo.dk/api/shop/v6/ChangeLineCount';

@Injectable()
export class BilkaToGoCartService {
  private readonly logger = new Logger(BilkaToGoCartService.name);

  constructor(private readonly httpService: HttpService) {}

  async addItem(
    cookies: string,
    productId: string,
    count: number,
  ): Promise<void> {
    const params = new URLSearchParams({
      u: 'w',
      productId,
      count: String(count),
      fullCart: '0',
    }).toString();

    await firstValueFrom(
      this.httpService.get(`${BILKATOGO_CART_URL}?${params}`, {
        headers: { Cookie: cookies },
      }),
    );

    this.logger.debug(`Added product ${productId} (count=${count}) to cart`);
  }
}
