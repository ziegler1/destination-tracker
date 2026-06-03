import {
  Component, ChangeDetectionStrategy, inject, signal,
} from '@angular/core';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { ClaudeService } from '../../../core/services/claude.service';

interface SuggestedDest {
  name: string;
  state_province: string;
  country: string;
  description: string;
  top_activities: string[];
  best_months: string[];
}

const STYLE_OPTIONS = [
  'Outdoor & Hiking', 'Road Trip', 'Beach & Coast', 'Mountains',
  'History & Culture', 'Food & Dining', 'Wildlife & Nature', 'City Break',
  'National Parks', 'Quirky & Offbeat',
];

@Component({
  selector: 'app-destination-suggest',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormsModule, MatCardModule, MatFormFieldModule, MatInputModule,
    MatButtonModule, MatIconModule, MatChipsModule,
    MatProgressSpinnerModule, MatSnackBarModule,
  ],
  styles: [`
    .page-title { font-size:24px; font-weight:700; margin:0 0 6px; }
    .page-sub   { color:var(--wp-text-secondary); margin:0 0 24px; }

    .style-grid { display:flex; flex-wrap:wrap; gap:8px; margin-bottom:20px; }
    .style-chip {
      padding:6px 14px; border-radius:16px; border:1.5px solid var(--wp-border);
      background:var(--wp-surface); cursor:pointer; font-size:13px;
      color:var(--wp-text-secondary); transition:all .2s;
    }
    .style-chip.selected { background:var(--wp-primary); color:white; border-color:var(--wp-primary); }

    .results-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(300px,1fr)); gap:16px; margin-top:28px; }

    .result-card { padding:18px; }
    .dest-name   { font-size:18px; font-weight:700; margin:0 0 3px; }
    .dest-loc    { font-size:13px; color:var(--wp-text-secondary); margin:0 0 10px; }
    .dest-desc   { font-size:14px; line-height:1.6; color:var(--wp-text-secondary); margin:0 0 12px; }
    .dest-acts   { font-size:13px; margin-bottom:10px; }
    .act-chip    { display:inline-block; padding:2px 9px; border-radius:10px;
                   background:var(--wp-surface-variant); font-size:12px; margin:2px; }
    .months-row  { font-size:12px; color:var(--wp-text-hint); margin-bottom:12px; }

    .loading-row { display:flex; flex-direction:column; align-items:center; padding:40px 0; gap:12px; }
    .loading-row p { color:var(--wp-text-secondary); }
  `],
  template: `
    <div class="page-container" style="max-width:900px">
      <p class="page-title">✨ Suggest a Destination</p>
      <p class="page-sub">Tell Claude what you're looking for and get three personalised picks.</p>

      <!-- Travel style chips -->
      <p style="font-size:13px;font-weight:600;margin-bottom:8px;color:var(--wp-text-secondary)">
        What's your travel style?
      </p>
      <div class="style-grid">
        @for (s of styleOptions; track s) {
          <span class="style-chip" [class.selected]="selectedStyles().includes(s)"
                (click)="toggleStyle(s)">{{ s }}</span>
        }
      </div>

      <!-- Preferences textarea -->
      <mat-form-field appearance="outline" style="width:100%">
        <mat-label>Describe what you're looking for (optional)</mat-label>
        <textarea matInput [(ngModel)]="preferences" rows="3"
          placeholder="e.g. A quiet spot with great hiking, no crowds, and somewhere I can see wildlife…"></textarea>
      </mat-form-field>

      <button mat-raised-button color="primary" [disabled]="loading()"
              (click)="suggest()" style="margin-top:8px">
        <mat-icon>auto_awesome</mat-icon>
        {{ loading() ? 'Thinking…' : 'Suggest Destinations' }}
      </button>

      <!-- Loading state -->
      @if (loading()) {
        <div class="loading-row">
          <mat-spinner diameter="40" />
          <p>Claude is exploring the map for you…</p>
        </div>
      }

      <!-- Results -->
      @if (results().length > 0) {
        <div class="results-grid">
          @for (dest of results(); track dest.name) {
            <mat-card class="result-card">
              <p class="dest-name">{{ dest.name }}</p>
              <p class="dest-loc">{{ dest.state_province }} · {{ dest.country }}</p>
              <p class="dest-desc">{{ dest.description }}</p>

              @if (dest.top_activities?.length) {
                <div class="dest-acts">
                  @for (a of dest.top_activities; track a) {
                    <span class="act-chip">{{ a }}</span>
                  }
                </div>
              }

              @if (dest.best_months?.length) {
                <p class="months-row">
                  Best time: {{ dest.best_months.join(', ') }}
                </p>
              }

              <button mat-stroked-button color="primary" (click)="saveToWishlist(dest)">
                <mat-icon>add_location</mat-icon> Save to Wishlist
              </button>
            </mat-card>
          }
        </div>
      }
    </div>
  `,
})
export class DestinationSuggestComponent {
  private claudeSvc = inject(ClaudeService);
  private router    = inject(Router);
  private snack     = inject(MatSnackBar);

  preferences   = '';
  selectedStyles = signal<string[]>([]);
  loading        = signal(false);
  results        = signal<SuggestedDest[]>([]);

  readonly styleOptions = STYLE_OPTIONS;

  toggleStyle(s: string) {
    this.selectedStyles.update((cur) =>
      cur.includes(s) ? cur.filter((x) => x !== s) : [...cur, s],
    );
  }

  suggest() {
    const pref = [
      this.selectedStyles().join(', '),
      this.preferences,
    ].filter(Boolean).join('. ') || 'Interesting US or Canada destinations';

    this.loading.set(true);
    this.results.set([]);

    this.claudeSvc.suggestDestination(pref).subscribe({
      next: (res) => {
        try {
          const parsed = JSON.parse(res.result) as SuggestedDest[];
          this.results.set(Array.isArray(parsed) ? parsed : []);
        } catch {
          this.snack.open('Could not parse AI response — try again', 'Dismiss', { duration: 3000 });
        }
        this.loading.set(false);
      },
      error: () => {
        this.snack.open('AI request failed', 'Dismiss', { duration: 3000 });
        this.loading.set(false);
      },
    });
  }

  saveToWishlist(dest: SuggestedDest) {
    const params = new URLSearchParams({
      name:           dest.name,
      state_province: dest.state_province ?? '',
      country:        dest.country ?? 'USA',
      description:    dest.description ?? '',
      best_months:    (dest.best_months ?? []).join(','),
    });
    this.router.navigateByUrl(`/destinations/new?${params.toString()}`);
  }
}
