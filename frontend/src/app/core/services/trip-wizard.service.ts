import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { WizardPlan, WizardGenerateRequest, Trip } from '../../types/schema.types';

@Injectable({ providedIn: 'root' })
export class TripWizardService {
  private http = inject(HttpClient);

  generate(payload: WizardGenerateRequest) {
    return this.http.post<WizardPlan>('/api/trips/wizard/generate', payload);
  }

  confirm(plan: WizardPlan) {
    return this.http.post<Trip>('/api/trips/wizard/confirm', plan);
  }
}
