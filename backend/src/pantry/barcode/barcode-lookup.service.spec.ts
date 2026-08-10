import { BadRequestException } from '@nestjs/common';
import { BarcodeLookupService } from './barcode-lookup.service';
import { PantryCategory, Unit } from '../../shared/enums/index.js';

/**
 * Asking an open database what a number is.
 *
 * The failure modes matter more than the happy path here: most of a Danish
 * supermarket is missing from Open Food Facts, and the service may be slow or
 * down. None of that is an error a cook standing in the kitchen should be shown
 * — it is "no idea", and the form stays fillable by hand.
 */
describe('BarcodeLookupService', () => {
  const service = new BarcodeLookupService();
  const fetchMock = jest.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  const answer = (body: unknown, ok = true) => ({
    ok,
    json: () => Promise.resolve(body),
  });

  it('returns the product when the database knows the code', async () => {
    fetchMock.mockResolvedValue(
      answer({
        status: 1,
        product: {
          product_name: 'Nutella',
          categories_tags: ['en:spreads'],
          quantity: '400 g',
        },
      }),
    );

    await expect(service.lookup('3017620422003')).resolves.toEqual({
      barcode: '3017620422003',
      name: 'Nutella',
      category: PantryCategory.CONDIMENTS,
      quantity: 400,
      unit: Unit.G,
    });
  });

  it('asks for only the fields it reads', async () => {
    // The whole product is a megabyte of JSON, fetched over a kitchen's wifi.
    fetchMock.mockResolvedValue(answer({ status: 0 }));

    await service.lookup('3017620422003');

    const [url] = fetchMock.mock.calls[0] as [string];
    expect(url).toContain('fields=');
    expect(url).toContain('3017620422003');
  });

  it('says it does not know, rather than failing, for an unlisted code', async () => {
    fetchMock.mockResolvedValue(answer({ status: 0 }, false));

    await expect(service.lookup('5701234567890')).resolves.toBeNull();
  });

  it('says it does not know when the lookup itself falls over', async () => {
    // The distractor: letting this throw turns a slow third party into a 500 in
    // somebody's kitchen, for a feature whose fallback is typing a name.
    fetchMock.mockRejectedValue(new Error('network is down'));

    await expect(service.lookup('3017620422003')).resolves.toBeNull();
  });

  it('refuses something that is not a barcode instead of forwarding it', async () => {
    // This value becomes a URL path at a third party. Whatever arrives here,
    // only digits leave.
    await expect(service.lookup('../../etc/passwd')).rejects.toThrow(
      BadRequestException,
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('refuses a code too short to be one', async () => {
    await expect(service.lookup('12')).rejects.toThrow(BadRequestException);
  });
});
