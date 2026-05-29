"use client";

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { api } from '@/lib/axios';
import Link from 'next/link';
import { CheckCircle, XCircle, Loader2, KeyRound } from 'lucide-react';
import { useAuthStore } from '@/store/useAuthStore';

function VerifyEmailContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const urlToken = searchParams.get('token');
  const login = useAuthStore(state => state.login);
  
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>(urlToken ? 'loading' : 'idle');
  const [message, setMessage] = useState(urlToken ? 'Verifying your email...' : '');
  const [otp, setOtp] = useState('');

  useEffect(() => {
    if (urlToken) {
      verify(urlToken);
    }
  }, [urlToken]);

  const verify = async (tokenToVerify: string) => {
    setStatus('loading');
    setMessage('Verifying your email...');
    try {
      const res = await api.post('/auth/verify-email', { token: tokenToVerify });
      if (res.data.success) {
        setStatus('success');
        setMessage(res.data.message);
        // Auto-login
        if (res.data.user && res.data.accessToken) {
          login(res.data.user, res.data.accessToken);
          setTimeout(() => {
            router.push('/');
          }, 1500);
        }
      } else {
        setStatus('error');
        setMessage(res.data.message || 'Verification failed.');
      }
    } catch (err: unknown) {
      const error = err as { response?: { data?: { message?: string } } };
      setStatus('error');
      setMessage(error.response?.data?.message || 'An error occurred during verification.');
    }
  };

  const handleOtpSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (otp.trim().length > 0) {
      verify(otp.trim());
    }
  };

  return (
    <div className="max-w-md w-full bg-gray-800 rounded-2xl shadow-xl overflow-hidden p-8 border border-gray-700 text-center">
      {status === 'idle' && (
        <form onSubmit={handleOtpSubmit} className="flex flex-col items-center justify-center">
          <KeyRound className="h-12 w-12 text-blue-500 mb-4" />
          <h2 className="text-2xl font-bold text-white mb-2">Check Your Email</h2>
          <p className="text-gray-400 mb-6">Enter the 6-digit code we sent to your email address.</p>
          
          <input
            type="text"
            value={otp}
            onChange={(e) => setOtp(e.target.value)}
            placeholder="000000"
            className="w-full text-center tracking-widest text-2xl px-4 py-3 bg-gray-700/50 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent mb-4"
            maxLength={6}
            required
          />
          
          <button 
            type="submit"
            className="w-full flex items-center justify-center py-3 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 transition-all"
          >
            Verify Email
          </button>
        </form>
      )}

      {status === 'loading' && (
        <div className="flex flex-col items-center justify-center">
          <Loader2 className="h-12 w-12 text-blue-500 animate-spin mb-4" />
          <h2 className="text-2xl font-bold text-white mb-2">Verifying...</h2>
          <p className="text-gray-400">{message}</p>
        </div>
      )}

      {status === 'success' && (
        <div className="flex flex-col items-center justify-center">
          <CheckCircle className="h-16 w-16 text-green-500 mb-4" />
          <h2 className="text-2xl font-bold text-white mb-2">Verified!</h2>
          <p className="text-gray-300 mb-6">{message}</p>
          <p className="text-sm text-gray-400 animate-pulse">Redirecting you to dashboard...</p>
        </div>
      )}

      {status === 'error' && (
        <div className="flex flex-col items-center justify-center">
          <XCircle className="h-16 w-16 text-red-500 mb-4" />
          <h2 className="text-2xl font-bold text-white mb-2">Verification Failed</h2>
          <p className="text-gray-300 mb-6">{message}</p>
          <button 
            onClick={() => setStatus('idle')}
            className="w-full mb-3 flex items-center justify-center py-3 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 transition-all"
          >
            Try Again
          </button>
          <Link 
            href="/register" 
            className="w-full flex items-center justify-center py-3 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-gray-600 hover:bg-gray-700 transition-all"
          >
            Back to Register
          </Link>
        </div>
      )}
    </div>
  );
}

export default function VerifyEmail() {
  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
      <Suspense fallback={
        <div className="max-w-md w-full bg-gray-800 rounded-2xl shadow-xl overflow-hidden p-8 border border-gray-700 text-center flex flex-col items-center justify-center">
          <Loader2 className="h-12 w-12 text-blue-500 animate-spin mb-4" />
          <h2 className="text-2xl font-bold text-white mb-2">Loading...</h2>
        </div>
      }>
        <VerifyEmailContent />
      </Suspense>
    </div>
  );
}
