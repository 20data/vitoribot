import { redirect } from 'next/navigation';

export default function AdminIndex(): JSX.Element {
  redirect('/admin/dashboard');
}
