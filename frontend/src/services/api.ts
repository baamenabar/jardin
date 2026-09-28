import {
  Property,
  Obstacle,
  GardenBed,
  PlantSpecies,
  PlantPlacement,
  InstantShadowsResponse,
  DailySunlightResponse,
  MonthlyBloomResponse,
  ChatMessage,
} from '../types/garden';

const BASE_URL = '/api/v1';

async function fetchJson<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, options);
  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`API Error [${res.status}]: ${errorText || res.statusText}`);
  }
  if (res.status === 204) {
    return null as unknown as T;
  }
  return res.json();
}

export const api = {
  // Property
  getProperty: () => fetchJson<Property>(`${BASE_URL}/property`),
  updateProperty: (data: Partial<Property>) =>
    fetchJson<Property>(`${BASE_URL}/property`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }),
  uploadBackground: (file: File, scalePxPerM?: number) => {
    const formData = new FormData();
    formData.append('file', file);
    const url = scalePxPerM
      ? `${BASE_URL}/property/background?scale_px_per_m=${scalePxPerM}`
      : `${BASE_URL}/property/background`;
    return fetchJson<{ status: string; background_image: string; background_scale_px_per_m: number }>(
      url,
      { method: 'POST', body: formData }
    );
  },

  // Obstacles / Structures
  listObstacles: () => fetchJson<Obstacle[]>(`${BASE_URL}/obstacles`),
  createObstacle: (data: Omit<Obstacle, 'id' | 'property_id'>) =>
    fetchJson<Obstacle>(`${BASE_URL}/obstacles`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }),
  updateObstacle: (id: number, data: Partial<Obstacle>) =>
    fetchJson<Obstacle>(`${BASE_URL}/obstacles/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }),
  deleteObstacle: (id: number) =>
    fetchJson<void>(`${BASE_URL}/obstacles/${id}`, { method: 'DELETE' }),

  // Beds
  listBeds: (zone?: string) => {
    const url = zone ? `${BASE_URL}/beds?zone=${zone}` : `${BASE_URL}/beds`;
    return fetchJson<GardenBed[]>(url);
  },
  createBed: (data: Omit<GardenBed, 'id' | 'property_id'>) =>
    fetchJson<GardenBed>(`${BASE_URL}/beds`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }),
  updateBed: (id: number, data: Partial<GardenBed>) =>
    fetchJson<GardenBed>(`${BASE_URL}/beds/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }),
  deleteBed: (id: number) =>
    fetchJson<void>(`${BASE_URL}/beds/${id}`, { method: 'DELETE' }),

  // Plants
  listPlants: (query?: string, bloomMonth?: number) => {
    const params = new URLSearchParams();
    if (query) params.append('query', query);
    if (bloomMonth) params.append('bloom_month', String(bloomMonth));
    return fetchJson<PlantSpecies[]>(`${BASE_URL}/plants?${params.toString()}`);
  },
  createPlant: (data: Omit<PlantSpecies, 'id'>) =>
    fetchJson<PlantSpecies>(`${BASE_URL}/plants`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }),
  enrichPlant: (query: string, autoSave: boolean = false) =>
    fetchJson<PlantSpecies>(`${BASE_URL}/plants/enrich`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, auto_save: autoSave }),
    }),

  // Placements
  listPlacements: (bedId?: number) => {
    const url = bedId !== undefined ? `${BASE_URL}/placements?bed_id=${bedId}` : `${BASE_URL}/placements`;
    return fetchJson<PlantPlacement[]>(url);
  },
  createPlacement: (data: Omit<PlantPlacement, 'id' | 'species'>) =>
    fetchJson<PlantPlacement>(`${BASE_URL}/placements`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }),
  updatePlacement: (id: number, data: Partial<PlantPlacement>) =>
    fetchJson<PlantPlacement>(`${BASE_URL}/placements/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }),
  deletePlacement: (id: number) =>
    fetchJson<void>(`${BASE_URL}/placements/${id}`, { method: 'DELETE' }),

  // Solar, Shadows & Blooms
  getShadows: (dateStr?: string, timeStr?: string) => {
    const params = new URLSearchParams();
    if (dateStr) params.append('date_str', dateStr);
    if (timeStr) params.append('time_str', timeStr);
    return fetchJson<InstantShadowsResponse>(`${BASE_URL}/analysis/shadows?${params.toString()}`);
  },
  getSunlight: (dateStr?: string) => {
    const params = new URLSearchParams();
    if (dateStr) params.append('date_str', dateStr);
    return fetchJson<DailySunlightResponse>(`${BASE_URL}/analysis/sunlight?${params.toString()}`);
  },
  getBlooms: (month?: number) => {
    const params = new URLSearchParams();
    if (month) params.append('month', String(month));
    return fetchJson<MonthlyBloomResponse>(`${BASE_URL}/analysis/blooms?${params.toString()}`);
  },

  // Agent Chat
  sendChat: (messages: ChatMessage[]) =>
    fetchJson<{ message: { role: string; content: string } }>(`${BASE_URL}/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages }),
    }),
};
