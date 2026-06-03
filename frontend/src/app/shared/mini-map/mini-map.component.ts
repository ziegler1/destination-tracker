import {
  Component, AfterViewInit, OnDestroy, ViewChild, ElementRef,
  ChangeDetectionStrategy, NgZone, inject, effect, input,
} from '@angular/core';
import * as L from 'leaflet';

const PIN_ICON = L.divIcon({
  html: `<div style="width:14px;height:14px;border-radius:50%;background:#00695C;
                border:2px solid white;box-shadow:0 2px 6px rgba(0,0,0,.4)"></div>`,
  iconSize: [14, 14],
  iconAnchor: [7, 7],
  className: '',
});

@Component({
  selector: 'app-mini-map',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div #mapEl [style.height]="height()" style="width:100%;border-radius:8px;overflow:hidden"></div>
  `,
})
export class MiniMapComponent implements AfterViewInit, OnDestroy {
  lat    = input.required<number>();
  lon    = input.required<number>();
  label  = input('');
  height = input('200px');

  @ViewChild('mapEl', { static: true }) mapEl!: ElementRef<HTMLDivElement>;

  private ngZone = inject(NgZone);
  private map?: L.Map;
  private marker?: L.Marker;

  constructor() {
    // React to lat/lon changes after map is initialised
    effect(() => {
      const lat = Number(this.lat());
      const lon = Number(this.lon());
      if (!this.map) return;
      this.ngZone.runOutsideAngular(() => {
        this.map!.setView([lat, lon], 13);
        this.marker?.setLatLng([lat, lon]);
      });
    });
  }

  ngAfterViewInit() {
    this.ngZone.runOutsideAngular(() => this.initMap());
  }

  ngOnDestroy() {
    this.map?.remove();
  }

  private initMap() {
    const lat = Number(this.lat());
    const lon = Number(this.lon());

    this.map = L.map(this.mapEl.nativeElement, {
      center: [lat, lon],
      zoom: 13,
      zoomControl: false,
      scrollWheelZoom: false,
      dragging: false,
      doubleClickZoom: false,
      keyboard: false,
      attributionControl: false,
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(this.map);

    this.marker = L.marker([lat, lon], { icon: PIN_ICON });
    if (this.label()) this.marker.bindTooltip(this.label(), { permanent: false, direction: 'top' });
    this.marker.addTo(this.map);
  }
}
