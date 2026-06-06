import { Component, ChangeDetectionStrategy, input } from '@angular/core';
import { GoogleMap, MapAdvancedMarker } from '@angular/google-maps';

@Component({
  selector: 'app-mini-map',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [GoogleMap, MapAdvancedMarker],
  template: `
    <div [style.height]="height()" style="width:100%;border-radius:8px;overflow:hidden">
      <google-map
        [height]="height()"
        width="100%"
        [center]="center()"
        [zoom]="14"
        [options]="mapOptions">
        <map-advanced-marker [position]="center()" [title]="label()" />
      </google-map>
    </div>
  `,
})
export class MiniMapComponent {
  lat    = input.required<number>();
  lon    = input.required<number>();
  label  = input('');
  height = input('200px');

  center = () => ({ lat: Number(this.lat()), lng: Number(this.lon()) });

  readonly mapOptions: google.maps.MapOptions = {
    mapId: 'DEMO_MAP_ID',
    zoomControl: false,
    scrollwheel: false,
    disableDoubleClickZoom: true,
    draggable: false,
    mapTypeControl: false,
    streetViewControl: false,
    fullscreenControl: false,
  };
}
