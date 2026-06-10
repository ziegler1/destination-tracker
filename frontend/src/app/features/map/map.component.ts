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
import { RestaurantService } from '../../core/services/restaurant.service';
import { LodgingService } from '../../core/services/lodging.service';
import { SpecialInterestService } from '../../core/services/special-interest.service';
import { Destination, DestinationStatus, Trip, Restaurant, Lodging, SpecialInterestPlace } from '../../types/schema.types';
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

function restaurantMarkerEl(): HTMLElement {
  const el = document.createElement('div');
  el.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16">
    <circle cx="8" cy="8" r="6" fill="#E65100" stroke="white" stroke-width="2"/>
  </svg>`;
  return el.firstElementChild as HTMLElement;
}

function lodgingMarkerEl(): HTMLElement {
  const el = document.createElement('div');
  el.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16">
    <circle cx="8" cy="8" r="6" fill="#0277BD" stroke="white" stroke-width="2"/>
  </svg>`;
  return el.firstElementChild as HTMLElement;
}

function siMarkerEl(): HTMLElement {
  const el = document.createElement('div');
  el.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16">
    <circle cx="8" cy="8" r="6" fill="#7B1FA2" stroke="white" stroke-width="2"/>
  </svg>`;
  return el.firstElementChild as HTMLElement;
}

interface ActiveMarker {
  type: 'destination' | 'restaurant' | 'lodging' | 'si';
  id: number;
  name: string;
  city: string;
  state: string;
  sub?: string;
  rating?: number;
  photoUrl?: string;
  route: string[];
}

function primaryPhotoUrl(
  item: { photos?: Array<{ url: string; is_primary: boolean }>; image_url?: string }
): string | undefined {
  return item.photos?.find(p => p.is_primary)?.url ?? item.photos?.[0]?.url ?? item.image_url ?? undefined;
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

    /* Toggle button — always visible */
    .layers-toggle {
      position:absolute; top:12px; right:12px; z-index:1002;
      background:var(--wp-surface); border:none; border-radius:10px;
      padding:8px 12px; cursor:pointer; box-shadow:0 2px 8px var(--wp-shadow);
      display:flex; align-items:center; gap:6px;
      font-size:13px; font-weight:600; color:var(--wp-text-primary);
    }
    .layers-toggle mat-icon { font-size:18px; width:18px; height:18px; }

    .controls {
      position:absolute; top:52px; right:12px; z-index:1001; width:220px;
      padding:14px; border-radius:12px;
      background:var(--wp-surface); box-shadow:0 4px 16px var(--wp-shadow);
      max-height:calc(100vh - 120px); overflow-y:auto;
    }
    @media (max-width:768px) {
      .controls {
        top:auto; bottom:0; right:0; left:0; width:auto;
        border-radius:16px 16px 0 0; max-height:70vh;
      }
      .layers-toggle { top:12px; right:12px; }
    }
    .ctrl-title {
      font-size:11px; font-weight:600; text-transform:uppercase;
      letter-spacing:.8px; color:var(--wp-text-hint); margin-bottom:8px;
    }
    .ctrl-row { display:flex; align-items:center; gap:8px; margin-bottom:6px; font-size:13px; }
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

      <!-- Restaurant markers -->
      @if (showRestaurants) {
        @for (r of restaurantMarkers(); track r.id) {
          <map-advanced-marker
            [position]="r.position"
            [content]="r.content"
            [title]="r.name"
            (mapClick)="openRestInfo(r.item, restMarker)"
            #restMarker="mapAdvancedMarker" />
        }
      }

      <!-- Lodging markers -->
      @if (showLodging) {
        @for (l of lodgingMarkers(); track l.id) {
          <map-advanced-marker
            [position]="l.position"
            [content]="l.content"
            [title]="l.name"
            (mapClick)="openLodgeInfo(l.item, lodgeMarker)"
            #lodgeMarker="mapAdvancedMarker" />
        }
      }

      <!-- Special Interest markers -->
      @if (showSI) {
        @for (si of siMarkers(); track si.id) {
          <map-advanced-marker
            [position]="si.position"
            [content]="si.content"
            [title]="si.name"
            (mapClick)="openSIInfo(si.item, siAdvMarker)"
            #siAdvMarker="mapAdvancedMarker" />
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
        @if (activeMarker(); as m) {
          <div style="min-width:140px;max-width:170px;font-family:Roboto,sans-serif;overflow:hidden">
            @if (m.photoUrl) {
              <img [src]="m.photoUrl" style="width:100%;height:80px;object-fit:cover;display:block"
                   (error)="$any($event.target).style.display='none'" />
            }
            <div style="padding:6px">
              <strong style="font-size:13px;display:block;margin-bottom:2px;color:#212121">{{ m.name }}</strong>
              <small style="color:#666">{{ m.city }}, {{ m.state }}</small><br/>
              <span style="font-size:11px;text-transform:capitalize;color:#888">{{ m.sub }}</span>
              @if (m.rating) {
                <span style="font-size:11px;color:#f57f17;margin-left:6px">★ {{ m.rating }}</span>
              }
              <br/>
              <button (click)="router.navigate(m.route)"
                style="margin-top:6px;padding:3px 10px;background:#00695C;color:white;border:none;
                       border-radius:4px;cursor:pointer;font-size:11px">
                View →
              </button>
            </div>
          </div>
        }
      </map-info-window>
    </google-map>

    <!-- Layers toggle button -->
    <button class="layers-toggle" (click)="showControls = !showControls">
      <mat-icon>layers</mat-icon>
      Layers
      @if (showControls) { <mat-icon>expand_more</mat-icon> } @else { <mat-icon>chevron_right</mat-icon> }
    </button>

    <!-- Controls + legend panel -->
    @if (showControls) {
      <div class="controls">
        <div class="ctrl-title">Layers</div>
        <div class="ctrl-row">
          <mat-checkbox [(ngModel)]="showDestinations">
            Destinations ({{ validDests().length }})
          </mat-checkbox>
        </div>
        <div class="ctrl-row">
          <mat-checkbox [(ngModel)]="showRestaurants">
            Restaurants ({{ validRestaurants().length }})
          </mat-checkbox>
        </div>
        <div class="ctrl-row">
          <mat-checkbox [(ngModel)]="showLodging">
            Lodging ({{ validLodging().length }})
          </mat-checkbox>
        </div>
        <div class="ctrl-row">
          <mat-checkbox [(ngModel)]="showSI">
            Special Interest ({{ validSI().length }})
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
        <mat-divider style="margin:10px 0" />
        <div class="ctrl-title">Legend</div>
        <div class="leg-row"><div class="leg-dot" style="background:#1565c0"></div> Want to Visit</div>
        <div class="leg-row"><div class="leg-dot" style="background:#f57f17"></div> Planned</div>
        <div class="leg-row"><div class="leg-dot" style="background:#2e7d32"></div> Visited (Dest.)</div>
        <div class="leg-row"><div class="leg-dot" style="background:#E65100"></div> Restaurant</div>
        <div class="leg-row"><div class="leg-dot" style="background:#0277BD"></div> Lodging</div>
        <div class="leg-row"><div class="leg-dot" style="background:#7B1FA2"></div> Special Interest</div>
        @if (visitedStates().size > 0) {
          <div class="leg-row"><div class="leg-rect"></div> Visited States ({{ visitedStates().size }})</div>
        }
      </div>
    }
  `,
})
export class MapComponent implements OnInit, AfterViewInit {
  protected router  = inject(Router);
  private destSvc   = inject(DestinationService);
  private tripSvc   = inject(TripService);
  private mapsSvc   = inject(MapsService);
  private restSvc   = inject(RestaurantService);
  private lodgeSvc  = inject(LodgingService);
  private siSvc     = inject(SpecialInterestService);

  @ViewChild(MapInfoWindow) infoWindow!: MapInfoWindow;
  @ViewChild(GoogleMap)     gmap!: GoogleMap;

  loading        = signal(true);
  destinations   = signal<Destination[]>([]);
  restaurants    = signal<Restaurant[]>([]);
  lodging        = signal<Lodging[]>([]);
  specialInterests = signal<SpecialInterestPlace[]>([]);
  trips          = signal<Trip[]>([]);
  activeMarker   = signal<ActiveMarker | null>(null);
  visitedStates  = signal<Set<string>>(new Set());

  showDestinations  = true;
  showRestaurants   = true;
  showLodging       = true;
  showSI            = true;
  showStateFill     = true;
  showControls      = false;
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

  validRestaurants = computed(() =>
    this.restaurants().filter(r => r.latitude != null && r.longitude != null),
  );
  restaurantMarkers = computed(() =>
    this.validRestaurants().map(r => ({
      id:       r.id,
      name:     r.name,
      position: { lat: Number(r.latitude), lng: Number(r.longitude) } as google.maps.LatLngLiteral,
      content:  restaurantMarkerEl(),
      item:     r,
    })),
  );

  validLodging = computed(() =>
    this.lodging().filter(l => l.latitude != null && l.longitude != null),
  );
  lodgingMarkers = computed(() =>
    this.validLodging().map(l => ({
      id:       l.id,
      name:     l.name,
      position: { lat: Number(l.latitude), lng: Number(l.longitude) } as google.maps.LatLngLiteral,
      content:  lodgingMarkerEl(),
      item:     l,
    })),
  );

  validSI = computed(() =>
    this.specialInterests().filter(si => si.latitude != null && si.longitude != null),
  );
  siMarkers = computed(() =>
    this.validSI().map(si => ({
      id:       si.id,
      name:     si.name,
      position: { lat: Number(si.latitude), lng: Number(si.longitude) } as google.maps.LatLngLiteral,
      content:  siMarkerEl(),
      item:     si,
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
      this.restSvc.list(),
      this.lodgeSvc.list(),
      this.siSvc.list(),
      fetch(US_STATES_GEOJSON_URL).then(r => r.json()).catch(() => null),
    ]).subscribe({
      next: ([dests, trips, rests, lodging, sis, geojson]) => {
        this.destinations.set(dests);
        this.trips.set(trips);
        this.restaurants.set(rests);
        this.lodging.set(lodging);
        this.specialInterests.set(sis);
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
    this.activeMarker.set({
      type: 'destination', id: d.id, name: d.name,
      city: d.city, state: d.state_province,
      sub: d.status.replace(/_/g, ' '),
      photoUrl: primaryPhotoUrl(d),
      route: ['/destinations', String(d.id)],
    });
    this.infoWindow.open(marker);
  }

  openRestInfo(r: Restaurant, marker: MapAdvancedMarker) {
    this.activeMarker.set({
      type: 'restaurant', id: r.id, name: r.name,
      city: r.city, state: r.state_province,
      sub: r.cuisine_type ?? 'Restaurant',
      rating: r.rating,
      photoUrl: primaryPhotoUrl(r),
      route: ['/restaurants', String(r.id)],
    });
    this.infoWindow.open(marker);
  }

  openLodgeInfo(l: Lodging, marker: MapAdvancedMarker) {
    this.activeMarker.set({
      type: 'lodging', id: l.id, name: l.name,
      city: l.city, state: l.state_province,
      sub: l.lodging_type,
      rating: l.room_quality,
      photoUrl: primaryPhotoUrl(l),
      route: ['/lodging', String(l.id)],
    });
    this.infoWindow.open(marker);
  }

  openSIInfo(si: SpecialInterestPlace, marker: MapAdvancedMarker) {
    this.activeMarker.set({
      type: 'si', id: si.id, name: si.name,
      city: si.city, state: si.state_province,
      sub: si.category ?? 'Special Interest',
      rating: si.rating,
      photoUrl: primaryPhotoUrl(si),
      route: ['/special-interests', String(si.id)],
    });
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
