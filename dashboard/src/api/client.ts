import { isMockMode, mockApi } from './mock';
import type { Device, Position } from './mock';

const API_URL = import.meta.env.VITE_API_URL || '/api';

async function fetchWithAuth(url: string, options: RequestInit = {}) {
  const response = await fetch(`${API_URL}${url}`, {
    ...options,
    credentials: 'include',
    headers: {
      'Accept': 'application/json',
      'Content-Type': options.body instanceof URLSearchParams ? 'application/x-www-form-urlencoded' : 'application/json',
      ...options.headers,
    },
  });

  if (!response.ok) {
    if (response.status === 401) {
      // Handle unauthorized
      throw new Error('Unauthorized');
    }
    throw new Error(`API Error: ${response.statusText}`);
  }

  // Handle 204 No Content for empty responses like logout
  if (response.status === 204) {
    return null;
  }

  return response.json();
}

export const client = {
  login: async (email: string, password: string) => {
    if (isMockMode) return mockApi.login();
    const params = new URLSearchParams();
    params.append('email', email);
    params.append('password', password);
    return fetchWithAuth('/session', {
      method: 'POST',
      body: params,
    });
  },
  logout: async () => {
    if (isMockMode) return mockApi.logout();
    return fetchWithAuth('/session', { method: 'DELETE' });
  },
  session: async () => {
    if (isMockMode) return mockApi.session();
    return fetchWithAuth('/session', { method: 'GET' });
  },
  getDevices: async (): Promise<Device[]> => {
    if (isMockMode) return mockApi.devices();
    return fetchWithAuth('/devices');
  },
  getPositions: async (): Promise<Position[]> => {
    if (isMockMode) return mockApi.positions();
    return fetchWithAuth('/positions');
  },
};
