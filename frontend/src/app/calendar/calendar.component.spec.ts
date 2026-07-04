// src/app/calendar/calendar.component.spec.ts
import { TestBed, ComponentFixture } from '@angular/core/testing';
import { signal } from '@angular/core';
import { of } from 'rxjs';
import { CalendarComponent } from './calendar.component';
import { ReminderService } from '../core/services/reminder.service';
import { SpecialDayService } from '../core/services/special-day.service';

describe('CalendarComponent', () => {
  let fixture: ComponentFixture<CalendarComponent>;
  let component: CalendarComponent;

  const reminderStub = {
    reminders: signal<any[]>([]),
    receivedReminders: signal<any[]>([]),
    getAll: () => of([]),
    getReceived: () => of([]),
  };

  const specialDayStub = {
    items: signal<any[]>([]),
    getAll: () => of([]),
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CalendarComponent],
      providers: [
        { provide: ReminderService, useValue: reminderStub },
        { provide: SpecialDayService, useValue: specialDayStub },
      ],
    })
      .overrideComponent(CalendarComponent, { set: { template: '' } })
      .compileComponents();

    fixture = TestBed.createComponent(CalendarComponent);
    component = fixture.componentInstance;
  });

  it('creates with month view by default', () => {
    expect(component).toBeTruthy();
    expect(component.viewMode()).toBe('month');
  });

  it('formatHour() renders a 12-hour clock label', () => {
    expect(component.formatHour(7)).toBe('7 AM');
    expect(component.formatHour(12)).toBe('12 PM');
    expect(component.formatHour(15)).toBe('3 PM');
  });

  it('getHour() extracts the hour from a HH:mm string', () => {
    expect(component.getHour('14:30')).toBe(14);
    expect(component.getHour('07:00')).toBe(7);
    expect(component.getHour(undefined as any)).toBe(0);
  });

  it('hours slot list spans 7am–11pm', () => {
    expect(component.hours[0]).toBe(7);
    expect(component.hours[component.hours.length - 1]).toBe(23);
  });

  it('weekDays() always returns 7 consecutive days', () => {
    const days = component.weekDays();
    expect(days.length).toBe(7);
    for (let i = 1; i < 7; i++) {
      const diff = days[i].date.getTime() - days[i - 1].date.getTime();
      expect(Math.round(diff / 86400000)).toBe(1);
    }
  });

  it('nextWeek()/prevWeek() move the selected date by 7 days', () => {
    const start = component.selected().getTime();
    component.nextWeek();
    expect(Math.round((component.selected().getTime() - start) / 86400000)).toBe(7);
    component.prevWeek();
    expect(Math.round((component.selected().getTime() - start) / 86400000)).toBe(0);
  });

  it('viewMode can switch to week', () => {
    component.viewMode.set('week');
    expect(component.viewMode()).toBe('week');
  });

  it('selectedDaySpecials() matches special days on their month/day', () => {
    const sel = component.selected();
    specialDayStub.items.set([
      { _id: 's1', name: 'Match', type: 'birthday', month: sel.getMonth() + 1, day: sel.getDate() },
      { _id: 's2', name: 'Other', type: 'event', month: sel.getMonth() + 1, day: sel.getDate() === 1 ? 2 : 1 },
    ]);
    expect(component.selectedDaySpecials().map(s => s.name)).toEqual(['Match']);
    specialDayStub.items.set([]);
  });

  it('selectedDaySpecials() hides special days before their start year', () => {
    const sel = component.selected();
    specialDayStub.items.set([
      { _id: 's3', name: 'Future', type: 'anniversary', month: sel.getMonth() + 1, day: sel.getDate(), year: sel.getFullYear() + 1 },
    ]);
    expect(component.selectedDaySpecials().length).toBe(0);
    specialDayStub.items.set([]);
  });
});
