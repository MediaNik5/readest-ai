'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

import { Book } from '@/types/book';
import { useEnv } from '@/context/EnvContext';
import { useSettingsStore } from '@/store/settingsStore';
import { useBookDataStore } from '@/store/bookDataStore';
import { useReaderStore } from '@/store/readerStore';
import { useSidebarStore } from '@/store/sidebarStore';
import { useGamepad } from '@/hooks/useGamepad';
import { useTranslation } from '@/hooks/useTranslation';
import { SystemSettings } from '@/types/settings';
import { parseOpenWithFiles } from '@/helpers/openWith';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { UnlistenFn } from '@tauri-apps/api/event';
import { tauriHandleClose, tauriHandleOnCloseWindow } from '@/utils/window';
import { isTauriAppPlatform } from '@/services/environment';
import { uniqueId } from '@/utils/misc';
import { throttle } from '@/utils/throttle';
import { eventDispatcher } from '@/utils/event';
import {
  closeReaderWindowOrGoToLibrary,
  ensureMainLibraryWindow,
  navigateToLibrary,
} from '@/utils/nav';
import { clearDiscordPresence } from '@/utils/discord';
import { BOOK_IDS_SEPARATOR } from '@/services/constants';
import { BookDetailModal } from '@/components/metadata';
import { uploadBook } from '@/services/sofusion/api';
import SofusionUploadDialog from '@/components/SofusionUploadDialog';

import useBooksManager from '../hooks/useBooksManager';
import useBookShortcuts from '../hooks/useBookShortcuts';
import Spinner from '@/components/Spinner';
import SideBar from './sidebar/SideBar';
import Notebook from './notebook/Notebook';
import BooksGrid from './BooksGrid';
import SettingsDialog from '@/components/settings/SettingsDialog';

const ReaderContent: React.FC<{ ids?: string; settings: SystemSettings }> = ({ ids, settings }) => {
  const _ = useTranslation();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { envConfig, appService } = useEnv();
  const { bookKeys, dismissBook, getNextBookKey } = useBooksManager();
  const { sideBarBookKey, setSideBarBookKey } = useSidebarStore();
  const { saveSettings } = useSettingsStore();
  const { getConfig, getBookData, setConfig, saveConfig } = useBookDataStore();
  const { getView, setBookKeys, getViewSettings } = useReaderStore();
  const { initViewState, getViewState, clearViewState } = useReaderStore();
  const { isSettingsDialogOpen, settingsDialogBookKey } = useSettingsStore();
  const [showDetailsBook, setShowDetailsBook] = useState<Book | null>(null);
  const [showUploadDialog, setShowUploadDialog] = useState(false);
  const [uploadDialogBookKey, setUploadDialogBookKey] = useState<string | null>(null);
  const [uploadDialogBookTitle, setUploadDialogBookTitle] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const isInitiating = useRef(false);
  const [loading, setLoading] = useState(false);
  const [errorLoading, setErrorLoading] = useState(false);

  useBookShortcuts({ sideBarBookKey, bookKeys });
  useGamepad();

  const checkedBookIds = useRef(new Set<string>());

  // Subscribe to bookDataStore changes to detect when books finish loading
  useEffect(() => {
    const checkBooks = () => {
      const currentBookKeys = useReaderStore.getState().bookKeys;
      console.log('[Sofusion] Store changed. Checking books:', currentBookKeys);

      for (const key of currentBookKeys) {
        const id = key.split('-')[0]!;
        console.log(
          '[Sofusion] Checking book key:',
          key,
          'id:',
          id,
          'alreadyChecked:',
          checkedBookIds.current.has(id),
        );

        if (checkedBookIds.current.has(id)) continue;

        const bookData = useBookDataStore.getState().getBookData(key);
        const config = useBookDataStore.getState().getConfig(key);
        console.log('[Sofusion] bookData for', key, ':', {
          hasBook: !!bookData?.book,
          hasConfig: !!config,
          hasFile: !!bookData?.file,
          format: bookData?.book?.format,
          title: bookData?.book?.title,
          sofusionBookId: config?.sofusionBookId,
        });

        if (!bookData?.book || !config || !bookData.file) {
          console.log(
            '[Sofusion] Skipping',
            key,
            '— data not ready yet (book:',
            !!bookData?.book,
            'config:',
            !!config,
            'file:',
            !!bookData?.file,
            ')',
          );
          continue;
        }

        console.log(
          '[Sofusion] Book fully loaded:',
          bookData.book.title,
          'format:',
          bookData.book.format,
          'sofusionBookId:',
          config.sofusionBookId,
        );

        checkedBookIds.current.add(id);

        if (
          bookData.book.format === 'EPUB' &&
          ((!config.sofusionBookId &&
          config.sofusionBookId !== 'skipped') || config.sofusionBookId === '6')
        ) {
          console.log('[Sofusion] Showing upload dialog for:', bookData.book.title);
          setUploadDialogBookKey(key);
          setUploadDialogBookTitle(bookData.book.title || _('Untitled'));
          setShowUploadDialog(true);
          break;
        } else {
          console.log(
            '[Sofusion] Not showing dialog. format:',
            bookData.book.format,
            'sofusionBookId:',
            config.sofusionBookId,
          );
        }
      }
    };

    // Check immediately
    checkBooks();

    // Subscribe to bookDataStore changes (fires when initViewState populates data)
    const unsub = useBookDataStore.subscribe(checkBooks);
    return unsub;
  }, []);

  useEffect(() => {
    if (isInitiating.current) return;
    isInitiating.current = true;

    const pathname = window.location.pathname;
    const bookIds = ids || searchParams?.get('ids') || pathname.split('/reader/')[1] || '';
    const initialIds = bookIds.split(BOOK_IDS_SEPARATOR).filter(Boolean);
    const initialBookKeys = initialIds.map((id) => `${id}-${uniqueId()}`);
    setBookKeys(initialBookKeys);
    const uniqueIds = new Set<string>();
    console.log('Initialize books', initialBookKeys);
    initialBookKeys.forEach((key, index) => {
      const id = key.split('-')[0]!;
      const isPrimary = !uniqueIds.has(id);
      uniqueIds.add(id);
      if (!getViewState(key)) {
        initViewState(envConfig, id, key, isPrimary).catch((error) => {
          console.log('Error initializing book', key, error);
          setErrorLoading(true);
          eventDispatcher.dispatch('toast', {
            message: _('Unable to open book'),
            callback: async () => {
              const service = await envConfig.getAppService();
              await closeReaderWindowOrGoToLibrary(service, router);
            },
            timeout: 2000,
            type: 'error',
          });
        });
        if (index === 0) setSideBarBookKey(key);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const handleShowBookDetails = (event: CustomEvent) => {
      setShowDetailsBook(event.detail as Book);
      return true;
    };
    eventDispatcher.onSync('show-book-details', handleShowBookDetails);

    return () => {
      eventDispatcher.offSync('show-book-details', handleShowBookDetails);
    };
  }, []);

  useEffect(() => {
    if (bookKeys && bookKeys.length > 0) {
      const settings = useSettingsStore.getState().settings;
      const lastOpenBooks = bookKeys.map((key) => key.split('-')[0]!);
      if (settings.lastOpenBooks?.toString() !== lastOpenBooks.toString()) {
        settings.lastOpenBooks = lastOpenBooks;
        saveSettings(envConfig, settings);
      }
    }

    let unlistenOnCloseWindow: Promise<UnlistenFn>;
    if (isTauriAppPlatform()) {
      unlistenOnCloseWindow = tauriHandleOnCloseWindow(handleCloseBooks);
    }
    window.addEventListener('beforeunload', handleCloseBooks);
    eventDispatcher.on('beforereload', handleCloseBooks);
    eventDispatcher.on('close-reader', handleCloseBooks);
    eventDispatcher.on('quit-app', handleCloseBooks);
    return () => {
      window.removeEventListener('beforeunload', handleCloseBooks);
      eventDispatcher.off('beforereload', handleCloseBooks);
      eventDispatcher.off('close-reader', handleCloseBooks);
      eventDispatcher.off('quit-app', handleCloseBooks);
      unlistenOnCloseWindow?.then((fn) => fn());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookKeys]);

  const saveBookConfig = async (bookKey: string) => {
    const config = getConfig(bookKey);
    const { book } = getBookData(bookKey) || {};
    const { isPrimary } = getViewState(bookKey) || {};
    if (isPrimary && book && config) {
      const settings = useSettingsStore.getState().settings;
      eventDispatcher.dispatch('sync-book-progress', { bookKey });
      eventDispatcher.dispatch('flush-kosync', { bookKey });
      await saveConfig(envConfig, bookKey, config, settings);
    }
  };

  const saveConfigAndCloseBook = async (bookKey: string) => {
    console.log('Closing book', bookKey);

    const viewState = getViewState(bookKey);
    if (viewState?.isPrimary && appService?.isDesktopApp) {
      await clearDiscordPresence(appService);
    }

    try {
      getView(bookKey)?.close();
      getView(bookKey)?.remove();
    } catch {
      console.info('Error closing book', bookKey);
    }
    eventDispatcher.dispatch('tts-stop', { bookKey });
    await saveBookConfig(bookKey);
    clearViewState(bookKey);
  };

  const navigateBackToLibrary = () => {
    navigateToLibrary(router, '', undefined, true);
  };

  const handleUploadBook = async () => {
    console.log('[Sofusion] handleUploadBook called. uploadDialogBookKey:', uploadDialogBookKey);
    if (!uploadDialogBookKey) return;
    const bookData = getBookData(uploadDialogBookKey);
    console.log('[Sofusion] handleUploadBook bookData:', {
      hasFile: !!bookData?.file,
      hasBook: !!bookData?.book,
      fileSize: bookData?.file?.size,
    });
    if (!bookData?.file || !bookData.book) return;

    let rawUserId = localStorage.getItem('sofusionUserId');
    console.log('[Sofusion] sofusionUserId from localStorage:', rawUserId);
    if (!rawUserId) {
      rawUserId = '1';
      console.log('[Sofusion] No userId in localStorage, using default: 1');
    }
    const userId = Number(rawUserId);
    if (!Number.isFinite(userId)) {
      setUploadError('Invalid Sofusion user ID.');
      return;
    }

    setIsUploading(true);
    setUploadError(null);

    try {
      const fileName = `${bookData.book.title || 'book'}.epub`;
      console.log(
        '[Sofusion] Uploading file:',
        fileName,
        'size:',
        bookData.file.size,
        'type:',
        bookData.file.type,
        'userId:',
        userId,
      );
      // NativeFile/RemoteFile extend File but construct with empty blob —
      // must read full content into a real Blob before passing to FormData
      const arrayBuffer = await bookData.file.arrayBuffer();
      const fileBlob = new Blob([arrayBuffer], { type: 'application/epub+zip' });
      console.log('[Sofusion] Read file into blob, size:', fileBlob.size);
      const response = await uploadBook(fileBlob, fileName, userId);
      console.log('[Sofusion] Upload response:', response);

      const config = getConfig(uploadDialogBookKey);
      if (config) {
        const updatedConfig = {
          ...config,
          sofusionBookId: String(response.id),
        };
        console.log('[Sofusion] Saving config with sofusionBookId:', String(response.id));
        setConfig(uploadDialogBookKey, { sofusionBookId: String(response.id) });
        await saveConfig(envConfig, uploadDialogBookKey, updatedConfig, settings);
      }

      setShowUploadDialog(false);
      eventDispatcher.dispatch('toast', {
        type: 'info',
        message: _('Book uploaded for AI Q&A'),
        timeout: 3000,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Upload failed';
      console.error('[Sofusion] Upload error:', message, err);
      setUploadError(message);
    } finally {
      setIsUploading(false);
    }
  };

  const handleSkipUpload = () => {
    console.log('[Sofusion] handleSkipUpload called');
    setShowUploadDialog(false);
  };

  const handleDontAskAgain = () => {
    console.log('[Sofusion] handleDontAskAgain called. uploadDialogBookKey:', uploadDialogBookKey);
    if (!uploadDialogBookKey) return;
    const config = getConfig(uploadDialogBookKey);
    if (config) {
      setConfig(uploadDialogBookKey, { sofusionBookId: 'skipped' });
      saveConfig(
        envConfig,
        uploadDialogBookKey,
        { ...config, sofusionBookId: 'skipped' },
        settings,
      );
      console.log('[Sofusion] Saved sofusionBookId=skipped to config');
    }
    setShowUploadDialog(false);
  };

  const saveSettingsAndGoToLibrary = () => {
    saveSettings(envConfig, settings);
    navigateBackToLibrary();
  };

  const handleCloseBooks = throttle(async () => {
    const settings = useSettingsStore.getState().settings;
    await Promise.all(bookKeys.map(async (key) => await saveConfigAndCloseBook(key)));
    await saveSettings(envConfig, settings);
  }, 200);

  const handleCloseBooksToLibrary = async () => {
    handleCloseBooks();
    if (isTauriAppPlatform()) {
      const currentWindow = getCurrentWindow();
      if (currentWindow.label === 'main') {
        navigateBackToLibrary();
      } else {
        if (appService) {
          await ensureMainLibraryWindow(appService);
        }
        currentWindow.close();
      }
    } else {
      navigateBackToLibrary();
    }
  };

  const handleCloseBook = async (bookKey: string) => {
    saveConfigAndCloseBook(bookKey);
    if (sideBarBookKey === bookKey) {
      setSideBarBookKey(getNextBookKey(sideBarBookKey));
    }
    dismissBook(bookKey);
    if (bookKeys.filter((key) => key !== bookKey).length == 0) {
      const openWithFiles = (await parseOpenWithFiles(appService)) || [];
      if (appService?.hasWindow) {
        if (openWithFiles.length > 0) {
          tauriHandleOnCloseWindow(handleCloseBooks);
          return await tauriHandleClose();
        }
        const currentWindow = getCurrentWindow();
        if (currentWindow.label.startsWith('reader')) {
          return await currentWindow.close();
        }
      }
      saveSettingsAndGoToLibrary();
    }
  };

  if (!bookKeys || bookKeys.length === 0) return null;
  const bookData = getBookData(bookKeys[0]!);
  const viewSettings = getViewSettings(bookKeys[0]!);
  if (!bookData || !bookData.book || !bookData.bookDoc || !viewSettings) {
    setTimeout(() => setLoading(true), 200);
    return (
      loading &&
      !errorLoading && (
        <div className='hero hero-content full-height'>
          <Spinner loading={true} />
        </div>
      )
    );
  }

  return (
    <div className='reader-content full-height flex'>
      <SideBar />
      <BooksGrid
        bookKeys={bookKeys}
        onCloseBook={handleCloseBook}
        onGoToLibrary={handleCloseBooksToLibrary}
      />
      {isSettingsDialogOpen && <SettingsDialog bookKey={settingsDialogBookKey} />}
      <Notebook />
      {showDetailsBook && (
        <BookDetailModal
          isOpen={!!showDetailsBook}
          book={showDetailsBook}
          onClose={() => setShowDetailsBook(null)}
        />
      )}
      {showUploadDialog && (
        <SofusionUploadDialog
          bookTitle={uploadDialogBookTitle}
          isUploading={isUploading}
          error={uploadError}
          onUpload={handleUploadBook}
          onSkip={handleSkipUpload}
          onDontAskAgain={handleDontAskAgain}
        />
      )}
    </div>
  );
};

export default ReaderContent;
