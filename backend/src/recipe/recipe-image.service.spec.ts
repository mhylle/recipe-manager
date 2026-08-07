import { BadRequestException } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { RecipeImageService, MAX_IMAGE_BYTES } from './recipe-image.service';

/** Real magic bytes, padded to something plausibly file-sized. */
const png = (extra = 32) =>
  Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47]), Buffer.alloc(extra)]);
const jpeg = (extra = 32) =>
  Buffer.concat([Buffer.from([0xff, 0xd8, 0xff]), Buffer.alloc(extra)]);
const webp = () =>
  Buffer.concat([
    Buffer.from('RIFF', 'ascii'),
    Buffer.alloc(4),
    Buffer.from('WEBP', 'ascii'),
    Buffer.alloc(32),
  ]);

describe('RecipeImageService', () => {
  let service: RecipeImageService;
  let workdir: string;
  let originalCwd: string;

  beforeEach(() => {
    // The service writes under process.cwd(), so give it a throwaway one rather
    // than scattering files through the repo.
    originalCwd = process.cwd();
    workdir = fs.mkdtempSync(path.join(os.tmpdir(), 'recipe-image-'));
    process.chdir(workdir);
    service = new RecipeImageService();
  });

  afterEach(() => {
    process.chdir(originalCwd);
    fs.rmSync(workdir, { recursive: true, force: true });
  });

  const storedFiles = () =>
    fs.readdirSync(path.join(workdir, 'public', 'recipes'));

  describe('accepting real images', () => {
    it('stores a PNG and returns its served URL', () => {
      const url = service.store('recipe-1', {
        buffer: png(),
        size: png().length,
      });

      expect(url).toMatch(
        /^\/api\/recipe-manager\/images\/recipes\/recipe-1_upload\d+-[0-9a-f]{8}\.png$/,
      );
      expect(storedFiles()).toHaveLength(1);
    });

    it('stores a JPEG', () => {
      const url = service.store('recipe-1', {
        buffer: jpeg(),
        size: jpeg().length,
      });
      expect(url).toMatch(/\.jpg$/);
    });

    it('stores a WebP', () => {
      const buffer = webp();
      const url = service.store('recipe-1', { buffer, size: buffer.length });
      expect(url).toMatch(/\.webp$/);
    });

    it('gives each upload a distinct name, so caches cannot show the old picture', () => {
      const first = service.store('recipe-1', {
        buffer: png(),
        size: png().length,
      });
      const second = service.store('recipe-1', {
        buffer: png(64),
        size: png(64).length,
      });

      // Reusing `<id>.png` would leave the browser and the service worker serving
      // the previous image, which reads as a silently failed upload.
      expect(first).not.toBe(second);
      expect(storedFiles()).toHaveLength(2);
    });

    it('creates the directory when it does not exist yet', () => {
      expect(() =>
        service.store('recipe-1', { buffer: png(), size: png().length }),
      ).not.toThrow();
    });
  });

  describe('refusing anything that is not an image', () => {
    it('rejects HTML dressed up as an upload', () => {
      // The classic stored-XSS route: a script served from our own origin. The
      // declared type and filename are attacker-controlled, so only the bytes
      // can be trusted.
      const html = Buffer.from('<script>alert(1)</script>', 'utf8');

      expect(() =>
        service.store('recipe-1', { buffer: html, size: html.length }),
      ).toThrow(BadRequestException);
    });

    it('writes nothing when it refuses', () => {
      const html = Buffer.from('<html></html>', 'utf8');
      try {
        service.store('recipe-1', { buffer: html, size: html.length });
      } catch {
        // expected
      }
      // A rejected file must never reach disk at all.
      const dir = path.join(workdir, 'public', 'recipes');
      expect(fs.existsSync(dir) ? fs.readdirSync(dir) : []).toEqual([]);
    });

    it('rejects a RIFF container that is not WebP', () => {
      // RIFF also fronts .wav and .avi.
      const wav = Buffer.concat([
        Buffer.from('RIFF', 'ascii'),
        Buffer.alloc(4),
        Buffer.from('WAVE', 'ascii'),
        Buffer.alloc(32),
      ]);

      expect(() =>
        service.store('recipe-1', { buffer: wav, size: wav.length }),
      ).toThrow(BadRequestException);
    });

    it('rejects an empty file', () => {
      expect(() =>
        service.store('recipe-1', { buffer: Buffer.alloc(0), size: 0 }),
      ).toThrow(BadRequestException);
    });

    it('rejects something too large', () => {
      expect(() =>
        service.store('recipe-1', { buffer: png(), size: MAX_IMAGE_BYTES + 1 }),
      ).toThrow(BadRequestException);
    });

    it('says how large is too large', () => {
      // A refusal that does not name the limit sends people guessing.
      expect(() =>
        service.store('recipe-1', { buffer: png(), size: MAX_IMAGE_BYTES + 1 }),
      ).toThrow(/8 MB/);
    });
  });
});
