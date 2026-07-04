// src/app/quick-alarms/quick-alarms.component.spec.ts
import { TestBed, ComponentFixture } from '@angular/core/testing';
import { Router } from '@angular/router';
import { QuickAlarmsComponent } from './quick-alarms.component';
import { AlarmService } from '../core/services/alarm.service';

describe('QuickAlarmsComponent', () => {
  let fixture: ComponentFixture<QuickAlarmsComponent>;
  let component: QuickAlarmsComponent;
  let alarmSvc: jasmine.SpyObj<AlarmService>;

  beforeEach(async () => {
    localStorage.removeItem('rm_quick_alarms');
    alarmSvc = jasmine.createSpyObj<AlarmService>('AlarmService', ['schedule', 'cancel', 'ensurePermission']);
    alarmSvc.schedule.and.resolveTo();
    alarmSvc.cancel.and.resolveTo();
    alarmSvc.ensurePermission.and.resolveTo(true);

    await TestBed.configureTestingModule({
      imports: [QuickAlarmsComponent],
      providers: [
        { provide: AlarmService, useValue: alarmSvc },
        { provide: Router, useValue: { navigate: jasmine.createSpy('navigate') } },
      ],
    })
      .overrideComponent(QuickAlarmsComponent, { set: { template: '' } })
      .compileComponents();

    fixture = TestBed.createComponent(QuickAlarmsComponent);
    component = fixture.componentInstance;
  });

  it('creates and starts with the default weekday alarm draft', () => {
    expect(component).toBeTruthy();
    expect(component.newAlarm().days).toEqual([true, true, true, true, true, false, false]);
    expect(component.isWeekdays()).toBe(true);
  });

  it('toggleDay() flips a single day and updates isWeekdays', () => {
    component.toggleDay(5); // enable Saturday
    expect(component.newAlarm().days[5]).toBe(true);
    expect(component.isWeekdays()).toBe(false);
  });

  it('formatTime() renders 12-hour clock with AM/PM', () => {
    expect(component.formatTime(0, 0)).toBe('12:00 AM');
    expect(component.formatTime(13, 5)).toBe('1:05 PM');
    expect(component.formatTime(12, 30)).toBe('12:30 PM');
  });

  it('daysLabel() summarises common patterns', () => {
    expect(component.daysLabel([true, true, true, true, true, true, true])).toBe('Every day');
    expect(component.daysLabel([true, true, true, true, true, false, false])).toBe('Weekdays');
    expect(component.daysLabel([false, false, false, false, false, true, true])).toBe('Weekends');
    expect(component.daysLabel([true, false, true, false, false, false, false])).toBe('Mon, Wed');
  });

  it('setTime() parses "HH:mm" into hour/minute and ignores junk', () => {
    component.setTime('18:30');
    expect(component.newAlarm().hour).toBe(18);
    expect(component.newAlarm().minute).toBe(30);
    component.setTime('');
    expect(component.newAlarm().hour).toBe(18); // unchanged
  });

  it('timeValue() renders the draft as zero-padded "HH:mm"', () => {
    component.newAlarm.set({ hour: 6, minute: 5, label: 'x', days: component.newAlarm().days });
    expect(component.timeValue()).toBe('06:05');
  });

  it('firesIn() counts down to the next enabled day', () => {
    // Wed 2026-07-01 10:00 local time
    const now = new Date(2026, 6, 1, 10, 0, 0);
    component.newAlarm.set({ hour: 12, minute: 30, label: 'x', days: [true, true, true, true, true, true, true] });
    expect(component.firesIn(now)).toBe('2h 30m');

    // Only Monday enabled → Wed 10:00 → Mon 09:00 is 4d 23h away
    component.newAlarm.set({ hour: 9, minute: 0, label: 'x', days: [true, false, false, false, false, false, false] });
    expect(component.firesIn(now)).toBe('4d 23h');
  });

  it('addAlarm() appends, persists to localStorage and schedules via AlarmService', async () => {
    await component.addAlarm();

    expect(component.alarms().length).toBe(1);
    expect(alarmSvc.schedule).toHaveBeenCalledTimes(1);
    const stored = JSON.parse(localStorage.getItem('rm_quick_alarms')!);
    expect(stored.length).toBe(1);
  });

  it('deleteAlarm() removes the alarm and cancels its schedule', async () => {
    await component.addAlarm();
    const id = component.alarms()[0].id;

    await component.deleteAlarm(id);

    expect(component.alarms().length).toBe(0);
    expect(alarmSvc.cancel).toHaveBeenCalled();
  });

  it('toggleAlarm() flips enabled and (de)schedules accordingly', async () => {
    await component.addAlarm();
    const id = component.alarms()[0].id;
    alarmSvc.schedule.calls.reset();

    await component.toggleAlarm(id); // now disabled
    expect(component.alarms()[0].enabled).toBe(false);
    expect(alarmSvc.cancel).toHaveBeenCalled();

    await component.toggleAlarm(id); // re-enabled
    expect(component.alarms()[0].enabled).toBe(true);
    expect(alarmSvc.schedule).toHaveBeenCalled();
  });

  it('ngOnInit() hydrates alarms from localStorage', () => {
    const saved = [{ id: '99', hour: 7, minute: 0, label: 'Saved', days: [true, false, false, false, false, false, false], enabled: true }];
    localStorage.setItem('rm_quick_alarms', JSON.stringify(saved));

    component.ngOnInit();

    expect(component.alarms().length).toBe(1);
    expect(component.alarms()[0].label).toBe('Saved');
  });
});
