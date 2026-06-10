import {
  Component, OnInit, ChangeDetectionStrategy, inject, signal, computed,
} from '@angular/core';
import { DatePipe } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { forkJoin } from 'rxjs';
import { GoogleMap, MapAdvancedMarker } from '@angular/google-maps';
import { DragDropModule, CdkDragDrop, moveItemInArray } from '@angular/cdk/drag-drop';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { TripService } from '../../../core/services/trip.service';
import { StopService } from '../../../core/services/stop.service';
import { DestinationService } from '../../../core/services/destination.service';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import {
  PlacesAutocompleteComponent, PlaceSelectedEvent,
} from '../../../shared/components/places-autocomplete/places-autocomplete.component';
import { Trip, TripStop, Destination } from '../../../types/schema.types';

function numberedPinEl(order: number): HTMLElement {
  const el = document.createElement('div');
  el.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28">
    <circle cx="14" cy="14" r="12" fill="#00695C" stroke="white" stroke-width="2"/>
    <text x="14" y="19" font-family="Arial" font-size="11" font-weight="bold"
          fill="white" text-anchor="middle">${order}</text></svg>`;
  return el.firstElementChild as HTMLElement;
}

@Component({
  selector: 'app-trip-edit-wizard',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterLink, DatePipe, GoogleMap, MapAdvancedMarker, DragDropModule,
    MatButtonModule, MatIconModule, MatProgressSpinnerModule, MatTooltipModule,
    MatSnackBarModule, PageHeaderComponent, PlacesAutocompleteComponent,
  ],
  styles: [`
    .wizard-wrap { max-width:900px; margin:0 auto; padding:24px; overflow-x:hidden; }
    .step-title { font-size:22px; font-weight:700; margin:0 0 6px; }
    .step-sub   { color:var(--wp-text-secondary); margin:0 0 20px; }

    .route-map-compact {
      height:200px; border-radius:12px; overflow:hidden;
      border:1px solid var(--wp-border); margin-bottom:16px;
      background:var(--wp-surface-variant);
    }

    .route-stop-card {
      display:flex; align-items:center; gap:12px; padding:14px 16px;
      border-radius:10px; background:var(--wp-surface); box-shadow:0 1px 4px var(--wp-shadow);
      margin-bottom:10px;
    }
    .route-stop-num {
      flex-shrink:0; width:28px; height:28px; border-radius:50%; background:#00695C; color:#fff;
      display:flex; align-items:center; justify-content:center; font-size:13px; font-weight:700;
    }
    .route-stop-body  { flex:1; min-width:0; }
    .route-stop-city  { font-size:15px; font-weight:700; margin:0 0 2px; }
    .route-stop-dates { font-size:12px; color:var(--wp-text-secondary); margin:0; }
    .drag-handle {
      flex-shrink:0; display:flex; align-items:center; cursor:grab;
      color:var(--wp-text-hint); touch-action:none;
    }
    .drag-handle:active { cursor:grabbing; }

    .add-stop-row { display:flex; align-items:center; justify-content:center; padding:6px 0; }
    .add-stop-btn {
      font-size:12px; color:var(--wp-text-hint); cursor:pointer;
      border:1.5px dashed var(--wp-border); border-radius:20px;
      padding:4px 16px; background:none; transition:all .2s;
      display:flex; align-items:center; gap:4px;
    }
    .add-stop-btn:hover { border-color:var(--wp-primary); color:var(--wp-primary); background:color-mix(in srgb,var(--wp-primary) 5%,transparent); }
    .insert-stop-form  { width:100%; padding:10px 0; }
    .insert-stop-label { font-size:12px; color:var(--wp-text-secondary); margin:0 0 6px; }
    .insert-spinner    { display:flex; align-items:center; gap:8px; padding:8px 0; font-size:13px; color:var(--wp-text-secondary); }

    .cdk-drag-preview { box-shadow:0 4px 12px rgba(0,0,0,.2); border-radius:10px; }
    .cdk-drag-placeholder { opacity:0.3; }
    .cdk-drag-animating { transition:transform 200ms cubic-bezier(0,0,0.2,1); }

    .wizard-actions { display:flex; gap:12px; justify-content:flex-end; margin-top:24px; }

    @media (max-width:768px) {
      .wizard-wrap { padding:16px 16px 100px; }
    }
  `],
  template: `
    <app-page-header title="Edit Route & Stops" [backRoute]="'/trips/' + tripId" />
    @if (loading()) {
      <div class="loading-wrap"><mat-spinner diameter="48" /></div>
    } @else {
      <div class="wizard-wrap">
        <p class="step-title">Edit Route & Stops</p>
        <p class="step-sub">Drag to reorder, or add and remove stops along your route.</p>

        <div class="route-map-compact">
          <google-map width="100%" height="200px" [options]="mapOpts" [center]="mapCenter()" [zoom]="mapZoom()">
            @for (m of stopMarkers(); track m.stopId) {
              <map-advanced-marker [position]="m.position" [content]="m.content" />
            }
          </google-map>
        </div>

        <div cdkDropList (cdkDropListDropped)="onDrop($event)">
          <div class="add-stop-row">
            @if (insertingAfter() === 0) {
              <div class="insert-stop-form">
                <p class="insert-stop-label">Add a stop before {{ stops()[0].destination?.city || 'your first stop' }}</p>
                @if (insertLoading()) {
                  <div class="insert-spinner"><mat-spinner diameter="20" /><span>Adding stop…</span></div>
                } @else {
                  <app-places-autocomplete placeholder="Search city or address…" [types]="['(cities)']"
                    (placeSelected)="onInsertPlaceSelected($event, 0)" />
                  <button type="button" mat-stroked-button style="font-size:12px" (click)="insertingAfter.set(null)">Cancel</button>
                }
              </div>
            } @else {
              <button class="add-stop-btn" (click)="insertingAfter.set(0)">
                <mat-icon style="font-size:16px;width:16px;height:16px">add</mat-icon>
                Add a stop here
              </button>
            }
          </div>

          @for (stop of stops(); track stop.id; let i = $index) {
            <div class="route-stop-card" cdkDrag>
              <div class="drag-handle" cdkDragHandle><mat-icon>drag_indicator</mat-icon></div>
              <div class="route-stop-num">{{ i + 1 }}</div>
              <div class="route-stop-body">
                <p class="route-stop-city">{{ stop.destination?.city }}, {{ stop.destination?.state_province }}</p>
                @if (stop.arrival_date || stop.departure_date) {
                  <p class="route-stop-dates">{{ stop.arrival_date | date:'MMM d' }} → {{ stop.departure_date | date:'MMM d' }}</p>
                }
              </div>
              <button mat-icon-button color="warn" matTooltip="Remove this stop"
                      [disabled]="stops().length <= 1" (click)="removeStop(stop)">
                <mat-icon>close</mat-icon>
              </button>
            </div>

            <div class="add-stop-row">
              @if (insertingAfter() === i + 1) {
                <div class="insert-stop-form">
                  <p class="insert-stop-label">Add a stop after {{ stop.destination?.city }}, {{ stop.destination?.state_province }}</p>
                  @if (insertLoading()) {
                    <div class="insert-spinner"><mat-spinner diameter="20" /><span>Adding stop…</span></div>
                  } @else {
                    <app-places-autocomplete placeholder="Search city or address…" [types]="['(cities)']"
                      (placeSelected)="onInsertPlaceSelected($event, i + 1)" />
                    <button type="button" mat-stroked-button style="font-size:12px" (click)="insertingAfter.set(null)">Cancel</button>
                  }
                </div>
              } @else {
                <button class="add-stop-btn" (click)="insertingAfter.set(i + 1)">
                  <mat-icon style="font-size:16px;width:16px;height:16px">add</mat-icon>
                  Add a stop here
                </button>
              }
            </div>
          }
        </div>

        <div class="wizard-actions">
          <button mat-raised-button color="primary" [routerLink]="['/trips', tripId]">Done</button>
        </div>
      </div>
    }
  `,
})
export class TripEditWizardComponent implements OnInit {
  private route   = inject(ActivatedRoute);
  private router  = inject(Router);
  private tripSvc = inject(TripService);
  private stopSvc = inject(StopService);
  private destSvc = inject(DestinationService);
  private snack   = inject(MatSnackBar);

  readonly tripId = +this.route.snapshot.paramMap.get('id')!;

  loading = signal(true);
  trip    = signal<Trip | null>(null);
  stops   = signal<TripStop[]>([]);

  insertingAfter = signal<number | null>(null);
  insertLoading  = signal(false);

  readonly mapOpts: google.maps.MapOptions = {
    mapId:             'DEMO_MAP_ID',
    streetViewControl: false,
    fullscreenControl: false,
    mapTypeControl:    false,
    zoomControl:       true,
  };

  ngOnInit() {
    forkJoin([this.tripSvc.get(this.tripId), this.stopSvc.list(this.tripId)]).subscribe({
      next: ([trip, stops]) => {
        this.trip.set(trip);
        this.stops.set([...stops].sort((a, b) => a.stop_order - b.stop_order));
        this.loading.set(false);
      },
      error: () => this.router.navigate(['/trips', this.tripId]),
    });
  }

  private destinationsWithCoords(): Destination[] {
    return this.stops()
      .map(s => s.destination)
      .filter((d): d is Destination => !!d?.latitude && !!d?.longitude);
  }

  mapCenter = computed<google.maps.LatLngLiteral>(() => {
    const pts = this.destinationsWithCoords();
    if (!pts.length) return { lat: 39.5, lng: -98.35 };
    return {
      lat: pts.reduce((sum, d) => sum + d.latitude!, 0) / pts.length,
      lng: pts.reduce((sum, d) => sum + d.longitude!, 0) / pts.length,
    };
  });

  mapZoom = computed(() => {
    const pts = this.destinationsWithCoords();
    if (pts.length <= 1) return 6;
    const lats = pts.map(d => d.latitude!);
    const lngs = pts.map(d => d.longitude!);
    const spread = Math.max(Math.max(...lats) - Math.min(...lats), Math.max(...lngs) - Math.min(...lngs));
    if (spread > 15) return 4;
    if (spread > 8)  return 5;
    if (spread > 4)  return 6;
    if (spread > 2)  return 7;
    return 8;
  });

  stopMarkers = computed(() =>
    this.stops()
      .map((s, i) => {
        const d = s.destination;
        if (!d?.latitude || !d?.longitude) return null;
        return { stopId: s.id, position: { lat: d.latitude, lng: d.longitude }, content: numberedPinEl(i + 1) };
      })
      .filter((m): m is { stopId: number; position: google.maps.LatLngLiteral; content: HTMLElement } => !!m),
  );

  onDrop(event: CdkDragDrop<TripStop[]>) {
    if (event.previousIndex === event.currentIndex) return;
    const list = [...this.stops()];
    moveItemInArray(list, event.previousIndex, event.currentIndex);
    this.stops.set(list);
    this.persistOrder();
  }

  removeStop(stop: TripStop) {
    if (this.stops().length <= 1) return;
    if (!confirm(`Remove ${stop.destination?.city ?? 'this stop'} from your route?`)) return;
    this.stopSvc.delete(this.tripId, stop.id).subscribe({
      next: () => {
        this.stops.update(list => list.filter(s => s.id !== stop.id));
        this.persistOrder();
      },
      error: () => this.snack.open('Failed to remove stop', 'Dismiss', { duration: 3000 }),
    });
  }

  onInsertPlaceSelected(e: PlaceSelectedEvent, index: number) {
    this.insertLoading.set(true);
    this.destSvc.create({
      name: e.name, city: e.city, state_province: e.state_province,
      country: e.country, latitude: e.lat, longitude: e.lng, status: 'planned',
    }).subscribe({
      next: (dest) => this.createStopAt(index, dest.id),
      error: (err: HttpErrorResponse) => {
        if (err.status === 409 && err.error?.duplicate && err.error?.existing?.id) {
          this.createStopAt(index, err.error.existing.id);
          return;
        }
        this.snack.open('Failed to save destination', 'Dismiss', { duration: 3000 });
        this.insertLoading.set(false);
      },
    });
  }

  private createStopAt(index: number, destinationId: number) {
    this.stopSvc.create(this.tripId, {
      destination_id: destinationId,
      stop_order:     this.stops().length + 1,
      status:         'upcoming',
      arrival_date:   null,
      departure_date: null,
    }).subscribe({
      next: (created) => {
        this.stopSvc.list(this.tripId).subscribe({
          next: (fresh) => {
            const list = [...fresh].sort((a, b) => a.stop_order - b.stop_order);
            const newIdx = list.findIndex(s => s.id === created.id);
            if (newIdx >= 0) {
              const [item] = list.splice(newIdx, 1);
              list.splice(index, 0, item);
            }
            this.stops.set(list);
            this.persistOrder();
            this.insertingAfter.set(null);
            this.insertLoading.set(false);
          },
          error: () => {
            this.snack.open('Stop added but list refresh failed', 'Dismiss', { duration: 3000 });
            this.insertLoading.set(false);
            this.insertingAfter.set(null);
          },
        });
      },
      error: () => {
        this.snack.open('Failed to add stop', 'Dismiss', { duration: 3000 });
        this.insertLoading.set(false);
      },
    });
  }

  private persistOrder() {
    if (!this.stops().length) return;
    this.stopSvc.reorder(this.tripId, this.stops().map(s => s.id)).subscribe({
      error: () => this.snack.open('Failed to save new order', 'Dismiss', { duration: 3000 }),
    });
  }
}
