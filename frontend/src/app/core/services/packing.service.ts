import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { PackingList, PackingItem } from '../../types/schema.types';

@Injectable({ providedIn: 'root' })
export class PackingService {
  private http = inject(HttpClient);

  private base(tripId: number) { return `/api/trips/${tripId}/packing`; }

  lists(tripId: number) {
    return this.http.get<PackingList[]>(this.base(tripId));
  }

  createList(tripId: number, name: string) {
    return this.http.post<PackingList>(this.base(tripId), { name });
  }

  renameList(tripId: number, listId: number, name: string) {
    return this.http.put<PackingList>(`${this.base(tripId)}/${listId}`, { name });
  }

  deleteList(tripId: number, listId: number) {
    return this.http.delete<void>(`${this.base(tripId)}/${listId}`);
  }

  addItem(tripId: number, listId: number, dto: Record<string, unknown>) {
    return this.http.post<PackingItem>(`${this.base(tripId)}/${listId}/items`, dto);
  }

  updateItem(tripId: number, listId: number, itemId: number, dto: Record<string, unknown>) {
    return this.http.put<PackingItem>(`${this.base(tripId)}/${listId}/items/${itemId}`, dto);
  }

  toggleItem(tripId: number, listId: number, itemId: number) {
    return this.http.patch<PackingItem>(
      `${this.base(tripId)}/${listId}/items/${itemId}/toggle`, {},
    );
  }

  deleteItem(tripId: number, listId: number, itemId: number) {
    return this.http.delete<void>(`${this.base(tripId)}/${listId}/items/${itemId}`);
  }
}
