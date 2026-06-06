import {
  Component, AfterViewInit, OnDestroy, ViewChild, ElementRef,
  ChangeDetectionStrategy, input, output,
} from '@angular/core';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatIconModule } from '@angular/material/icon';

export interface PlaceSelectedEvent {
  name:             string;
  formatted_address:string;
  lat:              number;
  lng:              number;
  place_id:         string;
  city:             string;
  state_province:   string;
  country:          'USA' | 'Canada';
  phone?:           string;
  website?:         string;
  price_level?:     number;
}

function extractComponent(
  components: google.maps.GeocoderAddressComponent[],
  type: string,
  nameType: 'long_name' | 'short_name' = 'long_name',
): string {
  return components.find(c => c.types.includes(type))?.[nameType] ?? '';
}

@Component({
  selector: 'app-places-autocomplete',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatFormFieldModule, MatInputModule, MatIconModule],
  template: `
    <mat-form-field appearance="outline" style="width:100%">
      <mat-label>{{ placeholder() }}</mat-label>
      <mat-icon matPrefix>search</mat-icon>
      <input matInput #input [placeholder]="placeholder()" autocomplete="off" />
      @if (hint()) {
        <mat-hint>{{ hint() }}</mat-hint>
      }
    </mat-form-field>
  `,
})
export class PlacesAutocompleteComponent implements AfterViewInit, OnDestroy {
  placeholder = input('Search location…');
  hint        = input('');
  /** Google Places types — e.g. ['geocode'], ['establishment'], ['(cities)'] */
  types       = input<string[]>(['geocode']);
  /** ISO 3166-1 alpha-2 country codes */
  countries   = input<string[]>(['us', 'ca']);
  /** Pre-populate the input (display-only) */
  initialValue = input('');

  placeSelected = output<PlaceSelectedEvent>();
  cleared       = output<void>();

  @ViewChild('input') inputRef!: ElementRef<HTMLInputElement>;

  private autocomplete?: google.maps.places.Autocomplete;
  private listener?: google.maps.MapsEventListener;
  private retryTimer?: ReturnType<typeof setTimeout>;

  ngAfterViewInit() {
    this.tryInit();
    if (this.initialValue()) {
      this.inputRef.nativeElement.value = this.initialValue();
    }
  }

  ngOnDestroy() {
    this.listener?.remove();
    if (this.retryTimer) clearTimeout(this.retryTimer);
  }

  private tryInit() {
    if (typeof google === 'undefined' || !google.maps?.places?.Autocomplete) {
      this.retryTimer = setTimeout(() => this.tryInit(), 150);
      return;
    }
    this.autocomplete = new google.maps.places.Autocomplete(this.inputRef.nativeElement, {
      types:                this.types(),
      componentRestrictions: { country: this.countries() },
      fields: ['address_components', 'formatted_address', 'geometry', 'name',
               'place_id', 'formatted_phone_number', 'website', 'price_level'],
    });

    this.listener = this.autocomplete.addListener('place_changed', () => this.onPlaceChanged());
  }

  private onPlaceChanged() {
    const place = this.autocomplete!.getPlace();
    if (!place.geometry?.location) return;

    const comps = place.address_components ?? [];
    const city = extractComponent(comps, 'locality')
      || extractComponent(comps, 'administrative_area_level_3')
      || extractComponent(comps, 'sublocality_level_1');
    const stateShort  = extractComponent(comps, 'administrative_area_level_1', 'short_name');
    const countryCode = extractComponent(comps, 'country', 'short_name');

    this.placeSelected.emit({
      name:              place.name ?? '',
      formatted_address: place.formatted_address ?? '',
      lat:               place.geometry.location.lat(),
      lng:               place.geometry.location.lng(),
      place_id:          place.place_id ?? '',
      city,
      state_province:    stateShort,
      country:           countryCode === 'CA' ? 'Canada' : 'USA',
      phone:             place.formatted_phone_number,
      website:           place.website,
      price_level:       place.price_level,
    });
  }

  /** Programmatically clear the input. */
  clear() {
    if (this.inputRef) this.inputRef.nativeElement.value = '';
    this.cleared.emit();
  }
}
