// src/app/special-days/special-days.component.spec.ts
import { TestBed, ComponentFixture } from '@angular/core/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { Router } from '@angular/router';
import { ToastController } from '@ionic/angular/standalone';
import { SpecialDaysComponent, SpecialDay } from './special-days.component';

const sd = (over: Partial<SpecialDay> = {}): SpecialDay => ({
  _id: Math.random().toString(), name: 'X', type: 'birthday', month: 1, day: 1, ...over,
});

describe('SpecialDaysComponent', () => {
  let fixture: ComponentFixture<SpecialDaysComponent>;
  let component: SpecialDaysComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SpecialDaysComponent, HttpClientTestingModule],
      providers: [
        { provide: Router, useValue: { navigate: jasmine.createSpy('navigate') } },
        { provide: ToastController, useValue: { create: () => Promise.resolve({ present: () => Promise.resolve() }) } },
      ],
    })
      .overrideComponent(SpecialDaysComponent, { set: { template: '' } })
      .compileComponents();

    fixture = TestBed.createComponent(SpecialDaysComponent);
    component = fixture.componentInstance;
  });

  it('creates', () => {
    expect(component).toBeTruthy();
  });

  it('typeLabel() maps enum values to display labels', () => {
    expect(component.typeLabel('birthday')).toBe('Birthday');
    expect(component.typeLabel('anniversary')).toBe('Anniversary');
    expect(component.typeLabel('event')).toBe('Event');
  });

  it('countdownLabel() handles today, future and undefined', () => {
    expect(component.countdownLabel(0)).toBe('Today!');
    expect(component.countdownLabel(5)).toBe('in 5 days');
    expect(component.countdownLabel(undefined)).toBe('');
  });

  it('initials() takes up to two uppercase initials', () => {
    expect(component.initials('Ada Lovelace')).toBe('AL');
    expect(component.initials('cher')).toBe('C');
  });

  it('filteredItems() returns everything when filter is All', () => {
    component.items.set([sd({ type: 'birthday' }), sd({ type: 'event' })]);
    component.setFilter('All');
    expect(component.filteredItems().length).toBe(2);
  });

  it('filteredItems() narrows to the selected category', () => {
    component.items.set([sd({ type: 'birthday' }), sd({ type: 'anniversary' }), sd({ type: 'event' })]);
    component.setFilter('Birthdays');
    expect(component.filteredItems().every((i) => i.type === 'birthday')).toBe(true);

    component.setFilter('Anniversaries');
    expect(component.filteredItems()[0].type).toBe('anniversary');
  });

  it('featured() prefers an item within 30 days, else the first', () => {
    component.items.set([sd({ name: 'far', daysUntil: 200 }), sd({ name: 'soon', daysUntil: 5 })]);
    expect(component.featured()?.name).toBe('soon');

    component.items.set([sd({ name: 'only', daysUntil: 200 })]);
    expect(component.featured()?.name).toBe('only');
  });

  it('updateForm() patches a single field immutably', () => {
    component.updateForm('day', 15);
    expect(component.form().day).toBe(15);
    component.updateForm('name', 'Party');
    expect(component.form().name).toBe('Party');
    expect(component.form().day).toBe(15); // previous field retained
  });
});
