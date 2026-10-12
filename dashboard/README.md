# Traccar GPS Dashboard (VitoriBot Front-end Module)

A modern, responsive, and real-time GPS tracking dashboard designed to connect seamlessly with an existing Traccar server. Built using **React, TypeScript, Vite, Tailwind CSS, and Zustand**.

## Features

- **Live Map:** Real-time device tracking using MapLibre GL JS and WebSockets.
- **Multi-language:** Supports Persian (RTL) and English (LTR).
- **Themeable:** Light/Dark mode with automatic map style switching.
- **REST & WS Connection:** Completely independent of any custom backend; talks directly to Traccar API and WebSocket.

## Prerequisites

- Node.js >= 20.x
- A running instance of [Traccar](https://www.traccar.org/) Server (Optional for Mock Mode).

## Setup & Execution

### 1. Installation

```bash
cd dashboard
npm install
```

### 2. Configuration

Copy the `.env.example` file and create a `.env` file:

```bash
cp .env.example .env
```

Configure the environment variables in `.env`:

```env
# Traccar API URL
VITE_API_URL=http://localhost:8082/api

# Traccar WebSocket URL
VITE_WS_URL=ws://localhost:8082/api/socket

# OpenStreetMap or Custom Tiles
VITE_MAP_TILES=https://tile.openstreetmap.org/{z}/{x}/{y}.png

# Set to true to run without a real Traccar Server
VITE_MOCK_MODE=true
```

### 3. Running the App

To run the app in development mode (with Hot Module Replacement):

```bash
npm run dev
```

### 4. Build for Production

```bash
npm run build
```

This will generate static files in the `dist` folder.

## Nginx Reverse Proxy Configuration (Production)

If you are running the dashboard alongside Traccar behind an Nginx reverse proxy, you must properly configure the `/api` and WebSocket (`/api/socket`) paths to avoid CORS issues and allow real-time updates.

Example Nginx Configuration:

```nginx
server {
    listen 80;
    server_name tracking.yourdomain.com;

    # Serve the React Dashboard
    location / {
        root /path/to/dashboard/dist;
        try_files $uri $uri/ /index.html;
    }

    # Proxy REST API requests to Traccar
    location /api/ {
        proxy_pass http://localhost:8082/api/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Proxy WebSocket requests to Traccar
    location /api/socket {
        proxy_pass http://localhost:8082/api/socket;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 86400; # Prevent connection timeout
    }
}
```

## Mock Mode

If you do not have a Traccar server available for testing, simply set `VITE_MOCK_MODE=true` in your `.env` file. The application will simulate HTTP REST responses and push simulated position updates through the WebSocket service.

## Security Considerations

- **Authentication:** Sessions rely on HTTP cookies provided by the Traccar server. Ensure that Nginx passes cookies correctly.
- **Sensitive Data:** Never hardcode actual Traccar admin credentials into the source code.
- **HTTPS:** Always serve the dashboard and API over HTTPS in production environments.
