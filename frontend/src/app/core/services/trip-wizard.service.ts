import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import {
  WizardPlan, WizardGenerateRequest, Trip,
  WizardEnrichStopRequest, WizardEnrichStopResponse,
} from '../../types/schema.types';

@Injectable({ providedIn: 'root' })
export class TripWizardService {
  private http = inject(HttpClient);

  generate(payload: WizardGenerateRequest) {
    return this.http.post<WizardPlan>('/api/trips/wizard/generate', payload);
  }

  enrichStop(payload: WizardEnrichStopRequest) {
    return this.http.post<WizardEnrichStopResponse>('/api/trips/wizard/enrich-stop', payload);
  }

  confirm(plan: WizardPlan) {
    return this.http.post<Trip>('/api/trips/wizard/confirm', plan);
  }
}
