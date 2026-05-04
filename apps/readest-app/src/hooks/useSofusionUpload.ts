import { useState, useCallback, useEffect, useRef } from 'react';

import { useEnv } from '@/context/EnvContext';
import { useBookDataStore } from '@/store/bookDataStore';
import { useSettingsStore } from '@/store/settingsStore';
import { uploadBook } from '@/services/sofusion/api';

const SOFUSION_USER_ID_KEY = 'sofusionUserId';

function getStoredUserId(): number | null {
  const raw = localStorage.getItem(SOFUSION_USER_ID_KEY);
  if (!raw) return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

function _storeUserId(id: number): void {
  localStorage.setItem(SOFUSION_USER_ID_KEY, String(id));
}

export type UploadStatus = 'idle' | 'uploading' | 'uploaded' | 'error' | 'skipped';

interface SofusionUploadState {
  status: UploadStatus;
  sofusionBookId: number | null;
  error: string | null;
  upload: () => Promise<void>;
  skip: (permanent: boolean) => void;
}

export function useSofusionUpload(bookKey: string): SofusionUploadState {
  const { envConfig } = useEnv();
  const { getConfig, getBookData, setConfig, saveConfig } = useBookDataStore();
  const { settings } = useSettingsStore();

  const [status, setStatus] = useState<UploadStatus>('idle');
  const [sofusionBookId, setSofusionBookId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const mounted = useRef(true);

  useEffect(() => {
    const config = getConfig(bookKey);
    if (!config) return;

    const id = config.sofusionBookId;
    if (id && id !== 'skipped') {
      const numId = Number(id);
      if (Number.isFinite(numId)) {
        setSofusionBookId(numId);
        setStatus('uploaded');
        return;
      }
    }
    if (id === 'skipped') {
      setStatus('skipped');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookKey]);

  useEffect(() => {
    return () => {
      mounted.current = false;
    };
  }, []);

  const upload = useCallback(async () => {
    const bookData = getBookData(bookKey);
    if (!bookData?.file || !bookData.book) {
      setError('Book file not available');
      setStatus('error');
      return;
    }

    const book = bookData.book;
    if (book.format !== 'EPUB') {
      setError('Only EPUB books are supported');
      setStatus('error');
      return;
    }

    const userId = getStoredUserId();
    if (!userId) {
      setError('Sofusion user ID not configured. Set it in settings.');
      setStatus('error');
      return;
    }

    setStatus('uploading');
    setError(null);

    try {
      const fileName = `${book.title || 'book'}.epub`;
      const response = await uploadBook(bookData.file, fileName, userId);

      if (!mounted.current) return;

      const newId = String(response.id);
      setSofusionBookId(response.id);
      setStatus('uploaded');

      const config = getConfig(bookKey);
      if (config) {
        setConfig(bookKey, { sofusionBookId: newId });
        await saveConfig(envConfig, bookKey, { ...config, sofusionBookId: newId }, settings);
      }
    } catch (err) {
      if (!mounted.current) return;
      const message = err instanceof Error ? err.message : 'Upload failed';
      setError(message);
      setStatus('error');
    }
  }, [bookKey, envConfig, getConfig, getBookData, setConfig, saveConfig, settings]);

  const skip = useCallback(
    (permanent: boolean) => {
      if (permanent) {
        const config = getConfig(bookKey);
        if (config) {
          setConfig(bookKey, { sofusionBookId: 'skipped' });
          saveConfig(envConfig, bookKey, { ...config, sofusionBookId: 'skipped' }, settings);
        }
      }
      setStatus('skipped');
    },
    [bookKey, envConfig, getConfig, setConfig, saveConfig, settings],
  );

  return { status, sofusionBookId, error, upload, skip };
}
