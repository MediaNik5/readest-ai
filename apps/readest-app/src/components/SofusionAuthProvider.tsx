'use client';

import { useEffect } from 'react';
import { useSofusionAuthStore } from '@/store/sofusionAuthStore';

const SofusionAuthProvider = ({ children }: { children: React.ReactNode }) => {
  const initAuth = useSofusionAuthStore((state) => state.initAuth);

  useEffect(() => {
    initAuth();
  }, [initAuth]);

  return <>{children}</>;
};

export default SofusionAuthProvider;
