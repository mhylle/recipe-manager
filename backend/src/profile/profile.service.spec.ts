import { BadRequestException } from '@nestjs/common';
import { ProfileService } from './profile.service';
import { PrismaService } from '../prisma/prisma.service';

interface Row {
  id: string;
  geminiKeyEnvelope: string | null;
  geminiKeyUpdatedAt: Date | null;
}

function createPrismaStub(
  seed: Row[] = [
    { id: 'u-1', geminiKeyEnvelope: null, geminiKeyUpdatedAt: null },
  ],
) {
  const rows = [...seed];
  return {
    rows: () => rows,
    user: {
      findUnique: jest.fn(({ where }: { where: { id: string } }) =>
        Promise.resolve(rows.find((r) => r.id === where.id) ?? null),
      ),
      update: jest.fn(
        ({
          where,
          data,
        }: {
          where: { id: string };
          data: Partial<Pick<Row, 'geminiKeyEnvelope' | 'geminiKeyUpdatedAt'>>;
        }) => {
          const row = rows.find((r) => r.id === where.id);
          if (!row) return Promise.reject(new Error('no such user'));
          Object.assign(row, data);
          return Promise.resolve(row);
        },
      ),
    },
  };
}

/** A realistic envelope: what the browser encrypter produces. */
const ENVELOPE = JSON.stringify({
  v: 1,
  salt: 'c2FsdHNhbHQ',
  iv: 'aXZpdml2aXZpdg',
  ct: 'Y2lwaGVydGV4dA',
});

describe('ProfileService', () => {
  let service: ProfileService;
  let prisma: ReturnType<typeof createPrismaStub>;

  beforeEach(() => {
    prisma = createPrismaStub();
    service = new ProfileService(prisma as unknown as PrismaService);
  });

  describe('getGeminiKey', () => {
    it('reports no key when none is stored', async () => {
      expect(await service.getGeminiKey('u-1')).toEqual({
        configured: false,
        envelope: null,
        updatedAt: null,
      });
    });

    it('returns the envelope verbatim for the browser to decrypt', async () => {
      await service.saveGeminiKey('u-1', ENVELOPE);

      const state = await service.getGeminiKey('u-1');
      expect(state.configured).toBe(true);
      // Byte-identical: the server is a courier, not a participant.
      expect(state.envelope).toBe(ENVELOPE);
      expect(state.updatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });

    it('reports nothing for a user who does not exist', async () => {
      expect(await service.getGeminiKey('nobody')).toEqual({
        configured: false,
        envelope: null,
        updatedAt: null,
      });
    });
  });

  describe('saveGeminiKey', () => {
    it('stores the ciphertext unchanged', async () => {
      await service.saveGeminiKey('u-1', ENVELOPE);
      expect(prisma.rows()[0].geminiKeyEnvelope).toBe(ENVELOPE);
    });

    it('rejects something that is not an envelope', async () => {
      // The failure this guards against is a client posting the RAW key, which
      // would put a live secret in the database in plaintext.
      await expect(
        service.saveGeminiKey('u-1', 'AIzaSyRawLookingApiKey123'),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.rows()[0].geminiKeyEnvelope).toBeNull();
    });

    it('rejects a JSON scalar, which cannot be an envelope', async () => {
      await expect(
        service.saveGeminiKey('u-1', '"just-a-string"'),
      ).rejects.toThrow(BadRequestException);
      await expect(service.saveGeminiKey('u-1', 'null')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('does not care what is INSIDE the envelope', async () => {
      // Deliberately: the format must be revisable client-side with a version
      // bump, so the server does not validate its fields.
      const future = JSON.stringify({ v: 99, alg: 'something-new', blob: 'x' });
      await expect(service.saveGeminiKey('u-1', future)).resolves.toMatchObject(
        {
          configured: true,
        },
      );
    });

    it('moves the timestamp on, so a stale key is recognisable', async () => {
      const first = await service.saveGeminiKey('u-1', ENVELOPE);
      await new Promise((r) => setTimeout(r, 5));
      const second = await service.saveGeminiKey('u-1', ENVELOPE);

      expect(new Date(second.updatedAt!).getTime()).toBeGreaterThanOrEqual(
        new Date(first.updatedAt!).getTime(),
      );
    });
  });

  describe('deleteGeminiKey', () => {
    it('clears the envelope AND the timestamp', async () => {
      await service.saveGeminiKey('u-1', ENVELOPE);
      await service.deleteGeminiKey('u-1');

      expect(await service.getGeminiKey('u-1')).toEqual({
        configured: false,
        envelope: null,
        updatedAt: null,
      });
      // A lingering timestamp would imply a key that is not there.
      expect(prisma.rows()[0].geminiKeyUpdatedAt).toBeNull();
    });
  });
});
