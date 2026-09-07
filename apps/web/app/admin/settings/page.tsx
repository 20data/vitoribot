import { apiJson } from '@/lib/api';
import { jalaliTime } from '@/lib/format';
import { Card, PageTitle } from '@/components/ui';
import { AdminManager, ChannelManager, MessageEditor, PaymentSettings } from './SettingsForms';

export const dynamic = 'force-dynamic';

export default async function SettingsPage(): Promise<JSX.Element> {
  const [settings, messages, channels, admins, audit] = await Promise.all([
    apiJson<Record<string, string>>('/api/admin/settings'),
    apiJson<Array<{ key: string; content: string }>>('/api/admin/messages'),
    apiJson<Array<{ id: string; channelId: string; channelUsername: string; channelTitle: string }>>('/api/admin/channels'),
    apiJson<Array<{ id: string; telegramId: string; username: string | null; firstName: string; role: string }>>(
      '/api/admin/admins',
    ).catch(() => [] as Array<{ id: string; telegramId: string; username: string | null; firstName: string; role: string }>),
    apiJson<{ items: Array<{ id: string; adminId: string; action: string; createdAt: string }> }>(
      '/api/admin/audit?page=1&pageSize=20',
    ).catch(() => ({ items: [] as Array<{ id: string; adminId: string; action: string; createdAt: string }> })),
  ]);

  return (
    <div className="space-y-4">
      <PageTitle>تنظیمات</PageTitle>
      <Card><PaymentSettings initial={settings} /></Card>
      <Card><MessageEditor messages={messages} /></Card>
      <Card><ChannelManager channels={channels} /></Card>
      <Card><AdminManager admins={admins} /></Card>
      <Card>
        <p className="mb-2 font-bold">📜 لاگ ادمین‌ها</p>
        <table className="w-full text-sm">
          <tbody>
            {audit.items.map((l) => (
              <tr key={l.id} className="border-t border-zinc-100 dark:border-zinc-800">
                <td className="p-2" dir="ltr">{l.action}</td>
                <td className="p-2">{jalaliTime(l.createdAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
