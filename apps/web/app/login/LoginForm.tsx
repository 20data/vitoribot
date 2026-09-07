'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { signIn } from 'next-auth/react';
import { requestCodeAction, verifyCodeAction, verifyTotpAction } from './actions';

const idSchema = z.object({ telegramId: z.string().regex(/^\d+$/, 'شناسه معتبر نیست') });
const codeSchema = z.object({ code: z.string().length(6, 'کد ۶ رقمی است') });
const totpSchema = z.object({ totp: z.string().length(6, 'کد ۶ رقمی است') });

type Step = 'id' | 'code' | 'totp';

export function LoginForm(): JSX.Element {
  const [step, setStep] = useState<Step>('id');
  const [telegramId, setTelegramId] = useState('');
  const [tempToken, setTempToken] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const idForm = useForm<z.infer<typeof idSchema>>({ resolver: zodResolver(idSchema) });
  const codeForm = useForm<z.infer<typeof codeSchema>>({ resolver: zodResolver(codeSchema) });
  const totpForm = useForm<z.infer<typeof totpSchema>>({ resolver: zodResolver(totpSchema) });

  async function finishLogin(accessToken: string, refreshToken: string, userId: string, role: string): Promise<void> {
    const res = await signIn('credentials', {
      accessToken,
      refreshToken,
      userId,
      role,
      redirect: false,
    });
    if (res?.error) {
      setError('ورود ناموفق بود.');
      return;
    }
    window.location.href = '/admin/dashboard';
  }

  return (
    <div className="mx-auto w-full max-w-sm rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
      <h1 className="mb-1 text-xl font-bold">ورود به پنل مدیریت</h1>
      <p className="mb-4 text-sm text-zinc-500">کد ورود از طریق ربات تلگرام ارسال می‌شود.</p>
      {error && <p className="mb-3 rounded bg-red-100 p-2 text-sm text-red-700">{error}</p>}

      {step === 'id' && (
        <form
          onSubmit={idForm.handleSubmit(async (v) => {
            setBusy(true);
            setError('');
            await requestCodeAction(v.telegramId);
            setTelegramId(v.telegramId);
            setStep('code');
            setBusy(false);
          })}
          className="space-y-3"
        >
          <input
            {...idForm.register('telegramId')}
            placeholder="شناسه تلگرام"
            inputMode="numeric"
            className="w-full rounded border border-zinc-300 p-2 dark:border-zinc-700 dark:bg-zinc-800"
          />
          {idForm.formState.errors.telegramId && (
            <p className="text-sm text-red-500">{idForm.formState.errors.telegramId.message}</p>
          )}
          <button disabled={busy} className="w-full rounded bg-zinc-900 p-2 text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900">
            {busy ? '...' : 'ارسال کد ورود'}
          </button>
        </form>
      )}

      {step === 'code' && (
        <form
          onSubmit={codeForm.handleSubmit(async (v) => {
            setBusy(true);
            setError('');
            const res = await verifyCodeAction(telegramId, v.code);
            if ('error' in res) {
              setError(res.error);
              setBusy(false);
              return;
            }
            if (res.need2fa) {
              setTempToken(res.tempToken);
              setStep('totp');
              setBusy(false);
              return;
            }
            await finishLogin(res.accessToken, res.refreshToken, res.userId, res.role);
            setBusy(false);
          })}
          className="space-y-3"
        >
          <input
            {...codeForm.register('code')}
            placeholder="کد ۶ رقمی"
            inputMode="numeric"
            className="w-full rounded border border-zinc-300 p-2 text-center tracking-widest dark:border-zinc-700 dark:bg-zinc-800"
          />
          <button disabled={busy} className="w-full rounded bg-zinc-900 p-2 text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900">
            {busy ? '...' : 'تایید کد'}
          </button>
        </form>
      )}

      {step === 'totp' && (
        <form
          onSubmit={totpForm.handleSubmit(async (v) => {
            setBusy(true);
            setError('');
            const res = await verifyTotpAction(tempToken, v.totp);
            if ('error' in res) {
              setError(res.error);
              setBusy(false);
              return;
            }
            if (res.need2fa) {
              setError('خطای سرور');
              setBusy(false);
              return;
            }
            await finishLogin(res.accessToken, res.refreshToken, res.userId, res.role);
            setBusy(false);
          })}
          className="space-y-3"
        >
          <input
            {...totpForm.register('totp')}
            placeholder="کد احراز هویت دو مرحله‌ای"
            inputMode="numeric"
            className="w-full rounded border border-zinc-300 p-2 text-center tracking-widest dark:border-zinc-700 dark:bg-zinc-800"
          />
          <button disabled={busy} className="w-full rounded bg-zinc-900 p-2 text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900">
            {busy ? '...' : 'تایید نهایی'}
          </button>
        </form>
      )}
    </div>
  );
}
