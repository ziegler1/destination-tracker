import { Directive, ElementRef, OnDestroy, OnInit, inject } from '@angular/core';

/**
 * Scrolls the focused form field into view when the on-screen keyboard opens
 * (detected via the visualViewport shrinking), so Save/Cancel buttons and
 * the active field stay reachable inside bottom sheets and forms on mobile.
 */
@Directive({
  selector: '[appKeyboardAwareScroll]',
  standalone: true,
})
export class KeyboardAwareScrollDirective implements OnInit, OnDestroy {
  private host = inject(ElementRef<HTMLElement>);

  private focusInHandler = (e: FocusEvent) => {
    const target = e.target as HTMLElement;
    const isFormField = target.matches('input, textarea, select, mat-select, .mat-mdc-select-trigger');
    // Web components (e.g. Google's <gmp-place-autocomplete>) retarget focus
    // events to their custom-element host, so match those by tag name too.
    const isAutocompleteHost = target.localName?.includes('autocomplete') || !!target.shadowRoot;
    if (isFormField || isAutocompleteHost) {
      this.lastFocused = target;
    }
  };

  private viewportHandler = () => {
    if (this.lastFocused) {
      this.lastFocused.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };

  private lastFocused: HTMLElement | null = null;

  ngOnInit(): void {
    this.host.nativeElement.addEventListener('focusin', this.focusInHandler);
    window.visualViewport?.addEventListener('resize', this.viewportHandler);
  }

  ngOnDestroy(): void {
    this.host.nativeElement.removeEventListener('focusin', this.focusInHandler);
    window.visualViewport?.removeEventListener('resize', this.viewportHandler);
  }
}
