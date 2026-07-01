'use client';

import { useActionState } from 'react';
import type { LoginState } from '@/application/auth/auth.actions';

interface Props {
  action: (prevState: LoginState, formData: FormData) => Promise<LoginState>;
}

export default function LoginForm({ action }: Props) {
  const [state, formAction, pending] = useActionState<LoginState, FormData>(action, undefined);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input
        type="password"
        name="password"
        placeholder="รหัสผ่าน"
        required
        autoFocus
        className="rounded-lg bg-gray-800 px-4 py-2.5 text-white placeholder-gray-500 outline-none ring-1 ring-gray-700 focus:ring-indigo-500"
      />
      {state?.error && (
        <p className="text-sm text-red-400">{state.error}</p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-indigo-600 py-2.5 font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
      >
        {pending ? 'กำลังเข้าสู่ระบบ…' : 'เข้าสู่ระบบ'}
      </button>
    </form>
  );
}
