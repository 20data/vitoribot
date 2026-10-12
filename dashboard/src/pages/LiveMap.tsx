import { useEffect, useState, useMemo } from 'react';
import Map, { Marker, NavigationControl } from 'react-map-gl/maplibre';
import 'maplibre-gl/dist/maplibre-gl.css';
import { useQuery } from '@tanstack/react-query';
import { client } from '../api/client';
import { socket } from '../api/websocket';
import { useAppStore } from '../store/useAppStore';
import DeviceList from '../features/devices/DeviceList';
import type { Position } from '../api/mock';

export default function LiveMap() {
  const { theme, sidebarOpen } = useAppStore();
  const [positions, setPositions] = useState<Record<number, Position>>({});

  const { data: initialPositions } = useQuery({
    queryKey: ['positions'],
    queryFn: client.getPositions,
  });

  useEffect(() => {
    if (initialPositions) {
      const posMap: Record<number, Position> = {};
      initialPositions.forEach(p => posMap[p.deviceId] = p);
      setPositions(posMap);
    }
  }, [initialPositions]);

  useEffect(() => {
    socket.connect();
    const unsubscribe = socket.subscribe((message) => {
      if (message.positions && message.positions.length > 0) {
        setPositions(prev => {
          const next = { ...prev };
          message.positions!.forEach(p => {
            if (p.deviceId && p.latitude && p.longitude) {
              next[p.deviceId] = { ...next[p.deviceId], ...p };
            }
          });
          return next;
        });
      }
    });

    return () => {
      unsubscribe();
      socket.disconnect();
    };
  }, []);

  const mapStyle = useMemo(() => {
    // Determine MapLibre style based on theme
    const isDark = theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);

    return {
      version: 8 as const,
      sources: {
        'osm': {
          type: 'raster' as const,
          tiles: [import.meta.env.VITE_MAP_TILES || 'https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
          tileSize: 256,
          attribution: '&copy; OpenStreetMap Contributors',
        }
      },
      layers: [
        {
          id: 'osm',
          type: 'raster' as const,
          source: 'osm',
          minzoom: 0,
          maxzoom: 19,
          paint: {
            'raster-opacity': isDark ? 0.7 : 1,
            'raster-hue-rotate': isDark ? 180 : 0,
            'raster-invert-colors': isDark
          }
        }
      ]
    };
  }, [theme]);

  return (
    <div className="flex h-full w-full relative">
      {/* Sidebar for Devices */}
      <div className={`absolute lg:relative z-10 h-full w-80 bg-card border-r transition-transform duration-300 ease-in-out ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>
        <DeviceList />
      </div>

      {/* Map Container */}
      <div className="flex-1 h-full w-full relative">
        <Map
          initialViewState={{
            longitude: 51.3890,
            latitude: 35.6892,
            zoom: 10
          }}
          mapStyle={mapStyle}
          style={{ width: '100%', height: '100%' }}
        >
          <NavigationControl position="bottom-right" />

          {Object.values(positions).map(pos => (
            <Marker
              key={pos.id || `dev-${pos.deviceId}`}
              longitude={pos.longitude}
              latitude={pos.latitude}
              anchor="center"
            >
              <div
                className="w-6 h-6 bg-primary rounded-full border-2 border-white shadow-md flex items-center justify-center transform transition-transform"
                style={{ transform: `rotate(${pos.course || 0}deg)` }}
              >
                <div className="w-1.5 h-1.5 bg-white rounded-full translate-y-[-4px]" />
              </div>
            </Marker>
          ))}
        </Map>
      </div>
    </div>
  );
}
