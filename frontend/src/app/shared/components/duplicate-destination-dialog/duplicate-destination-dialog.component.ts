import { Component, ChangeDetectionStrategy, inject } from '@angular/core';
import { MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';

export interface DuplicateDestinationDialogData {
  existing: { id: number; name: string; city: string; state_province: string };
}

export type DuplicateDestinationDialogResult = 'view' | 'save-anyway';

@Component({
  selector: 'app-duplicate-destination-dialog',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatDialogModule, MatButtonModule],
  template: `
    <h2 mat-dialog-title>Destination Already Exists</h2>
    <mat-dialog-content>
      <p>
        You already have <strong>{{ data.existing.name }}</strong> in
        {{ data.existing.city }}, {{ data.existing.state_province }}.
        Would you like to view it instead?
      </p>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-stroked-button (click)="dialogRef.close('view')">View Existing</button>
      <button mat-raised-button color="primary" (click)="dialogRef.close('save-anyway')">Save Anyway</button>
    </mat-dialog-actions>
  `,
})
export class DuplicateDestinationDialogComponent {
  dialogRef = inject(MatDialogRef<DuplicateDestinationDialogComponent, DuplicateDestinationDialogResult>);
  data: DuplicateDestinationDialogData = inject(MAT_DIALOG_DATA);
}
