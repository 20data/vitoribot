export interface Device {
  id: number;
  name: string;
  uniqueId: string;
  status: string;
  disabled: boolean;
  lastUpdate: string;
  positionId: number;
  phone: string;
  model: string;
  contact: string;
  category: string;
}

export interface Position {
  id: number;
  deviceId: number;
  protocol: string;
  serverTime: string;
  deviceTime: string;
  fixTime: string;
  outdated: boolean;
  valid: boolean;
  latitude: number;
  longitude: number;
  altitude: number;
  speed: number;
  course: number;
  address: string;
  accuracy: number;
  network: any;
  attributes: {
    ignition?: boolean;
    batteryLevel?: number;
    distance?: number;
    totalDistance?: number;
    motion?: boolean;
  };
}

const mockDevices: Device[] = [
  {
    id: 1,
    name: "Toyota Hilux",
    uniqueId: "123456789",
    status: "online",
    disabled: false,
    lastUpdate: new Date().toISOString(),
    positionId: 1,
    phone: "",
    model: "",
    contact: "",
    category: "truck"
  },
  {
    id: 2,
    name: "Delivery Van",
    uniqueId: "987654321",
    status: "offline",
    disabled: false,
    lastUpdate: new Date(Date.now() - 3600000).toISOString(),
    positionId: 2,
    phone: "",
    model: "",
    contact: "",
    category: "van"
  }
];

const mockPositions: Position[] = [
  {
    id: 1,
    deviceId: 1,
    protocol: "osmand",
    serverTime: new Date().toISOString(),
    deviceTime: new Date().toISOString(),
    fixTime: new Date().toISOString(),
    outdated: false,
    valid: true,
    latitude: 35.6892,
    longitude: 51.3890,
    altitude: 1200,
    speed: 30, // knots
    course: 90,
    address: "Tehran, Iran",
    accuracy: 0,
    network: null,
    attributes: {
      ignition: true,
      batteryLevel: 95,
      motion: true
    }
  },
  {
    id: 2,
    deviceId: 2,
    protocol: "osmand",
    serverTime: new Date().toISOString(),
    deviceTime: new Date().toISOString(),
    fixTime: new Date().toISOString(),
    outdated: false,
    valid: true,
    latitude: 35.7000,
    longitude: 51.4000,
    altitude: 1200,
    speed: 0,
    course: 0,
    address: "Tehran, Iran",
    accuracy: 0,
    network: null,
    attributes: {
      ignition: false,
      batteryLevel: 80,
      motion: false
    }
  }
];

export const isMockMode = import.meta.env.VITE_MOCK_MODE === 'true';

export const mockApi = {
  login: async () => {
    return new Promise((resolve) => setTimeout(() => resolve({ id: 1, name: "Admin", email: "admin@example.com" }), 500));
  },
  logout: async () => {
    return new Promise((resolve) => setTimeout(() => resolve(true), 200));
  },
  session: async () => {
    return new Promise((resolve) => setTimeout(() => resolve({ id: 1, name: "Admin", email: "admin@example.com" }), 200));
  },
  devices: async () => {
    return new Promise<Device[]>((resolve) => setTimeout(() => resolve(mockDevices), 500));
  },
  positions: async () => {
    return new Promise<Position[]>((resolve) => setTimeout(() => resolve(mockPositions), 500));
  }
};
