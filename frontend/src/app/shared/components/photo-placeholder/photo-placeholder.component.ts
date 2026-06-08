import { Component, Input, ChangeDetectionStrategy } from '@angular/core';

const SPECIAL_INTEREST_EMOJI: Array<{ match: string[]; emoji: string }> = [
  { match: ['bourbon', 'distillery', 'whiskey'],       emoji: '🥃' },
  { match: ['winery', 'brewery', 'wine', 'beer', 'brew'], emoji: '🍺' },
  { match: ['museum'],                                  emoji: '🏛️' },
  { match: ['historic', 'history', 'monument'],         emoji: '🏚️' },
  { match: ['national_park', 'state_park', 'park', 'national', 'forest'], emoji: '🌲' },
];

@Component({
  selector: 'app-photo-placeholder',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="ph-wrap">
      @if (entityType === 'destination') {
        <span class="ph-letter">{{ name ? name.charAt(0).toUpperCase() : '?' }}</span>
      } @else {
        <span class="ph-emoji">{{ emoji }}</span>
      }
    </div>
  `,
  styles: [`
    .ph-wrap {
      width: 100%; height: 100%;
      background: #1E2A35;
      display: flex; align-items: center; justify-content: center;
    }
    .ph-letter {
      font-size: 64px; font-weight: 700; color: #00695C;
      line-height: 1; user-select: none;
    }
    .ph-emoji {
      font-size: 48px; line-height: 1; user-select: none;
    }
  `],
})
export class PhotoPlaceholderComponent {
  @Input() entityType: 'destination' | 'restaurant' | 'lodging' | 'special_interest' = 'destination';
  @Input() category?: string;
  @Input() name = '';

  get emoji(): string {
    switch (this.entityType) {
      case 'restaurant': return '🍽️';
      case 'lodging':    return '🏨';
      case 'special_interest': {
        const cat = (this.category ?? '').toLowerCase().replace(/_/g, ' ');
        for (const { match, emoji } of SPECIAL_INTEREST_EMOJI) {
          if (match.some((m) => cat.includes(m))) return emoji;
        }
        return '⭐';
      }
      default: return '📍';
    }
  }
}
