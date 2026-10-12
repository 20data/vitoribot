import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { client } from '../../api/client';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { Search } from 'lucide-react';
import { useState } from 'react';
import type { Device } from '../../api/mock';

export default function DeviceList() {
  const { t } = useTranslation();
  const [search, setSearch] = useState('');

  const { data: devices, isLoading } = useQuery({
    queryKey: ['devices'],
    queryFn: client.getDevices,
  });

  const filteredDevices = devices?.filter(device =>
    device.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <Card className="h-full border-0 rounded-none shadow-none flex flex-col">
      <CardHeader className="px-4 py-3 border-b">
        <CardTitle className="text-lg font-medium">{t('map.devices')}</CardTitle>
        <div className="relative mt-2">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            type="search"
            placeholder={t('map.search')}
            className="pl-8"
            value={search}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearch(e.target.value)}
          />
        </div>
      </CardHeader>
      <CardContent className="flex-1 overflow-y-auto p-0">
        {isLoading ? (
          <div className="p-4 text-center text-sm text-muted-foreground">Loading...</div>
        ) : (
          <ul className="divide-y">
            {filteredDevices?.map((device: Device) => (
              <li key={device.id} className="p-4 hover:bg-muted/50 cursor-pointer transition-colors">
                <div className="flex justify-between items-start">
                  <div>
                    <div className="font-medium">{device.name}</div>
                    <div className="text-xs text-muted-foreground mt-1">{t(`map.status.${device.status}`)}</div>
                  </div>
                  <div className={`w-2 h-2 rounded-full mt-1.5 ${
                    device.status === 'online' ? 'bg-green-500' :
                    device.status === 'offline' ? 'bg-gray-400' : 'bg-yellow-500'
                  }`} />
                </div>
              </li>
            ))}
            {filteredDevices?.length === 0 && (
              <li className="p-4 text-center text-sm text-muted-foreground">No devices found.</li>
            )}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
