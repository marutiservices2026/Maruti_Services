// Login.jsx — sign in, and (since Section 5's tree lists no separate Register.jsx)
// account creation via a mode toggle on the same page. A brand-new client needs some
// way to create their first Company + admin User, and the backend's /auth/register
// already covers exactly that.
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

const registerSchema = z.object({
  name: z.string().min(1, 'Your name is required'),
  email: z.string().email('Enter a valid email'),
  password: z.string().min(8, 'At least 8 characters'),
  companyName: z.string().min(1, 'Company name is required'),
  address: z.string().min(1, 'Address is required'),
  gstin: z.string().length(15, 'GSTIN must be 15 characters'),
  stateName: z.string().min(1, 'State name is required'),
  stateCode: z.string().min(1, 'State code is required'),
});

function LoginForm({ onSwitch }) {
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
      navigate('/');
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
      <p className="small muted" style={{ marginTop: 16 }}>
        New here?{' '}
        <button type="button" className="btn-text" style={{ padding: 0 }} onClick={onSwitch}>
          Create your business account
        </button>
      </p>
    </>
  );
}

function RegisterForm({ onSwitch }) {
  const { register: registerAccount } = useAuth();
  const navigate = useNavigate();
  const [submitError, setSubmitError] = useState('');
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: zodResolver(registerSchema) });

  const onSubmit = async (data) => {
    setSubmitError('');
    try {
      await registerAccount({
        name: data.name,
        email: data.email,
        password: data.password,
        company: {
          name: data.companyName,
          address: data.address,
          gstin: data.gstin,
          stateName: data.stateName,
          stateCode: data.stateCode,
        },
      });
      navigate('/');
    } catch (err) {
      setSubmitError(formatApiErrorMessage(err.response?.data, 'Could not create account.'));
    }
  };

  return (
    <>
      {submitError && <div className="error-banner">{submitError}</div>}
      <form onSubmit={handleSubmit(onSubmit)}>
        <Input label="Your name" {...register('name')} error={errors.name?.message} />
        <Input label="Email" type="email" {...register('email')} error={errors.email?.message} />
        <Input
          label="Password"
          type="password"
          {...register('password')}
          error={errors.password?.message}
        />
        <Input label="Company name" {...register('companyName')} error={errors.companyName?.message} />
        <Input label="Address" {...register('address')} error={errors.address?.message} />
        <div className="form-grid">
          <Input label="GSTIN" {...register('gstin')} error={errors.gstin?.message} />
          <Input label="State code" {...register('stateCode')} error={errors.stateCode?.message} />
        </div>
        <Input label="State name" {...register('stateName')} error={errors.stateName?.message} />
        <Button type="submit" disabled={isSubmitting} style={{ width: '100%', justifyContent: 'center' }}>
          {isSubmitting ? 'Creating account…' : 'Create account'}
        </Button>
      </form>
      <p className="small muted" style={{ marginTop: 16 }}>
        Already have an account?{' '}
        <button type="button" className="btn-text" style={{ padding: 0 }} onClick={onSwitch}>
          Sign in
        </button>
      </p>
    </>
  );
}

export default function Login() {
  const [mode, setMode] = useState('login');

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
          {mode === 'login' ? 'Sign in to your account' : 'Set up your business'}
        </p>

        {mode === 'login' ? (
          <LoginForm onSwitch={() => setMode('register')} />
        ) : (
          <RegisterForm onSwitch={() => setMode('login')} />
        )}
      </div>
    </div>
  );
}
