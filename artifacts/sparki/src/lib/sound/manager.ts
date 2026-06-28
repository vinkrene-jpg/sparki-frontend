// Sparki Sound Manager — a tiny singleton that owns audio playback.
//
// Kept outside React so the wekker keeps ringing across re-renders/navigations.
// Browsers block audio until the user has interacted with the page (autoplay
// policy); `markUnlocked()` is called on the first user gesture. We never pretend
// audio played — `play()` swallows the blocked-autoplay rejection silently and
// the wekker overlay always offers a tap to start sound if it was blocked.

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

class SoundManager {
  private enabled = true;
  private masterVolume = 0.7; // 0..1
  private unlocked = false;
  private cache = new Map<string, HTMLAudioElement>();
  private alarmEl: HTMLAudioElement | null = null;

  setEnabled(v: boolean): void {
    this.enabled = v;
    if (!v) this.stopAlarm();
  }

  setVolume(v0to1: number): void {
    this.masterVolume = clamp01(v0to1);
    if (this.alarmEl) this.alarmEl.volume = this.alarmVolume();
  }

  markUnlocked(): void {
    this.unlocked = true;
  }

  isUnlocked(): boolean {
    return this.unlocked;
  }

  private element(url: string): HTMLAudioElement {
    let el = this.cache.get(url);
    if (!el) {
      el = new Audio(url);
      el.preload = "auto";
      this.cache.set(url, el);
    }
    return el;
  }

  // Play a short event sound. Respects the master switch unless `force` (used by
  // settings previews so the user can always hear a sound while testing).
  play(url: string, opts: { force?: boolean } = {}): void {
    if (!this.enabled && !opts.force) return;
    try {
      const el = this.element(url);
      el.loop = false;
      el.volume = this.masterVolume;
      el.currentTime = 0;
      void el.play().catch(() => {});
    } catch {
      /* ignore */
    }
  }

  private alarmVolume(): number {
    // A wekker should be audible even at a low master volume.
    return Math.max(this.masterVolume, 0.45);
  }

  // Start the wekker. Always plays (independent of the event master switch) — an
  // armed wekker is an explicit, separate opt-in.
  playAlarm(url: string, loop: boolean): void {
    this.stopAlarm();
    try {
      const el = new Audio(url);
      el.loop = loop;
      el.volume = this.alarmVolume();
      this.alarmEl = el;
      void el.play().catch(() => {});
    } catch {
      /* ignore */
    }
  }

  // Retry starting the current alarm element (e.g. after a user gesture unblocks
  // autoplay). No-op when no alarm is active.
  resumeAlarm(): void {
    if (this.alarmEl) {
      try {
        void this.alarmEl.play().catch(() => {});
      } catch {
        /* ignore */
      }
    }
  }

  stopAlarm(): void {
    if (this.alarmEl) {
      try {
        this.alarmEl.pause();
      } catch {
        /* ignore */
      }
      this.alarmEl = null;
    }
  }
}

export const soundManager = new SoundManager();
