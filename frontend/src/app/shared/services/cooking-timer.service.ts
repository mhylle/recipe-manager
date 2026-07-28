import { Injectable, signal, computed, DestroyRef, inject } from '@angular/core';

export interface CookingTimer {
  id: string;
  /** What the user was doing — the step text that produced it. */
  label: string;
  /** Wall-clock milliseconds at which it fires. */
  endsAt: number;
  totalSeconds: number;
  remainingSeconds: number;
  finished: boolean;
}

/** Injected so tests can drive time without waiting for it. */
export type Now = () => number;

@Injectable({ providedIn: 'root' })
export class CookingTimerService {
  private readonly timers = signal<CookingTimer[]>([]);
  private ticker: ReturnType<typeof setInterval> | null = null;
  private nextId = 1;

  /** Overridable for tests; production reads the real clock. */
  now: Now = () => Date.now();

  readonly active = computed(() => this.timers().filter((t) => !t.finished));
  readonly finished = computed(() => this.timers().filter((t) => t.finished));
  readonly all = this.timers.asReadonly();

  constructor() {
    inject(DestroyRef).onDestroy(() => this.stopTicking());
  }

  /**
   * Start a countdown.
   *
   * The timer stores an absolute end time rather than counting ticks down. A
   * backgrounded tab has its intervals throttled to once a minute or stopped
   * altogether, so an accumulating counter drifts badly or freezes — on a phone
   * that is the normal case, not the edge case. Comparing against the wall clock
   * means the remaining time is correct the moment the page is looked at again,
   * however long it was away.
   */
  start(label: string, seconds: number): string {
    const id = `timer-${this.nextId++}`;
    this.timers.update((current) => [
      ...current,
      {
        id,
        label,
        endsAt: this.now() + seconds * 1000,
        totalSeconds: seconds,
        remainingSeconds: seconds,
        finished: false,
      },
    ]);
    this.startTicking();
    return id;
  }

  cancel(id: string): void {
    this.timers.update((current) => current.filter((t) => t.id !== id));
    if (this.timers().length === 0) {
      this.stopTicking();
    }
  }

  /** Acknowledge a finished timer and clear it. */
  dismiss(id: string): void {
    this.cancel(id);
  }

  clearFinished(): void {
    this.timers.update((current) => current.filter((t) => !t.finished));
    if (this.timers().length === 0) {
      this.stopTicking();
    }
  }

  /**
   * Recompute every timer against the clock.
   *
   * Public so a visibilitychange handler can force an immediate refresh when the
   * page comes back, instead of showing a stale countdown until the next tick.
   */
  tick(): void {
    const now = this.now();
    let anyFinishedNow = false;

    this.timers.update((current) =>
      current.map((timer) => {
        if (timer.finished) return timer;
        const remaining = Math.max(0, Math.ceil((timer.endsAt - now) / 1000));
        if (remaining === 0) {
          anyFinishedNow = true;
          return { ...timer, remainingSeconds: 0, finished: true };
        }
        return { ...timer, remainingSeconds: remaining };
      }),
    );

    if (anyFinishedNow) {
      this.alarm();
    }
    if (this.active().length === 0) {
      this.stopTicking();
    }
  }

  private startTicking(): void {
    if (this.ticker !== null) return;
    this.ticker = setInterval(() => this.tick(), 1000);
  }

  private stopTicking(): void {
    if (this.ticker === null) return;
    clearInterval(this.ticker);
    this.ticker = null;
  }

  /**
   * Sound and, if allowed, notify.
   *
   * Both are attempted because neither is reliable alone: audio only plays while
   * the page is audible, and notifications need a permission the user may never
   * have granted. Everything here is wrapped — a blocked notification or a
   * suspended audio context must not take down the countdown.
   */
  private alarm(): void {
    this.beep();
    this.notify();
  }

  private beep(): void {
    try {
      const AudioCtor =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtor) return;

      const ctx = new AudioCtor();
      // Three short pulses — long enough to notice across a kitchen, short
      // enough not to be the thing you resent about the app.
      for (let i = 0; i < 3; i++) {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.frequency.value = 880;
        osc.connect(gain);
        gain.connect(ctx.destination);
        const start = ctx.currentTime + i * 0.45;
        gain.gain.setValueAtTime(0.0001, start);
        gain.gain.exponentialRampToValueAtTime(0.3, start + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.35);
        osc.start(start);
        osc.stop(start + 0.4);
      }
      setTimeout(() => void ctx.close(), 2000);
    } catch {
      // No audio available. The visual state still shows the timer finished.
    }
  }

  private notify(): void {
    try {
      if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
      const done = this.finished();
      const latest = done[done.length - 1];
      new Notification(latest?.label ?? 'Timer finished');
    } catch {
      // Notifications unavailable or blocked; nothing to recover.
    }
  }

  /** Ask once, from a user gesture. Returns whether notifications may be shown. */
  async requestNotificationPermission(): Promise<boolean> {
    try {
      if (typeof Notification === 'undefined') return false;
      if (Notification.permission === 'granted') return true;
      if (Notification.permission === 'denied') return false;
      return (await Notification.requestPermission()) === 'granted';
    } catch {
      return false;
    }
  }
}

/** mm:ss, or h:mm:ss once there is an hour to show. */
export function formatRemaining(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}
