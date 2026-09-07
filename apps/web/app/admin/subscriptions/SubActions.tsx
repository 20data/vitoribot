'use client';

import { subAction } from '../actions';

export function SubActions({ id }: { id: string }): JSX.Element {
  const btn = 'rounded px-2 py-1 text-xs ';
  return (
    <div className="flex flex-wrap gap-1">
      <button onClick={() => subAction(id, 'suspend')} className={`${btn}bg-yellow-100 text-yellow-800`}>تعلیق</button>
      <button onClick={() => subAction(id, 'restore')} className={`${btn}bg-green-100 text-green-800`}>بازگردانی</button>
      <button onClick={() => subAction(id, 'reset')} className={`${btn}bg-blue-100 text-blue-800`}>ریست ترافیک</button>
      <button onClick={() => confirm('حذف شود؟') && subAction(id, 'delete')} className={`${btn}bg-red-100 text-red-800`}>حذف</button>
    </div>
  );
}
