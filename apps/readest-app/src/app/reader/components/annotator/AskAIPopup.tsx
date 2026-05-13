import clsx from 'clsx';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { FiLock } from 'react-icons/fi';

import { useBookDataStore } from '@/store/bookDataStore';
import { useSofusionAuthStore } from '@/store/sofusionAuthStore';
import { askQuestion } from '@/services/sofusion/api';
import { useTranslation } from '@/hooks/useTranslation';
import { generateSuggestedQuestions } from '@/utils/askAI';
import { Position, TextSelection } from '@/utils/sel';
import Popup from '@/components/Popup';
import SofusionLoginDialog from '@/components/SofusionLoginDialog';

interface AskAIPopupProps {
  bookKey: string;
  selection?: TextSelection;
  position: Position;
  trianglePosition: Position;
  popupWidth: number;
  popupHeight: number;
  onDismiss: () => void;
}
export const normalizeCfi = (cfi: string): string => {
  if (!cfi) return '';

  // 1. Remove epubcfi() wrapper
  const clean = cfi.replace(/^epubcfi\(|\)$/g, '');

  // 2. Split by commas
  const parts = clean.split(',');

  // If it's not a range (no commas), parts[0] is our only path.
  // If it is a range, parts[0] is the common parent and parts[1] is the start.
  let fullPath = parts.length > 1 ? parts[0]! + parts[1]! : (parts[0] ?? '');

  // 3. Cleanup logic:
  return fullPath
    .replace(/:.*$/, '') // Remove character offset (e.g., :0)
    .replace(/\/\d*[13579]$/, ''); // Remove trailing odd numbers (text node indices)
};

const AskAIPopup: React.FC<AskAIPopupProps> = ({
  bookKey,
  selection,
  position,
  trianglePosition,
  popupWidth,
  popupHeight,
  onDismiss,
}) => {
  const _ = useTranslation();
  const { getConfig } = useBookDataStore();
  const { user, isAuthenticated } = useSofusionAuthStore();

  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandDetails, setExpandDetails] = useState(false);
  const [showLogin, setShowLogin] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const responseRef = useRef<HTMLDivElement>(null);

  const suggestedQuestions = useMemo(
    () => generateSuggestedQuestions(selection?.text || ''),
    [selection?.text],
  );

  const config = getConfig(bookKey);
  const sofusionBookId = config?.sofusionBookId;

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSubmit = async (questionText: string) => {
    if (!questionText.trim() || isLoading) return;

    if (!isAuthenticated || !user) {
      setShowLogin(true);
      return;
    }

    if (!sofusionBookId || sofusionBookId === 'skipped') {
      setError(_('Book not uploaded. Upload it first to use AI Q&A.'));
      return;
    }

    const bookId = Number(sofusionBookId);
    console.log('BookId: ' + bookId);
    if (!Number.isFinite(bookId)) {
      setError(_('Invalid book ID: ' + sofusionBookId));
      return;
    }
    let cfi = selection?.cfi;
    if (cfi == undefined) {
      setError(_('There is no selection'));
      return;
    }
    cfi = normalizeCfi(cfi);

    const userId = user.userId;

    setIsLoading(true);
    setError(null);
    setAnswer('');

    try {
      const response = await askQuestion(bookId, {
        userId,
        question: questionText,
        cfi: cfi,
        selectedText: selection?.text,
        expandDetails,
      });

      if (response.message && response.message.includes('error')) {
        setError(response.message);
      } else {
        setAnswer(response.answer);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to get answer';
      if (message.includes('Session expired')) {
        // Session expired, show login dialog and clear auth state
        const { clearSession } = useSofusionAuthStore.getState();
        clearSession();
        setShowLogin(true);
      } else {
        setError(message);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleLoginSuccess = () => {
    setShowLogin(false);
    if (question.trim()) {
      handleSubmit(question);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && question.trim()) {
      handleSubmit(question);
    }
  };

  const handleSuggestionClick = (suggestion: string) => {
    setQuestion(suggestion);
    handleSubmit(suggestion);
  };

  return (
    <div>
      <Popup
        trianglePosition={trianglePosition}
        width={popupWidth}
        minHeight={popupHeight}
        position={position}
        className='not-eink:text-gray-200 flex flex-col rounded-lg bg-gray-700'
        triangleClassName='text-gray-700'
        onDismiss={onDismiss}
      >
        <div className='flex flex-col gap-3 p-4'>
          {!isAuthenticated && (
            <div className='alert alert-info py-2 text-xs'>
              <FiLock className='h-4 w-4 shrink-0' />
              <span>
                {_('Login required')} - {_('Sign in to use AI Q&A features.')}
              </span>
              <button
                className='btn btn-ghost btn-xs text-primary ml-auto'
                onClick={() => setShowLogin(true)}
              >
                {_('Login')}
              </button>
            </div>
          )}

          {/* Suggested questions */}
          {isAuthenticated && !answer && !isLoading && !error && (
            <div className='flex flex-wrap gap-1.5'>
              {suggestedQuestions.map((suggestion, i) => (
                <button
                  key={i}
                  className='text-primary btn btn-xs border-none bg-transparent p-1 text-xs'
                  onClick={() => handleSuggestionClick(suggestion)}
                >
                  {suggestion}
                </button>
              ))}
            </div>
          )}

          {/* Input */}
          <div className='flex flex-col gap-2'>
            <div className='flex items-center gap-2'>
              <input
                ref={inputRef}
                type='text'
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={isAuthenticated ? _('Ask a question...') : _('Login to ask...')}
                disabled={!isAuthenticated || isLoading}
                className={clsx(
                  'w-full flex-1 rounded-md p-2 text-sm placeholder-gray-400 focus:outline-none focus:ring-0',
                  'not-eink:bg-gray-600 not-eink:text-white eink:border eink:border-base-content',
                  !isAuthenticated && 'opacity-75',
                )}
              />
              <button
                onClick={() => handleSubmit(question)}
                disabled={!isAuthenticated || !question.trim() || isLoading}
                className={clsx(
                  'btn btn-sm btn-ghost btn-primary text-blue-600',
                  'bg-transparent hover:bg-transparent disabled:bg-transparent',
                  'disabled:text-base-content/75 disabled:opacity-75',
                )}
              >
                {isLoading ? <span className='loading loading-spinner loading-xs'></span> : _('Ask')}
              </button>
            </div>
            {/* Expand Details Toggle */}
            {isAuthenticated && (
              <label className='flex items-center gap-2 text-xs text-gray-400'>
                <input
                  type='checkbox'
                  checked={expandDetails}
                  onChange={(e) => setExpandDetails(e.target.checked)}
                  disabled={isLoading}
                  className='checkbox checkbox-xs'
                />
                <span>{_('Expand details (more comprehensive answers)')}</span>
              </label>
            )}
          </div>

          {/* Error */}
          {error && <div className='py-1 text-xs text-red-400'>{error}</div>}

          {/* Answer */}
          {answer && (
            <div
              ref={responseRef}
              className='max-h-60 overflow-y-auto text-sm leading-relaxed text-gray-200 break-words'
              style={{
                scrollbarWidth: 'thin',
                scrollbarColor: '#4b5563 #374151',
              }}
            >
              {answer}
            </div>
          )}
        </div>
      </Popup>

      <SofusionLoginDialog isOpen={showLogin} onClose={() => setShowLogin(false)} onSuccess={handleLoginSuccess} />
    </div>
  );
};

export default AskAIPopup;
