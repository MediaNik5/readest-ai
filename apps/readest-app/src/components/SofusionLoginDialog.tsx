import clsx from 'clsx';
import { useState, useEffect } from 'react';
import { FiLogIn, FiUserPlus, FiX } from 'react-icons/fi';
import { useTranslation } from '@/hooks/useTranslation';
import { useSofusionAuthStore } from '@/store/sofusionAuthStore';
import ModalPortal from './ModalPortal';

type View = 'login' | 'register';

interface SofusionLoginDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export const setSofusionLoginDialogVisible = (visible: boolean) => {
  const dialog = document.getElementById('sofusion_login_dialog');
  if (dialog) {
    const event = new CustomEvent('setDialogVisibility', {
      detail: { visible },
    });
    dialog.dispatchEvent(event);
  }
};

const SofusionLoginDialog: React.FC<SofusionLoginDialogProps> = ({ isOpen, onClose, onSuccess }) => {
  const _ = useTranslation();
  const { login, register } = useSofusionAuthStore();

  const [view, setView] = useState<View>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [email, setEmail] = useState('');
  const [token, setToken] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) {
      setView('login');
      setUsername('');
      setPassword('');
      setEmail('');
      setToken('');
      setError(null);
    }
  }, [isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      if (view === 'login') {
        await login({ username, password });
      } else {
        await register({ username, email, password, token: token.trim() || undefined });
      }
      onSuccess?.();
      onClose();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Authentication failed';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <ModalPortal>
      <div
        id='sofusion_login_dialog'
        className={clsx(
          'bg-base-200 text-base-content relative w-[90vw] max-w-md rounded-xl p-6 shadow-2xl',
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className='absolute right-4 top-4 text-base-content/50 hover:text-base-content'
          aria-label='Close'
        >
          <FiX size={20} />
        </button>

        <h2 className='mb-1 text-xl font-semibold'>
          {view === 'login' ? _('Login to Sofusion') : _('Create Sofusion Account')}
        </h2>
        <p className='text-base-content/60 mb-4 text-sm'>
          {view === 'login'
            ? _('Sign in to access AI-powered reading features')
            : _('Register to access AI-powered reading features')}
        </p>

        <form onSubmit={handleSubmit} className='flex flex-col gap-2'>
          <div className='form-control'>
            <label className='label py-1'>
              <span className='label-text'>{_('Username')}</span>
            </label>
            <input
              type='text'
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className='input input-bordered input-sm w-full'
              placeholder={_('Enter your username')}
              required
              minLength={3}
              maxLength={50}
              disabled={isLoading}
            />
          </div>

          {view === 'register' && (
            <>
              <div className='form-control'>
                <label className='label py-1'>
                  <span className='label-text'>{_('Email')}</span>
                </label>
                <input
                  type='email'
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className='input input-bordered input-sm w-full'
                  placeholder={_('Enter your email')}
                  required
                  disabled={isLoading}
                />
              </div>

              <div className='form-control'>
                <label className='label py-1'>
                  <span className='label-text'>{_('Registration Token (Optional)')}</span>
                </label>
                <textarea
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  className='textarea textarea-bordered textarea-sm w-full min-h-[60px] resize-y'
                  placeholder={_('Enter your registration token if you have one...')}
                  disabled={isLoading}
                  maxLength={1000}
                />
              </div>
            </>
          )}

          <div className='form-control'>
            <label className='label py-1'>
              <span className='label-text'>{_('Password')}</span>
            </label>
            <input
              type='password'
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className='input input-bordered input-sm w-full'
              placeholder={_('Enter your password')}
              required
              minLength={4}
              disabled={isLoading}
            />
          </div>

          {error && (
            <div className='alert alert-error py-2 text-sm'>
              <span>{error}</span>
            </div>
          )}

          <button
            type='submit'
            className='btn btn-primary btn-sm w-full mt-1'
            disabled={isLoading || !username || (view === 'register' ? !email : false) || !password}
          >
            {isLoading ? (
              <>
                <span className='loading loading-spinner loading-sm'></span>
                <span>{view === 'login' ? _('Logging in...') : _('Creating account...')}</span>
              </>
            ) : (
              <>
                {view === 'login' ? <FiLogIn className='mr-1 h-4 w-4' /> : <FiUserPlus className='mr-1 h-4 w-4' />}
                {view === 'login' ? _('Login') : _('Register')}
              </>
            )}
          </button>
        </form>

        <div className='mt-3 text-center'>
          <button
            type='button'
            onClick={() => {
              setView(view === 'login' ? 'register' : 'login');
              setError(null);
            }}
            className='text-primary btn btn-ghost btn-sm text-xs hover:underline'
            disabled={isLoading}
          >
            {view === 'login'
              ? _("Don't have an account? Register")
              : _('Already have an account? Login')}
          </button>
        </div>
      </div>
    </ModalPortal>
  );
};

export default SofusionLoginDialog;
