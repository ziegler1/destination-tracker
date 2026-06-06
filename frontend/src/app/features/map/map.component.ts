import {
  Component, OnInit, ChangeDetectionStrategy, inject, signal, computed,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { GoogleMap, MapMarker, MapInfoWindow, MapDirectionsRenderer } from '@angular/google-maps';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatSelectModule } from '@angular/material/select';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatDividerModule } from '@angular/material/divider';
import { DestinationService } from '../../core/services/destination.service';
import { TripService } from '../../core/services/trip.service';
import { MapsService } from '../../core/services/maps.service';
import { Destination, DestinationStatus, Trip } from '../../types/schema.types';
import { forkJoin } from 'rxjs';

const STATUS_COLORS: Record<DestinationStatus, string> = {
  want_to_visit: '#1565c0',
  planned:       '#f57f17',
  visited:       '#2e7d32',
};

function destIconSvg(status: DestinationStatus): string {
  const c = STATUS_COLORS[status];
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18">
    <circle cx="9" cy="9" r="7" fill="${c}" stroke="white" stroke-width="2"/>
  </svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

function stopIconSvg(n: number, color = '#00695C'): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28">
    <circle cx="14" cy="14" r="12" fill="${color}" stroke="white" stroke-width="2"/>
    <text x="14" y="19" font-family="Arial" font-size="11" font-weight="bold"
          fill="white" text-anchor="middle">${n}</text>
  </svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

const TRIP_COLORS = ['#1565c0','#c62828','#6a1b9a','#e65100','#1b5e20','#0277bd','#880e4f','#33691e'];

@Component({
  selector: 'app-map',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormsModule, GoogleMap, MapMarker, MapInfoWindow, MapDirectionsRenderer,
    MatCardModule, MatButtonModule, MatIconModule,
    MatCheckboxModule, MatSelectModule, MatProgressSpinnerModule, MatDividerModule,
  ],
  styles: [`
    :host { display:block; position:relative; height:calc(100vh - 56px); }
    .controls {
      position:absolute; top:16px; right:16px; z-index:1001; width:220px;
      padding:14px; border-radius:12px;
      background:var(--wp-surface); box-shadow:0 4px 16px var(--wp-shadow);
    }
    .ctrl-title {
      font-size:11px; font-weight:600; text-transform:uppercase;
      letter-spacing:.8px; color:var(--wp-text-hint); margin-bottom:8px;
    }
    .ctrl-row { display:flex; align-items:center; gap:8px; margin-bottom:6px; font-size:13px; }
    .legend {
      position:absolute; bottom:32px; left:16px; z-index:1001;
      padding:10px 14px; border-radius:10px;
      background:var(--wp-surface); box-shadow:0 2px 8px var(--wp-shadow);
    }
    .leg-row { display:flex; align-items:center; gap:8px; font-size:12px; margin-bottom:4px; }
    .leg-dot { width:11px; height:11px; border-radius:50%; flex-shrink:0; }
  `],
  template: `
    @if (loading()) {
      <div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;z-index:2000;background:rgba(255,255,255,.6)">
        <mat-spinner diameter="48" />
      </div>
    }

    <google-map
      height="100%"
      width="100%"
      [center]="mapCenter"
      [zoom]="4"
      [options]="mapOptions">

      <!-- Destination markers -->
      @if (showDestinations) {
        @for (d of validDests(); track d.id) {
          <map-marker
            [position]="{ lat: +d.latitude!, lng: +d.longitude! }"
            [options]="destMarkerOptions(d)"
            [title]="d.name"
            (mapClick)="openDestInfo(d, destMarker)"
            #destMarker="mapMarker" />
        }
      }

      <!-- Trip route stops -->
      @if (directionsResult()) {
        <map-directions-renderer
          [directions]="directionsResult()!"
          [options]="{ suppressMarkers: true, polylineOptions: { strokeColor: '#00695C', strokeOpacity: 0.8, strokeWeight: 4 } }" />
      }
      @for (s of tripStopMarkers(); track s.label) {
        <map-marker [position]="s.position" [options]="s.options" [title]="s.label" />
      }

      <map-info-window #infoWindow>
        @if (selectedDest()) {
          <div style="min-width:160px;font-family:Roboto,sans-serif;padding:4px">
            <strong style="font-size:14px">{{ selectedDest()!.name }}</strong><br/>
            <small style="color:#666">{{ selectedDest()!.city }}, {{ selectedDest()!.state_province }}</small><br/>
            <span style="font-size:12px;text-transform:capitalize;color:#888">{{ selectedDest()!.status.replace('_',' ') }}</span><br/>
            <button (click)="router.navigate(['/destinations', selectedDest()!.id])"
              style="margin-top:8px;padding:4px 12px;background:#00695C;color:white;border:none;
                     border-radius:4px;cursor:pointer;font-size:12px">
              View →
            </button>
          </div>
        }
      </map-info-window>
    </google-map>

    <!-- Controls panel -->
    <div class="controls">
      <div class="ctrl-title">Layers</div>
      <div class="ctrl-row">
        <mat-checkbox [(ngModel)]="showDestinations">
          Destinations ({{ validDests().length }})
        </mat-checkbox>
      </div>
      <mat-divider style="margin:10px 0" />
      <div class="ctrl-title">Trip Route</div>
      <mat-select [(ngModel)]="selectedTripId" (selectionChange)="onTripSelect($event.value)"
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
    </div>
  `,
})
export class MapComponent implements OnInit {
  protected router  = inject(Router);
  private destSvc   = inject(DestinationService);
  private tripSvc   = inject(TripService);
  private mapsSvc   = inject(MapsService);

  loading      = signal(true);
  destinations = signal<Destination[]>([]);
  trips        = signal<Trip[]>([]);
  selectedDest = signal<Destination | null>(null);

  showDestinations = true;
  selectedTripId: number | null = null;

  directionsResult = signal<google.maps.DirectionsResult | null>(null);
  tripStopMarkers  = signal<Array<{ position: google.maps.LatLngLiteral; options: google.maps.MarkerOptions; label: string }>>([]);

  validDests = computed(() =>
    this.destinations().filter(d => d.latitude != null && d.longitude != null),
  );

  readonly mapCenter: google.maps.LatLngLiteral = { lat: 39.5, lng: -98.35 };
  readonly mapOptions: google.maps.MapOptions = {
    mapTypeControl: false,
    streetViewControl: false,
    fullscreenControl: false,
    mapTypeId: 'roadmap',
  };

  ngOnInit() {
    forkJoin([this.destSvc.list(), this.tripSvc.list()]).subscribe({
      next: ([dests, trips]) => {
        this.destinations.set(dests);
        this.trips.set(trips);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  destMarkerOptions(d: Destination): google.maps.MarkerOptions {
    return {
      icon: { url: destIconSvg(d.status), scaledSize: new google.maps.Size(18, 18) },
      title: d.name,
    };
  }

  openDestInfo(d: Destination, marker: MapMarker & { _marker?: google.maps.Marker }) {
    this.selectedDest.set(d);
  }

  onTripSelect(tripId: number | null) {
    this.directionsResult.set(null);
    this.tripStopMarkers.set([]);
    if (!tripId) return;

    this.tripSvc.get(tripId).subscribe(trip => {
      const stops = [...(trip.stops ?? [])]
        .sort((a, b) => a.stop_order - b.stop_order)
        .filter(s => s.destination?.latitude != null && s.destination?.longitude != null);

      if (stops.length < 2) return;

      const waypoints = stops.map(s => ({
        lat: Number(s.destination!.latitude),
        lng: Number(s.destination!.longitude),
      }));

      this.mapsSvc.loadDirections(waypoints).subscribe(result => {
        this.directionsResult.set(result);
      });

      // Numbered stop markers
      this.tripStopMarkers.set(
        stops.map((s, i) => ({
          position: { lat: Number(s.destination!.latitude), lng: Number(s.destination!.longitude) },
          options:  { icon: { url: stopIconSvg(s.stop_order), scaledSize: new google.maps.Size(28, 28) }, zIndex: 10 },
          label:    s.destination!.name ?? `Stop ${s.stop_order}`,
        })),
      );
    });
  }
}
