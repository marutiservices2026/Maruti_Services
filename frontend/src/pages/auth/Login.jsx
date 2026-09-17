// Login.jsx — sign in only. Used to also offer account (Company + admin User) creation
// via a mode toggle — removed 2026-09-17: this app is genuinely single-tenant (one real
// business, one Company), and /auth/register had no invite gate, so leaving it reachable
// from the login screen meant literally anyone who found the URL could create an unrelated
// second Company in this production database. The backend route itself is untouched (still
// reachable directly if ever needed for a legitimate second deploy), only this UI entry
// point is gone — see understand.md for the full reasoning.
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth.js';
import Input from '../../components/common/Input.jsx';
import Button from '../../components/common/Button.jsx';
import { formatApiErrorMessage } from '../../utils/apiError.js';

const loginSchema = z.object({
  email: z.string().email('Enter a valid email'),
  password: z.string().min(1, 'Password is required'),
});

function LoginForm() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [submitError, setSubmitError] = useState('');
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: zodResolver(loginSchema) });

  const onSubmit = async (data) => {
    setSubmitError('');
    try {
      await login(data.email, data.password);
      // replace, not push — otherwise /login stays one "back" step behind Dashboard in
      // history, and DashboardLayout's Backspace shortcut (deliberately mirrors the
      // browser's own back button) would land you right back on the login screen.
      navigate('/', { replace: true });
    } catch (err) {
      setSubmitError(formatApiErrorMessage(err.response?.data, 'Login failed.'));
    }
  };

  return (
    <>
      {submitError && <div className="error-banner">{submitError}</div>}
      <form onSubmit={handleSubmit(onSubmit)}>
        <Input label="Email" type="email" {...register('email')} error={errors.email?.message} />
        <Input
          label="Password"
          type="password"
          {...register('password')}
          error={errors.password?.message}
        />
        <Button type="submit" disabled={isSubmitting} style={{ width: '100%', justifyContent: 'center' }}>
          {isSubmitting ? 'Signing in…' : 'Sign in'}
        </Button>
      </form>
    </>
  );
}

export default function Login() {
  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--color-ink-navy)',
      }}
    >
      <div style={{ background: 'var(--color-paper-white)', padding: 32, borderRadius: 4, width: 380 }}>
        <img src="/logo.png" alt="Maruti Packaging" style={{ height: 44, display: 'block', marginBottom: 12 }} />
        <p className="small muted" style={{ marginBottom: 20 }}>
          Sign in to your account
        </p>

        <LoginForm />
      </div>
    </div>
  );
}
