import { apiJson } from '@/lib/api';
import { Card, PageTitle } from '@/components/ui';
import { ProductsManager } from './ProductsManager';

export const dynamic = 'force-dynamic';

export default async function ProductsPage(): Promise<JSX.Element> {
  const [products, panels] = await Promise.all([
    apiJson<Array<{ id: string; panelId: string; groupName: string; name: string; inboundId: number; trafficGB: number; durationDays: number; price: string; isActive: boolean }>>(
      '/api/admin/products',
    ),
    apiJson<Array<{ id: string; name: string }>>('/api/admin/panels'),
  ]);
  return (
    <div>
      <PageTitle>محصولات</PageTitle>
      <Card>
        <ProductsManager products={products} panels={panels} />
      </Card>
    </div>
  );
}
