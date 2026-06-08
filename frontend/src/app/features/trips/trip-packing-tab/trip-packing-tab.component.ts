import {
  Component, OnInit, ChangeDetectionStrategy, inject, signal, computed, input,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { COMMA, ENTER } from '@angular/cdk/keycodes';
import { forkJoin } from 'rxjs';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatChipsModule, MatChipInputEvent } from '@angular/material/chips';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { PackingService } from '../../../core/services/packing.service';
import { ClaudeService } from '../../../core/services/claude.service';
import { PackingList, PackingItem } from '../../../types/schema.types';

interface AiCategory { name: string; items: string[]; selected: Set<string>; }

@Component({
  selector: 'app-trip-packing-tab',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormsModule, MatCardModule, MatButtonModule, MatIconModule,
    MatCheckboxModule, MatProgressBarModule, MatFormFieldModule,
    MatInputModule, MatChipsModule, MatProgressSpinnerModule, MatSnackBarModule,
  ],
  styles: [`
    .list-header {
      display:flex; align-items:center; gap:8px; margin-bottom:8px; flex-wrap:wrap;
    }
    .list-name { font-size:16px; font-weight:600; flex:1; }
    .list-name-input { font-size:16px; font-weight:600; border:none; border-bottom:2px solid var(--wp-primary); outline:none; background:transparent; flex:1; }
    .progress-bar { margin-bottom:12px; }
    .progress-label { font-size:12px; color:var(--wp-text-secondary); margin-bottom:4px; }

    .category-section { margin-bottom:12px; }
    .category-header {
      display:flex; align-items:center; gap:6px; margin-bottom:4px;
      font-size:12px; font-weight:600; text-transform:uppercase;
      letter-spacing:.8px; color:var(--wp-text-secondary);
    }
    .item-row { display:flex; align-items:center; gap:6px; padding:4px 0; }
    .item-name { flex:1; font-size:14px; }
    .item-qty  { font-size:12px; color:var(--wp-text-hint); }
    .item-actions { display:flex; gap:0; }

    .add-item-row { display:flex; gap:8px; align-items:flex-end; margin-top:8px; flex-wrap:wrap; }
    .add-item-row mat-form-field { flex:1; min-width:120px; }

    .list-card { margin-bottom:16px; padding:16px; }
    .list-footer { display:flex; gap:8px; margin-top:12px; flex-wrap:wrap; align-items:center; }

    .new-list-row { display:flex; gap:8px; align-items:flex-end; margin-bottom:16px; }
    .new-list-row mat-form-field { flex:1; }

    .ai-panel {
      margin-top:12px; padding:14px; border-radius:8px;
      background:var(--wp-surface-variant); border-left:3px solid var(--wp-accent);
    }
    .ai-cat-name { font-size:14px; font-weight:600; margin:8px 0 4px; }
    .ai-items { display:flex; flex-wrap:wrap; gap:6px; }
    .ai-chip {
      padding:3px 10px; border-radius:12px; cursor:pointer; font-size:13px;
      background:var(--wp-surface); border:1.5px solid var(--wp-border);
    }
    .ai-chip.selected { background:var(--wp-accent); border-color:var(--wp-accent); color:#000; }
    .ai-actions { display:flex; gap:8px; margin-top:12px; }

    .empty { text-align:center; color:var(--wp-text-secondary); padding:40px 0; }
  `],
  template: `
    <div style="padding-top:20px">
      @if (loading()) {
        <div class="loading-wrap"><mat-spinner diameter="40" /></div>
      } @else {

        <!-- New list row -->
        @if (showNewList()) {
          <div class="new-list-row">
            <mat-form-field appearance="outline" subscriptSizing="dynamic">
              <mat-label>List name</mat-label>
              <input matInput [(ngModel)]="newListName" placeholder="e.g. Main Bag" (keyup.enter)="createList()" />
            </mat-form-field>
            <button mat-raised-button color="primary" (click)="createList()" [disabled]="!newListName().trim()">
              Create
            </button>
            <button mat-stroked-button (click)="showNewList.set(false)">Cancel</button>
          </div>
        } @else {
          <button mat-stroked-button (click)="showNewList.set(true)" style="margin-bottom:16px">
            <mat-icon>add</mat-icon> New List
          </button>
        }

        @if (lists().length === 0) {
          <div class="empty">No packing lists yet — create one above.</div>
        }

        @for (list of lists(); track list.id) {
          <mat-card class="list-card">

            <!-- List header -->
            <div class="list-header">
              @if (renamingListId() === list.id) {
                <input class="list-name-input" [(ngModel)]="renameValue"
                       (keyup.enter)="saveRename(list.id)" (blur)="saveRename(list.id)" />
              } @else {
                <span class="list-name" (dblclick)="startRename(list)">{{ list.name }}</span>
              }
              <button mat-icon-button (click)="startRename(list)" title="Rename"><mat-icon>edit</mat-icon></button>
              <button mat-icon-button color="warn" (click)="deleteList(list.id)" title="Delete list"><mat-icon>delete</mat-icon></button>
            </div>

            <!-- Progress bar -->
            <div class="progress-bar">
              <div class="progress-label">{{ packedCount(list) }}/{{ list.items?.length ?? 0 }} packed</div>
              <mat-progress-bar mode="determinate" [value]="listProgress(list)" />
            </div>

            <!-- Items grouped by category -->
            @for (cat of groupItems(list); track cat.key) {
              <div class="category-section">
                <div class="category-header">
                  <span>{{ cat.key }}</span>
                  <button mat-icon-button style="width:20px;height:20px;line-height:20px"
                          (click)="toggleCategory(list, cat.value)"
                          [title]="allPacked(cat.value) ? 'Uncheck all' : 'Check all'">
                    <mat-icon style="font-size:14px;width:14px;height:14px">
                      {{ allPacked(cat.value) ? 'check_box' : 'check_box_outline_blank' }}
                    </mat-icon>
                  </button>
                </div>
                @for (item of cat.value; track item.id) {
                  <div class="item-row">
                    <mat-checkbox [checked]="item.is_packed" (change)="toggleItem(list.id, item)" />
                    <span class="item-name" [style.textDecoration]="item.is_packed ? 'line-through' : 'none'"
                          [style.color]="item.is_packed ? 'var(--wp-text-hint)' : ''">
                      {{ item.item_name }}
                    </span>
                    @if (item.quantity > 1) {
                      <span class="item-qty">×{{ item.quantity }}</span>
                    }
                    <div class="item-actions">
                      <button mat-icon-button style="width:28px;height:28px;line-height:28px"
                              (click)="deleteItem(list.id, item.id)">
                        <mat-icon style="font-size:14px;width:14px;height:14px">close</mat-icon>
                      </button>
                    </div>
                  </div>
                }
              </div>
            }

            <!-- Add item row -->
            @if (addingToList() === list.id) {
              <div class="add-item-row">
                <mat-form-field appearance="outline" subscriptSizing="dynamic" style="max-width:120px">
                  <mat-label>Category</mat-label>
                  <input matInput [(ngModel)]="newItemCat" placeholder="General" />
                </mat-form-field>
                <mat-form-field appearance="outline" subscriptSizing="dynamic">
                  <mat-label>Item name</mat-label>
                  <input matInput [(ngModel)]="newItemName" (keyup.enter)="addItem(list.id)" />
                </mat-form-field>
                <mat-form-field appearance="outline" subscriptSizing="dynamic" style="max-width:80px">
                  <mat-label>Qty</mat-label>
                  <input matInput type="number" [(ngModel)]="newItemQty" min="1" />
                </mat-form-field>
                <button mat-raised-button color="primary" (click)="addItem(list.id)" [disabled]="!newItemName().trim()">Add</button>
                <button mat-stroked-button (click)="addingToList.set(null)">Cancel</button>
              </div>
            }

            <!-- List footer actions -->
            <div class="list-footer">
              <button mat-stroked-button (click)="openAddItem(list.id)">
                <mat-icon>add</mat-icon> Add Item
              </button>
              <button mat-stroked-button (click)="suggestWithAI(list)" [disabled]="aiLoading()">
                <mat-icon>auto_awesome</mat-icon>
                {{ aiLoading() && aiTargetId() === list.id ? 'Thinking…' : 'AI Suggest' }}
              </button>
              @if (list.items && list.items.length > 0) {
                <button mat-stroked-button (click)="uncheckAll(list)">Uncheck All</button>
              }
            </div>

            <!-- AI suggestions panel -->
            @if (aiTargetId() === list.id && aiSuggestions().length > 0) {
              <div class="ai-panel">
                <strong>AI Suggestions — click to select, then Import</strong>
                @for (cat of aiSuggestions(); track cat.name) {
                  <div class="ai-cat-name">{{ cat.name }}</div>
                  <div class="ai-items">
                    @for (item of cat.items; track item) {
                      <span class="ai-chip" [class.selected]="cat.selected.has(item)"
                            (click)="toggleAiItem(cat, item)">
                        {{ item }}
                      </span>
                    }
                  </div>
                }
                <div class="ai-actions">
                  <button mat-raised-button color="accent" (click)="importSuggestions(list.id)">
                    <mat-icon>download</mat-icon> Import Selected
                  </button>
                  <button mat-stroked-button (click)="aiSuggestions.set([]); aiTargetId.set(null)">Dismiss</button>
                </div>
              </div>
            }
          </mat-card>
        }
      }
    </div>
  `,
})
export class TripPackingTabComponent implements OnInit {
  tripId  = input.required<number>();
  tripName = input('');

  private packSvc = inject(PackingService);
  private claudeSvc = inject(ClaudeService);
  private snack = inject(MatSnackBar);

  loading = signal(true);
  lists = signal<PackingList[]>([]);

  showNewList = signal(false);
  newListName = signal('');

  renamingListId = signal<number | null>(null);
  renameValue = '';

  addingToList = signal<number | null>(null);
  newItemCat  = signal('General');
  newItemName = signal('');
  newItemQty  = signal(1);

  aiLoading = signal(false);
  aiTargetId = signal<number | null>(null);
  aiSuggestions = signal<AiCategory[]>([]);

  readonly separatorKeys = [ENTER, COMMA];

  ngOnInit() { this.load(); }

  private load() {
    this.packSvc.lists(this.tripId()).subscribe({
      next: (l) => { this.lists.set(l); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }

  createList() {
    const name = this.newListName().trim();
    if (!name) return;
    this.packSvc.createList(this.tripId(), name).subscribe(() => {
      this.newListName.set('');
      this.showNewList.set(false);
      this.load();
    });
  }

  startRename(list: PackingList) {
    this.renameValue = list.name;
    this.renamingListId.set(list.id);
  }

  saveRename(listId: number) {
    if (!this.renameValue.trim()) { this.renamingListId.set(null); return; }
    this.packSvc.renameList(this.tripId(), listId, this.renameValue).subscribe(() => {
      this.renamingListId.set(null);
      this.load();
    });
  }

  deleteList(listId: number) {
    if (!confirm('Delete this packing list and all its items?')) return;
    this.packSvc.deleteList(this.tripId(), listId).subscribe(() => this.load());
  }

  openAddItem(listId: number) {
    this.newItemCat.set('General');
    this.newItemName.set('');
    this.newItemQty.set(1);
    this.addingToList.set(listId);
  }

  addItem(listId: number) {
    const name = this.newItemName().trim();
    if (!name) return;
    this.packSvc.addItem(this.tripId(), listId, {
      category: this.newItemCat().trim() || 'General',
      item_name: name,
      quantity: this.newItemQty(),
    }).subscribe(() => {
      this.newItemName.set('');
      this.load();
    });
  }

  toggleItem(listId: number, item: PackingItem) {
    this.packSvc.toggleItem(this.tripId(), listId, item.id).subscribe(() => this.load());
  }

  deleteItem(listId: number, itemId: number) {
    if (!confirm('Remove this item?')) return;
    this.packSvc.deleteItem(this.tripId(), listId, itemId).subscribe(() => this.load());
  }

  toggleCategory(list: PackingList, items: PackingItem[]) {
    const allPacked = items.every((i) => i.is_packed);
    const targets = allPacked ? items : items.filter((i) => !i.is_packed);
    if (!targets.length) return;
    forkJoin(targets.map((i) => this.packSvc.toggleItem(this.tripId(), list.id, i.id)))
      .subscribe(() => this.load());
  }

  uncheckAll(list: PackingList) {
    const packed = (list.items ?? []).filter((i) => i.is_packed);
    if (!packed.length) return;
    forkJoin(packed.map((i) => this.packSvc.toggleItem(this.tripId(), list.id, i.id)))
      .subscribe(() => this.load());
  }

  groupItems(list: PackingList): { key: string; value: PackingItem[] }[] {
    const result: Record<string, PackingItem[]> = {};
    for (const item of (list.items ?? [])) {
      const cat = item.category || 'General';
      (result[cat] ??= []).push(item);
    }
    return Object.entries(result).map(([key, value]) => ({ key, value }));
  }

  allPacked(items: PackingItem[]): boolean {
    return items.length > 0 && items.every((i) => i.is_packed);
  }

  listProgress(list: PackingList): number {
    const items = list.items ?? [];
    if (!items.length) return 0;
    return Math.round((items.filter((i) => i.is_packed).length / items.length) * 100);
  }

  packedCount(list: PackingList): number {
    return (list.items ?? []).filter((i) => i.is_packed).length;
  }

  suggestWithAI(list: PackingList) {
    this.aiLoading.set(true);
    this.aiTargetId.set(list.id);
    this.aiSuggestions.set([]);
    this.claudeSvc.packingSuggestions(this.tripName(), [], 7, []).subscribe({
      next: (res) => {
        try {
          const parsed = JSON.parse(res.result) as { categories: { name: string; items: string[] }[] };
          this.aiSuggestions.set(
            (parsed.categories ?? []).map((c) => ({ ...c, selected: new Set(c.items) })),
          );
        } catch {
          this.snack.open('Could not parse AI response', 'Dismiss', { duration: 3000 });
        }
        this.aiLoading.set(false);
      },
      error: () => {
        this.snack.open('AI request failed', 'Dismiss', { duration: 3000 });
        this.aiLoading.set(false);
      },
    });
  }

  toggleAiItem(cat: AiCategory, item: string) {
    if (cat.selected.has(item)) cat.selected.delete(item);
    else cat.selected.add(item);
    this.aiSuggestions.update((v) => [...v]); // trigger re-render
  }

  importSuggestions(listId: number) {
    const toAdd: { category: string; item_name: string }[] = [];
    for (const cat of this.aiSuggestions()) {
      for (const item of cat.selected) {
        toAdd.push({ category: cat.name, item_name: item });
      }
    }
    if (!toAdd.length) { this.snack.open('No items selected', 'Dismiss', { duration: 2000 }); return; }
    forkJoin(toAdd.map((dto) => this.packSvc.addItem(this.tripId(), listId, { ...dto, quantity: 1 })))
      .subscribe(() => {
        this.aiSuggestions.set([]);
        this.aiTargetId.set(null);
        this.load();
        this.snack.open(`${toAdd.length} items imported`, 'OK', { duration: 2500 });
      });
  }
}
