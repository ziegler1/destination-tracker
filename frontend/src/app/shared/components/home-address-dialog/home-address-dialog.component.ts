import { Component, ChangeDetectionStrategy, inject } from '@angular/core';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

export type HomeAddressDialogResult = 'add-anyway' | undefined;

@Component({
  selector: 'app-home-address-dialog',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatDialogModule, MatButtonModule, MatIconModule],
  template: `
    <h2 mat-dialog-title>
      <mat-icon style="vertical-align:middle;margin-right:8px;color:#f57f17">home</mat-icon>
      Looks Like Home
    </h2>
    <mat-dialog-content>
      <p style="margin:0">
        The location you entered is within 25 miles of your home address.
        Are you sure you want to add it as a travel destination?
      </p>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-stroked-button (click)="dialogRef.close(undefined)">Cancel</button>
      <button mat-raised-button color="primary" (click)="dialogRef.close('add-anyway')">Add Anyway</button>
    </mat-dialog-actions>
  `,
})
export class HomeAddressDialogComponent {
  dialogRef = inject(MatDialogRef<HomeAddressDialogComponent, HomeAddressDialogResult>);
}
