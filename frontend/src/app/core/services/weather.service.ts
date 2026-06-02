import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { WeatherResponse } from '../../types/schema.types';

export function weatherEmoji(code: number): string {
  if (code === 0)                         return '☀️';
  if (code <= 3)                          return '⛅';
  if (code <= 48)                         return '🌫️';
  if (code <= 67)                         return '🌧️';
  if (code <= 77)                         return '🌨️';
  if (code <= 82)                         return '🌦️';
  if (code <= 86)                         return '🌨️';
  if (code >= 95)                         return '⛈️';
  return '🌡️';
}

@Injectable({ providedIn: 'root' })
export class WeatherService {
  private http = inject(HttpClient);

  getWeather(lat: number, lon: number) {
    return this.http.get<WeatherResponse>(`/api/weather?lat=${lat}&lon=${lon}`);
  }
}
