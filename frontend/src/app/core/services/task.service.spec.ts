// src/app/core/services/task.service.spec.ts
import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { TaskService, Task } from './task.service';
import { environment } from '../../../environments/environment';

const base = `${environment.apiUrl}/tasks`;

const mockTask = (over: Partial<Task> = {}): Task => ({
  _id: 't1', title: 'Test', status: 'active', priority: 'medium', ...over,
});

describe('TaskService', () => {
  let service: TaskService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [TaskService],
    });
    service = TestBed.inject(TaskService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('is created with an empty tasks signal', () => {
    expect(service).toBeTruthy();
    expect(service.tasks()).toEqual([]);
  });

  it('loadTasks() GETs the collection and populates the signal', () => {
    const data = [mockTask({ _id: 'a' }), mockTask({ _id: 'b' })];
    service.loadTasks().subscribe();

    const req = http.expectOne(base);
    expect(req.request.method).toBe('GET');
    req.flush({ success: true, data });

    expect(service.tasks().length).toBe(2);
    expect(service.tasks()[0]._id).toBe('a');
  });

  it('loadTasks(params) forwards status/category/priority as query params', () => {
    service.loadTasks({ status: 'done', priority: 'high' }).subscribe();
    const req = http.expectOne(
      (r) => r.url === base && r.params.get('status') === 'done' && r.params.get('priority') === 'high'
    );
    expect(req.request.method).toBe('GET');
    req.flush({ success: true, data: [] });
  });

  it('createTask() POSTs and prepends the new task to the signal', () => {
    service.createTask({ title: 'New' }).subscribe();
    const req = http.expectOne(base);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ title: 'New' });
    req.flush({ success: true, data: mockTask({ _id: 'new', title: 'New' }) });

    expect(service.tasks()[0]._id).toBe('new');
  });

  it('toggleDone() PATCHes the toggle endpoint and replaces the task in place', () => {
    // seed the signal
    service.createTask({ title: 'x' }).subscribe();
    http.expectOne(base).flush({ success: true, data: mockTask({ _id: 't1', status: 'active' }) });

    service.toggleDone('t1').subscribe();
    const req = http.expectOne(`${base}/t1/toggle`);
    expect(req.request.method).toBe('PATCH');
    req.flush({ success: true, data: mockTask({ _id: 't1', status: 'done' }) });

    expect(service.tasks()[0].status).toBe('done');
  });

  it('updateTask() PUTs and replaces the matching task', () => {
    service.createTask({ title: 'x' }).subscribe();
    http.expectOne(base).flush({ success: true, data: mockTask({ _id: 't1', title: 'x' }) });

    service.updateTask('t1', { title: 'renamed' }).subscribe();
    const req = http.expectOne(`${base}/t1`);
    expect(req.request.method).toBe('PUT');
    req.flush({ success: true, data: mockTask({ _id: 't1', title: 'renamed' }) });

    expect(service.tasks()[0].title).toBe('renamed');
  });

  it('deleteTask() DELETEs and removes the task from the signal', () => {
    service.createTask({ title: 'x' }).subscribe();
    http.expectOne(base).flush({ success: true, data: mockTask({ _id: 't1' }) });
    expect(service.tasks().length).toBe(1);

    service.deleteTask('t1').subscribe();
    const req = http.expectOne(`${base}/t1`);
    expect(req.request.method).toBe('DELETE');
    req.flush({ success: true });

    expect(service.tasks().length).toBe(0);
  });

  it('getTask() GETs a single task without mutating the signal', () => {
    service.getTask('t9').subscribe((res) => expect(res.data._id).toBe('t9'));
    const req = http.expectOne(`${base}/t9`);
    expect(req.request.method).toBe('GET');
    req.flush({ success: true, data: mockTask({ _id: 't9' }) });
    expect(service.tasks()).toEqual([]);
  });
});
