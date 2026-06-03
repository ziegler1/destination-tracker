import {
  Component, AfterViewInit, OnDestroy, ViewChild, ElementRef,
  ChangeDetectionStrategy, NgZone, inject, signal, computed,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { forkJoin } from 'rxjs';
import * as L from 'leaflet';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatSelectModule } from '@angular/material/select';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatDividerModule } from '@angular/material/divider';
import { DestinationService } from '../../core/services/destination.service';
import { TripService } from '../../core/services/trip.service';
import { Destination, DestinationStatus, Trip, PointOfInterest } from '../../types/schema.types';

// ── Marker factories ──────────────────────────────────────────────────────
const STATUS_COLOR: Record<DestinationStatus, string> = {
  want_to_visit: '#1565c0',
  planned:       '#f57f17',
  visited:       '#2e7d32',
};

function destIcon(status: DestinationStatus): L.DivIcon {
  const c = STATUS_COLOR[status];
  return L.divIcon({
    html: `<div style="width:13px;height:13px;border-radius:50%;background:${c};border:2px solid white;box-shadow:0 2px 6px rgba(0,0,0,.35)"></div>`,
    iconSize: [13, 13], iconAnchor: [6, 6], popupAnchor: [0, -8], className: '',
  });
}

function stopIcon(order: number): L.DivIcon {
  return L.divIcon({
    html: `<div style="width:26px;height:26px;border-radius:50%;background:#00695C;color:white;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;border:2px solid white;box-shadow:0 2px 6px rgba(0,0,0,.4)">${order}</div>`,
    iconSize: [26, 26], iconAnchor: [13, 13], popupAnchor: [0, -14], className: '',
  });
}

function poiIcon(): L.DivIcon {
  return L.divIcon({
    html: `<div style="width:11px;height:11px;border-radius:2px;background:#e65100;border:2px solid white;box-shadow:0 1px 4px rgba(0,0,0,.35);transform:rotate(45deg)"></div>`,
    iconSize: [11, 11], iconAnchor: [5, 5], popupAnchor: [0, -8], className: '',
  });
}

// ── Component ─────────────────────────────────────────────────────────────
@Component({
  selector: 'app-map',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormsModule, MatCardModule, MatButtonModule, MatIconModule,
    MatCheckboxModule, MatSelectModule, MatProgressSpinnerModule, MatDividerModule,
  ],
  styles: [`
    :host { display:block; position:relative; }
    .map-el { width:100%; height:calc(100vh - 56px); }
    .controls {
      position:absolute; top:16px; right:16px; z-index:1001; width:220px;
      padding:14px; border-radius:12px;
      background:var(--wp-surface); box-shadow:0 4px 16px var(--wp-shadow);
    }
    .ctrl-title {
      font-size:11px; font-weight:600; text-transform:uppercase;
      letter-spacing:.8px; color:var(--wp-text-hint); margin-bottom:8px;
    }
    .ctrl-row { display:flex; align-items:center; gap:8px; margin-bottom:6px; }
    .legend {
      position:absolute; bottom:32px; left:16px; z-index:1001;
      padding:10px 14px; border-radius:10px;
      background:var(--wp-surface); box-shadow:0 2px 8px var(--wp-shadow);
    }
    .leg-row { display:flex; align-items:center; gap:8px; font-size:12px; margin-bottom:4px; }
    .leg-dot { width:11px; height:11px; border-radius:50%; flex-shrink:0; }
    .leg-sq  { width:9px; height:9px; border-radius:1px; transform:rotate(45deg); flex-shrink:0; background:#e65100; }
    .loading-overlay {
      position:absolute; inset:0; display:flex; align-items:center;
      justify-content:center; background:rgba(255,255,255,.65); z-index:2000;
    }
  `],
  template: `
    <div #mapEl class="map-el"></div>

    @if (loading()) {
      <div class="loading-overlay"><mat-spinner diameter="48" /></div>
    }

    <!-- Controls panel -->
    <div class="controls">
      <div class="ctrl-title">Layers</div>
      <div class="ctrl-row">
        <mat-checkbox [(ngModel)]="showDestinations" (change)="toggleDestLayer($event.checked)">
          Destinations ({{ validDestCount() }})
        </mat-checkbox>
      </div>
      <div class="ctrl-row">
        <mat-checkbox [(ngModel)]="showPOIs" (change)="togglePoiLayer($event.checked)">
          Points of Interest
        </mat-checkbox>
      </div>
      <mat-divider style="margin:10px 0" />
      <div class="ctrl-title">Trip Route</div>
      <mat-select [(ngModel)]="selectedTripId"
                  (selectionChange)="onTripSelect($event.value)"
                  placeholder="Select a trip" style="width:100%;font-size:13px">
        <mat-option [value]="null">— None —</mat-option>
        @for (t of trips(); track t.id) {
          <mat-option [value]="t.id">{{ t.name }}</mat-option>
        }
      </mat-select>
    </div>

    <!-- Legend -->
    <div class="legend">
      <div class="leg-row"><div class="leg-dot" style="background:#1565c0"></div> Want to Visit</div>
      <div class="leg-row"><div class="leg-dot" style="background:#f57f17"></div> Planned</div>
      <div class="leg-row"><div class="leg-dot" style="background:#2e7d32"></div> Visited</div>
      <div class="leg-row"><div class="leg-sq"></div> Point of Interest</div>
    </div>
  `,
})
export class MapComponent implements AfterViewInit, OnDestroy {
  @ViewChild('mapEl', { static: true }) mapEl!: ElementRef<HTMLDivElement>;

  private ngZone  = inject(NgZone);
  private router  = inject(Router);
  private destSvc = inject(DestinationService);
  private tripSvc = inject(TripService);

  loading      = signal(true);
  destinations = signal<Destination[]>([]);
  trips        = signal<Trip[]>([]);

  showDestinations = true;
  showPOIs         = false;
  selectedTripId: number | null = null;

  validDestCount = computed(() =>
    this.destinations().filter((d) => d.latitude != null && d.longitude != null).length,
  );

  private map!: L.Map;
  private destLayer  = L.layerGroup();
  private poiLayer   = L.layerGroup();
  private routeLayer = L.layerGroup();

  ngAfterViewInit() {
    this.ngZone.runOutsideAngular(() => this.initMap());

    forkJoin([this.destSvc.list(), this.tripSvc.list()]).subscribe({
      next: ([dests, trips]) => {
        this.destinations.set(dests);
        this.trips.set(trips);
        this.ngZone.runOutsideAngular(() => {
          this.plotDestinations(dests);
          this.plotPOIs(dests);
        });
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });

    // Expose router for Leaflet popup buttons
    (window as unknown as Record<string, unknown>)['_wpNav'] = (path: string) =>
      this.ngZone.run(() => this.router.navigateByUrl(path));
  }

  ngOnDestroy() {
    this.map?.remove();
    delete (window as unknown as Record<string, unknown>)['_wpNav'];
  }

  private initMap() {
    this.map = L.map(this.mapEl.nativeElement, { center: [39.5, -98.35], zoom: 4 });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 18,
    }).addTo(this.map);

    this.destLayer.addTo(this.map);
    this.routeLayer.addTo(this.map);
  }

  private plotDestinations(dests: Destination[]) {
    this.destLayer.clearLayers();
    for (const d of dests) {
      if (d.latitude == null || d.longitude == null) continue;
      const stars = '★'.repeat(d.rating ?? 0) + '☆'.repeat(5 - (d.rating ?? 0));
      const statusLabel = d.status.replace(/_/g, ' ');
      const popup = `
        <div style="min-width:170px;font-family:Roboto,sans-serif">
          <strong style="font-size:14px">${d.name}</strong><br/>
          <span style="color:#666;font-size:12px">${d.city}, ${d.state_province}</span><br/>
          <span style="font-size:12px;color:#888;text-transform:capitalize">${statusLabel}</span><br/>
          <span style="color:#f57f17;font-size:14px">${stars}</span><br/>
          <button onclick="window._wpNav('/destinations/${d.id}')"
            style="margin-top:8px;padding:4px 14px;background:#00695C;color:white;
                   border:none;border-radius:4px;cursor:pointer;font-size:13px">
            View →
          </button>
        </div>`;
      L.marker([Number(d.latitude), Number(d.longitude)], { icon: destIcon(d.status) })
        .bindPopup(popup)
        .addTo(this.destLayer);
    }
  }

  private plotPOIs(dests: Destination[]) {
    this.poiLayer.clearLayers();
    for (const d of dests) {
      for (const p of (d.pois ?? []) as PointOfInterest[]) {
        if (p.latitude == null || p.longitude == null) continue;
        L.marker([Number(p.latitude), Number(p.longitude)], { icon: poiIcon() })
          .bindPopup(
            `<strong>${p.name}</strong><br/>
             <span style="color:#666;font-size:12px">${d.name}</span>`,
          )
          .addTo(this.poiLayer);
      }
    }
  }

  toggleDestLayer(show: boolean) {
    this.ngZone.runOutsideAngular(() => {
      if (show) this.destLayer.addTo(this.map);
      else this.destLayer.remove();
    });
  }

  togglePoiLayer(show: boolean) {
    this.ngZone.runOutsideAngular(() => {
      if (show) this.poiLayer.addTo(this.map);
      else this.poiLayer.remove();
    });
  }

  onTripSelect(tripId: number | null) {
    this.ngZone.runOutsideAngular(() => this.routeLayer.clearLayers());
    if (!tripId) return;
    this.tripSvc.get(tripId).subscribe((trip) =>
      this.ngZone.runOutsideAngular(() => this.drawRoute(trip)),
    );
  }

  private drawRoute(trip: Trip) {
    this.routeLayer.clearLayers();
    const stops = [...(trip.stops ?? [])]
      .sort((a, b) => a.stop_order - b.stop_order)
      .filter((s) => s.destination?.latitude != null && s.destination?.longitude != null);

    if (!stops.length) return;

    const latlngs: [number, number][] = stops.map((s) => [
      Number(s.destination!.latitude),
      Number(s.destination!.longitude),
    ]);

    L.polyline(latlngs, { color: '#00695C', weight: 3, dashArray: '10,8', opacity: 0.85 })
      .addTo(this.routeLayer);

    for (const stop of stops) {
      L.marker(
        [Number(stop.destination!.latitude), Number(stop.destination!.longitude)],
        { icon: stopIcon(stop.stop_order) },
      )
        .bindPopup(
          `<strong>Stop ${stop.stop_order}: ${stop.destination!.name}</strong><br/>
           <span style="color:#666;font-size:12px">${stop.destination!.city}, ${stop.destination!.state_province}</span>`,
        )
        .addTo(this.routeLayer);
    }

    this.map.fitBounds(latlngs, { padding: [60, 60], maxZoom: 10 });
  }
}
