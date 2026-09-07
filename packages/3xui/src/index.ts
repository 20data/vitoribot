import axios, { type AxiosInstance } from 'axios';

export interface Inbound {
  id: number;
  remark: string;
  protocol: string;
  settings: string;
  streamSettings: string;
  sniffing: string;
  [key: string]: unknown;
}

export interface CreateClientDto {
  uuid: string;
  email: string;
  totalGB: number;
  expiryTime: number;
  enable: boolean;
  tgId?: string;
  subId?: string;
}

export type UpdateClientDto = Partial<CreateClientDto>;

export interface ClientTraffic {
  id?: number;
  email?: string;
  up: number;
  down: number;
  total: number;
  enable?: boolean;
  expiryTime?: number;
}

interface SessionCache {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, ttlSeconds: number): Promise<void>;
}

export class ThreeXUIClient {
  private readonly http: AxiosInstance;
  private sessionCookie: string | null = null;
  private cookieExpiresAt = 0;

  constructor(
    private readonly panelId: string,
    private readonly baseUrl: string,
    private readonly username: string,
    private readonly password: string,
    private readonly cache?: SessionCache,
  ) {
    const cleanBase = baseUrl.replace(/\/+$/, '');
    this.http = axios.create({
      baseURL: cleanBase,
      timeout: 15000,
      validateStatus: (s) => s < 500,
    });
  }

  private cacheKey(): string {
    return `3xui:session:${this.panelId}`;
  }

  async login(): Promise<void> {
    try {
      const res = await this.http.post('/login', {
        username: this.username,
        password: this.password,
      });
      const setCookie: string[] | undefined =
        (res.headers['set-cookie'] as string[] | undefined) ?? undefined;
      if (!setCookie || setCookie.length === 0) {
        throw new Error('3x-ui login did not return a session cookie');
      }
      const session = setCookie.map((c) => c.split(';')[0]).join('; ');
      this.sessionCookie = session;
      // Default panel session ~24h; keep 5-min safety buffer.
      this.cookieExpiresAt = Date.now() + 24 * 3600 * 1000 - 5 * 60 * 1000;
      if (this.cache) {
        const ttlSec = 24 * 3600 - 300;
        await this.cache.set(this.cacheKey(), session, ttlSec);
      }
    } catch (err) {
      throw new Error(`3x-ui login failed for panel ${this.panelId}: ${(err as Error).message}`);
    }
  }

  private async ensureSession(): Promise<void> {
    if (this.sessionCookie && Date.now() < this.cookieExpiresAt) return;
    if (this.cache) {
      try {
        const cached = await this.cache.get(this.cacheKey());
        if (cached) {
          this.sessionCookie = cached;
          this.cookieExpiresAt = Date.now() + 24 * 3600 * 1000 - 5 * 60 * 1000;
          return;
        }
      } catch {
        // Fall through to fresh login on cache errors.
      }
    }
    await this.login();
  }

  private cookieHeader(): Record<string, string> {
    if (!this.sessionCookie) return {};
    return { Cookie: this.sessionCookie };
  }

  async getInbounds(): Promise<Inbound[]> {
    try {
      await this.ensureSession();
      const res = await this.http.get('/panel/api/inbounds/list', {
        headers: this.cookieHeader(),
      });
      if (res.data?.success === false) {
        await this.login();
        const retry = await this.http.get('/panel/api/inbounds/list', {
          headers: this.cookieHeader(),
        });
        return (retry.data?.obj ?? []) as Inbound[];
      }
      return (res.data?.obj ?? []) as Inbound[];
    } catch (err) {
      throw new Error(`getInbounds failed: ${(err as Error).message}`);
    }
  }

  async getInbound(id: number): Promise<Inbound> {
    try {
      await this.ensureSession();
      const res = await this.http.get(`/panel/api/inbounds/${id}`, {
        headers: this.cookieHeader(),
      });
      return res.data?.obj as Inbound;
    } catch (err) {
      throw new Error(`getInbound failed: ${(err as Error).message}`);
    }
  }

  async addClient(inboundId: number, client: CreateClientDto): Promise<void> {
    try {
      await this.ensureSession();
      await this.http.post(
        '/panel/api/inbounds/addClient',
        {
          id: inboundId,
          settings: JSON.stringify({ clients: [client] }),
        },
        { headers: this.cookieHeader() },
      );
    } catch (err) {
      throw new Error(`addClient failed: ${(err as Error).message}`);
    }
  }

  async updateClient(inboundId: number, uuid: string, data: UpdateClientDto): Promise<void> {
    try {
      await this.ensureSession();
      await this.http.post(
        `/panel/api/inbounds/updateClient/${uuid}`,
        {
          id: inboundId,
          settings: JSON.stringify({ clients: [{ uuid, ...data }] }),
        },
        { headers: this.cookieHeader() },
      );
    } catch (err) {
      throw new Error(`updateClient failed: ${(err as Error).message}`);
    }
  }

  async deleteClient(inboundId: number, uuid: string): Promise<void> {
    try {
      await this.ensureSession();
      await this.http.post(
        `/panel/api/inbounds/${inboundId}/delClient/${uuid}`,
        {},
        { headers: this.cookieHeader() },
      );
    } catch (err) {
      throw new Error(`deleteClient failed: ${(err as Error).message}`);
    }
  }

  async getClientTraffic(email: string): Promise<ClientTraffic> {
    try {
      await this.ensureSession();
      const res = await this.http.get(
        `/panel/api/inbounds/getClientTraffics/${encodeURIComponent(email)}`,
        { headers: this.cookieHeader() },
      );
      return res.data?.obj as ClientTraffic;
    } catch (err) {
      throw new Error(`getClientTraffic failed: ${(err as Error).message}`);
    }
  }

  async getClientTrafficById(id: number): Promise<ClientTraffic> {
    try {
      await this.ensureSession();
      const res = await this.http.get(`/panel/api/inbounds/getClientTrafficsById/${id}`, {
        headers: this.cookieHeader(),
      });
      return res.data?.obj as ClientTraffic;
    } catch (err) {
      throw new Error(`getClientTrafficById failed: ${(err as Error).message}`);
    }
  }

  async resetClientTraffic(email: string): Promise<void> {
    try {
      await this.ensureSession();
      await this.http.post(
        `/panel/api/inbounds/resetClientTraffic/${encodeURIComponent(email)}`,
        {},
        { headers: this.cookieHeader() },
      );
    } catch (err) {
      throw new Error(`resetClientTraffic failed: ${(err as Error).message}`);
    }
  }

  async getClientIps(email: string): Promise<string[]> {
    try {
      await this.ensureSession();
      const res = await this.http.get(
        `/panel/api/inbounds/getClientIps/${encodeURIComponent(email)}`,
        { headers: this.cookieHeader() },
      );
      const obj = res.data?.obj as unknown;
      if (Array.isArray(obj)) return obj as string[];
      if (typeof obj === 'string' && obj.length > 0) return obj.split(',');
      return [];
    } catch (err) {
      throw new Error(`getClientIps failed: ${(err as Error).message}`);
    }
  }

  async clearClientIps(email: string): Promise<void> {
    try {
      await this.ensureSession();
      await this.http.post(
        `/panel/api/inbounds/clearClientIps/${encodeURIComponent(email)}`,
        {},
        { headers: this.cookieHeader() },
      );
    } catch (err) {
      throw new Error(`clearClientIps failed: ${(err as Error).message}`);
    }
  }

  async getOnlineClients(): Promise<string[]> {
    try {
      await this.ensureSession();
      const res = await this.http.post(
        '/panel/api/inbounds/onlines',
        {},
        { headers: this.cookieHeader() },
      );
      return (res.data?.obj ?? []) as string[];
    } catch (err) {
      throw new Error(`getOnlineClients failed: ${(err as Error).message}`);
    }
  }

  getSubLink(subId: string): string {
    const cleanBase = this.baseUrl.replace(/\/+$/, '');
    return `${cleanBase}/sub/${subId}`;
  }
}
