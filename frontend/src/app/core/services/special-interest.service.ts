import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { SpecialInterestPlace, ScrapedSiteInfo } from '../../types/schema.types';

@Injectable({ providedIn: 'root' })
export class SpecialInterestService {
  private http = inject(HttpClient);
  private base = '/api/special-interests';

  list()               { return this.http.get<SpecialInterestPlace[]>(this.base); }
  get(id: number)      { return this.http.get<SpecialInterestPlace>(`${this.base}/${id}`); }
  create(body: Partial<SpecialInterestPlace> | Record<string, unknown>) { return this.http.post<SpecialInterestPlace>(this.base, body); }
  update(id: number, body: Partial<SpecialInterestPlace> | Record<string, unknown>) { return this.http.put<SpecialInterestPlace>(`${this.base}/${id}`, body); }
  delete(id: number)   { return this.http.delete<void>(`${this.base}/${id}`); }

  logVisit(id: number) {
    return this.http.patch<{ visit_count: number }>(`${this.base}/${id}/visit`, {});
  }

  saveSiteInfo(id: number, site_info: ScrapedSiteInfo | null) {
    return this.http.patch<SpecialInterestPlace>(`${this.base}/${id}/site-info`, { site_info });
  }
}
