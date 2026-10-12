import { isMockMode } from './mock';

type SocketMessage = {
  devices?: any[];
  positions?: any[];
  events?: any[];
};

class TraccarWebSocket {
  private ws: WebSocket | null = null;
  private url: string;
  private reconnectAttempts = 0;
  private maxReconnectDelay = 30000; // 30 seconds
  private listeners = new Set<(data: SocketMessage) => void>();
  private intentionalClose = false;

  constructor() {
    this.url = import.meta.env.VITE_WS_URL || 'ws://localhost:8082/api/socket';
  }

  connect() {
    if (isMockMode) {
      console.log('Mock Mode: WebSocket connection simulated');
      this.simulateMockUpdates();
      return;
    }

    if (this.ws && (this.ws.readyState === WebSocket.CONNECTING || this.ws.readyState === WebSocket.OPEN)) {
      return;
    }

    this.intentionalClose = false;
    this.ws = new WebSocket(this.url);

    this.ws.onopen = () => {
      console.log('WebSocket connected');
      this.reconnectAttempts = 0;
    };

    this.ws.onmessage = (event) => {
      try {
        const data: SocketMessage = JSON.parse(event.data);
        this.listeners.forEach(listener => listener(data));
      } catch (e) {
        console.error('Error parsing WebSocket message', e);
      }
    };

    this.ws.onclose = () => {
      if (!this.intentionalClose) {
        this.reconnect();
      }
    };

    this.ws.onerror = (error) => {
      console.error('WebSocket Error', error);
    };
  }

  disconnect() {
    this.intentionalClose = true;
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  private reconnect() {
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), this.maxReconnectDelay);
    console.log(`WebSocket reconnecting in ${delay}ms...`);
    setTimeout(() => {
      this.reconnectAttempts++;
      this.connect();
    }, delay);
  }

  subscribe(callback: (data: SocketMessage) => void) {
    this.listeners.add(callback);
    return () => {
      this.listeners.delete(callback);
    };
  }

  private simulateMockUpdates() {
    setInterval(() => {
      const mockData: SocketMessage = {
        positions: [{
          id: 1,
          deviceId: 1,
          latitude: 35.6892 + (Math.random() - 0.5) * 0.01,
          longitude: 51.3890 + (Math.random() - 0.5) * 0.01,
          speed: Math.random() * 60,
          course: Math.random() * 360,
          attributes: { motion: true }
        }]
      };
      this.listeners.forEach(listener => listener(mockData));
    }, 5000);
  }
}

export const socket = new TraccarWebSocket();
