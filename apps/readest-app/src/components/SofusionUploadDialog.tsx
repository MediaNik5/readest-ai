import clsx from 'clsx';
import React from 'react';
import { FiUpload } from 'react-icons/fi';
import { IoSparklesOutline } from 'react-icons/io5';
import { useTranslation } from '@/hooks/useTranslation';
import ModalPortal from './ModalPortal';

interface SofusionUploadDialogProps {
  bookTitle: string;
  isUploading: boolean;
  error: string | null;
  onUpload: () => void;
  onSkip: () => void;
  onDontAskAgain: () => void;
}

const SofusionUploadDialog: React.FC<SofusionUploadDialogProps> = ({
  bookTitle,
  isUploading,
  error,
  onUpload,
  onSkip,
  onDontAskAgain,
}) => {
  const _ = useTranslation();

  return (
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

        <p className='text-base-content/80 mb-6 text-sm leading-relaxed'>
          {_('Upload')}
          <span className='text-base-content mx-1 font-medium'>{'"' + bookTitle + '"'}</span>
          {_('for AI-powered spoiler-free Q&A? You can ask questions about the text as you read.')}
        </p>

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
          <div className='flex flex-col gap-2'>
            <button className='btn btn-primary btn-sm' onClick={onUpload}>
              <FiUpload className='mr-1 h-4 w-4' />
              {_('Upload')}
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
  );
};

export default SofusionUploadDialog;
