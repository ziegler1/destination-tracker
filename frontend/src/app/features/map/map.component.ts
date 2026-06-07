import {
  Component, OnInit, AfterViewInit, ChangeDetectionStrategy, ViewChild,
  inject, signal, computed,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import {
  GoogleMap, MapAdvancedMarker, MapInfoWindow, MapDirectionsRenderer,
} from '@angular/google-maps';
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

// Maps US state abbreviations to full names used in GeoJSON
const ABBREV_TO_STATE: Record<string, string> = {
  AL:'Alabama',AK:'Alaska',AZ:'Arizona',AR:'Arkansas',CA:'California',
  CO:'Colorado',CT:'Connecticut',DE:'Delaware',FL:'Florida',GA:'Georgia',
  HI:'Hawaii',ID:'Idaho',IL:'Illinois',IN:'Indiana',IA:'Iowa',
  KS:'Kansas',KY:'Kentucky',LA:'Louisiana',ME:'Maine',MD:'Maryland',
  MA:'Massachusetts',MI:'Michigan',MN:'Minnesota',MS:'Mississippi',MO:'Missouri',
  MT:'Montana',NE:'Nebraska',NV:'Nevada',NH:'New Hampshire',NJ:'New Jersey',
  NM:'New Mexico',NY:'New York',NC:'North Carolina',ND:'North Dakota',OH:'Ohio',
  OK:'Oklahoma',OR:'Oregon',PA:'Pennsylvania',RI:'Rhode Island',SC:'South Carolina',
  SD:'South Dakota',TN:'Tennessee',TX:'Texas',UT:'Utah',VT:'Vermont',
  VA:'Virginia',WA:'Washington',WV:'West Virginia',WI:'Wisconsin',WY:'Wyoming',
  DC:'District of Columbia',
};

const US_STATES_GEOJSON_URL =
  'https://raw.githubusercontent.com/PublicaMundi/MappingAPI/master/data/geojson/us-states.json';

function destMarkerEl(status: DestinationStatus): HTMLElement {
  const el = document.createElement('div');
  const c  = STATUS_COLORS[status];
  el.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18">
    <circle cx="9" cy="9" r="7" fill="${c}" stroke="white" stroke-width="2"/>
  </svg>`;
  return el.firstElementChild as HTMLElement;
}

function stopMarkerEl(n: number): HTMLElement {
  const el = document.createElement('div');
  el.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28">
    <circle cx="14" cy="14" r="12" fill="#00695C" stroke="white" stroke-width="2"/>
    <text x="14" y="19" font-family="Arial" font-size="11" font-weight="bold"
          fill="white" text-anchor="middle">${n}</text>
  </svg>`;
  return el.firstElementChild as HTMLElement;
}

@Component({
  selector: 'app-map',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormsModule, GoogleMap, MapAdvancedMarker, MapInfoWindow, MapDirectionsRenderer,
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
    .leg-rect {
      width:18px; height:11px; border-radius:3px; flex-shrink:0;
      background:rgba(0,105,92,.22); border:1px solid #00695C;
    }
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
      [options]="mapOptions"
      (tilesloaded)="onTilesLoaded()">

      <!-- Destination markers -->
      @if (showDestinations) {
        @for (d of destMarkers(); track d.id) {
          <map-advanced-marker
            [position]="d.position"
            [content]="d.content"
            [title]="d.name"
            (mapClick)="openDestInfo(d.dest, advMarker)"
            #advMarker="mapAdvancedMarker" />
        }
      }

      <!-- Trip route polyline -->
      @if (directionsResult()) {
        <map-directions-renderer
          [directions]="directionsResult()!"
          [options]="{ suppressMarkers: true, polylineOptions: { strokeColor: '#00695C', strokeOpacity: 0.8, strokeWeight: 4 } }" />
      }

      <!-- Numbered stop markers -->
      @for (s of tripStopMarkers(); track s.label) {
        <map-advanced-marker [position]="s.position" [content]="s.content" [title]="s.label" />
      }

      <map-info-window #infoWindow>
        @if (selectedDest()) {
          <div style="min-width:160px;font-family:Roboto,sans-serif;padding:4px">
            <strong style="font-size:14px">{{ selectedDest()!.name }}</strong><br/>
            <small style="color:#666">{{ selectedDest()!.city }}, {{ selectedDest()!.state_province }}</small><br/>
            <span style="font-size:12px;text-transform:capitalize;color:#888">
              {{ selectedDest()!.status.replace('_',' ') }}
            </span><br/>
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
      <div class="ctrl-row">
        <mat-checkbox [(ngModel)]="showStateFill" (ngModelChange)="toggleStateFill($event)">
          Visited States
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
      @if (visitedStates().size > 0) {
        <div class="leg-row"><div class="leg-rect"></div> Visited States ({{ visitedStates().size }})</div>
      }
    </div>
  `,
})
export class MapComponent implements OnInit, AfterViewInit {
  protected router = inject(Router);
  private destSvc  = inject(DestinationService);
  private tripSvc  = inject(TripService);
  private mapsSvc  = inject(MapsService);

  @ViewChild(MapInfoWindow) infoWindow!: MapInfoWindow;
  @ViewChild(GoogleMap)     gmap!: GoogleMap;

  loading        = signal(true);
  destinations   = signal<Destination[]>([]);
  trips          = signal<Trip[]>([]);
  selectedDest   = signal<Destination | null>(null);
  visitedStates  = signal<Set<string>>(new Set());

  showDestinations = true;
  showStateFill    = true;
  selectedTripId: number | null = null;

  directionsResult = signal<google.maps.DirectionsResult | null>(null);
  tripStopMarkers  = signal<Array<{ position: google.maps.LatLngLiteral; content: HTMLElement; label: string }>>([]);

  private statesGeoJson: object | null = null;
  private geoJsonAddedToMap = false;
  private mapTilesReady = false;

  validDests = computed(() =>
    this.destinations().filter(d => d.latitude != null && d.longitude != null),
  );

  destMarkers = computed(() =>
    this.validDests().map(d => ({
      id:       d.id,
      name:     d.name,
      position: { lat: Number(d.latitude), lng: Number(d.longitude) } as google.maps.LatLngLiteral,
      content:  destMarkerEl(d.status),
      dest:     d,
    })),
  );

  readonly mapCenter: google.maps.LatLngLiteral = { lat: 39.5, lng: -98.35 };
  readonly mapOptions: google.maps.MapOptions = {
    mapId: 'DEMO_MAP_ID',
    mapTypeControl: false,
    streetViewControl: false,
    fullscreenControl: false,
    mapTypeId: 'roadmap',
  };

  ngOnInit() {
    // Fetch the states GeoJSON in parallel with destinations/trips so it's
    // ready (and awaited) before we ever try to add it to the map's data layer —
    // adding it before it's loaded was the root cause of the missing fill.
    forkJoin([
      this.destSvc.list(),
      this.tripSvc.list(),
      fetch(US_STATES_GEOJSON_URL).then(r => r.json()).catch(() => null),
    ]).subscribe({
      next: ([dests, trips, geojson]) => {
        this.destinations.set(dests);
        this.trips.set(trips);
        this.loading.set(false);
        this.computeVisitedStates(dests);
        this.statesGeoJson = geojson as object | null;
        this.maybeInitStateLayer();
      },
      error: () => this.loading.set(false),
    });
  }

  ngAfterViewInit() {
    // Map might not be ready yet; actual data layer setup happens in onTilesLoaded
  }

  onTilesLoaded() {
    this.mapTilesReady = true;
    this.maybeInitStateLayer();
  }

  private computeVisitedStates(dests: Destination[]) {
    const visited = new Set<string>();
    dests
      .filter(d => d.status === 'visited' && d.state_province)
      .forEach(d => {
        const sp = d.state_province.trim();
        // Lookup abbreviation or use as-is (already a full name post-normalization)
        const fullName = ABBREV_TO_STATE[sp.toUpperCase()] ?? sp;
        visited.add(fullName);
      });
    this.visitedStates.set(visited);
  }

  /** Adds the GeoJSON to the map's data layer (once) and applies the choropleth
   *  style — but only once BOTH the map tiles are ready AND the GeoJSON has
   *  finished loading, so we never style an empty/incomplete data layer. */
  private maybeInitStateLayer() {
    if (this.geoJsonAddedToMap || !this.mapTilesReady || !this.statesGeoJson) return;
    const map = this.gmap?.googleMap;
    if (!map) return;

    map.data.addGeoJson(this.statesGeoJson);
    this.geoJsonAddedToMap = true;
    this.applyDataLayerStyle();
  }

  private applyDataLayerStyle() {
    const map = this.gmap?.googleMap;
    if (!map) return;
    const visited = this.visitedStates();

    const matched: string[] = [];
    const unmatched: string[] = [];

    map.data.setStyle((feature: google.maps.Data.Feature) => {
      const name =
        (feature.getProperty('NAME_1') as string | undefined) ||
        (feature.getProperty('name') as string | undefined) ||
        (feature.getProperty('NAME') as string | undefined);
      const isVisited = !!name && visited.has(name);
      if (name) (isVisited ? matched : unmatched).push(name);
      return {
        fillColor:     isVisited ? '#00695C' : 'transparent',
        fillOpacity:   isVisited ? 0.15 : 0,
        strokeColor:   '#00695C',
        strokeOpacity: isVisited ? 0.3 : 0,
        strokeWeight:  1,
        clickable:     false,
      };
    });

    // eslint-disable-next-line no-console
    console.log('[map] visited states:', [...visited]);
    // eslint-disable-next-line no-console
    console.log('[map] GeoJSON states matched (filled):', matched);
    // eslint-disable-next-line no-console
    console.log('[map] GeoJSON states not visited:', unmatched);
  }

  toggleStateFill(show: boolean) {
    const map = this.gmap?.googleMap;
    if (!map) return;
    if (!show) {
      map.data.setStyle({ fillOpacity: 0, strokeOpacity: 0, clickable: false } as google.maps.Data.StyleOptions);
      return;
    }
    this.applyDataLayerStyle();
  }

  openDestInfo(d: Destination, marker: MapAdvancedMarker) {
    this.selectedDest.set(d);
    this.infoWindow.open(marker);
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

      this.tripStopMarkers.set(
        stops.map(s => ({
          position: { lat: Number(s.destination!.latitude), lng: Number(s.destination!.longitude) },
          content:  stopMarkerEl(s.stop_order),
          label:    s.destination!.name ?? `Stop ${s.stop_order}`,
        })),
      );
    });
  }
}
