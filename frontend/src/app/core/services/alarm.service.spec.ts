// src/app/core/services/alarm.service.spec.ts
import { TestBed } from '@angular/core/testing';
import { AlarmService } from './alarm.service';

/**
 * These specs exercise the WEB code path (Capacitor.isNativePlatform() === false
 * under Karma), where scheduling is intentionally a no-op that must never throw
 * so the UI keeps working in the browser / PWA preview.
 */
describe('AlarmService', () => {
  let service: AlarmService;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [AlarmService] });
    service = TestBed.inject(AlarmService);
  });

  it('is created', () => {
    expect(service).toBeTruthy();
  });

  it('ensurePermission() resolves true on web', async () => {
    await expectAsync(service.ensurePermission()).toBeResolvedTo(true);
  });

  it('schedule() resolves without throwing on web (no-op)', async () => {
    await expectAsync(
      service.schedule({ id: 1, hour: 6, minute: 30, label: 'Wake', days: [true, false, false, false, false, false, false] })
    ).toBeResolved();
  });

  it('schedule() with no repeat days resolves (one-shot path)', async () => {
    await expectAsync(
      service.schedule({ id: 2, hour: 9, minute: 0, label: 'Once', days: [false, false, false, false, false, false, false] })
    ).toBeResolved();
  });

  it('cancel() resolves without throwing on web', async () => {
    await expectAsync(service.cancel(1)).toBeResolved();
  });

  it('formatTime (via schedule side-effect free) — verify AM/PM math', () => {
    // formatTime is private; assert its contract indirectly through a tiny probe.
    const fmt = (service as any).formatTime.bind(service);
    expect(fmt(0, 0)).toBe('12:00 AM');
    expect(fmt(9, 5)).toBe('9:05 AM');
    expect(fmt(12, 0)).toBe('12:00 PM');
    expect(fmt(13, 30)).toBe('1:30 PM');
    expect(fmt(23, 59)).toBe('11:59 PM');
  });

  it('nextOccurrence returns a future Date', () => {
    const next = (service as any).nextOccurrence.bind(service)(0, 0);
    expect(next instanceof Date).toBe(true);
    expect(next.getTime()).toBeGreaterThan(Date.now() - 1000);
  });
});
