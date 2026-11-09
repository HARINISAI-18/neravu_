import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { LanguageContext } from './i18n';
import { authService, isSupabaseConfigured } from './services';
import { PROGRESS_CONSENT_VERSION } from './supabase';
import { languageOptions, normalizeAssessmentAnswers } from './data';

const STORAGE_KEY = 'neravu.platform.v1';
const supportedLanguageCodes = new Set(languageOptions.map(({ code }) => code));
const defaults = {
  language: 'en',
  patientRole: '',
  assessmentAccessGranted: false,
  followUpStep: 0,
  assistanceTypes: [],
  answers: {},
  checkedDocuments: [],
  chatHistory: [],
  completedStages: [],
  schemeProgress: {},
  trackedProgrammeIds: [],
  schemeApplicationStatus: {},
  documentProgress: {}
};

const PlatformContext = createContext(null);

function normalizeSchemeProgress(progress) {
  if (!progress || typeof progress !== 'object' || Array.isArray(progress)) return {};
  return Object.fromEntries(
    Object.entries(progress)
      .filter(([key, value]) => typeof key === 'string' && Array.isArray(value))
      .map(([key, value]) => [key, [...new Set(value.filter((step) => Number.isInteger(step) && step > 0))]])
  );
}

function normalizeStringArray(value) {
  return Array.isArray(value) ? [...new Set(value.filter((item) => typeof item === 'string'))] : [];
}

function normalizeStringMap(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value)
      .filter(([key, item]) => typeof key === 'string' && typeof item === 'string')
  );
}

function normalizeStringArrayMap(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value)
      .filter(([key, item]) => typeof key === 'string' && Array.isArray(item))
      .map(([key, item]) => [key, normalizeStringArray(item)])
  );
}

function freshDefaults() {
  return {
    ...defaults,
    answers: {},
    assistanceTypes: [],
    checkedDocuments: [],
    chatHistory: [],
    completedStages: [],
    schemeProgress: {},
    trackedProgrammeIds: [],
    schemeApplicationStatus: {},
    documentProgress: {}
  };
}

function readStoredState() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return { data: freshDefaults(), issue: '' };
    const parsed = JSON.parse(stored);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return { data: freshDefaults(), issue: 'Saved local progress could not be read. Starting with a fresh guest session.' };
    }
    const savedData = { ...parsed };
    delete savedData.chatHistory;
    if (!supportedLanguageCodes.has(savedData.language)) savedData.language = 'en';
    savedData.answers = normalizeAssessmentAnswers(savedData.answers);
    savedData.schemeProgress = normalizeSchemeProgress(savedData.schemeProgress);
    if (!Array.isArray(savedData.trackedProgrammeIds)) {
      savedData.trackedProgrammeIds = Object.keys(savedData.schemeProgress)
        .map((schemeId) => `scheme:${schemeId}`);
    }
    savedData.trackedProgrammeIds = normalizeStringArray(savedData.trackedProgrammeIds);
    savedData.schemeApplicationStatus = normalizeStringMap(savedData.schemeApplicationStatus);
    savedData.documentProgress = normalizeStringArrayMap(savedData.documentProgress);
    return { data: { ...freshDefaults(), ...savedData }, issue: '' };
  } catch {
    return { data: freshDefaults(), issue: 'Local storage is unavailable. Progress may not persist after you leave this page.' };
  }
}

function cloudProgressFrom(data) {
  return {
    schemaVersion: 2,
    language: data.language,
    patientRole: data.patientRole,
    assistanceTypes: data.assistanceTypes,
    answers: data.answers,
    assessmentStep: data.assessmentStep ?? 0,
    followUpStep: data.followUpStep ?? 0,
    assessmentComplete: Boolean(data.assessmentComplete),
    checkedDocuments: data.checkedDocuments,
    completedStages: data.completedStages,
    schemeProgress: data.schemeProgress,
    trackedProgrammeIds: data.trackedProgrammeIds,
    schemeApplicationStatus: data.schemeApplicationStatus,
    documentProgress: data.documentProgress
  };
}

function hasLocalProgress(data) {
  return Boolean(
    data.patientRole
    || Object.keys(data.answers || {}).length
    || data.assistanceTypes?.length
    || data.checkedDocuments?.length
    || data.completedStages?.length
    || Object.keys(data.schemeProgress || {}).length
    || data.trackedProgrammeIds?.length
    || Object.keys(data.schemeApplicationStatus || {}).length
    || Object.keys(data.documentProgress || {}).length
  );
}

function normalizeCloudProgress(progress, current) {
  if (!progress || typeof progress !== 'object' || Array.isArray(progress)) {
    throw new Error('The saved progress record has an invalid format. Your local data was not changed.');
  }
  const schemeProgress = normalizeSchemeProgress(progress.schemeProgress);
  return {
    ...freshDefaults(),
    ...current,
    language: supportedLanguageCodes.has(progress.language) ? progress.language : 'en',
    patientRole: typeof progress.patientRole === 'string' ? progress.patientRole : '',
    assistanceTypes: Array.isArray(progress.assistanceTypes) ? progress.assistanceTypes.filter((value) => typeof value === 'string') : [],
    answers: normalizeAssessmentAnswers(progress.answers),
    assessmentStep: Number.isInteger(progress.assessmentStep) ? Math.max(0, progress.assessmentStep) : 0,
    followUpStep: Number.isInteger(progress.followUpStep) ? Math.max(0, progress.followUpStep) : 0,
    assessmentComplete: Boolean(progress.assessmentComplete),
    checkedDocuments: Array.isArray(progress.checkedDocuments) ? progress.checkedDocuments.filter((value) => typeof value === 'string') : [],
    completedStages: Array.isArray(progress.completedStages) ? progress.completedStages.filter((value) => Number.isInteger(value)) : [],
    schemeProgress,
    trackedProgrammeIds: Array.isArray(progress.trackedProgrammeIds)
      ? normalizeStringArray(progress.trackedProgrammeIds)
      : Object.keys(schemeProgress).map((schemeId) => `scheme:${schemeId}`),
    schemeApplicationStatus: normalizeStringMap(progress.schemeApplicationStatus),
    documentProgress: normalizeStringArrayMap(progress.documentProgress)
  };
}

export function PlatformProvider({ children }) {
  const [storedState] = useState(readStoredState);
  const [data, setData] = useState(storedState.data);
  const [storageIssue, setStorageIssue] = useState(storedState.issue);
  const [user, setUser] = useState(null);
  const [displayName, setDisplayName] = useState('');
  const [authLoading, setAuthLoading] = useState(isSupabaseConfigured);
  const [cloudStatus, setCloudStatus] = useState(isSupabaseConfigured ? 'checking' : 'local');
  const [cloudError, setCloudError] = useState('');
  const [needsProgressConsent, setNeedsProgressConsent] = useState(false);
  const [pendingCloudProgress, setPendingCloudProgress] = useState(null);
  const authRun = useRef(0);
  const lastCloudProgress = useRef('');
  const dataRef = useRef(data);
  dataRef.current = data;

  const persistLocal = useCallback((next) => {
    dataRef.current = next;
    setData(next);
    try {
      const savedData = { ...next };
      delete savedData.chatHistory;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(savedData));
      setStorageIssue('');
    } catch {
      setStorageIssue('Could not save your progress on this device. Keep this page open or download your information before leaving.');
    }
  }, []);

  const updateData = useCallback((patch) => {
    const next = { ...dataRef.current, ...patch };
    dataRef.current = next;
    setData(next);
    try {
      const savedData = { ...next };
      delete savedData.chatHistory;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(savedData));
      setStorageIssue('');
    } catch {
      setStorageIssue('Could not save your progress on this device. Keep this page open or download your information before leaving.');
    }
  }, []);

  const clearSavedProgress = useCallback(async () => {
    if (user && !needsProgressConsent) {
      await authService.deleteProgress(user.id);
    }
    try {
      localStorage.removeItem(STORAGE_KEY);
      setStorageIssue('');
      const empty = freshDefaults();
      dataRef.current = empty;
      setData(empty);
      lastCloudProgress.current = JSON.stringify(cloudProgressFrom(freshDefaults()));
      return true;
    } catch {
      setStorageIssue('Could not clear saved progress from this device. Please clear this site’s storage in your browser settings.');
      throw new Error('Cloud progress may already be deleted, but local saved progress could not be cleared.');
    }
  }, [needsProgressConsent, user]);

  const clearLocalCopy = useCallback(() => {
    try {
      localStorage.removeItem(STORAGE_KEY);
      setStorageIssue('');
      const empty = freshDefaults();
      dataRef.current = empty;
      setData(empty);
      return true;
    } catch {
      setStorageIssue('Could not clear saved progress from this device. Please clear this site’s storage in your browser settings.');
      return false;
    }
  }, []);

  const syncForUser = useCallback(async (nextUser, saveConsent = false) => {
    const requestId = ++authRun.current;
    setUser(nextUser);
    setDisplayName(nextUser?.user_metadata?.display_name || '');
    setCloudError('');
    setPendingCloudProgress(null);
    setNeedsProgressConsent(false);
    if (!nextUser) {
      setAuthLoading(false);
      setCloudStatus(isSupabaseConfigured ? 'signed_out' : 'local');
      lastCloudProgress.current = '';
      return;
    }
    setAuthLoading(false);
    setCloudStatus('checking');
    try {
      const profile = await authService.getProgressConsent(nextUser.id);
      if (requestId !== authRun.current) return;
      if (profile.display_name) setDisplayName(profile.display_name);
      const hasConsent = profile.progress_consent_version === PROGRESS_CONSENT_VERSION;
      if (saveConsent && !hasConsent) {
        await authService.grantProgressConsent(nextUser.id);
      } else if (!hasConsent) {
        setNeedsProgressConsent(true);
        setCloudStatus('consent_required');
        return;
      }
      if (requestId !== authRun.current) return;
      setNeedsProgressConsent(false);
      const remote = await authService.getProgress(nextUser.id);
      if (requestId !== authRun.current) return;
      if (remote?.progress) {
        const currentData = dataRef.current;
        const cloudData = normalizeCloudProgress(remote.progress, currentData);
        const remoteFingerprint = JSON.stringify(cloudProgressFrom(cloudData));
        const localFingerprint = JSON.stringify(cloudProgressFrom(currentData));
        if (hasLocalProgress(currentData) && localFingerprint !== remoteFingerprint) {
          setPendingCloudProgress(cloudData);
          setCloudStatus('conflict');
          return;
        }
        persistLocal(cloudData);
        lastCloudProgress.current = remoteFingerprint;
      } else {
        lastCloudProgress.current = '';
      }
      setCloudStatus('ready');
    } catch (error) {
      if (requestId !== authRun.current) return;
      setCloudStatus('error');
      setCloudError(error instanceof Error ? error.message : 'Could not load your account progress.');
    }
  }, [persistLocal]);

  const acceptProgressConsent = useCallback(async (targetUser = user) => {
    if (!targetUser) throw new Error('Sign in before enabling account progress.');
    setCloudStatus('checking');
    setCloudError('');
    try {
      await authService.grantProgressConsent(targetUser.id);
      setNeedsProgressConsent(false);
      await syncForUser(targetUser, false);
    } catch (error) {
      setCloudStatus('error');
      setCloudError(error instanceof Error ? error.message : 'Could not save your data-sharing preference.');
      throw error;
    }
  }, [syncForUser, user]);

  const useCloudProgress = useCallback(() => {
    if (!pendingCloudProgress) return;
    const next = { ...pendingCloudProgress };
    persistLocal(next);
    lastCloudProgress.current = JSON.stringify(cloudProgressFrom(next));
    setPendingCloudProgress(null);
    setCloudStatus('ready');
  }, [pendingCloudProgress, persistLocal]);

  const keepDeviceProgress = useCallback(() => {
    if (!user || !pendingCloudProgress) return;
    setPendingCloudProgress(null);
    lastCloudProgress.current = '';
    setCloudStatus('ready');
  }, [pendingCloudProgress, user]);

  useEffect(() => {
    document.documentElement.lang = data.language;
    document.documentElement.dir = data.language === 'ur' ? 'rtl' : 'ltr';
  }, [data.language]);

  useEffect(() => {
    if (!isSupabaseConfigured) return undefined;
    let active = true;
    let subscription;
    authService.onAuthStateChange((session) => {
      if (active) void syncForUser(session?.user || null);
    }).then((registeredSubscription) => {
      if (active) subscription = registeredSubscription;
      else registeredSubscription.unsubscribe();
    }).catch((error) => {
      if (!active) return;
      setAuthLoading(false);
      setCloudStatus('error');
      setCloudError(error instanceof Error ? error.message : 'Could not subscribe to authentication changes.');
    });
    authService.getSession().then((session) => {
      if (active) void syncForUser(session?.user || null);
    }).catch((error) => {
      if (!active) return;
      setAuthLoading(false);
      setCloudStatus('error');
      setCloudError(error instanceof Error ? error.message : 'Could not check the signed-in session.');
    });
    return () => {
      active = false;
      subscription?.unsubscribe();
      authRun.current += 1;
    };
  }, [syncForUser]);

  const progressFingerprint = JSON.stringify(cloudProgressFrom(data));
  useEffect(() => {
    if (!user || needsProgressConsent || cloudStatus !== 'ready' || progressFingerprint === lastCloudProgress.current) return undefined;
    const timer = window.setTimeout(async () => {
      setCloudStatus('saving');
      setCloudError('');
      try {
        await authService.saveProgress(user.id, cloudProgressFrom(data));
        lastCloudProgress.current = progressFingerprint;
        setCloudStatus('saved');
      } catch (error) {
        setCloudStatus('error');
        setCloudError(error instanceof Error ? error.message : 'Could not save account progress.');
      }
    }, 900);
    return () => window.clearTimeout(timer);
  }, [cloudStatus, data, needsProgressConsent, progressFingerprint, user]);

  const languageContext = useMemo(() => ({
    language: data.language,
    setLanguage: (language) => updateData({ language })
  }), [data.language, updateData]);

  const contextValue = useMemo(() => ({
    data,
    updateData,
    clearSavedProgress,
    clearLocalCopy,
    storageIssue,
    user,
    displayName,
    authLoading,
    cloudStatus,
    cloudError,
    needsProgressConsent,
    acceptProgressConsent,
    useCloudProgress,
    keepDeviceProgress
  }), [
    data, updateData, clearSavedProgress, clearLocalCopy, storageIssue, user, displayName, authLoading,
    cloudStatus, cloudError, needsProgressConsent, acceptProgressConsent, useCloudProgress, keepDeviceProgress
  ]);

  return (
    <PlatformContext.Provider value={contextValue}>
      <LanguageContext.Provider value={languageContext}>{children}</LanguageContext.Provider>
    </PlatformContext.Provider>
  );
}

export function usePlatform() {
  const value = useContext(PlatformContext);
  if (!value) throw new Error('usePlatform must be used within PlatformProvider');
  return value;
}
