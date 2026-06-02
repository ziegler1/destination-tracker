interface WeatherCache {
  data: WeatherResponse;
  expiresAt: number;
}

export interface WeatherResponse {
  current_weather: {
    temperature: number;
    windspeed: number;
    weathercode: number;
    time: string;
  };
  daily: {
    time: string[];
    temperature_2m_max: number[];
    temperature_2m_min: number[];
    weathercode: number[];
    precipitation_sum: number[];
  };
}

const cache = new Map<string, WeatherCache>();
const TTL = 60 * 60 * 1000; // 1 hour

export async function fetchWeather(lat: number, lon: number): Promise<WeatherResponse> {
  const key = `${lat.toFixed(4)},${lon.toFixed(4)}`;
  const hit = cache.get(key);
  if (hit && Date.now() < hit.expiresAt) return hit.data;

  const params = new URLSearchParams({
    latitude: String(lat),
    longitude: String(lon),
    current_weather: 'true',
    daily: 'temperature_2m_max,temperature_2m_min,weathercode,precipitation_sum',
    temperature_unit: 'fahrenheit',
    timezone: 'auto',
    forecast_days: '7',
  });

  const res = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`);
  if (!res.ok) throw new Error(`Open-Meteo error: ${res.status}`);
  const data = (await res.json()) as WeatherResponse;

  cache.set(key, { data, expiresAt: Date.now() + TTL });
  return data;
}
