import { loginAction } from '@/application/auth/auth.actions';
import LoginForm from '@/components/LoginForm';

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-950">
      <div className="w-full max-w-sm rounded-xl bg-gray-900 p-8 shadow-xl">
        <h1 className="mb-6 text-center text-xl font-semibold text-white">Guitar Practice</h1>
        <LoginForm action={loginAction} />
      </div>
    </main>
  );
}
