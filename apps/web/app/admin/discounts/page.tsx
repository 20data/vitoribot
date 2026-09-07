import { apiJson } from '@/lib/api';
import { Card, PageTitle } from '@/components/ui';
import { DiscountsManager } from './DiscountsManager';

export const dynamic = 'force-dynamic';

export default async function DiscountsPage(): Promise<JSX.Element> {
  const [discounts, gifts] = await Promise.all([
    apiJson<Array<{ id: string; code: string; type: string; value: string; usedCount: number; maxUses: number | null }>>(
      '/api/admin/discounts',
    ),
    apiJson<Array<{ id: string; code: string; amount: string; usedCount: number; maxUses: number | null }>>(
      '/api/admin/gifts',
    ),
  ]);
  return (
    <div>
      <PageTitle>تخفیف‌ها و هدیه‌ها</PageTitle>
      <Card>
        <DiscountsManager discounts={discounts} gifts={gifts} />
      </Card>
    </div>
  );
}
