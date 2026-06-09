import {
  Component, AfterViewInit, OnDestroy, ViewChild, ElementRef,
  ChangeDetectionStrategy, input, output,
} from '@angular/core';

export interface PlaceSelectedEvent {
  name:              string;
  formatted_address: string;
  lat:               number;
  lng:               number;
  place_id:          string;
  city:              string;
  state_province:    string;
  country:           'USA' | 'Canada';
  phone?:            string;
  website?:          string;
  price_level?:      number;
}

const PRICE_MAP: Record<string, number> = {
  FREE:          0,
  INEXPENSIVE:   1,
  MODERATE:      2,
  EXPENSIVE:     3,
  VERY_EXPENSIVE: 4,
};

@Component({
  selector: 'app-places-autocomplete',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [`
    :host { display: block; width: 100%; max-width: 100%; overflow: hidden; margin-bottom: 8px; }
    .hint { font-size: 12px; color: var(--wp-text-hint); margin-top: 2px; }
  `],
  template: `
    <div #container style="width:100%"></div>
    @if (hint()) {
      <div class="hint">{{ hint() }}</div>
    }
  `,
})
export class PlacesAutocompleteComponent implements AfterViewInit, OnDestroy {
  placeholder  = input('Search location…');
  hint         = input('');
  types        = input<string[]>(['geocode']);
  countries    = input<string[]>(['us', 'ca']);
  initialValue = input('');

  placeSelected = output<PlaceSelectedEvent>();
  cleared       = output<void>();

  @ViewChild('container') containerRef!: ElementRef<HTMLDivElement>;

  private element?: google.maps.places.PlaceAutocompleteElement;
  private abortCtrl = new AbortController();

  ngAfterViewInit() {
    this.init();
  }

  private async init() {
    await this.waitForMaps();
    const lib = await google.maps.importLibrary('places') as google.maps.PlacesLibrary;
    const { PlaceAutocompleteElement } = lib;

    this.element = new PlaceAutocompleteElement({
      types:                this.types(),
      componentRestrictions: { country: this.countries() },
    } as google.maps.places.PlaceAutocompleteElementOptions);

    const el = this.element as unknown as HTMLElement;
    el.setAttribute('placeholder', this.placeholder());
    el.style.width = '100%';
    el.style.maxWidth = '100%';
    el.style.boxSizing = 'border-box';

    this.containerRef.nativeElement.appendChild(el);

    if (this.initialValue()) {
      (this.element as unknown as { value: string }).value = this.initialValue();
    }

    (this.element as unknown as EventTarget).addEventListener(
      'gmp-select',
      async (raw: Event) => {
        const prediction = (raw as CustomEvent & { placePrediction: google.maps.places.PlacePrediction })
          .placePrediction;
        if (!prediction) return;

        const place = prediction.toPlace();
        await place.fetchFields({
          fields: ['id', 'displayName', 'formattedAddress', 'location',
                   'addressComponents', 'nationalPhoneNumber', 'websiteURI', 'priceLevel'],
        });

        if (!place.location) return;

        const comps: google.maps.places.AddressComponent[] = place.addressComponents ?? [];
        const city =
          comps.find(c => c.types.includes('locality'))?.longText ??
          comps.find(c => c.types.includes('administrative_area_level_3'))?.longText ??
          comps.find(c => c.types.includes('sublocality_level_1'))?.longText ??
          '';
        const stateShort  = comps.find(c => c.types.includes('administrative_area_level_1'))?.shortText ?? '';
        const countryCode = comps.find(c => c.types.includes('country'))?.shortText ?? '';

        const priceLevelKey = place.priceLevel
          ? String(place.priceLevel).replace('PRICE_LEVEL_', '')
          : undefined;

        this.placeSelected.emit({
          name:              place.displayName  ?? '',
          formatted_address: place.formattedAddress ?? '',
          lat:               place.location.lat(),
          lng:               place.location.lng(),
          place_id:          place.id ?? '',
          city,
          state_province:    stateShort,
          country:           countryCode === 'CA' ? 'Canada' : 'USA',
          phone:             place.nationalPhoneNumber  ?? undefined,
          website:           place.websiteURI           ?? undefined,
          price_level:       priceLevelKey !== undefined ? PRICE_MAP[priceLevelKey] : undefined,
        });
      },
      { signal: this.abortCtrl.signal },
    );
  }

  private waitForMaps(): Promise<void> {
    return new Promise(resolve => {
      if (typeof google !== 'undefined' && google.maps) { resolve(); return; }
      const t = setInterval(() => {
        if (typeof google !== 'undefined' && google.maps) { clearInterval(t); resolve(); }
      }, 100);
    });
  }

  ngOnDestroy() {
    this.abortCtrl.abort();
    (this.element as unknown as HTMLElement | undefined)?.remove();
  }

  clear() {
    if (this.element) (this.element as unknown as { value: string }).value = '';
    this.cleared.emit();
  }

  setValue(v: string) {
    if (this.element) (this.element as unknown as { value: string }).value = v;
  }
}
