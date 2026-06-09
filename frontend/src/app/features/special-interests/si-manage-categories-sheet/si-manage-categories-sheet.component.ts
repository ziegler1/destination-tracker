import { Component, ChangeDetectionStrategy, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatBottomSheetRef } from '@angular/material/bottom-sheet';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { SiCategoryService, BUILT_IN_SI_CATEGORIES } from '../../../core/services/si-category.service';

@Component({
  selector: 'app-si-manage-categories-sheet',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormsModule, MatButtonModule, MatIconModule, MatFormFieldModule, MatInputModule,
  ],
  styles: [`
    .sheet   { padding: 0 16px 32px; max-height: calc(100vh - 80px); overflow-y: auto; -webkit-overflow-scrolling: touch; }
    .handle  { width: 40px; height: 4px; background: var(--wp-border); border-radius: 2px; margin: 10px auto 16px; }
    .title   { font-size: 18px; font-weight: 700; margin: 0 0 4px; }
    .sub     { font-size: 13px; color: var(--wp-text-secondary); margin: 0 0 20px; }
    .section-label { font-size: 11px; font-weight: 700; text-transform: uppercase;
                     letter-spacing: .7px; color: var(--wp-text-secondary); margin: 16px 0 8px; }
    .cat-row { display: flex; align-items: center; gap: 8px; padding: 8px 0;
               border-bottom: 1px solid var(--wp-divider); }
    .cat-row:last-child { border: none; }
    .cat-icon  { font-size: 20px; width: 28px; text-align: center; }
    .cat-label { flex: 1; font-size: 14px; }
    .add-row { display: flex; gap: 8px; align-items: flex-start; margin-top: 16px; }
    .add-row mat-form-field { flex: 1; }
    .error { font-size: 12px; color: #c62828; margin: 4px 0 0; }
  `],
  template: `
    <div class="sheet">
      <div class="handle"></div>
      <p class="title">Manage Categories</p>
      <p class="sub">Add custom categories for special interest places.</p>

      <p class="section-label">Built-in categories</p>
      @for (c of builtIn; track c.value) {
        <div class="cat-row">
          <span class="cat-icon">{{ c.icon }}</span>
          <span class="cat-label">{{ c.label }}</span>
        </div>
      }

      <p class="section-label">Custom categories</p>
      @if (catSvc.customCategories().length === 0) {
        <p style="font-size:13px;color:var(--wp-text-hint);padding:8px 0">None yet.</p>
      }
      @for (c of catSvc.customCategories(); track c.value) {
        <div class="cat-row">
          <span class="cat-icon">{{ c.icon }}</span>
          <span class="cat-label">{{ c.label }}</span>
          <button mat-icon-button (click)="remove(c.value)" title="Remove">
            <mat-icon style="font-size:18px;color:#c62828">delete</mat-icon>
          </button>
        </div>
      }

      <div class="add-row">
        <mat-form-field appearance="outline">
          <mat-label>New category name</mat-label>
          <input matInput [(ngModel)]="newLabel" (keydown.enter)="add()"
                 placeholder="e.g. Coffee Shop" />
        </mat-form-field>
        <button mat-raised-button color="primary" style="margin-top:4px"
                [disabled]="!newLabel.trim()" (click)="add()">
          <mat-icon>add</mat-icon> Add
        </button>
      </div>
      @if (errorMsg()) {
        <p class="error">{{ errorMsg() }}</p>
      }

      <button mat-stroked-button style="width:100%;margin-top:16px" (click)="ref.dismiss()">
        Done
      </button>
    </div>
  `,
})
export class SiManageCategoriesSheetComponent {
  readonly ref    = inject(MatBottomSheetRef<SiManageCategoriesSheetComponent>);
  readonly catSvc = inject(SiCategoryService);

  readonly builtIn = BUILT_IN_SI_CATEGORIES;
  newLabel = '';
  errorMsg = signal('');

  add(): void {
    if (!this.newLabel.trim()) return;
    try {
      this.catSvc.add(this.newLabel);
      this.newLabel = '';
      this.errorMsg.set('');
    } catch (e: unknown) {
      this.errorMsg.set(e instanceof Error ? e.message : 'Could not add category.');
    }
  }

  remove(value: string): void {
    this.catSvc.remove(value);
  }
}
