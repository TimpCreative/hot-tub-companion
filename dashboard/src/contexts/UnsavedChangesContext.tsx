'use client';

import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';

interface UnsavedChangesContextType {
  hasUnsavedChanges: boolean;
  setUnsavedChanges: (value: boolean) => void;
  /** Call before navigating. If unsaved changes exist, shows confirm; on confirm calls onProceed. */
  confirmNavigate: (href: string, onProceed: () => void) => void;
}

const UnsavedChangesContext = createContext<UnsavedChangesContextType | null>(null);

export function UnsavedChangesProvider({ children }: { children: React.ReactNode }) {
  const [hasUnsavedChanges, setUnsavedChanges] = useState(false);
  const [pendingNav, setPendingNav] = useState<{ href: string; onProceed: () => void } | null>(null);

  const confirmNavigate = useCallback((href: string, onProceed: () => void) => {
    if (hasUnsavedChanges) {
      setPendingNav({ href, onProceed });
    } else {
      onProceed();
    }
  }, [hasUnsavedChanges]);

  const handleConfirmLeave = useCallback(() => {
    if (pendingNav) {
      setUnsavedChanges(false);
      pendingNav.onProceed();
      setPendingNav(null);
    }
  }, [pendingNav]);

  const handleCancel = useCallback(() => {
    setPendingNav(null);
  }, []);

  useEffect(() => {
    if (!hasUnsavedChanges) return;
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasUnsavedChanges]);

  const value: UnsavedChangesContextType = {
    hasUnsavedChanges,
    setUnsavedChanges,
    confirmNavigate,
  };

  return (
    <UnsavedChangesContext.Provider value={value}>
      {children}
      {pendingNav ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="mx-4 max-w-md rounded-lg bg-white p-6 shadow-xl">
            <h3 className="text-lg font-semibold text-gray-900">Unsaved changes</h3>
            <p className="mt-2 text-sm text-gray-600">
              You have unsaved changes. Are you sure you want to leave? Your changes will be lost.
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={handleCancel}
                className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Stay
              </button>
              <button
                type="button"
                onClick={handleConfirmLeave}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
              >
                Leave anyway
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </UnsavedChangesContext.Provider>
  );
}

export function useUnsavedChanges() {
  const ctx = useContext(UnsavedChangesContext);
  if (!ctx) {
    return {
      hasUnsavedChanges: false,
      setUnsavedChanges: () => {},
      confirmNavigate: (_href: string, onProceed: () => void) => onProceed(),
    };
  }
  return ctx;
}
