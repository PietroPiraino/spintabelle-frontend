import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../../environments/environment';
import { Lesson, Paginated } from '../models/api.models';
import { LessonsService } from './lessons.service';

const API = environment.API_URL;

const emptyPage: Paginated<Lesson> = {
  items: [],
  total: 0,
  page: 1,
  limit: 24,
  totalPages: 1,
};

describe('LessonsService', () => {
  let service: LessonsService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });
    service = TestBed.inject(LessonsService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('invia SEMPRE page e limit (è ciò che fa rispondere envelope al backend)', () => {
    service.getLessons().subscribe();

    const req = http.expectOne((r) => r.url === `${API}/lessons`);
    expect(req.request.params.get('page')).toBe('1');
    expect(req.request.params.get('limit')).toBe('24');
    expect(req.request.params.has('q')).toBeFalse();
    expect(req.request.params.has('tags')).toBeFalse();
    expect(req.request.params.has('visibility')).toBeFalse();
    req.flush(emptyPage);
  });

  it('serializza i filtri: tags in CSV, q e visibility solo se presenti', () => {
    service
      .getLessons({
        page: 3,
        limit: 10,
        q: 'icm',
        tags: ['icm', '3bet'],
        visibility: 'SUBSCRIBER',
      })
      .subscribe();

    const req = http.expectOne((r) => r.url === `${API}/lessons`);
    expect(req.request.params.get('page')).toBe('3');
    expect(req.request.params.get('limit')).toBe('10');
    expect(req.request.params.get('q')).toBe('icm');
    expect(req.request.params.get('tags')).toBe('icm,3bet');
    expect(req.request.params.get('visibility')).toBe('SUBSCRIBER');
    req.flush({ ...emptyPage, page: 3, limit: 10 });
  });
});
