import clsx from 'clsx';
import { useState, useEffect } from 'react';
import { FiUpload, FiLock } from 'react-icons/fi';
import { IoSparklesOutline } from 'react-icons/io5';
import { useTranslation } from '@/hooks/useTranslation';
import { useSofusionAuthStore } from '@/store/sofusionAuthStore';
import ModalPortal from './ModalPortal';
import SofusionSeriesSelector, { type SeriesSelection } from './SofusionSeriesSelector';
import SofusionLoginDialog from './SofusionLoginDialog';

interface SofusionUploadDialogProps {
  bookTitle: string;
  isUploading: boolean;
  error: string | null;
  onUpload: (seriesSelection?: SeriesSelection) => void;
  onSkip: () => void;
  onDontAskAgain: () => void;
  onClearError?: () => void;
  suggestedSeriesOrder?: number;
}

const SofusionUploadDialog: React.FC<SofusionUploadDialogProps> = ({
  bookTitle,
  isUploading,
  error,
  onUpload,
  onSkip,
  onDontAskAgain,
  onClearError,
  suggestedSeriesOrder,
}) => {
  const _ = useTranslation();
  const { isAuthenticated, clearSession } = useSofusionAuthStore();
  const [showLogin, setShowLogin] = useState(false);
  const [seriesSelection, setSeriesSelection] = useState<SeriesSelection>({
    seriesId: null,
    seriesOrder: suggestedSeriesOrder || null,
  });

  // Handle session expiration errors
  useEffect(() => {
    if (error && error.includes('Session expired')) {
      clearSession();
      setShowLogin(true);
      onClearError?.();
    }
  }, [error, clearSession, onClearError]);

  useEffect(() => {
    if (isAuthenticated && showLogin) {
      setShowLogin(false);
    }
  }, [isAuthenticated, showLogin]);

  const handleUploadClick = () => {
    if (!isAuthenticated) {
      setShowLogin(true);
    } else {
      onUpload(seriesSelection);
    }
  };

  const handleLoginSuccess = () => {
    setShowLogin(false);
    onUpload(seriesSelection);
  };

  return (
    <>
      <ModalPortal>
        <div
          className={clsx(
            'bg-base-200 text-base-content relative w-[90vw] max-w-md rounded-xl p-6 shadow-2xl',
          )}
          onClick={(e) => e.stopPropagation()}
        >
          <div className='mb-4 flex items-center gap-3'>
            <IoSparklesOutline className='text-primary h-6 w-6 shrink-0' />
            <h2 className='text-lg font-semibold'>{_('AI Reading Assistant')}</h2>
          </div>

          <p className='text-base-content/80 mb-4 text-sm leading-relaxed'>
            {_('Upload')}
            <span className='text-base-content mx-1 font-medium'>{'"' + bookTitle + '"'}</span>
            {_('for AI-powered spoiler-free Q&A? You can ask questions about the text as you read.')}
          </p>

          {!isAuthenticated && (
            <div className='alert alert-info mb-4 py-2 text-sm'>
              <FiLock className='h-4 w-4 shrink-0' />
              <span>
                {_('Login required')} - {_('You need to be logged in to use AI features.')}
              </span>
            </div>
          )}

          {isAuthenticated && !isUploading && (
            <SofusionSeriesSelector
              value={seriesSelection}
              onChange={setSeriesSelection}
              disabled={isUploading}
              suggestedOrder={suggestedSeriesOrder}
            />
          )}

          {error && (
            <div className='alert alert-error mb-4 py-2 text-sm'>
              <span>{error}</span>
            </div>
          )}

          {isUploading && (
            <div className='mb-4 flex items-center justify-center gap-2 py-4'>
              <span className='loading loading-spinner loading-sm'></span>
              <span className='text-base-content/70 text-sm'>{_('Uploading book...')}</span>
            </div>
          )}

          {!isUploading && (
            <div className='mt-4 flex flex-col gap-2'>
              <button
                className={clsx('btn btn-sm', isAuthenticated ? 'btn-primary' : 'btn-secondary')}
                onClick={handleUploadClick}
              >
                {isAuthenticated ? <FiUpload className='mr-1 h-4 w-4' /> : <FiLock className='mr-1 h-4 w-4' />}
                {isAuthenticated ? _('Upload') : _('Login to Upload')}
              </button>
              <button className='btn btn-ghost btn-sm' onClick={onSkip}>
                {_('Skip for now')}
              </button>
              <button
                className='text-base-content/50 btn btn-ghost btn-sm text-xs'
                onClick={onDontAskAgain}
              >
                {_("Don't ask again for this book")}
              </button>
            </div>
          )}
        </div>
      </ModalPortal>

      <SofusionLoginDialog isOpen={showLogin} onClose={() => setShowLogin(false)} onSuccess={handleLoginSuccess} />
    </>
  );
};

export default SofusionUploadDialog;
