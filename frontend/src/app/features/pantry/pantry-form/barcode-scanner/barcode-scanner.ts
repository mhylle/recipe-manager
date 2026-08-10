import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnDestroy,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { TranslatePipe } from '../../../../shared/i18n';

/** The slice of the BarcodeDetector API this uses. Not in lib.dom yet. */
interface BarcodeDetectorLike {
  detect(source: CanvasImageSource): Promise<{ rawValue: string }[]>;
}
interface BarcodeDetectorCtor {
  new (options?: { formats?: string[] }): BarcodeDetectorLike;
}

/** How often to look at the picture. Fast enough to feel instant, cheap enough not to heat the phone. */
const SCAN_INTERVAL_MS = 400;

/**
 * Getting a barcode into the app.
 *
 * Two ways in, and typing is not the apology: `BarcodeDetector` is native in
 * Chrome and Android and absent in iOS Safari, so a camera-only feature would
 * simply not exist on half the phones in the house. The number under the bars
 * is always readable by a human, so the box for it is always there.
 *
 * No scanning library on purpose — that is a dependency in a PWA's bundle and
 * somebody else's decision to make.
 */
@Component({
  selector: 'app-barcode-scanner',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslatePipe],
  templateUrl: './barcode-scanner.html',
  styleUrl: './barcode-scanner.scss',
})
export class BarcodeScannerComponent implements OnDestroy {
  /** A barcode, however it was obtained. */
  readonly scanned = output<string>();

  private readonly video = viewChild<ElementRef<HTMLVideoElement>>('video');

  readonly cameraOn = signal(false);
  readonly cameraFailed = signal(false);
  readonly typed = signal('');

  private stream: MediaStream | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;

  /** Whether this browser can read a barcode out of a picture at all. */
  readonly cameraSupported = typeof (
    globalThis as { BarcodeDetector?: unknown }
  ).BarcodeDetector !== 'undefined';

  async startCamera(): Promise<void> {
    if (!this.cameraSupported || this.cameraOn()) {
      return;
    }
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        // The back camera, which is the one pointing at the tin.
        video: { facingMode: 'environment' },
      });
      const element = this.video()?.nativeElement;
      if (element) {
        element.srcObject = this.stream;
        await element.play();
      }
      this.cameraOn.set(true);
      this.cameraFailed.set(false);
      this.watch();
    } catch {
      // Permission refused, no camera, or a browser that will not. All the same
      // to the cook: the number is still typeable.
      this.cameraFailed.set(true);
      this.stop();
    }
  }

  private watch(): void {
    const Detector = (globalThis as { BarcodeDetector?: BarcodeDetectorCtor })
      .BarcodeDetector;
    const element = this.video()?.nativeElement;
    if (!Detector || !element) {
      return;
    }
    const detector = new Detector({
      formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128'],
    });

    this.timer = setInterval(() => {
      void detector
        .detect(element)
        .then((found) => {
          const code = found[0]?.rawValue?.trim();
          if (code) {
            // One barcode is the whole job. Leaving the camera running would
            // keep firing on the same tin and re-fill the form underneath.
            this.stop();
            this.scanned.emit(code);
          }
        })
        .catch(() => {
          // A frame that will not decode is the normal case, not an error.
        });
    }, SCAN_INTERVAL_MS);
  }

  submitTyped(): void {
    const code = this.typed().trim();
    if (code) {
      this.scanned.emit(code);
    }
  }

  onTyped(event: Event): void {
    this.typed.set((event.target as HTMLInputElement).value);
  }

  /** Let go of the camera. A light left on in someone's kitchen is a real bug. */
  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.stream?.getTracks().forEach((track) => track.stop());
    this.stream = null;
    this.cameraOn.set(false);
  }

  ngOnDestroy(): void {
    this.stop();
  }
}
