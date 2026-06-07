import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { switchMap } from 'rxjs/operators';
import { throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { DestinationPhoto, RestaurantPhoto, LodgingPhoto, SpecialInterestPhoto } from '../../types/schema.types';

export type EntityPhoto = DestinationPhoto | RestaurantPhoto | LodgingPhoto | SpecialInterestPhoto;
export type PhotoEntityType = 'destinations' | 'restaurants' | 'lodging' | 'special-interests';

@Injectable({ providedIn: 'root' })
export class PhotoService {
  private http = inject(HttpClient);

  /** Upload file to R2 then save photo record in the DB. */
  upload(file: File, entityType: PhotoEntityType, entityId: number, isFirst: boolean) {
    const fd = new FormData();
    fd.append('photo', file);
    fd.append('resourceType', entityType);

    return this.http
      .post<{ key: string; url: string }>('/api/uploads', fd)
      .pipe(
        catchError((err) => {
          const msg = err?.error?.error ?? err?.message ?? 'Upload failed';
          return throwError(() => new Error(msg));
        }),
        switchMap(({ key, url }) =>
          this.http.post<EntityPhoto>(`/api/${entityType}/${entityId}/photos`, {
            r2_key: key,
            url,
            is_primary: isFirst,
          }),
        ),
      );
  }

  delete(entityType: PhotoEntityType, entityId: number, photoId: number) {
    return this.http.delete<void>(`/api/${entityType}/${entityId}/photos/${photoId}`);
  }

  setPrimary(entityType: PhotoEntityType, entityId: number, photoId: number) {
    return this.http.patch<EntityPhoto>(
      `/api/${entityType}/${entityId}/photos/${photoId}/primary`,
      {},
    );
  }

  updateCaption(entityType: PhotoEntityType, entityId: number, photoId: number, caption: string) {
    return this.http.patch<EntityPhoto>(
      `/api/${entityType}/${entityId}/photos/${photoId}/caption`,
      { caption },
    );
  }
}
