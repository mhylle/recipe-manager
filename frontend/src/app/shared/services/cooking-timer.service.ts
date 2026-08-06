import { Injectable, signal, computed, DestroyRef, inject } from '@angular/core';
import { TimerPushService } from './timer-push.service';

export interface CookingTimer {
  id: string;
  /** What the user was doing — the step text that produced it. */
  label: string;
  /** Wall-clock milliseconds at which it fires. */
  endsAt: number;
  totalSeconds: number;
  remainingSeconds: number;
  finished: boolean;
  /**
   * The backend's id for the same timer, when it was booked to ring on the
   * phone. Absent for a purely local countdown — a signed-out cook, a browser
   * that cannot receive push, or a booking that failed.
   */
  serverId?: string;
}

/** Injected so tests can drive time without waiting for it. */
export type Now = () => number;

@Injectable({ providedIn: 'root' })
export class CookingTimerService {
  private readonly push = inject(TimerPushService);

  private readonly timers = signal<CookingTimer[]>([]);
  private ticker: ReturnType<typeof setInterval> | null = null;
  private nextId = 1;
  /** Pending timers are pulled back once per session, not per recipe visited. */
  private restored = false;

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
  /**
   * `doneMessage` is the notification body, already translated by the caller.
   *
   * Its presence is what opts a timer into ringing on the phone. This service
   * has no LocaleService — putting one here would mean an English string baked
   * into a service, which `npm run check:i18n` exists to prevent — so a caller
   * that cannot supply translated text gets the local-only countdown instead of
   * a lock-screen notification written in the wrong language.
   */
  start(label: string, seconds: number, doneMessage?: string): string {
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

    if (doneMessage !== undefined) {
      // Fire and forget. The countdown is already on screen and must not wait
      // for a round trip, and a failed booking is a degraded timer rather than
      // a broken one.
      void this.bookOnServer(id, label, doneMessage, seconds);
    }
    return id;
  }

  cancel(id: string): void {
    const timer = this.timers().find((t) => t.id === id);
    this.timers.update((current) => current.filter((t) => t.id !== id));
    if (timer?.serverId) {
      // Otherwise the phone rings for a timer the user explicitly cancelled.
      void this.push.cancel(timer.serverId);
    }
    if (this.timers().length === 0) {
      this.stopTicking();
    }
  }

  private async bookOnServer(
    localId: string,
    title: string,
    body: string,
    seconds: number,
  ): Promise<void> {
    const serverId = await this.push.schedule(title, body, seconds);
    if (serverId === null) return;

    // The timer may have been cancelled while the request was in flight, in
    // which case there is nothing left to attach the id to and the booking has
    // to be undone — or the phone rings for a timer that is gone from the UI.
    const stillRunning = this.timers().some((t) => t.id === localId);
    if (!stillRunning) {
      void this.push.cancel(serverId);
      return;
    }
    this.timers.update((current) =>
      current.map((t) => (t.id === localId ? { ...t, serverId } : t)),
    );
  }

  /**
   * Rebuild countdowns for timers the backend is still holding.
   *
   * This is what makes a timer survive the app being killed: the phone discards
   * the page, the row lives on, and reopening the recipe shows the countdown
   * again rather than an empty timer bar.
   *
   * Runs at most once per session — it is called from a page that gets visited
   * repeatedly, and re-running it would duplicate every chip.
   */
  async restore(): Promise<void> {
    if (this.restored) return;
    this.restored = true;

    const pending = await this.push.pending();
    if (pending.length === 0) return;

    const known = new Set(
      this.timers()
        .map((t) => t.serverId)
        .filter((id): id is string => id !== undefined),
    );

    const now = this.now();
    const restored = pending
      .filter((timer) => !known.has(timer.id))
      .map((timer) => {
        const endsAt = new Date(timer.fireAt).getTime();
        const remaining = Math.max(0, Math.ceil((endsAt - now) / 1000));
        return {
          id: `timer-${this.nextId++}`,
          label: timer.title,
          endsAt,
          // The original duration is not stored server-side and is not worth a
          // column: it is only used for a progress proportion, and what is left
          // is the honest answer for a timer picked up mid-flight.
          totalSeconds: remaining,
          remainingSeconds: remaining,
          finished: false,
          serverId: timer.id,
        };
      })
      // A timer whose instant has already passed rang on the phone while the app
      // was closed. Resurrecting it as a finished chip would demand a second
      // dismissal for an alarm already dealt with.
      .filter((timer) => timer.remainingSeconds > 0);

    if (restored.length === 0) return;
    this.timers.update((current) => [...current, ...restored]);
    this.startTicking();
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
    const ringingHere: string[] = [];

    this.timers.update((current) =>
      current.map((timer) => {
        if (timer.finished) return timer;
        const remaining = Math.max(0, Math.ceil((timer.endsAt - now) / 1000));
        if (remaining === 0) {
          anyFinishedNow = true;
          if (timer.serverId) {
            ringingHere.push(timer.serverId);
          }
          // serverId is dropped along with the booking, so dismissing the chip
          // later does not try to cancel it a second time.
          return { ...timer, remainingSeconds: 0, finished: true, serverId: undefined };
        }
        return { ...timer, remainingSeconds: remaining };
      }),
    );

    if (anyFinishedNow) {
      this.alarm();
    }

    // The page was open and has just beeped, so withdraw the phone's copy.
    //
    // This is a race we usually win rather than a guarantee: the local timer
    // fires exactly on time while the backend polls every few seconds, which
    // normally leaves enough room for the cancellation to land first. Losing it
    // costs a redundant notification for an alarm the cook already heard — the
    // right way round, since the alternative is a silent phone.
    for (const serverId of ringingHere) {
      void this.push.cancel(serverId);
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
