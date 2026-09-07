import { apiJson } from '@/lib/api';
import { Card, PageTitle } from '@/components/ui';
import { PanelsManager } from './PanelsManager';

export const dynamic = 'force-dynamic';

export default async function PanelsPage(): Promise<JSX.Element> {
  const panels = await apiJson<Array<{ id: string; name: string; url: string; isOnline: boolean; isActive: boolean }>>(
    '/api/admin/panels',
  );
  return (
    <div>
      <PageTitle>پنل‌ها</PageTitle>
      <Card>
        <PanelsManager panels={panels} />
      </Card>
    </div>
  );
}
