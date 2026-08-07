import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import sharp from 'sharp';
import { ThumbnailService } from './thumbnail.service';

const SERVED = '/api/recipe-manager/images/recipes/';

describe('ThumbnailService', () => {
  let service: ThumbnailService;
  let workdir: string;
  let originalCwd: string;
  let imagesDir: string;

  /** A real PNG, so sharp is genuinely exercised rather than mocked. */
  const writePng = async (filename: string, size = 1024): Promise<void> => {
    const buffer = await sharp({
      create: {
        width: size,
        height: size,
        channels: 3,
        background: { r: 200, g: 120, b: 60 },
      },
    })
      .png()
      .toBuffer();
    fs.writeFileSync(path.join(imagesDir, filename), buffer);
  };

  beforeEach(() => {
    originalCwd = process.cwd();
    workdir = fs.mkdtempSync(path.join(os.tmpdir(), 'thumb-'));
    imagesDir = path.join(workdir, 'public', 'recipes');
    fs.mkdirSync(imagesDir, { recursive: true });
    process.chdir(workdir);
    service = new ThumbnailService();
  });

  afterEach(() => {
    process.chdir(originalCwd);
    fs.rmSync(workdir, { recursive: true, force: true });
  });

  const thumbPath = (base: string) =>
    path.join(imagesDir, 'thumbs', `${base}.webp`);

  describe('generating', () => {
    it('makes a WebP thumbnail and returns its served URL', async () => {
      await writePng('abc.png');

      const url = await service.generate(`${SERVED}abc.png`);

      expect(url).toBe(`${SERVED}thumbs/abc.webp`);
      expect(fs.existsSync(thumbPath('abc'))).toBe(true);
    });

    it('produces something dramatically smaller than the original', async () => {
      // The whole reason this exists: the real images are ~2MB PNGs, and a
      // gallery of forty asked the browser for roughly 80MB.
      await writePng('abc.png');
      const before = fs.statSync(path.join(imagesDir, 'abc.png')).size;

      await service.generate(`${SERVED}abc.png`);
      const after = fs.statSync(thumbPath('abc')).size;

      expect(after).toBeLessThan(before);
    });

    it('caps the width rather than upscaling a small original', async () => {
      // Upscaling would produce a "thumbnail" larger than its source.
      await writePng('small.png', 200);
      await service.generate(`${SERVED}small.png`);

      const meta = await sharp(thumbPath('small')).metadata();
      expect(meta.width).toBe(200);
    });

    it('resizes a large original down to the card width', async () => {
      await writePng('big.png', 1024);
      await service.generate(`${SERVED}big.png`);

      const meta = await sharp(thumbPath('big')).metadata();
      expect(meta.width).toBe(600);
    });

    it('leaves the original untouched', async () => {
      // The detail page still shows it, and replacing it would be an
      // irreversible quality loss for a saving that only matters in a list.
      await writePng('abc.png');
      const before = fs.readFileSync(path.join(imagesDir, 'abc.png'));

      await service.generate(`${SERVED}abc.png`);

      expect(fs.readFileSync(path.join(imagesDir, 'abc.png'))).toEqual(before);
    });
  });

  describe('failing safely', () => {
    it('returns null when the original is missing', async () => {
      // Expected for an image generated on another deployment. Null means "use
      // the full image", which is what happened before thumbnails existed.
      expect(await service.generate(`${SERVED}nope.png`)).toBeNull();
    });

    it('returns null for a URL that is not one of ours', async () => {
      expect(await service.generate('https://example.com/evil.png')).toBeNull();
      expect(await service.generate('/some/other/path.png')).toBeNull();
    });

    it('returns null for a file that is not an image', async () => {
      fs.writeFileSync(path.join(imagesDir, 'notreally.png'), 'plain text');
      expect(await service.generate(`${SERVED}notreally.png`)).toBeNull();
    });
  });

  describe('refusing to leave the images directory', () => {
    it('rejects traversal in the filename', async () => {
      // These strings come from our own database rather than a request, but a
      // stored value is still a value, and being wrong here means reading or
      // writing outside the images directory.
      const secret = path.join(workdir, 'secret.png');
      await writePng('seed.png');
      fs.copyFileSync(path.join(imagesDir, 'seed.png'), secret);

      expect(await service.generate(`${SERVED}../secret.png`)).toBeNull();
      expect(await service.generate(`${SERVED}../../etc/passwd`)).toBeNull();
      expect(
        await service.generate(`${SERVED}subdir/../../secret.png`),
      ).toBeNull();
    });

    it('rejects a dotfile', async () => {
      expect(await service.generate(`${SERVED}.env`)).toBeNull();
    });

    it('rejects characters our filenames never use', async () => {
      expect(await service.generate(`${SERVED}ab c.png`)).toBeNull();
      expect(await service.generate(`${SERVED}ab;c.png`)).toBeNull();
    });
  });

  describe('exists', () => {
    it('is false before and true after', async () => {
      await writePng('abc.png');
      expect(service.exists(`${SERVED}abc.png`)).toBe(false);

      await service.generate(`${SERVED}abc.png`);
      expect(service.exists(`${SERVED}abc.png`)).toBe(true);
    });

    it('is false for a URL that is not ours', () => {
      expect(service.exists('https://example.com/x.png')).toBe(false);
    });
  });
});
