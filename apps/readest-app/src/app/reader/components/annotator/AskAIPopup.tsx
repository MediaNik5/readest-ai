import clsx from 'clsx';
import React, { useEffect, useMemo, useRef, useState } from 'react';

import { useBookDataStore } from '@/store/bookDataStore';
import { askQuestion } from '@/services/sofusion/api';
import { useTranslation } from '@/hooks/useTranslation';
import { generateSuggestedQuestions } from '@/utils/askAI';
import { Position, TextSelection } from '@/utils/sel';
import Popup from '@/components/Popup';

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

  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  useEffect(() => {
    if (responseRef.current) {
      responseRef.current.scrollTop = responseRef.current.scrollHeight;
    }
  }, [answer]);

  const handleSubmit = async (questionText: string) => {
    if (!questionText.trim() || isLoading) return;

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

    const rawUserId = localStorage.getItem('sofusionUserId');
    const userId = rawUserId ? Number(rawUserId) : 1;

    setIsLoading(true);
    setError(null);
    setAnswer('');

    try {
      const response = await askQuestion(bookId, {
        userId,
        question: questionText,
        cfi: cfi,
        selectedText: selection?.text,
        expandDetails: false,
      });

      if (response.message && response.message.includes('error')) {
        setError(response.message);
      } else {
        setAnswer(response.answer);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to get answer';
      setError(message);
    } finally {
      setIsLoading(false);
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
          {/* Suggested questions */}
          {!answer && !isLoading && !error && (
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
          <div className='flex items-center gap-2'>
            <input
              ref={inputRef}
              type='text'
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={_('Ask a question...')}
              disabled={isLoading}
              className={clsx(
                'w-full flex-1 rounded-md p-2 text-sm placeholder-gray-400 focus:outline-none focus:ring-0',
                'not-eink:bg-gray-600 not-eink:text-white eink:border eink:border-base-content',
              )}
            />
            <button
              onClick={() => handleSubmit(question)}
              disabled={!question.trim() || isLoading}
              className={clsx(
                'btn btn-sm btn-ghost btn-primary text-blue-600',
                'bg-transparent hover:bg-transparent disabled:bg-transparent',
                'disabled:text-base-content/75 disabled:opacity-75',
              )}
            >
              {isLoading ? <span className='loading loading-spinner loading-xs'></span> : _('Ask')}
            </button>
          </div>

          {/* Error */}
          {error && <div className='py-1 text-xs text-red-400'>{error}</div>}

          {/* Answer */}
          {answer && (
            <div
              ref={responseRef}
              className='max-h-60 overflow-y-auto whitespace-pre-wrap text-sm leading-relaxed text-gray-200'
            >
              {answer}
            </div>
          )}
        </div>
      </Popup>
    </div>
  );
};

export default AskAIPopup;
