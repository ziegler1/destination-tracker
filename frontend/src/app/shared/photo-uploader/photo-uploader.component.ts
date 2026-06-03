import {
  Component, ChangeDetectionStrategy, inject, signal, input, output, ViewChild, ElementRef,
} from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { PhotoService, EntityPhoto, PhotoEntityType } from '../../core/services/photo.service';

@Component({
  selector: 'app-photo-uploader',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatIconModule, MatButtonModule, MatProgressSpinnerModule, MatSnackBarModule],
  styles: [`
    .drop-zone {
      border: 2px dashed var(--wp-border); border-radius: 10px;
      padding: 28px 16px; text-align: center; cursor: pointer;
      transition: border-color .2s, background .2s;
      color: var(--wp-text-secondary);
    }
    .drop-zone:hover, .drop-zone.dragging {
      border-color: var(--wp-primary); background: rgba(0,105,92,.05);
    }
    .drop-zone mat-icon { font-size: 36px; width: 36px; height: 36px; color: var(--wp-primary); }
    .drop-zone p { margin: 6px 0 0; font-size: 14px; }
    .drop-zone small { font-size: 12px; color: var(--wp-text-hint); }

    .photo-grid {
      display: grid; grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
      gap: 10px; margin-top: 14px;
    }
    .photo-item { position: relative; border-radius: 8px; overflow: hidden; aspect-ratio: 1; }
    .photo-item img { width: 100%; height: 100%; object-fit: cover; display: block; }
    .photo-overlay {
      position: absolute; inset: 0; background: rgba(0,0,0,.45);
      display: flex; align-items: center; justify-content: center; gap: 4px;
      opacity: 0; transition: opacity .2s;
    }
    .photo-item:hover .photo-overlay { opacity: 1; }
    .photo-overlay button { color: white !important; }
    .primary-badge {
      position: absolute; top: 4px; left: 4px; background: var(--wp-accent);
      border-radius: 4px; padding: 1px 5px; font-size: 10px; font-weight: 700; color: #000;
    }
    .uploading-overlay {
      position: absolute; inset: 0; background: rgba(255,255,255,.7);
      display: flex; align-items: center; justify-content: center;
    }
  `],
  template: `
    <!-- Drop zone -->
    <div class="drop-zone" [class.dragging]="isDragging()"
         (click)="fileInput.click()"
         (dragover)="onDragOver($event)"
         (dragleave)="isDragging.set(false)"
         (drop)="onDrop($event)">
      @if (uploading()) {
        <mat-spinner diameter="32" />
        <p>Uploading…</p>
      } @else {
        <mat-icon>cloud_upload</mat-icon>
        <p>Drop photo here or click to browse</p>
        <small>JPEG · PNG · WebP · max 5 MB</small>
      }
    </div>
    <input #fileInput type="file" accept="image/jpeg,image/png,image/webp,image/gif"
           style="display:none" (change)="onFileChange($event)" />

    <!-- Photo grid -->
    @if (photos().length > 0) {
      <div class="photo-grid">
        @for (p of photos(); track p.id) {
          <div class="photo-item">
            <img [src]="p.url" [alt]="'photo'" loading="lazy" />
            @if (p.is_primary) { <div class="primary-badge">PRIMARY</div> }
            <div class="photo-overlay">
              @if (!p.is_primary) {
                <button mat-icon-button (click)="makePrimary(p)" title="Set as primary">
                  <mat-icon>star</mat-icon>
                </button>
              }
              <button mat-icon-button (click)="deletePhoto(p)" title="Delete photo">
                <mat-icon>delete</mat-icon>
              </button>
            </div>
            @if (deletingId() === p.id) {
              <div class="uploading-overlay"><mat-spinner diameter="24" /></div>
            }
          </div>
        }
      </div>
    }
  `,
})
export class PhotoUploaderComponent {
  entityType = input.required<PhotoEntityType>();
  entityId   = input.required<number>();
  photos     = input<EntityPhoto[]>([]);
  changed    = output<void>();

  @ViewChild('fileInput') fileInput!: ElementRef<HTMLInputElement>;

  private svc   = inject(PhotoService);
  private snack = inject(MatSnackBar);

  isDragging = signal(false);
  uploading  = signal(false);
  deletingId = signal<number | null>(null);

  onDragOver(e: DragEvent) {
    e.preventDefault();
    this.isDragging.set(true);
  }

  onDrop(e: DragEvent) {
    e.preventDefault();
    this.isDragging.set(false);
    const file = e.dataTransfer?.files[0];
    if (file) this.upload(file);
  }

  onFileChange(e: Event) {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (file) this.upload(file);
    (e.target as HTMLInputElement).value = '';
  }

  private upload(file: File) {
    if (file.size > 5 * 1024 * 1024) {
      this.snack.open('File exceeds 5 MB limit', 'Dismiss', { duration: 3000 });
      return;
    }
    this.uploading.set(true);
    const isFirst = this.photos().length === 0;
    this.svc.upload(file, this.entityType(), this.entityId(), isFirst).subscribe({
      next: () => { this.uploading.set(false); this.changed.emit(); },
      error: () => {
        this.snack.open('Upload failed', 'Dismiss', { duration: 3000 });
        this.uploading.set(false);
      },
    });
  }

  makePrimary(photo: EntityPhoto) {
    this.svc.setPrimary(this.entityType(), this.entityId(), photo.id).subscribe({
      next: () => this.changed.emit(),
      error: () => this.snack.open('Failed to set primary', 'Dismiss', { duration: 3000 }),
    });
  }

  deletePhoto(photo: EntityPhoto) {
    if (!confirm('Delete this photo?')) return;
    this.deletingId.set(photo.id);
    this.svc.delete(this.entityType(), this.entityId(), photo.id).subscribe({
      next: () => { this.deletingId.set(null); this.changed.emit(); },
      error: () => {
        this.snack.open('Delete failed', 'Dismiss', { duration: 3000 });
        this.deletingId.set(null);
      },
    });
  }
}
