import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, Navigate, useLocation, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft, ArrowRight, BookOpenCheck, Check, CircleHelp, ClipboardCheck, RotateCcw, Trash2,
  FileCheck2, FileText, HeartHandshake, Languages, LockKeyhole, MessageCircle, ShieldCheck, Sparkles,
  Stethoscope, UserRound, Wallet, ExternalLink, AlertCircle, Plus, RefreshCw, Key, Edit, CheckCircle
} from 'lucide-react';
import {
  demoOrganizations, demoSchemes, languageOptions, questionDefinitions, sectionLabels
} from './data';
import {
  buildSchemeCards, filterWorkbookNgos, findSchemeGuidance, getDocumentChecklistForScheme,
  getNgoRecommendation, getSchemeRecommendation, guidanceText, knownStates, loadSchemeGuidance,
  schemeGuidance, schemeGuidanceSnapshot, stateTracker, workbookNgos
} from './schemeGuidance';
import { translate, translateOption, useLanguage } from './i18n';
import { openChatAssistant } from './ChatDrawer';
import { usePlatform } from './PlatformContext';
import {
  fetchDirectoryNgos, fetchDirectoryStates, fetchDirectoryTaxonomies,
  askGuidance, authService, getChatIdentity, isRagConfigured, isSupabaseConfigured, supabaseConfigurationIssue,
  fetchSchemes, fetchSchemeDetail, evaluateEligibility,
  fetchAdminSchemes, fetchAdminScheme, createAdminScheme, updateAdminScheme, deleteAdminScheme,
  fetchAdminSources, addEvidence, reviewAdminSource, deleteAdminSource,
  fetchAdminClaims, createAdminClaim, reviewAdminClaim, deleteAdminClaim,
  publishScheme, fetchAdminSyncStatus, retryAdminSync, getAuthHeaders
} from './services';
import {
  DemoNotice, LanguageSelect, OptionGrid, PageHeading, RouteFooter, TranslationNotice
} from './components';

const roleOptions = ['Myself', 'Parent', 'Spouse', 'Child', 'Other family member'];
const assistanceOptions = [
  { id: 'government', icon: BookOpenCheck, title: 'assist.government', detail: 'assist.governmentHelp' },
  { id: 'financial', icon: Wallet, title: 'assist.financial', detail: 'assist.financialHelp' },
  { id: 'ngo', icon: HeartHandshake, title: 'assist.ngo', detail: 'assist.ngoHelp' },
  { id: 'medical', icon: Stethoscope, title: 'assist.medical', detail: 'assist.medicalHelp' },
  { id: 'applications', icon: FileCheck2, title: 'assist.applications', detail: 'assist.applicationsHelp' },
  { id: 'unsure', icon: CircleHelp, title: 'assist.unsure', detail: 'assist.unsureHelp' }
];

export function SetupPage() {
  const { step = 'role' } = useParams();
  const navigate = useNavigate();
  const { data, updateData } = usePlatform();
  const { language, setLanguage } = useLanguage();
  const t = (key, values) => translate(language, key, values);
  const stepIndex = ['role', 'language', 'support'].indexOf(step);
  const [error, setError] = useState('');
  if (stepIndex < 0) return <Navigate to="/start/role" replace />;
  const goNext = () => {
    setError('');
    if (step === 'role' && !data.patientRole) return setError(t('onboarding.roleError'));
    if (step === 'support' && !data.assistanceTypes.length) return setError(t('onboarding.supportError'));
    if (step === 'role') navigate('/start/language');
    else if (step === 'language') navigate('/start/support');
    else navigate('/assessment/access');
  };
  const back = () => navigate(step === 'support' ? '/start/language' : '/start/role');
  const toggleSupport = (id) => {
    const selected = data.assistanceTypes || [];
    updateData({ assistanceTypes: selected.includes(id) ? selected.filter((item) => item !== id) : [...selected, id] });
  };
  const title = step === 'role' ? t('onboarding.welcome') : step === 'language' ? t('onboarding.language') : t('onboarding.assistance');
  return (
    <div className="flow-page">
      <header className="flow-header">
        <Link to="/" className="brand"><span className="brand-mark"><HeartHandshake size={20} /></span>Neravu</Link>
        <div className="flow-header-actions"><LanguageSelect /><span className="flow-step-count">{stepIndex + 1} / 3</span></div>
      </header>
      <div className="flow-progress"><span style={{ width: `${((stepIndex + 1) / 3) * 100}%` }} /></div>
      <main className="flow-content" id="main-content">
        <TranslationNotice />
        <span className="eyebrow">{t('onboarding.eyebrow')}</span>
        <h1>{title}</h1>
        {step === 'role' && <>
          <p className="flow-question">{t('onboarding.who')}</p>
          <OptionGrid options={roleOptions} value={data.patientRole} onChange={(patientRole) => {
            updateData({ patientRole, answers: { ...data.answers, relationship: patientRole } });
          }} name="patient-role" language={language} />
        </>}
        {step === 'language' && <div className="language-choice-grid" role="group" aria-label={t('onboarding.language')}>
          {languageOptions.map((option) => (
            <button type="button" className={`language-choice${language === option.code ? ' selected' : ''}`} key={option.code} onClick={() => setLanguage(option.code)}>
              <span>{option.nativeName}</span><small>{option.name}</small>{language === option.code && <Check size={17} />}
            </button>
          ))}
        </div>}
        {step === 'support' && <>
          <p className="flow-question">{t('onboarding.assistance')}</p>
          <p className="muted-copy">{t('onboarding.assistanceHelp')}</p>
          <div className="assistance-grid">
            {assistanceOptions.map(({ id, icon: Icon, title: titleKey, detail: detailKey }) => {
              const checked = data.assistanceTypes.includes(id);
              return <button type="button" className={`assistance-card${checked ? ' selected' : ''}`} key={id} onClick={() => toggleSupport(id)} aria-pressed={checked}>
                <span className="assist-icon"><Icon size={20} /></span><span className="assist-check">{checked ? <Check size={15} /> : ''}</span>
                <strong>{t(titleKey)}</strong><small>{t(detailKey)}</small>
              </button>;
            })}
          </div>
        </>}
        <p className="guest-note"><ShieldCheck size={17} /> {t('onboarding.guestNote')}</p>
        {error && <p className="form-error" role="alert">{error}</p>}
        <RouteFooter>
          {stepIndex > 0 && <button className="button button-outline" onClick={back}><ArrowLeft size={17} /> {t('common.back')}</button>}
          <button className="button button-primary" onClick={goNext}>{step === 'support' ? t('onboarding.startAssessment') : t('common.continue')} <ArrowRight size={17} /></button>
        </RouteFooter>
      </main>
    </div>
  );
}

export function AssessmentAccessPage() {
  const { language } = useLanguage();
  const { data, updateData, user, authLoading } = usePlatform();
  const t = (key) => translate(language, key);
  const navigate = useNavigate();
  const continueAsGuest = () => {
    updateData({ assessmentAccessGranted: true });
    navigate('/assessment');
  };
  const continueWithAccount = () => {
    updateData({ assessmentAccessGranted: true });
    navigate('/assessment');
  };
  return (
    <div className="auth-page">
      <header className="flow-header"><Link to="/" className="brand"><span className="brand-mark"><HeartHandshake size={20} /></span>Neravu</Link><div className="flow-header-actions"><LanguageSelect /><span className="flow-step-count">{t('access.beforeQuestions')}</span></div></header>
      <main className="auth-card access-card" id="main-content">
        <TranslationNotice />
        <span className="auth-icon"><ShieldCheck size={23} /></span>
        <span className="eyebrow">{t('access.eyebrow')}</span>
        <h1>{t('access.title')}</h1>
        <p className="muted-copy">{t('access.subtitle')}</p>
        {user ? (
          <div className="account-ready">
            <p>{t('access.signedIn', { name: user.user_metadata?.display_name || user.email })}</p>
            <button type="button" className="button button-primary full-width" onClick={continueWithAccount}>{t('access.continueAccount')} <ArrowRight size={17} /></button>
          </div>
        ) : authLoading ? (
          <p role="status" className="muted-copy">{t('common.loading')}</p>
        ) : (
          <>
            <div className="access-actions">
              <Link className="button button-primary full-width" to="/login?next=%2Fassessment">{t('access.login')} <ArrowRight size={17} /></Link>
              <Link className="button button-outline full-width" to="/signup?next=%2Fassessment">{t('access.signup')}</Link>
            </div>
            {!isSupabaseConfigured && <DemoNotice>{t(supabaseConfigurationIssue ? 'auth.secretKeyError' : 'auth.unconfigured')}</DemoNotice>}
            <div className="guest-divider"><span>{t('access.or')}</span></div>
            <button type="button" className="guest-continue-button" onClick={continueAsGuest}>{t('access.guest')}</button>
            <p className="guest-note"><ShieldCheck size={17} /> {t('onboarding.guestNote')}</p>
          </>
        )}
        {data.assessmentStep > 0 && <button className="text-link access-back" type="button" onClick={continueAsGuest}>{t('access.resume')}</button>}
      </main>
    </div>
  );
}

function answerLabel(value, language) {
  if (Array.isArray(value)) return value.map((item) => translateOption(language, item)).join(', ');
  if (typeof value === 'string') return translateOption(language, value);
  return value == null ? '' : String(value);
}

export function AssessmentPage() {
  const navigate = useNavigate();
  const { data, updateData } = usePlatform();
  const { language } = useLanguage();
  const t = (key, values) => translate(language, key, values);
  const [index, setIndex] = useState(Math.min(data.assessmentStep || 0, questionDefinitions.length - 1));
  const [error, setError] = useState('');
  if (!data.assessmentAccessGranted) return <Navigate to="/assessment/access" replace />;
  const question = questionDefinitions[index];
  if (!question) return <Navigate to="/assessment/review" replace />;
  const value = data.answers[question.key] ?? '';
  const change = (newValue) => {
    setError('');
    const answers = { ...data.answers, [question.key]: newValue };
    updateData({ answers, assessmentStep: index });
  };
  const next = () => {
    if (question.required && !value && value !== 0) return setError(t('assessment.required'));
    if (index === questionDefinitions.length - 1) {
      updateData({ assessmentStep: index });
      navigate('/assessment/review');
    } else {
      const nextIndex = index + 1;
      setIndex(nextIndex);
      updateData({ assessmentStep: nextIndex });
      setError('');
    }
  };
  const back = () => {
    if (index === 0) {
      navigate('/start/support');
      return;
    }
    const previousIndex = index - 1;
    setIndex(previousIndex);
    updateData({ assessmentStep: previousIndex });
    setError('');
  };
  return (
    <div className="assessment-page">
      <header className="flow-header">
        <Link to="/" className="brand"><span className="brand-mark"><HeartHandshake size={20} /></span>Neravu</Link>
        <div className="flow-header-actions"><LanguageSelect /><Link className="quiet-link" to="/login">{t('nav.login')}</Link></div>
      </header>
      <main className="assessment-content" id="main-content">
        <TranslationNotice />
        <div className="assessment-progress-label"><span>{t(sectionLabels[question.section])}</span><span>{t('assessment.step', { current: index + 1, total: questionDefinitions.length })}</span></div>
        <div className="flow-progress"><span style={{ width: `${((index + 1) / questionDefinitions.length) * 100}%` }} /></div>
        <h1>{t('assessment.title')}</h1>
        <p className="muted-copy">{t('assessment.subtitle')}</p>
        <section className="question-card" aria-live="polite">
          <div className="question-kicker">{t(sectionLabels[question.section])}{question.optional && <span className="optional-pill">{t('common.optional')}</span>}</div>
          <h2>{t(question.prompt)}</h2>
          {question.type === 'select' || question.type === 'multiselect' ? (
            <OptionGrid options={question.options} value={value} onChange={change} multiple={question.type === 'multiselect'} name={question.key} language={language} />
          ) : (
            <div className="text-answer">
              <input
                type={question.inputType || 'text'}
                inputMode={question.inputType === 'number' ? 'numeric' : 'text'}
                min={question.inputType === 'number' ? 0 : undefined}
                max={question.inputType === 'number' ? 120 : undefined}
                placeholder={t(question.placeholder)}
                value={['Not sure', 'Prefer not to say'].includes(value) ? '' : value}
                onChange={(event) => change(event.target.value)}
                aria-label={t(question.prompt)}
              />
              <OptionGrid options={['Not sure', 'Prefer not to say']} value={value} onChange={change} name={`${question.key}-skip`} language={language} />
            </div>
          )}
        </section>
        <p className="autosave-note"><ShieldCheck size={16} /> {t('assessment.saved')}</p>
        {error && <p className="form-error" role="alert">{error}</p>}
        <RouteFooter>
          <button className="button button-outline" type="button" onClick={back}><ArrowLeft size={17} /> {t('common.back')}</button>
          <button className="button button-primary" type="button" onClick={next}>{t('common.continue')} <ArrowRight size={17} /></button>
        </RouteFooter>
      </main>
    </div>
  );
}

export function ReviewPage() {
  const navigate = useNavigate();
  const { data, updateData } = usePlatform();
  const { language } = useLanguage();
  const t = (key) => translate(language, key);
  const groups = useMemo(() => questionDefinitions.reduce((result, question, index) => {
    (result[question.section] ||= []).push({ question, index });
    return result;
  }, {}), []);
  const finish = () => {
    updateData({ assessmentComplete: true, assessmentStep: questionDefinitions.length - 1 });
    navigate('/dashboard');
  };
  return (
    <div className="assessment-page">
      <header className="flow-header"><Link to="/" className="brand"><span className="brand-mark"><HeartHandshake size={20} /></span>Neravu</Link><div className="flow-header-actions"><LanguageSelect /><Link className="quiet-link" to="/login">{t('nav.login')}</Link></div></header>
      <main className="review-content" id="main-content">
        <TranslationNotice />
        <span className="eyebrow">{t('assessment.reviewEyebrow')}</span><h1>{t('assessment.review')}</h1><p className="muted-copy">{t('assessment.reviewHelp')}</p>
        {Object.entries(groups).map(([section, entries]) => <section className="review-section" key={section}>
          <h2>{t(sectionLabels[section])}</h2>
          {entries.map(({ question, index }) => <div className="review-row" key={question.key}>
            <div><span>{t(question.prompt)}</span><strong>{data.answers[question.key] ? answerLabel(data.answers[question.key], language) : '—'}</strong></div>
            <button type="button" className="text-link" onClick={() => { updateData({ assessmentStep: index }); navigate('/assessment'); }}>{t('common.edit')}</button>
          </div>)}
        </section>)}
        <DemoNotice />
        <RouteFooter>
          <button type="button" className="button button-outline" onClick={() => navigate('/assessment')}><ArrowLeft size={17} /> {t('common.back')}</button>
          <button type="button" className="button button-primary" onClick={finish}>{t('assessment.finish')} <ArrowRight size={17} /></button>
        </RouteFooter>
      </main>
    </div>
  );
}

export function AuthPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { language } = useLanguage();
  const { acceptProgressConsent, updateData, user, authLoading } = usePlatform();
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [method, setMethod] = useState('email');
  const [phone, setPhone] = useState('');
  const [phoneCodeSent, setPhoneCodeSent] = useState(false);
  const [progressConsent, setProgressConsent] = useState(false);
  const [resetEmailSent, setResetEmailSent] = useState(false);
  const oauthHandled = useRef(false);
  const t = (key) => translate(language, key);
  const signUp = location.pathname === '/signup';
  const forgotPassword = location.pathname === '/forgot-password';
  const resetPassword = location.pathname === '/reset-password';
  const requestedNext = new URLSearchParams(location.search).get('next');
  const nextPath = requestedNext === '/assessment' ? '/assessment' : '/dashboard';
  const oauthCallback = location.pathname === '/login' && new URLSearchParams(location.search).get('oauth') === '1';

  const finishSignIn = async (authenticatedUser) => {
    updateData({ assessmentAccessGranted: nextPath === '/assessment' });
    try {
      if (progressConsent) {
        await acceptProgressConsent(authenticatedUser);
      }
    } catch (e) {
      console.warn('Progress consent sync deferred:', e);
    }
    navigate(nextPath);
  };

  useEffect(() => {
    if (!oauthCallback || !user || authLoading || oauthHandled.current) return;
    oauthHandled.current = true;
    let consentGiven = false;
    try {
      consentGiven = sessionStorage.getItem('neravu.oauth-progress-consent') === 'true';
      sessionStorage.removeItem('neravu.oauth-progress-consent');
    } catch {
      setMessage(t('auth.oauthSessionError'));
      return;
    }
    if (!consentGiven) {
      setMessage(t('auth.oauthConsentMissing'));
      return;
    }
    setBusy(true);
    void finishSignIn(user).catch((error) => {
      setMessage(error instanceof Error ? error.message : t('common.error'));
    }).finally(() => setBusy(false));
  }, [authLoading, oauthCallback, user]);

  const submit = async (event) => {
    event.preventDefault();
    if (!isSupabaseConfigured) {
      setMessage(t(supabaseConfigurationIssue ? 'auth.secretKeyError' : 'auth.unconfigured'));
      return;
    }
    setBusy(true);
    setMessage('');
    try {
      const formData = new FormData(event.currentTarget);
      const email = String(formData.get('email') || '');
      const password = String(formData.get('password') || '');
      const displayName = String(formData.get('displayName') || '');
      if (forgotPassword) {
        await authService.sendPasswordReset(email, `${window.location.origin}/reset-password?next=${encodeURIComponent(nextPath)}`);
        setResetEmailSent(true);
        setMessage(t('auth.resetEmailSent'));
      } else if (resetPassword) {
        await authService.updatePassword(password);
        setMessage(t('auth.passwordUpdated'));
        window.setTimeout(() => navigate('/login'), 900);
      } else if (method === 'phone') {
        const code = String(formData.get('phoneCode') || '').trim();
        if (!phoneCodeSent) {
          await authService.sendPhoneCode(phone.trim(), signUp);
          setPhoneCodeSent(true);
          setMessage(t('auth.phoneCodeSent'));
        } else {
          const result = await authService.verifyPhoneCode(phone.trim(), code);
          if (result.session?.user) await finishSignIn(result.session.user);
        }
      } else {
        const emailRedirectTo = `${window.location.origin}/login?next=${encodeURIComponent(nextPath)}`;
        const result = signUp
          ? await authService.signUp(email, password, displayName, emailRedirectTo)
          : await authService.signIn(email, password);
        if (signUp && !result.session) {
          setMessage(t('auth.confirmEmail'));
        } else if (result.session?.user) {
          await finishSignIn(result.session.user);
        }
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : t('common.error'));
    } finally {
      setBusy(false);
    }
  };

  const startGoogleSignIn = async () => {
    if (!progressConsent) {
      setMessage(t('auth.consentRequired'));
      return;
    }
    if (!isSupabaseConfigured) {
      setMessage(t(supabaseConfigurationIssue ? 'auth.secretKeyError' : 'auth.unconfigured'));
      return;
    }
    setBusy(true);
    setMessage('');
    try {
      sessionStorage.setItem('neravu.oauth-progress-consent', 'true');
      const callback = `${window.location.origin}/login?next=${encodeURIComponent(nextPath)}&oauth=1`;
      await authService.signInWithGoogle(callback);
    } catch (error) {
      try { sessionStorage.removeItem('neravu.oauth-progress-consent'); } catch { /* Storage may be unavailable. */ }
      setMessage(error instanceof Error ? error.message : t('common.error'));
      setBusy(false);
    }
  };

  const titleKey = forgotPassword ? 'auth.forgotTitle'
    : resetPassword ? 'auth.resetTitle'
      : signUp ? 'auth.signup' : 'auth.login';
  const showConsent = !forgotPassword && !resetPassword && isSupabaseConfigured;

  return (
    <div className="auth-page">
      <header className="flow-header"><Link to="/" className="brand"><span className="brand-mark"><HeartHandshake size={20} /></span>Neravu</Link><LanguageSelect /></header>
      <main className="auth-card" id="main-content">
        <TranslationNotice />
        <span className="auth-icon"><LockKeyhole size={23} /></span>
        <h1>{t(titleKey)}</h1>
        <p className="muted-copy">{t(isSupabaseConfigured ? 'auth.providerNotice' : 'auth.demoNotice')}</p>
        {!isSupabaseConfigured && <DemoNotice>{t(supabaseConfigurationIssue ? 'auth.secretKeyError' : 'auth.unconfigured')}</DemoNotice>}
        <form onSubmit={submit} className="auth-form">
          {forgotPassword ? (
            <>
              <p className="muted-copy">{t('auth.forgotHelp')}</p>
              <label>{t('auth.email')}<input name="email" type="email" autoComplete="email" required disabled={!isSupabaseConfigured || resetEmailSent} /></label>
              <button className="button button-primary full-width" type="submit" disabled={busy || !isSupabaseConfigured || resetEmailSent}>{busy ? t('common.loading') : t('auth.sendReset')}</button>
            </>
          ) : resetPassword ? (
            <>
              <p className="muted-copy">{t('auth.resetHelp')}</p>
              <label>{t('auth.newPassword')}<input name="password" type="password" autoComplete="new-password" required minLength={8} disabled={!isSupabaseConfigured} /></label>
              <button className="button button-primary full-width" type="submit" disabled={busy || !isSupabaseConfigured}>{busy ? t('common.loading') : t('auth.updatePassword')}</button>
            </>
          ) : method === 'phone' ? (
            <>
              <label>{t('auth.phone')}<input name="phone" type="tel" autoComplete="tel" inputMode="tel" placeholder="+919876543210" value={phone} onChange={(event) => setPhone(event.target.value)} required disabled={!isSupabaseConfigured || phoneCodeSent} /></label>
              {phoneCodeSent && <label>{t('auth.smsCode')}<input name="phoneCode" type="text" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{4,10}" required disabled={!isSupabaseConfigured} /></label>}
              {showConsent && <label className="consent-checkbox"><input type="checkbox" checked={progressConsent} onChange={(event) => setProgressConsent(event.target.checked)} required /> <span>{t('auth.consent')}</span></label>}
              <button className="button button-primary full-width" type="submit" disabled={busy || !isSupabaseConfigured}>{busy ? t('common.loading') : t(phoneCodeSent ? 'auth.verifyPhone' : 'auth.sendPhoneCode')}</button>
            </>
          ) : (
            <>
              {signUp && <label>{t('auth.fullName')}<input name="displayName" type="text" autoComplete="name" required disabled={!isSupabaseConfigured} /></label>}
              <label>{t('auth.email')}<input name="email" type="email" autoComplete="email" required disabled={!isSupabaseConfigured} /></label>
              <label>{t('auth.password')}<input name="password" type="password" autoComplete={signUp ? 'new-password' : 'current-password'} required minLength={8} disabled={!isSupabaseConfigured} /></label>
              {!signUp && <Link className="quiet-link forgot-link" to={`/forgot-password${nextPath === '/assessment' ? '?next=%2Fassessment' : ''}`}>{t('auth.forgotLink')}</Link>}
              {showConsent && <label className="consent-checkbox"><input type="checkbox" checked={progressConsent} onChange={(event) => setProgressConsent(event.target.checked)} required /> <span>{t('auth.consent')}</span></label>}
              <button className="button button-primary full-width" type="submit" disabled={busy || !isSupabaseConfigured}>{busy ? t('common.loading') : t('auth.submit')}</button>
            </>
          )}
        </form>
        {message && <p className="form-error" role="alert">{message}</p>}
        {!forgotPassword && !resetPassword && method !== 'phone' && isSupabaseConfigured && <>
          <div className="auth-divider"><span>{t('access.or')}</span></div>
          <button className="button button-outline full-width auth-provider-button" type="button" onClick={startGoogleSignIn} disabled={busy}><span aria-hidden="true">G</span>{t('auth.google')}</button>
          <button className="text-link auth-method-switch" type="button" onClick={() => { setMethod('phone'); setMessage(''); }}>{t('auth.usePhone')}</button>
        </>}
        {!forgotPassword && !resetPassword && method === 'phone' && <button className="text-link auth-method-switch" type="button" onClick={() => { setMethod('email'); setPhoneCodeSent(false); setMessage(''); }}>{t('auth.useEmail')}</button>}
        {!forgotPassword && !resetPassword && <button className="text-link auth-switch" type="button" onClick={() => navigate(`${signUp ? '/login' : '/signup'}${nextPath === '/assessment' ? '?next=%2Fassessment' : ''}`)}>{t(signUp ? 'auth.switchLogin' : 'auth.switchSignup')}</button>}
        {(forgotPassword || resetPassword) && <Link className="text-link auth-switch" to={`/login${nextPath === '/assessment' ? '?next=%2Fassessment' : ''}`}>{t('auth.backToLogin')}</Link>}
        {!forgotPassword && !resetPassword && <button className="guest-continue" type="button" onClick={() => {
          updateData({ assessmentAccessGranted: nextPath === '/assessment' });
          navigate(nextPath);
        }}>{t('auth.guest')}</button>}
      </main>
    </div>
  );
}


function SchemeCard({ scheme, onSelectDetail, onScreenEligibility, tracked, onToggleTracking, recommendation }) {
  const { language } = useLanguage();
  const isLive = Boolean(scheme.isWorkbook ? scheme.liveSchemeId : scheme.programme_code || scheme.official_name);
  const demoCategoryKeys = {
    pmjay: 'schemes.category.health',
    pnrf: 'schemes.category.grant',
    hmdg: 'schemes.category.grant',
    state: 'schemes.category.state'
  };
  const title = scheme.official_name || scheme.name;
  const category = scheme.programme_type
    ? translateOption(language, scheme.programme_type)
    : translate(language, demoCategoryKeys[scheme.id] || 'schemes.category.health');
  const description = isLive
    ? scheme.description || scheme.summary || ''
    : translate(language, `schemes.${scheme.id}`);
  const reviewStatusKey = {
    draft: 'admin.statusDraft',
    under_review: 'admin.statusReview',
    verified: 'admin.statusVerified'
  }[scheme.review_status];
  const reviewStatus = scheme.review_status
    ? translate(language, reviewStatusKey || 'admin.statusUnknown')
    : '';
  const isVerified = scheme.review_status === 'verified';

  return (
    <article className="content-card scheme-card">
      <div className="card-title-row">
        <span className="support-icon-small"><BookOpenCheck size={18} /></span>
        <span className={`status-chip ${isVerified ? 'verified-chip' : ''}`}>
          {scheme.isWorkbook
            ? translate(language, 'schemes.workbookGuidance')
            : isVerified ? translate(language, 'schemes.verifiedEvidence') : translate(language, 'common.demo')}
        </span>
      </div>
      <span className="card-category">{category}</span>
      <h2>{title}</h2>
      <p>{description}</p>
      {!isLive && scheme.status && <small className="verification-status">{translate(language, `schemes.status.${scheme.id}`)}</small>}
      {recommendation && (
        <small className="verification-status">
          {translate(language, 'schemes.possibleMatch')}
          {recommendation.reason ? ` · ${recommendation.reason}` : ''}
        </small>
      )}
      {scheme.version && (
        <small className="verification-status">
          {translate(language, 'schemes.version', {
            version: scheme.version,
            status: reviewStatus
          })}
        </small>
      )}
      <div className="scheme-actions-row" style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: 'auto', width: '100%' }}>
        {scheme.guidanceSlug && onToggleTracking && (
          <button
            type="button"
            className="button button-outline"
            style={{ minWidth: '110px' }}
            onClick={() => onToggleTracking(`scheme:${scheme.guidanceSlug}`)}
          >
            {tracked ? translate(language, 'tracker.removeProgramme') : translate(language, 'tracker.addProgramme')}
          </button>
        )}
        {scheme.guidanceSlug ? (
          <>
            <Link
              className="button button-primary"
              style={{ flex: 1, minWidth: '130px' }}
              to={`/schemes/${scheme.guidanceSlug}`}
            >
              {translate(language, 'schemes.officialDetails')} <ArrowRight size={15} />
            </Link>
            {isLive && (
              <button
                type="button"
                className="button button-outline"
                style={{ minWidth: '110px' }}
                onClick={() => onScreenEligibility && onScreenEligibility(scheme)}
              >
                {translate(language, 'schemes.eligibility')}
              </button>
            )}
          </>
        ) : scheme.id && isLive ? (
          <>
            <button
              type="button"
              className="button button-primary"
              style={{ flex: 1, minWidth: '130px' }}
              onClick={() => onSelectDetail && onSelectDetail(scheme.id)}
            >
              {translate(language, 'schemes.officialDetails')} <ArrowRight size={15} />
            </button>
            <button
              type="button"
              className="button button-outline"
              style={{ minWidth: '110px' }}
              onClick={() => onScreenEligibility && onScreenEligibility(scheme)}
            >
              {translate(language, 'schemes.eligibility')}
            </button>
          </>
        ) : (
          scheme.link ? (
            <a className="button button-outline" href={scheme.link} target="_blank" rel="noreferrer">
              {translate(language, 'schemes.official')} <ArrowRight size={16} />
            </a>
          ) : (
            <Link className="button button-outline" to="/assistant">
              {translate(language, 'schemes.guidance')} <ArrowRight size={16} />
            </Link>
          )
        )}
      </div>
    </article>
  );
}

export function DashboardPage() {
  const { data, user, cloudStatus } = usePlatform();
  const { language } = useLanguage();
  const t = (key) => translate(language, key);
  const [liveSchemes, setLiveSchemes] = useState([]);

  useEffect(() => {
    let active = true;
    fetchSchemes()
      .then((res) => {
        if (active && res?.schemes?.length) {
          setLiveSchemes(res.schemes);
        }
      })
      .catch(() => {});
    return () => { active = false; };
  }, []);

  const requestedSupport = assistanceOptions.filter((option) => (data.assistanceTypes || []).includes(option.id));
  const displaySchemes = liveSchemes.length > 0 ? liveSchemes.slice(0, 3) : demoSchemes.slice(0, 3);

  return (
    <div className="page-content dashboard-page">
      <PageHeading
        eyebrow={t('dashboard.eyebrow')}
        title={t('dashboard.hello')}
        description={t('dashboard.subtitle')}
        action={<span className="guest-pill"><ShieldCheck size={15} /> {t('common.guest')}</span>}
      />
      <DemoNotice>{user ? t('profile.accountNotice') : undefined}</DemoNotice>
      <section className="profile-summary">
        <div>
          <span className="eyebrow">{t('dashboard.startingPoint')}</span>
          <h2>
            {data.answers?.relationship
              ? `${answerLabel(data.answers.relationship, language)}${data.answers.state ? ` · ${data.answers.state}` : ''}`
              : t('dashboard.emptySummary')}
          </h2>
          <p>{requestedSupport.length ? requestedSupport.map((option) => t(option.title)).join(' · ') : t('dashboard.chooseSupport')}</p>
          <small>{t('dashboard.discoveryDisclaimer')}</small>
        </div>
        <Link to={data.assessmentComplete ? '/assessment/review' : '/start/role'} className="text-link">
          {data.assessmentComplete ? t('common.edit') : t('nav.start')} <ArrowRight size={15} />
        </Link>
      </section>
      <div className="dashboard-highlight">
        <div>
          <span className="eyebrow">{t('dashboard.match')}</span>
          <h2>{t('dashboard.explore')}</h2>
          <p>{t('dashboard.exploreHelp')}</p>
        </div>
        <Link to="/schemes" className="button button-primary">
          {t('dashboard.exploreSchemes')} <ArrowRight size={16} />
        </Link>
      </div>
      <section className="dashboard-section">
        <div className="section-title-row">
          <div>
            <span className="eyebrow">{t('dashboard.govSupport')}</span>
            <h2>{t('dashboard.match')}</h2>
          </div>
          <Link className="text-link" to="/schemes">
            {t('dashboard.viewAll')} <ArrowRight size={15} />
          </Link>
        </div>
        <div className="scheme-grid compact-schemes">
          {displaySchemes.map((scheme) => (
            <SchemeCard scheme={scheme} key={scheme.id} />
          ))}
        </div>
      </section>
      <div className="dashboard-two-col">
        <section className="content-card">
          <span className="eyebrow">{t('dashboard.next')}</span>
          <h2>{t('dashboard.startConfirm')}</h2>
          <ul className="next-step-list">
            <li>
              <span>1</span>
              <div>
                <strong>{t('dashboard.review')}</strong>
                <small>{t('dashboard.reviewHelp')}</small>
              </div>
            </li>
            <li>
              <span>2</span>
              <div>
                <strong>{t('dashboard.gather')}</strong>
                <small>{t('dashboard.gatherHelp')}</small>
              </div>
            </li>
            <li>
              <span>3</span>
              <div>
                <strong>{t('dashboard.verify')}</strong>
                <small>{t('dashboard.verifyHelp')}</small>
              </div>
            </li>
          </ul>
          <Link className="button button-outline" to="/assessment/review">
            {t('dashboard.completeAssessment')} <ArrowRight size={16} />
          </Link>
        </section>
        <section className="dashboard-side-stack">
          <article className="content-card progress-card">
            <span className="eyebrow">{t('dashboard.progress')}</span>
            <h2>{data.assessmentComplete ? t('dashboard.assessmentReviewed') : t('dashboard.assessmentProgress')}</h2>
            <div className="progress-track">
              <span
                style={{
                  width: data.assessmentComplete
                    ? '100%'
                    : data.assessmentStep
                    ? `${Math.round((data.assessmentStep / questionDefinitions.length) * 100)}%`
                    : '8%',
                }}
              />
            </div>
            <p>{user && ['ready', 'saved'].includes(cloudStatus) ? t('cloud.account') : t('dashboard.localProgress')}</p>
            <Link className="text-link" to={data.assessmentAccessGranted ? '/assessment' : '/assessment/access'}>
              {t('dashboard.continueAssessment')} <ArrowRight size={15} />
            </Link>
          </article>
          <article className="assistant-promo">
            <span className="assist-icon"><Sparkles size={20} /></span>
            <div>
              <h2>{t('dashboard.ai')}</h2>
              <p>{t('dashboard.aiHelp')}</p>
              <button
                type="button"
                className="text-link"
                onClick={() => openChatAssistant()}
                style={{ background: 'none', border: 'none', padding: 0, font: 'inherit', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
              >
                {t('dashboard.ask')} <ArrowRight size={15} />
              </button>
            </div>
          </article>
        </section>
      </div>
    </div>
  );
}

export function NgoPage() {
  const { language } = useLanguage();
  const { data, updateData } = usePlatform();
  const t = (key) => translate(language, key);
  const [ngos, setNgos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [directoryNotice, setDirectoryNotice] = useState('');
  const [search, setSearch] = useState('');
  const [selectedState, setSelectedState] = useState(data.answers?.state || '');
  const [directAidFilter, setDirectAidFilter] = useState('');
  const trackedProgrammeIds = data.trackedProgrammeIds || [];
  const incomeAnswer = data.answers?.annual_family_income || data.answers?.annualIncome || '';

  const loadNgos = async () => {
    setLoading(true);
    setError('');
    setDirectoryNotice('');
    const snapshotNgos = filterWorkbookNgos({
      search,
      state: selectedState,
      directAid: directAidFilter,
    });
    try {
      const res = await fetchDirectoryNgos({
        search: search.trim() || undefined,
        state: selectedState || undefined,
        directAid: directAidFilter || undefined,
      });
      const mergedNgos = new Map();
      for (const ngo of [...snapshotNgos, ...(res.ngos || [])]) {
        const key = ngo.organization_name.trim().toLocaleLowerCase();
        const previous = mergedNgos.get(key);
        if (!previous) {
          mergedNgos.set(key, ngo);
          continue;
        }
        const combined = { ...previous };
        for (const [field, value] of Object.entries(ngo)) {
          if (value !== null && value !== undefined && String(value).trim()) combined[field] = value;
        }
        combined.source_kind = 'live+workbook';
        mergedNgos.set(key, combined);
      }
      setNgos([...mergedNgos.values()]);
    } catch (err) {
      setNgos(snapshotNgos);
      if (snapshotNgos.length > 0) setDirectoryNotice(t('ngo.directoryFallbackNote'));
      else setError(err.message || t('common.error'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadNgos();
  }, [search, selectedState, directAidFilter]);

  const rankedNgos = ngos
    .map((ngo) => ({
      ngo,
      trackerId: `ngo:${String(ngo.organization_name || '').toLocaleLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
      recommendation: getNgoRecommendation(ngo, selectedState, incomeAnswer)
    }))
    .sort((left, right) => Number(right.recommendation.recommended) - Number(left.recommendation.recommended));

  return (
    <div className="page-content">
      <PageHeading
        eyebrow={t('ngo.page.eyebrow')}
        title={t('ngo.page.title')}
        description={t('ngo.page.description')}
      />
      <p className="translation-notice" role="note">{t('ngo.directorySourceNote')}</p>
      {directoryNotice && <p className="translation-notice" role="status">{directoryNotice}</p>}

      {/* Filter Toolbar */}
      <section className="content-card" style={{ marginBottom: '20px', padding: '16px' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'center' }}>
          <div style={{ flex: '1 1 240px' }}>
            <input
              type="text"
              placeholder={t('ngo.search')}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #ccc', fontSize: '13px' }}
            />
          </div>

          <div style={{ flex: '0 1 180px' }}>
            <select
              value={selectedState}
              onChange={(e) => setSelectedState(e.target.value)}
              style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #ccc', fontSize: '13px' }}
            >
              <option value="">{t('ngo.allStates')}</option>
              {knownStates.map((st) => (
                <option key={st} value={st}>{translateOption(language, st)}</option>
              ))}
            </select>
          </div>

          <div style={{ flex: '0 1 180px' }}>
            <select
              value={directAidFilter}
              onChange={(e) => setDirectAidFilter(e.target.value)}
              style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #ccc', fontSize: '13px' }}
            >
              <option value="">{t('ngo.allAidTypes')}</option>
              <option value="Yes">{t('ngo.directAidOnly')}</option>
              <option value="No">{t('ngo.serviceOnly')}</option>
            </select>
          </div>

          <button
            type="button"
            className="button button-outline"
            onClick={() => { setSearch(''); setSelectedState(''); setDirectAidFilter(''); }}
            style={{ minHeight: '36px', fontSize: '12px' }}
          >
            {t('ngo.reset')}
          </button>
        </div>
      </section>

      {loading && <div style={{ textAlign: 'center', padding: '40px', color: '#683693' }}>{t('ngo.loading')}</div>}
      {error && <div style={{ background: '#ffebee', color: '#c62828', padding: '12px 16px', borderRadius: '8px', marginBottom: '20px' }}>{error}</div>}
      {selectedState && (
        <p className="muted-copy">{t('directory.resultsForState', { state: translateOption(language, selectedState) })}</p>
      )}

      {!loading && ngos.length === 0 && (
        <div className="content-card" style={{ textAlign: 'center', padding: '40px' }}>
          <h3>{t('ngo.noResults')}</h3>
          <p style={{ color: '#666', fontSize: '13px' }}>{t('ngo.noResultsHelp')}</p>
        </div>
      )}

      {/* NGO Cards Grid */}
      <div className="ngo-grid">
        {rankedNgos.map(({ ngo, trackerId, recommendation }) => {
          const hasDirectAid = ngo.direct_financial_aid?.toLowerCase().startsWith('yes');
          return (
            <article className="content-card ngo-card" key={ngo.id || trackerId} style={{ display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                <span className="support-icon-small"><HeartHandshake size={18} /></span>
                <span
                  style={{
                    background: hasDirectAid ? '#e8f5e9' : '#f5f0fa',
                    color: hasDirectAid ? '#2e7d32' : '#683693',
                    padding: '3px 8px',
                    borderRadius: '4px',
                    fontSize: '10px',
                    fontWeight: 'bold',
                  }}
                >
                  {hasDirectAid ? t('ngo.directFinancialAid') : translateOption(language, ngo.organization_type || t('ngo.supportNgo')).toUpperCase()}
                </span>
              </div>

              <h2 style={{ fontSize: '16px', margin: '4px 0 6px 0', color: '#1a1a1a' }}>{ngo.organization_name}</h2>
              {selectedState && recommendation.recommended && (
                <small className="verification-status">{t('directory.possibleNgoMatch')}</small>
              )}
              <div style={{ fontSize: '11px', color: '#666', marginBottom: '8px' }}>
                <strong>{t('ngo.coverage')}</strong> {ngo.state_coverage} {ngo.city_district ? `· ${ngo.city_district}` : ''}
              </div>

              <p style={{ fontSize: '12px', lineHeight: '1.5', color: '#444', flex: 1, margin: '0 0 12px 0' }}>
                {ngo.what_support_offered || ngo.support_type}
              </p>

              {ngo.aid_amount_limit && (
                <div style={{ background: '#fdf8e2', border: '1px solid #fae8a4', borderRadius: '6px', padding: '6px 10px', fontSize: '11px', color: '#7a5b00', marginBottom: '10px' }}>
                  <strong>{t('ngo.aidLimit')}</strong> {ngo.aid_amount_limit}
                </div>
              )}

              {ngo.contact_phone && (
                <div style={{ fontSize: '11px', color: '#555', marginBottom: '4px' }}>
                  <strong>{t('ngo.phone')}</strong> {ngo.contact_phone}
                </div>
              )}

              {ngo.contact_email && (
                <div style={{ fontSize: '11px', color: '#555', marginBottom: '8px' }}>
                  <strong>{t('ngo.email')}</strong> {ngo.contact_email}
                </div>
              )}

              {(ngo.eligibility || ngo.hospital_restrictions || ngo.application_route || ngo.address || ngo.verification_status || ngo.source_notes) && (
                <details className="guidance-disclosure" style={{ margin: '8px 0' }}>
                  <summary>{t('ngo.moreDetails')}</summary>
                  {ngo.eligibility && <p><strong>{t('ngo.eligibility')}:</strong> {ngo.eligibility}</p>}
                  {ngo.hospital_restrictions && <p><strong>{t('ngo.restrictions')}:</strong> {ngo.hospital_restrictions}</p>}
                  {ngo.application_route && <p><strong>{t('ngo.applicationRoute')}:</strong> {ngo.application_route}</p>}
                  {ngo.address && <p><strong>{t('ngo.address')}:</strong> {ngo.address}</p>}
                  {ngo.verification_status && <p><strong>{t('ngo.verificationStatus')}:</strong> {ngo.verification_status}</p>}
                  {ngo.source_notes && <p><strong>{t('ngo.sourceNotes')}:</strong> {ngo.source_notes}</p>}
                </details>
              )}

              <div style={{ display: 'flex', gap: '8px', marginTop: 'auto', paddingTop: '8px', flexWrap: 'wrap' }}>
                {ngo.website_url && (
                  <a
                    href={ngo.website_url}
                    target="_blank"
                    rel="noreferrer"
                    className="button button-outline"
                    style={{ fontSize: '11px', minHeight: '30px', padding: '4px 10px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                  >
                    {t('ngo.officialPortal')} <ExternalLink size={12} />
                  </a>
                )}
                {ngo.source_kind && (
                  <button
                    className="button button-outline"
                    type="button"
                    style={{ fontSize: '11px', minHeight: '30px', padding: '4px 10px' }}
                    onClick={() => updateData({
                      trackedProgrammeIds: trackedProgrammeIds.includes(trackerId)
                        ? trackedProgrammeIds
                        : [...trackedProgrammeIds, trackerId]
                    })}
                    disabled={trackedProgrammeIds.includes(trackerId)}
                  >
                    {translate(language, trackedProgrammeIds.includes(trackerId) ? 'tracker.alreadyTracked' : 'tracker.addProgramme')}
                  </button>
                )}
                <Link
                  className="button button-primary"
                  to="/assistant"
                  style={{ fontSize: '11px', minHeight: '30px', padding: '4px 10px' }}
                >
                  {t('ngo.askAssistant')} <ArrowRight size={14} />
                </Link>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}

export function SchemesPage() {
  const { language } = useLanguage();
  const t = (key, values) => translate(language, key, values);
  const { data, updateData } = usePlatform();
  const [browseState, setBrowseState] = useState(data.answers?.state || '');
  const [schemes, setSchemes] = useState(() => buildSchemeCards([], language));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeDetail, setActiveDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [eligibilityModal, setEligibilityModal] = useState(null);
  const [eligibilityLoading, setEligibilityLoading] = useState(false);
  const trackedProgrammeIds = data.trackedProgrammeIds || [];
  const incomeAnswer = data.answers?.annual_family_income || data.answers?.annualIncome || '';
  const recommendations = useMemo(() => schemes.map((scheme) => {
    const result = getSchemeRecommendation(scheme, browseState, incomeAnswer);
    const reasons = [];
    if (browseState && result.stateMatch) reasons.push(t('schemes.stateMatchReason', { state: browseState }));
    if (incomeAnswer && !result.incomeMismatch) reasons.push(t('schemes.incomeConsidered'));
    return { scheme, result, reason: reasons.join(' · ') };
  }), [schemes, browseState, incomeAnswer, language]);
  const visibleRecommendations = recommendations.filter(({ result }) => result.stateMatch);
  const hasProfileFactors = Boolean(browseState || incomeAnswer);
  const recommendedSchemes = hasProfileFactors
    ? visibleRecommendations.filter(({ result }) => result.recommended)
    : [];
  const selectedStateLead = stateTracker.find((record) => record.State === browseState);

  const toggleTracking = (programmeId) => {
    const current = new Set(trackedProgrammeIds);
    if (current.has(programmeId)) current.delete(programmeId);
    else current.add(programmeId);
    updateData({ trackedProgrammeIds: [...current] });
  };

  useEffect(() => {
    let active = true;
    fetchSchemes()
      .then((res) => {
        if (!active) return;
        if (res?.schemes && res.schemes.length > 0) {
          setSchemes(buildSchemeCards(res.schemes, language));
        }
      })
      .catch(() => {
        if (!active) return;
        setError(t('schemes.connecting'));
        setSchemes(buildSchemeCards([], language));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [language]);

  const loadDetail = async (schemeId) => {
    setDetailLoading(true);
    try {
      const res = await fetchSchemeDetail(schemeId);
      setActiveDetail(res);
    } catch (err) {
      alert(`${t('schemes.detailLoadError')} ${err.message}`);
    } finally {
      setDetailLoading(false);
    }
  };

  const handleScreenEligibility = async (scheme) => {
    setEligibilityLoading(true);
    setEligibilityModal({ scheme, result: null });
    try {
      const patientFacts = {
        age: Number(data.answers?.age) || 72,
        annual_income: Number(data.answers?.annual_income) || 120000,
        citizenship: 'Indian',
        state: data.answers?.state || 'Andhra Pradesh',
      };
      const res = await evaluateEligibility(scheme.id, patientFacts);
      setEligibilityModal({ scheme, result: res, facts: patientFacts });
    } catch (err) {
      setEligibilityModal({ scheme, error: err.message });
    } finally {
      setEligibilityLoading(false);
    }
  };

  return (
    <div className="page-content">
      <PageHeading
        eyebrow={t('schemes.pageEyebrow')}
        title={t('page.schemes')}
        description={t('schemes.pageDescription')}
      />
      <section className="content-card" style={{ marginBottom: '20px', padding: '16px' }}>
        <label htmlFor="schemes-state-filter" style={{ fontWeight: 'bold', fontSize: '13px', display: 'block', marginBottom: '8px' }}>
          {t('directory.browseByState')}
        </label>
        <select
          id="schemes-state-filter"
          value={browseState}
          onChange={(event) => setBrowseState(event.target.value)}
          style={{ width: '100%', maxWidth: '360px', padding: '8px 12px', borderRadius: '8px', border: '1px solid #ccc', fontSize: '13px', background: '#fff' }}
        >
          <option value="">{t('directory.useMyState', { state: data.answers?.state || t('directory.allStates') })}</option>
          {knownStates.map((state) => <option key={state} value={state}>{translateOption(language, state)}</option>)}
        </select>
        {recommendedSchemes.length > 0 && (
          <p className="muted-copy" style={{ marginBottom: 0 }}>
            {t('directory.possibleMatches', { count: recommendedSchemes.length })}
          </p>
        )}
        {selectedStateLead?.['State Government Scheme Lead'] && (
          <div className="guidance-fact" style={{ marginTop: '12px' }}>
            <strong>{t('directory.stateLead', { state: translateOption(language, browseState) })}</strong>
            <p>{selectedStateLead['State Government Scheme Lead']}</p>
            {selectedStateLead['Next Action / Verification Notes'] && (
              <p>{selectedStateLead['Next Action / Verification Notes']}</p>
            )}
          </div>
        )}
      </section>
      {loading && <div className="route-loading" role="status">{t('schemes.loading')}</div>}
      {error && <DemoNotice>{error}</DemoNotice>}

      <div className="scheme-grid">
        {visibleRecommendations.map(({ scheme, result, reason }) => (
          <SchemeCard
            scheme={scheme}
            key={scheme.id}
            onSelectDetail={loadDetail}
            onScreenEligibility={handleScreenEligibility}
            tracked={trackedProgrammeIds.includes(`scheme:${scheme.guidanceSlug}`)}
            onToggleTracking={scheme.guidanceSlug ? toggleTracking : undefined}
            recommendation={result.recommended && (browseState || incomeAnswer) ? { reason } : null}
          />
        ))}
      </div>

      {/* Official Detail Modal */}
      {activeDetail && (
        <div className="modal-overlay" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div className="content-card" style={{ maxWidth: '750px', maxHeight: '85vh', overflowY: 'auto', width: '100%', position: 'relative' }}>
            <button
              type="button"
              className="button button-outline"
              style={{ position: 'absolute', top: '15px', right: '15px' }}
              onClick={() => setActiveDetail(null)}
            >
              ✕ {translate(language, 'schemes.close')}
            </button>
            <span className="eyebrow">{translate(language, 'schemes.detailEyebrow')}</span>
            <h2>{activeDetail.official_name}</h2>
            <p style={{ marginTop: '8px', color: '#666' }}>{activeDetail.description || activeDetail.programme_type}</p>

            {activeDetail.coverage && (
              <div style={{ background: '#f5f0fa', padding: '15px', borderRadius: '12px', margin: '15px 0' }}>
                <h3 style={{ margin: '0 0 8px 0', fontSize: '15px', color: '#4a2574' }}>{translate(language, 'schemes.verifiedCoverage')}</h3>
                <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '13px' }}>
                  {activeDetail.coverage.annual_cover_inr && <li><strong>{translate(language, 'schemes.annualCover')}</strong> ₹{activeDetail.coverage.annual_cover_inr.toLocaleString()}</li>}
                  {activeDetail.coverage.senior_cover_inr && <li><strong>{translate(language, 'schemes.seniorTopUp')}</strong> ₹{activeDetail.coverage.senior_cover_inr.toLocaleString()}</li>}
                  <li><strong>{translate(language, 'schemes.cashlessHospitalization')}</strong> {translate(language, activeDetail.coverage.cashless ? 'schemes.cashlessYes' : 'schemes.reimbursement')}</li>
                  <li><strong>{translate(language, 'schemes.portability')}</strong> {translate(language, activeDetail.coverage.pan_india_portability ? 'schemes.allIndiaNetwork' : 'schemes.designatedCenters')}</li>
                </ul>
              </div>
            )}

            <h3 style={{ marginTop: '20px' }}>{translate(language, 'schemes.evidenceSources', { count: activeDetail.evidence_sources?.length || 0 })}</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '10px' }}>
              {(activeDetail.evidence_sources || []).map((src) => (
                <div key={src.id} style={{ border: '1px solid #e2d9ec', borderRadius: '10px', padding: '12px', background: '#fff' }}>
                  <strong>{src.source_title}</strong>
                  <div style={{ fontSize: '12px', color: '#555', marginTop: '4px' }}>
                    <span>{translate(language, 'schemes.issuingBody')} {src.issuing_body}</span> · <span>{translate(language, 'schemes.effectiveDate')} {src.effective_date}</span>
                  </div>
                  {src.page_reference && (
                    <div style={{ fontSize: '11px', color: '#777', marginTop: '4px' }}>
                      <em>{translate(language, 'schemes.locator')} {src.page_reference}</em>
                    </div>
                  )}
                  {src.source_url && (
                    <a
                      href={src.source_url}
                      target="_blank"
                      rel="noreferrer"
                      style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '12px', color: '#683693', marginTop: '6px', fontWeight: 'bold' }}
                    >
                      {translate(language, 'schemes.openDocument')} <ExternalLink size={13} />
                    </a>
                  )}
                </div>
              ))}
            </div>

            <div style={{ marginTop: '20px', textAlign: 'right' }}>
              <button type="button" className="button button-primary" onClick={() => setActiveDetail(null)}>{translate(language, 'common.done')}</button>
            </div>
          </div>
        </div>
      )}

      {/* Live Eligibility Screening Modal */}
      {eligibilityModal && (
        <div className="modal-overlay" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div className="content-card" style={{ maxWidth: '650px', maxHeight: '85vh', overflowY: 'auto', width: '100%', position: 'relative' }}>
            <button
              type="button"
              className="button button-outline"
              style={{ position: 'absolute', top: '15px', right: '15px' }}
              onClick={() => setEligibilityModal(null)}
            >
              ✕ {translate(language, 'schemes.close')}
            </button>
            <span className="eyebrow">{translate(language, 'eligibility.eyebrow')}</span>
            <h2>{eligibilityModal.scheme?.official_name || eligibilityModal.scheme?.name}</h2>

            {eligibilityLoading ? (
              <p>{translate(language, 'eligibility.loading')}</p>
            ) : eligibilityModal.error ? (
              <p className="form-error">{eligibilityModal.error}</p>
            ) : eligibilityModal.result ? (
              <div style={{ marginTop: '15px' }}>
                <div style={{
                  padding: '12px 18px',
                  borderRadius: '10px',
                  fontWeight: 'bold',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  background: eligibilityModal.result.result === 'PASS' ? '#e6f7ec' : eligibilityModal.result.result === 'FAIL' ? '#ffebee' : '#fff8e1',
                  color: eligibilityModal.result.result === 'PASS' ? '#1b5e20' : eligibilityModal.result.result === 'FAIL' ? '#b71c1c' : '#f57f17'
                }}>
                  <ShieldCheck size={20} />
                  <span>{translate(language, 'eligibility.verdict', { result: eligibilityModal.result.result })}</span>
                </div>
                <p style={{ fontSize: '13px', marginTop: '10px', color: '#555' }}>{eligibilityModal.result.disclaimer}</p>

                <h4 style={{ marginTop: '15px' }}>{translate(language, 'eligibility.rulePathways')}</h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '8px' }}>
                  {(eligibilityModal.result.rules || []).map((r, i) => (
                    <div key={i} style={{ border: '1px solid #ede7f1', padding: '10px', borderRadius: '8px', fontSize: '12px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold' }}>
                        <span>{r.rule_type?.replace(/_/g, ' ').toUpperCase()}</span>
                        <span style={{ color: r.result === 'PASS' ? '#2e7d32' : r.result === 'FAIL' ? '#c62828' : '#e65100' }}>{r.result}</span>
                      </div>
                      <p style={{ margin: '4px 0 0 0', color: '#444' }}>{r.explanation}</p>
                      {r.evidence_source && (
                        <small style={{ color: '#683693', display: 'block', marginTop: '4px' }}>
                          Source: {r.evidence_source.title} ({r.evidence_source.locator})
                        </small>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}

function GuidanceRecord({ record, labels = {} }) {
  return (
    <dl className="guidance-record">
      {Object.entries(record).filter(([, value]) => value !== '' && value !== null).map(([label, value]) => (
        <div key={label}>
          <dt>{labels[label] || label}</dt>
          <dd>{String(value)}</dd>
        </div>
      ))}
    </dl>
  );
}

export function SchemeGuidancePage() {
  const { schemeId } = useParams();
  const { language } = useLanguage();
  const t = (key, values) => translate(language, key, values);
  const { data, updateData } = usePlatform();
  const [scheme, setScheme] = useState(null);
  const [guidanceError, setGuidanceError] = useState('');
  const [liveScheme, setLiveScheme] = useState(null);
  const [liveError, setLiveError] = useState('');
  const localized = scheme?.translations?.[language] || {};
  const summary = localized.journeySummary?.[0] || scheme?.journeySummary?.[0] || {};
  const governmentRecord = scheme?.governmentRecords?.[0] || {};
  const researchDetails = localized.researchDetails || scheme?.researchDetails || [];
  const sourceVerifications = localized.sourceVerifications || scheme?.sourceVerifications || [];
  const applicationSteps = localized.applicationSteps || scheme?.applicationSteps || [];
  const uiLabels = localized.labels?.applicationSteps || {};
  const sourceLabels = localized.labels?.sourceVerifications || {};
  const auditLabels = localized.labels?.researchAudits || {};
  const legacyLabels = localized.labels?.legacyRecords || {};
  const summaryLabels = localized.labels?.summary || {};
  const steps = applicationSteps;
  const completedSteps = new Set(data.schemeProgress?.[schemeId] || []);

  useEffect(() => {
    let active = true;
    setScheme(null);
    setGuidanceError('');
    loadSchemeGuidance(schemeId)
      .then((catalogueEntry) => {
        if (active) setScheme(catalogueEntry);
      })
      .catch((error) => {
        if (active) setGuidanceError(error instanceof Error ? error.message : t('schemes.guidance.noMatch'));
      });
    return () => { active = false; };
  }, [schemeId]);

  useEffect(() => {
    let active = true;
    fetchSchemes()
      .then((response) => {
        if (!active) return;
        const published = response?.schemes?.find((candidate) => findSchemeGuidance(candidate)?.id === schemeId);
        if (published) setLiveScheme(published);
      })
      .catch((error) => {
        if (active) setLiveError(error instanceof Error ? error.message : t('schemes.connecting'));
      });
    return () => { active = false; };
  }, [schemeId]);

  if (!scheme) {
    return (
      <div className="page-content">
        {guidanceError
          ? <DemoNotice>{guidanceError}</DemoNotice>
          : <p className="route-loading" role="status">{t('common.loading')}</p>}
        <Link className="button button-outline" to="/schemes"><ArrowLeft size={16} /> {t('schemes.guidance.back')}</Link>
      </div>
    );
  }

  const eligibilityResearch = researchDetails.filter(({ question }) => (
    /diagnosis|age or demographic|residence or citizenship|income or socioeconomic|insurance or existing benefits|eligibility exclusions/i.test(question)
  ));
  const applicationResearch = researchDetails.filter(({ question }) => (
    /exact steps to apply|where and how must|hospital social worker|ngo referral|rejection reasons|escalation or grievance|common obstacles|procedure when the scheme/i.test(question)
  ));
  const documentsText = summary['Documents to Prepare']
    || governmentRecord['Documents Commonly Required']
    || '';
  const eligibilityText = summary['Who May Apply / Eligibility Snapshot']
    || governmentRecord['Eligibility Summary']
    || '';
  const applicationRoute = summary['Contact / Submission Point']
    || governmentRecord['Application / Referral Route']
    || '';
  const contactText = governmentRecord['Helpline / Contact'] || '';

  const toggleStep = (stepNumber, checked) => {
    const current = data.schemeProgress?.[schemeId] || [];
    const next = checked
      ? [...new Set([...current, stepNumber])]
      : current.filter((value) => value !== stepNumber);
    updateData({ schemeProgress: { ...(data.schemeProgress || {}), [schemeId]: next } });
  };

  return (
    <div className="page-content scheme-guidance-page">
      <TranslationNotice />
      <Link className="guidance-back-link" to="/schemes"><ArrowLeft size={16} /> {guidanceText(language, 'back')}</Link>
      <PageHeading
        eyebrow={summary['Programme Type'] || scheme.programmeType || guidanceText(language, 'sourceSnapshot')}
        title={summary.Programme || scheme.name}
        description={summary['Important Caveat'] || governmentRecord['Source Notes'] || ''}
      />
      <div style={{ display: 'flex', gap: '10px', margin: '0 0 16px', flexWrap: 'wrap' }}>
        <button
          type="button"
          className="button button-primary"
          onClick={() => updateData({
            trackedProgrammeIds: (data.trackedProgrammeIds || []).includes(`scheme:${schemeId}`)
              ? data.trackedProgrammeIds
              : [...(data.trackedProgrammeIds || []), `scheme:${schemeId}`]
          })}
          disabled={(data.trackedProgrammeIds || []).includes(`scheme:${schemeId}`)}
        >
          {t((data.trackedProgrammeIds || []).includes(`scheme:${schemeId}`) ? 'tracker.alreadyTracked' : 'tracker.addProgramme')}
        </button>
        <Link className="button button-outline" to="/tracker">{t('tracker.openTracker')}</Link>
      </div>
      <div className="guidance-snapshot-notice">
        <strong>{guidanceText(language, 'sourceSnapshot')} · {schemeGuidanceSnapshot}</strong>
        <p>{guidanceText(language, 'sourceNotice')}</p>
        {sourceVerifications.map((record, index) => (
          <p key={`${record['Programme / organization']}-${index}`}>
            <strong>{record['Verification status']}</strong>
            {record['Important correction / uncertainty'] && ` — ${record['Important correction / uncertainty']}`}
          </p>
        ))}
        {liveScheme && (
          <p className="guidance-live-note">
            {t('schemes.verifiedEvidence')}: {liveScheme.review_status || t('common.notVerified')}
            {liveScheme.version ? ` · ${t('schemes.version', { version: liveScheme.version, status: liveScheme.review_status || '' })}` : ''}
          </p>
        )}
        {liveError && <p role="status">{t('schemes.connecting')} {liveError}</p>}
      </div>

      <div className="guidance-section-grid">
        {(eligibilityText || eligibilityResearch.length > 0) && (
          <section className="content-card guidance-section">
            <h2>{summaryLabels['Who May Apply / Eligibility Snapshot'] || t('schemes.guidance.eligibility')}</h2>
            {eligibilityText && <p>{eligibilityText}</p>}
            {eligibilityResearch.map(({ question, localizedQuestion, answer }) => (
              <div className="guidance-fact" key={question}><strong>{localizedQuestion || question}</strong><p>{answer}</p></div>
            ))}
          </section>
        )}
        {documentsText && (
          <section className="content-card guidance-section">
            <h2>{summaryLabels['Documents to Prepare'] || t('schemes.guidance.documents')}</h2>
            <p>{documentsText}</p>
          </section>
        )}
        {(applicationRoute || contactText || applicationResearch.length > 0) && (
          <section className="content-card guidance-section">
            <h2>{summaryLabels['Contact / Submission Point'] || t('schemes.guidance.contacts')}</h2>
            {applicationRoute && <p>{applicationRoute}</p>}
            {contactText && <p><strong>{t('ngo.phone')}</strong> {contactText}</p>}
            {applicationResearch.map(({ question, localizedQuestion, answer }) => (
              <div className="guidance-fact" key={question}><strong>{localizedQuestion || question}</strong><p>{answer}</p></div>
            ))}
          </section>
        )}
      </div>

      <section className="guidance-steps-section">
        <div className="section-title-row">
          <div><span className="eyebrow">{summaryLabels['Journey Steps'] || t('schemes.guidance.steps')}</span><h2>{guidanceText(language, 'progress', { done: completedSteps.size, total: steps.length })}</h2></div>
        </div>
        {steps.length === 0 ? (
          <div className="content-card guidance-no-steps">
            <p>{guidanceText(language, 'noSteps')}</p>
            {applicationRoute && <p><strong>{guidanceText(language, 'action')}:</strong> {applicationRoute}</p>}
          </div>
        ) : (
          <ol className="guidance-step-list">
            {steps.map((step) => {
              const stepNumber = Number(step['Step No.']);
              const isComplete = completedSteps.has(stepNumber);
              return (
                <li className={`content-card guidance-step${isComplete ? ' completed' : ''}`} key={`${scheme.id}-${stepNumber}`}>
                  <label className="guidance-step-check">
                    <input type="checkbox" checked={isComplete} onChange={(event) => toggleStep(stepNumber, event.target.checked)} />
                    <span>{guidanceText(language, 'done')}</span>
                  </label>
                  <span className="guidance-step-number">{stepNumber}</span>
                  <div className="guidance-step-content">
                    <h3>{step['Step / Action']}</h3>
                    {step['Who Does It'] && <p><strong>{uiLabels['Who Does It'] || guidanceText(language, 'responsible')}:</strong> {step['Who Does It']}</p>}
                    {step['What to Do'] && <p><strong>{uiLabels['What to Do'] || guidanceText(language, 'action')}:</strong> {step['What to Do']}</p>}
                    {step['Evidence / Output to Keep'] && <p><strong>{uiLabels['Evidence / Output to Keep'] || guidanceText(language, 'output')}:</strong> {step['Evidence / Output to Keep']}</p>}
                    {step['If This Step Gets Stuck'] && <p className="guidance-stuck"><strong>{uiLabels['If This Step Gets Stuck'] || guidanceText(language, 'stuck')}:</strong> {step['If This Step Gets Stuck']}</p>}
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </section>

      {scheme.officialLinks?.length > 0 && (
        <section className="content-card guidance-section">
          <h2>{summaryLabels['Official Links / Forms'] || t('schemes.guidance.sources')}</h2>
          <ul className="guidance-links">
            {scheme.officialLinks.map((url) => (
              <li key={url}><a href={url} target="_blank" rel="noreferrer">{url} <ExternalLink size={14} /></a></li>
            ))}
          </ul>
        </section>
      )}

      {sourceVerifications.length > 0 && (
        <details className="content-card guidance-disclosure" open>
          <summary>{sourceLabels['Verification status'] || t('schemes.guidance.verification')}</summary>
          {sourceVerifications.map((record, index) => (
            <GuidanceRecord key={`${record['Programme / organization']}-${index}`} record={record} labels={sourceLabels} />
          ))}
        </details>
      )}

      {scheme.governmentRecords?.map((record, index) => (
        <details className="content-card guidance-disclosure" key={`government-${index}`}>
          <summary>{t('schemes.guidance.directory')}</summary>
          <GuidanceRecord record={record} />
        </details>
      ))}

      {scheme.researchDetails?.length > 0 && (
        <details className="content-card guidance-disclosure">
          <summary>{t('schemes.guidance.additionalResearch')} ({researchDetails.length})</summary>
          {researchDetails.map(({ question, localizedQuestion, answer }) => (
            <div className="guidance-fact" key={question}><strong>{localizedQuestion || question}</strong><p>{answer}</p></div>
          ))}
        </details>
      )}

      {(localized.legacyRecords || scheme.legacyRecords || []).length > 0 && (
        <details className="content-card guidance-disclosure">
          <summary>{legacyLabels['Name of the insurance'] || t('schemes.guidance.legacy')}</summary>
          <p>{t('common.notVerified')}</p>
          {(localized.legacyRecords || scheme.legacyRecords).map((record, index) => (
            <GuidanceRecord key={`legacy-${index}`} record={record} labels={legacyLabels} />
          ))}
        </details>
      )}

      {(localized.researchAudits || scheme.researchAudits || []).map((record, index) => (
        <details className="content-card guidance-disclosure" key={`audit-${index}`}>
          <summary>{auditLabels['Programme'] || t('schemes.guidance.researchAudit')}</summary>
          <GuidanceRecord record={record} labels={auditLabels} />
        </details>
      ))}

      {scheme.relatedOrganizations?.map((record, index) => (
        <details className="content-card guidance-disclosure" key={`organization-${index}`}>
          <summary>{t('schemes.guidance.directory')}: {record['Organisation Name']}</summary>
          <GuidanceRecord record={record} />
        </details>
      ))}
    </div>
  );
}

export function DocumentsPage() {
  const { data, updateData } = usePlatform();
  const { language } = useLanguage();
  const t = (key, values) => translate(language, key, values);
  const [selectedTarget, setSelectedTarget] = useState(`scheme:${schemeGuidance[0]?.id || ''}`);
  const [schemeDetail, setSchemeDetail] = useState(null);
  const [detailError, setDetailError] = useState('');
  const targets = [
    ...schemeGuidance.map((scheme) => ({
      id: `scheme:${scheme.id}`,
      name: scheme.translations?.[language]?.name || scheme.name,
      type: 'scheme',
      schemeId: scheme.id
    })),
    ...workbookNgos.map((ngo) => ({
      id: `ngo:${String(ngo.organization_name).toLocaleLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
      name: ngo.organization_name,
      type: 'ngo',
      ngo
    }))
  ];
  const selected = targets.find((target) => target.id === selectedTarget) || targets[0];
  const checked = data.documentProgress?.[selectedTarget] || [];

  useEffect(() => {
    if (!selected || selected.type !== 'scheme') {
      setSchemeDetail(null);
      setDetailError('');
      return undefined;
    }
    let active = true;
    setSchemeDetail(null);
    setDetailError('');
    loadSchemeGuidance(selected.schemeId)
      .then((detail) => { if (active) setSchemeDetail(detail); })
      .catch((error) => { if (active) setDetailError(error.message || t('common.error')); });
    return () => { active = false; };
  }, [selectedTarget]);

  const localized = schemeDetail?.translations?.[language] || {};
  const summary = localized.journeySummary?.[0] || schemeDetail?.journeySummary?.[0] || {};
  const englishSummary = schemeDetail?.journeySummary?.[0] || {};
  const governmentRecord = schemeDetail?.governmentRecords?.[0] || {};
  const documentText = summary['Documents to Prepare'] || governmentRecord['Documents Commonly Required'] || '';
  const englishDocumentText = englishSummary['Documents to Prepare'] || governmentRecord['Documents Commonly Required'] || '';
  const documentRows = selected?.type === 'scheme'
    ? getDocumentChecklistForScheme(selected.schemeId, language)
    : [];
  const englishRequirementItems = englishDocumentText.split(/[;\n]+/)
    .map((item) => item.replace(/^\s*[-•*]\s*/, '').trim());
  const parsedRequirements = selected?.type === 'scheme' && !['aas', 'ics-parent'].includes(selected.schemeId)
    ? documentText.split(/[;\n]+/)
      .map((item) => item.replace(/^\s*[-•*]\s*/, '').trim())
      .map((name, index) => ({
        name,
        key: englishRequirementItems[index] || name,
        sourceText: englishRequirementItems[index] || name
      }))
      .filter((item) => item.name && !/\b(confirm|ask (?:the )?programme|do not|don't)\b/i.test(item.sourceText))
    : [];
  const checklistItems = [
    ...parsedRequirements.map(({ name, key }) => ({ name, key, reason: '', provider: '' })),
    ...documentRows.map((row) => ({
      name: row['Document / Information'],
      key: row.english['Document / Information'] || row['Document / Information'],
      reason: row['Why It May Be Needed'] || '',
      provider: row['Who Issues / Provides It'] || ''
    }))
  ].filter((item, index, list) => list.findIndex((entry) => entry.key === item.key) === index);
  const checkedCount = checklistItems.filter((item) => checked.includes(item.key)).length;
  const toggle = (item) => {
    const next = checked.includes(item) ? checked.filter((entry) => entry !== item) : [...checked, item];
    updateData({ documentProgress: { ...(data.documentProgress || {}), [selectedTarget]: next } });
  };

  return (
    <div className="page-content">
      <PageHeading eyebrow={t('docs.eyebrow')} title={t('page.documents')} description={t('docs.description')} />

      {targets.length > 0 && (
        <div style={{ marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <label htmlFor="documents-target-select" style={{ fontWeight: 'bold', fontSize: '13px' }}>{t('docs.selectScheme')}</label>
          <select
            id="documents-target-select"
            value={selectedTarget}
            onChange={(e) => setSelectedTarget(e.target.value)}
            style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid #ccc', fontSize: '13px', background: '#fff' }}
          >
            <optgroup label={t('directory.schemes')}>
              {targets.filter((target) => target.type === 'scheme').map((target) => (
                <option key={target.id} value={target.id}>{target.name}</option>
              ))}
            </optgroup>
            <optgroup label={t('directory.ngos')}>
              {targets.filter((target) => target.type === 'ngo').map((target) => (
                <option key={target.id} value={target.id}>{target.name}</option>
              ))}
            </optgroup>
          </select>
        </div>
      )}

      <div className="content-card checklist-card">
        <div className="checklist-heading">
          <span className="support-icon-small"><FileText size={19} /></span>
          <div>
            <h2>{selected?.name || t('docs.checklistTitle')}</h2>
            <p>
              {t('documents.checkedCount', { checked: checkedCount, total: checklistItems.length })}
            </p>
          </div>
        </div>

        {selected?.type === 'scheme' ? (
          <>
            {schemeDetail ? (
              <>
                {documentText && (
                  <div className="guidance-fact">
                    <strong>{t(['aas', 'ics-parent'].includes(selected.schemeId) ? 'documents.otherGuidance' : 'documents.schemeRequirements')}</strong>
                    <p style={{ whiteSpace: 'pre-line' }}>{documentText}</p>
                  </div>
                )}
                {checklistItems.length > 0 ? (
                  <div className="document-list">
                    {checklistItems.map((item) => {
                      const isChecked = checked.includes(item.key);
                      return (
                        <div className="document-row" key={item.key}>
                          <label style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                            <input type="checkbox" checked={isChecked} onChange={() => toggle(item.key)} />
                            <span><strong>{item.name}</strong>{item.reason && <small style={{ display: 'block', color: '#666' }}>{item.reason}</small>}</span>
                          </label>
                          {item.provider && <small className="muted-copy">{t('documents.issuedBy')} {item.provider}</small>}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="muted-copy">{documentText || t('documents.noSchemeDocuments')}</p>
                )}
              </>
            ) : detailError ? <p className="form-error" role="alert">{detailError}</p> : <p role="status">{t('docs.checking')}</p>}
          </>
        ) : selected?.type === 'ngo' ? (
          <>
            <p className="guidance-fact"><strong>{t('documents.ngoRequirements')}</strong><br />{t('documents.ngoRequirementsNote')}</p>
            {selected.ngo.eligibility && <div className="guidance-fact"><strong>{t('ngo.eligibility')}</strong><p>{selected.ngo.eligibility}</p></div>}
            {selected.ngo.application_route && <div className="guidance-fact"><strong>{t('ngo.applicationRoute')}</strong><p>{selected.ngo.application_route}</p></div>}
            {selected.ngo.contact_phone && <p><strong>{t('ngo.phone')}</strong> {selected.ngo.contact_phone}</p>}
            {selected.ngo.contact_email && <p><strong>{t('ngo.email')}</strong> {selected.ngo.contact_email}</p>}
          </>
        ) : null}
        <p className="muted-copy">{t('docs.noUpload')}</p>
      </div>
    </div>
  );
}

export function TrackerPage() {
  const { data, updateData } = usePlatform();
  const { language } = useLanguage();
  const t = (key, values) => translate(language, key, values);
  const availableItems = [
    ...schemeGuidance.map((scheme) => ({
      id: `scheme:${scheme.id}`,
      type: 'scheme',
      schemeId: scheme.id,
      name: scheme.translations?.[language]?.name || scheme.name,
      source: scheme
    })),
    ...workbookNgos.map((ngo) => ({
      id: `ngo:${String(ngo.organization_name).toLocaleLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
      type: 'ngo',
      name: ngo.organization_name,
      source: ngo
    }))
  ];
  const trackedProgrammeIds = data.trackedProgrammeIds || [];
  const trackedItems = trackedProgrammeIds
    .map((id) => availableItems.find((item) => item.id === id))
    .filter(Boolean);
  const [selectedItemId, setSelectedItemId] = useState(trackedProgrammeIds[0] || '');
  const [programmeToAdd, setProgrammeToAdd] = useState('');
  const selectedItem = trackedItems.find((item) => item.id === selectedItemId) || null;
  const [journey, setJourney] = useState(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    if (!selectedItem || selectedItem.type !== 'scheme') {
      setJourney(null);
      setLoading(false);
      return undefined;
    }
    let active = true;
    setLoading(true);
    setLoadError('');
    loadSchemeGuidance(selectedItem.schemeId)
      .then((record) => {
        if (active) setJourney(record);
      })
      .catch((error) => {
        if (!active) return;
        setJourney(null);
        setLoadError(error instanceof Error ? error.message : 'Could not load this programme journey.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [selectedItemId, selectedItem?.type]);

  const localized = journey?.translations?.[language] || {};
  const summary = localized.journeySummary?.[0] || journey?.journeySummary?.[0] || {};
  const summaryLabels = localized.labels?.summary || {};
  const stepLabels = localized.labels?.applicationSteps || {};
  const steps = localized.applicationSteps || journey?.applicationSteps || [];
  const progressKey = selectedItem?.schemeId || selectedItemId;
  const completedSteps = new Set(data.schemeProgress?.[progressKey] || []);
  const currentStatus = data.schemeApplicationStatus?.[selectedItemId] || 'not_started';
  const selectedNgo = selectedItem?.type === 'ngo' ? selectedItem.source : null;
  const trackedSet = new Set(trackedProgrammeIds);

  const addTrackedProgramme = () => {
      if (!programmeToAdd) return;
      const next = [...new Set([...trackedProgrammeIds, programmeToAdd])];
      updateData({ trackedProgrammeIds: next });
      setSelectedItemId(programmeToAdd);
      setProgrammeToAdd('');
  };

  const removeTrackedProgramme = (programmeId) => {
      updateData({ trackedProgrammeIds: trackedProgrammeIds.filter((id) => id !== programmeId) });
      if (selectedItemId === programmeId) {
        setSelectedItemId(trackedProgrammeIds.find((id) => id !== programmeId) || '');
      }
  };

  const toggleStep = (stepNumber, checked) => {
      if (!progressKey || !selectedItem || selectedItem.type !== 'scheme') return;
      const current = data.schemeProgress?.[progressKey] || [];
      const next = checked
        ? [...new Set([...current, stepNumber])]
        : current.filter((value) => value !== stepNumber);
      updateData({ schemeProgress: { ...(data.schemeProgress || {}), [progressKey]: next } });
  };

  return (
    <div className="page-content application-tracker-page">
      <PageHeading
        eyebrow={guidanceText(language, 'trackerEyebrow')}
        title={guidanceText(language, 'trackerTitle')}
        description={guidanceText(language, 'trackerDescription')}
      />

      <section className="content-card" style={{ marginBottom: '20px', padding: '16px' }}>
        <label htmlFor="tracker-add-select" style={{ fontWeight: 'bold', fontSize: '13px', display: 'block', marginBottom: '8px' }}>
          {t('tracker.addFromCatalogue')}
        </label>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
          <select
            id="tracker-add-select"
            value={programmeToAdd}
            onChange={(event) => setProgrammeToAdd(event.target.value)}
            style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid #ccc', fontSize: '13px', background: '#fff' }}
          >
            <option value="">{t('tracker.chooseProgramme')}</option>
            <optgroup label={t('directory.schemes')}>
              {availableItems.filter((item) => item.type === 'scheme').map((item) => (
                <option key={item.id} value={item.id} disabled={trackedSet.has(item.id)}>{item.name}</option>
              ))}
            </optgroup>
            <optgroup label={t('directory.ngos')}>
              {availableItems.filter((item) => item.type === 'ngo').map((item) => (
                <option key={item.id} value={item.id} disabled={trackedSet.has(item.id)}>{item.name}</option>
              ))}
            </optgroup>
          </select>
          <button type="button" className="button button-primary" disabled={!programmeToAdd} onClick={addTrackedProgramme}>
            {t('tracker.addProgramme')}
          </button>
        </div>
        {trackedItems.length > 0 && (
          <div className="tracker-programme-tabs" style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '14px' }}>
            {trackedItems.map((item) => (
              <button
                type="button"
                key={item.id}
                className={`button ${selectedItemId === item.id ? 'button-primary' : 'button-outline'}`}
                onClick={() => setSelectedItemId(item.id)}
              >
                {item.name}
              </button>
            ))}
          </div>
        )}
      </section>

      {loading && <p role="status">{guidanceText(language, 'loading')}</p>}
      {loadError && <p className="form-error" role="alert">{loadError}</p>}

      {selectedItem ? (
        <section className="content-card tracker-card">
          <div className="tracker-title">
            <span className="support-icon-small"><ClipboardCheck size={19} /></span>
            <div>
              <h2>{summary.Programme || selectedItem.name}</h2>
              <p>{guidanceText(language, 'localProgress')}</p>
            </div>
            <button type="button" className="button button-outline" onClick={() => removeTrackedProgramme(selectedItem.id)}>
              {t('tracker.removeProgramme')}
            </button>
          </div>

          <label className="guidance-fact" style={{ display: 'block' }}>
            <strong>{t('tracker.applicationStatus')}</strong>
            <select
              value={currentStatus}
              onChange={(event) => updateData({
                schemeApplicationStatus: {
                  ...(data.schemeApplicationStatus || {}),
                  [selectedItem.id]: event.target.value
                }
              })}
              style={{ display: 'block', marginTop: '8px', padding: '8px 12px', borderRadius: '8px', border: '1px solid #ccc' }}
            >
              {['not_started', 'preparing', 'applied', 'under_review', 'needs_information', 'approved', 'declined', 'completed'].map((status) => (
                <option key={status} value={status}>{t(`tracker.status.${status}`)}</option>
              ))}
            </select>
          </label>

          {summary['Important Caveat'] && (
            <div className="guidance-snapshot-notice tracker-source-note">
              <strong>{guidanceText(language, 'sourceSnapshot')} · {schemeGuidanceSnapshot}</strong>
              <p>{guidanceText(language, 'sourceNotice')}</p>
              <p>{summary['Important Caveat']}</p>
            </div>
          )}

          {journey && (
            <details className="content-card tracker-programme-details" open>
              <summary>{guidanceText(language, 'programmeDetails')}</summary>
              {summary['Who May Apply / Eligibility Snapshot'] && (
                <div className="guidance-fact">
                  <strong>{summaryLabels['Who May Apply / Eligibility Snapshot'] || guidanceText(language, 'eligibility')}</strong>
                  <p>{summary['Who May Apply / Eligibility Snapshot']}</p>
                </div>
              )}
              {summary['Documents to Prepare'] && (
                <div className="guidance-fact">
                  <strong>{summaryLabels['Documents to Prepare'] || guidanceText(language, 'documents')}</strong>
                  <p>{summary['Documents to Prepare']}</p>
                </div>
              )}
              {summary['Contact / Submission Point'] && (
                <div className="guidance-fact">
                  <strong>{summaryLabels['Contact / Submission Point'] || guidanceText(language, 'whereToApply')}</strong>
                  <p>{summary['Contact / Submission Point']}</p>
                </div>
              )}
              {summary['Official Links / Forms'] && (
                <div className="guidance-fact">
                  <strong>{summaryLabels['Official Links / Forms'] || guidanceText(language, 'officialLinks')}</strong>
                  <p>{summary['Official Links / Forms']}</p>
                </div>
              )}
            </details>
          )}

          {selectedNgo && (
            <div className="guidance-fact">
              {selectedNgo.eligibility && <p><strong>{t('ngo.eligibility')}:</strong> {selectedNgo.eligibility}</p>}
              {selectedNgo.application_route && <p><strong>{t('ngo.applicationRoute')}:</strong> {selectedNgo.application_route}</p>}
              {selectedNgo.contact_phone && <p><strong>{t('ngo.phone')}</strong> {selectedNgo.contact_phone}</p>}
              {selectedNgo.contact_email && <p><strong>{t('ngo.email')}</strong> {selectedNgo.contact_email}</p>}
              <p>{t('tracker.ngoProgressNote')}</p>
            </div>
          )}

          {steps.length > 0 ? (
            <div className="tracker-full-steps">
              <div className="tracker-progress-heading">
                <strong>{guidanceText(language, 'progress', { done: completedSteps.size, total: steps.length })}</strong>
              </div>
              {steps.map((step) => {
                const stepNumber = Number(step['Step No.']);
                const completed = completedSteps.has(stepNumber);
                return (
                  <article className={`content-card tracker-guidance-step${completed ? ' completed' : ''}`} key={`${selectedItem.id}-${stepNumber}`}>
                    <div className="tracker-guidance-heading">
                      <span className="tracker-step">{stepNumber}</span>
                      <h3>{step['Step / Action']}</h3>
                      <label className="tracker-guidance-check">
                        <input type="checkbox" checked={completed} onChange={(event) => toggleStep(stepNumber, event.target.checked)} />
                        <span>{completed ? guidanceText(language, 'done') : guidanceText(language, 'notStarted')}</span>
                      </label>
                    </div>
                    {step['Who Does It'] && <p><strong>{stepLabels['Who Does It'] || guidanceText(language, 'responsible')}:</strong> {step['Who Does It']}</p>}
                    {step['What to Do'] && <p><strong>{stepLabels['What to Do'] || guidanceText(language, 'action')}:</strong> {step['What to Do']}</p>}
                    {step['Evidence / Output to Keep'] && <p><strong>{stepLabels['Evidence / Output to Keep'] || guidanceText(language, 'output')}:</strong> {step['Evidence / Output to Keep']}</p>}
                    {step['If This Step Gets Stuck'] && (
                      <p className="guidance-stuck"><strong>{stepLabels['If This Step Gets Stuck'] || guidanceText(language, 'stuck')}:</strong> {step['If This Step Gets Stuck']}</p>
                    )}
                  </article>
                );
              })}
            </div>
          ) : selectedItem.type === 'scheme' && !loading ? (
            <p>{guidanceText(language, 'noSteps')}</p>
          ) : null}
        </section>
      ) : (
        <section className="content-card tracker-card">
          <h2>{t('tracker.emptyTitle')}</h2>
          <p>{t('tracker.emptyDescription')}</p>
        </section>
      )}
    </div>
  );
}

export function AdminPage() {
  const { user } = usePlatform();
  const { language } = useLanguage();
  const t = (key, values) => translate(language, key, values);
  const statusLabel = (status) => {
    const labels = {
      draft: 'admin.statusDraft',
      under_review: 'admin.statusReview',
      verified: 'admin.statusVerified',
      approved: 'admin.statusApproved',
      pending: 'admin.statusPending',
      unverified: 'admin.statusUnverified'
    };
    return t(labels[status] || 'admin.statusUnknown');
  };
  const [schemes, setSchemes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [actionStatus, setActionStatus] = useState('');
  const [actionError, setActionError] = useState('');

  // Selected scheme for evidence, claims & publication
  const [selectedSchemeId, setSelectedSchemeId] = useState('');
  const [adminDetail, setAdminDetail] = useState(null);
  const [sources, setSources] = useState([]);
  const [claims, setClaims] = useState([]);
  const [syncStatus, setSyncStatus] = useState(null);

  // Modal / Form states
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);

  // Create Scheme Form State
  const [createCode, setCreateCode] = useState('');
  const [createName, setCreateName] = useState('');
  const [createType, setCreateType] = useState('Central Government Scheme');
  const [createOrgName, setCreateOrgName] = useState('Ministry of Health and Family Welfare');
  const [createOrgType, setCreateOrgType] = useState('Ministry');
  const [createDesc, setCreateDesc] = useState('');

  // Edit Scheme Form State
  const [editName, setEditName] = useState('');
  const [editType, setEditType] = useState('');
  const [editDesc, setEditDesc] = useState('');

  // Evidence Form State
  const [evidenceUrl, setEvidenceUrl] = useState('');
  const [evidenceTitle, setEvidenceTitle] = useState('');
  const [evidenceBody, setEvidenceBody] = useState('Ministry of Health and Family Welfare');
  const [evidencePage, setEvidencePage] = useState('Official Gazette / Portal Section 1');

  // Claim Form State
  const [claimSourceId, setClaimSourceId] = useState('');
  const [claimFieldPath, setClaimFieldPath] = useState('coverage.cancer_treatment');
  const [claimText, setClaimText] = useState('');
  const [claimLocator, setClaimLocator] = useState('Clause 1.0');
  const [claimIsCritical, setClaimIsCritical] = useState(true);

  // Strictly check Supabase role == 'admin' from verified JWT
  const isAdminUser = Boolean(user && user.app_metadata?.role === 'admin');

  // Clean up any legacy dev tokens from localStorage
  useEffect(() => {
    try {
      localStorage.removeItem('neravu.admin_token');
    } catch {}
  }, []);

  const loadAdminSchemes = async () => {
    if (!isAdminUser) return;
    setLoading(true);
    setActionError('');
    try {
      const res = await fetchAdminSchemes(100, 0);
      const list = res.schemes || [];
      setSchemes(list);
      if (list.length > 0) {
        setSelectedSchemeId((prev) => (prev && list.some((s) => s.id === prev) ? prev : list[0].id));
      }
    } catch (err) {
      setActionError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const loadSelectedSchemeData = async (schemeId) => {
    if (!schemeId || !isAdminUser) return;
    try {
      const [detailRes, sourcesRes, claimsRes, syncRes] = await Promise.all([
        fetchAdminScheme(schemeId).catch(() => null),
        fetchAdminSources(schemeId).catch(() => ({ sources: [] })),
        fetchAdminClaims(schemeId).catch(() => ({ claims: [] })),
        fetchAdminSyncStatus(schemeId).catch(() => null),
      ]);
      if (detailRes) {
        setAdminDetail(detailRes);
        setEditName(detailRes.official_name || '');
        setEditType(detailRes.programme_type || '');
        setEditDesc(detailRes.description || '');
      }
      const fetchedSources = sourcesRes?.sources || [];
      setSources(fetchedSources);
      if (fetchedSources.length > 0 && !claimSourceId) {
        setClaimSourceId(fetchedSources[0].id);
      }
      setClaims(claimsRes?.claims || []);
      setSyncStatus(syncRes);
    } catch (err) {
      console.error('Failed to load scheme details:', err);
    }
  };

  useEffect(() => {
    if (isAdminUser) {
      loadAdminSchemes();
    }
  }, [isAdminUser]);

  useEffect(() => {
    if (selectedSchemeId && isAdminUser) {
      loadSelectedSchemeData(selectedSchemeId);
    }
  }, [selectedSchemeId, isAdminUser]);

  // CREATE SCHEME
  const handleCreateScheme = async (e) => {
    e.preventDefault();
    if (!createCode.trim() || !createName.trim() || !createOrgName.trim()) return;
    setActionStatus('');
    setActionError('');
    try {
      const newScheme = await createAdminScheme({
        programme_code: createCode.trim().toUpperCase(),
        official_name: createName.trim(),
        programme_type: createType.trim() || 'Health Scheme',
        description: createDesc.trim() || 'Government health scheme assistance',
        organization: {
          name: createOrgName.trim(),
          organization_type: createOrgType.trim() || 'Government Agency',
          official_website: 'https://india.gov.in',
        },
        coverage: { summary: createDesc.trim() || 'Full healthcare benefit' },
        details: { verified: false },
      });
      setActionStatus(t('admin.createSuccess', { name: newScheme.official_name }));
      setShowCreateModal(false);
      setCreateCode('');
      setCreateName('');
      setCreateDesc('');
      await loadAdminSchemes();
      setSelectedSchemeId(newScheme.id);
    } catch (err) {
      setActionError(t('admin.errorPrefix', { action: t('admin.createNewScheme'), error: err.message }));
    }
  };

  // UPDATE SCHEME
  const handleUpdateScheme = async (e) => {
    e.preventDefault();
    if (!selectedSchemeId || !editName.trim()) return;
    setActionStatus('');
    setActionError('');
    try {
      const updated = await updateAdminScheme(selectedSchemeId, {
        official_name: editName.trim(),
        programme_type: editType.trim(),
        description: editDesc.trim(),
      });
      setActionStatus(t('admin.updateSuccess', { name: updated.official_name }));
      setShowEditModal(false);
      await loadAdminSchemes();
      await loadSelectedSchemeData(selectedSchemeId);
    } catch (err) {
      setActionError(t('admin.errorPrefix', { action: t('admin.saveChanges'), error: err.message }));
    }
  };

  // DELETE SCHEME
  const handleDeleteScheme = async (schemeId, schemeName) => {
    if (!window.confirm(t('admin.deleteSchemeConfirm', { name: schemeName || t('admin.thisScheme') }))) return;
    setActionStatus('');
    setActionError('');
    try {
      await deleteAdminScheme(schemeId);
      setActionStatus(t('admin.schemeDeleted'));
      if (selectedSchemeId === schemeId) {
        setSelectedSchemeId('');
        setAdminDetail(null);
      }
      setSchemes((prev) => prev.filter((s) => s.id !== schemeId));
      await loadAdminSchemes();
    } catch (err) {
      setActionError(t('admin.errorPrefix', { action: t('admin.deleteScheme'), error: err.message }));
    }
  };

  // ADD EVIDENCE SOURCE
  const handleAddEvidence = async (e) => {
    e.preventDefault();
    if (!selectedSchemeId || !evidenceUrl.trim() || !evidenceTitle.trim()) return;
    setActionStatus('');
    setActionError('');
    try {
      await addEvidence(selectedSchemeId, {
        source_url: evidenceUrl.trim(),
        source_title: evidenceTitle.trim(),
        issuing_body: evidenceBody.trim() || 'Ministry of Health and Family Welfare',
        page_reference: evidencePage.trim() || 'Official Gazette / Portal Section 1',
        effective_date: new Date().toISOString().split('T')[0],
      });
      setActionStatus(t('admin.sourceAttached'));
      setEvidenceUrl('');
      setEvidenceTitle('');
      await loadSelectedSchemeData(selectedSchemeId);
    } catch (err) {
      setActionError(t('admin.errorPrefix', { action: t('admin.attachEvidence'), error: err.message }));
    }
  };

  // APPROVE SOURCE
  const handleApproveSource = async (sourceId) => {
    setActionStatus('');
    setActionError('');
    try {
      await reviewAdminSource(selectedSchemeId, sourceId, 'approved', 'Verified official documentation', '2028-12-31');
      setActionStatus(t('admin.sourceApproved'));
      await loadSelectedSchemeData(selectedSchemeId);
    } catch (err) {
      setActionError(t('admin.errorPrefix', { action: t('admin.approveSource'), error: err.message }));
    }
  };

  // DELETE SOURCE
  const handleDeleteSource = async (sourceId) => {
    if (!window.confirm(t('admin.deleteSourceConfirm'))) return;
    setActionStatus('');
    setActionError('');
    try {
      await deleteAdminSource(selectedSchemeId, sourceId);
      setActionStatus(t('admin.sourceDeleted'));
      await loadSelectedSchemeData(selectedSchemeId);
    } catch (err) {
      setActionError(t('admin.errorPrefix', { action: t('admin.deleteSource'), error: err.message }));
    }
  };

  // ADD CLAIM
  const handleAddClaim = async (e) => {
    e.preventDefault();
    if (!selectedSchemeId || !claimSourceId || !claimText.trim()) return;
    setActionStatus('');
    setActionError('');
    try {
      await createAdminClaim(selectedSchemeId, {
        source_id: claimSourceId,
        field_path: claimFieldPath.trim() || 'coverage.cancer_treatment',
        claim_text: claimText.trim(),
        source_locator: claimLocator.trim() || 'Clause 1.0',
        is_critical: claimIsCritical,
        structured_value: { statement: claimText.trim() },
      });
      setActionStatus(t('admin.claimAdded'));
      setClaimText('');
      await loadSelectedSchemeData(selectedSchemeId);
    } catch (err) {
      setActionError(t('admin.errorPrefix', { action: t('admin.addClaim'), error: err.message }));
    }
  };

  // APPROVE CLAIM
  const handleApproveClaim = async (claimId) => {
    setActionStatus('');
    setActionError('');
    try {
      await reviewAdminClaim(selectedSchemeId, claimId, 'approved', 'Claim verified against source');
      setActionStatus(t('admin.claimApproved'));
      await loadSelectedSchemeData(selectedSchemeId);
    } catch (err) {
      setActionError(t('admin.errorPrefix', { action: t('admin.approveClaim'), error: err.message }));
    }
  };

  // DELETE CLAIM
  const handleDeleteClaim = async (claimId) => {
    if (!window.confirm(t('admin.deleteClaimConfirm'))) return;
    setActionStatus('');
    setActionError('');
    try {
      await deleteAdminClaim(selectedSchemeId, claimId);
      setActionStatus(t('admin.claimDeleted'));
      await loadSelectedSchemeData(selectedSchemeId);
    } catch (err) {
      setActionError(t('admin.errorPrefix', { action: t('admin.delete'), error: err.message }));
    }
  };

  // PUBLISH & SYNC
  const handlePublish = async (schemeId) => {
    setActionStatus('');
    setActionError('');
    try {
      const res = await publishScheme(schemeId);
      setActionStatus(res.message || t('admin.publishSuccess', { version: res.published_version }));
      await loadAdminSchemes();
      await loadSelectedSchemeData(schemeId);
    } catch (err) {
      setActionError(t('admin.errorPrefix', { action: t('admin.republishSync'), error: err.message }));
    }
  };

  // RETRY SYNC
  const handleRetrySync = async (schemeId) => {
    setActionStatus('');
    setActionError('');
    try {
      await retryAdminSync(schemeId);
      setActionStatus(t('admin.syncQueued'));
      await loadSelectedSchemeData(schemeId);
    } catch (err) {
      setActionError(t('admin.errorPrefix', { action: t('admin.retrySync'), error: err.message }));
    }
  };

  // If user is not authenticated or not an admin, strictly lock down the page
  if (!isAdminUser) {
    return (
      <div className="page-content">
        <PageHeading
          eyebrow={t('admin.restrictedEyebrow')}
          title={t('admin.authTitle')}
          description={t('admin.authDescription')}
        />
        <div className="content-card" style={{ maxWidth: '640px', margin: '40px auto', textAlign: 'center', padding: '40px 24px', boxShadow: '0 8px 30px rgba(0,0,0,0.06)' }}>
          <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: '#ffebee', color: '#c62828', display: 'grid', placeItems: 'center', margin: '0 auto 20px' }}>
            <LockKeyhole size={32} />
          </div>
          <h2 style={{ fontSize: '22px', margin: '0 0 12px 0', color: '#1a1a1a' }}>{t('admin.forbidden')}</h2>
          <p style={{ color: '#555', fontSize: '14px', lineHeight: '1.6', margin: '0 0 24px 0' }}>
            {user ? (
              <>
                {t('admin.signedInAs', { email: user.email, role: user.app_metadata?.role || t('common.none') })}
              </>
            ) : (
              t('admin.notSignedIn')
            )}
          </p>

          <div style={{ background: '#f5f0fa', border: '1px solid #e5d7f2', padding: '16px 20px', borderRadius: '12px', fontSize: '12px', color: '#444', textAlign: 'left', marginBottom: '28px' }}>
            <strong style={{ color: '#4a2574', display: 'block', marginBottom: '8px', fontSize: '13px' }}>
              {t('admin.createAdminsTitle')}
            </strong>
            <p style={{ margin: '0 0 8px 0', lineHeight: '1.5' }}>
              {t('admin.createAdminsIntro')}
            </p>
            <ol style={{ margin: 0, paddingLeft: '20px', lineHeight: '1.6' }}>
              <li>{t('admin.adminStep1')}</li>
              <li>{t('admin.adminStep2')}</li>
              <li>{t('admin.adminStep3', { email: user ? user.email : 'admin@domain.com' })}</li>
              <li>{t('admin.adminStep4')} <code style={{ background: '#fff', padding: '2px 6px', borderRadius: '4px', border: '1px solid #ddd' }}>{`{"role": "admin"}`}</code>.</li>
              <li>{t('admin.adminStep5')}</li>
            </ol>
          </div>

          <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
            <Link to="/dashboard" className="button button-primary">
              {t('admin.returnDashboard')} <ArrowRight size={16} />
            </Link>
            {!user && (
              <Link to="/login?next=%2Fadmin" className="button button-outline">
                {t('admin.signIn')} <ArrowRight size={16} />
              </Link>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page-content">
      <PageHeading
        eyebrow={t('admin.pageEyebrow')}
        title={t('admin.pageTitle')}
        description={t('admin.pageDescription')}
      />

      {/* Security Status Banner for Authorized Admin */}
      <section className="content-card" style={{ marginBottom: '20px', borderLeft: '4px solid #2e7d32' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <ShieldCheck size={20} color="#2e7d32" />
              <strong style={{ fontSize: '15px', color: '#1b5e20' }}>
                {t('admin.privilegesActive')}
              </strong>
            </div>
            <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: '#666' }}>
              {t('admin.authenticatedUser')} <strong>{user?.email}</strong> · {t('admin.appMetadata')} <code style={{ color: '#2e7d32' }}>role="admin"</code>
            </p>
          </div>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              type="button"
              className="button button-primary"
              onClick={() => setShowCreateModal((prev) => !prev)}
              style={{ minHeight: '34px', fontSize: '12px' }}
            >
              <Plus size={14} /> {showCreateModal ? t('admin.cancelCreate') : t('admin.createNewScheme')}
            </button>
            <button
              type="button"
              className="button button-outline"
              onClick={loadAdminSchemes}
              disabled={loading}
              style={{ minHeight: '34px', fontSize: '12px' }}
            >
              <RefreshCw size={14} /> {t('admin.refresh')}
            </button>
          </div>
        </div>
      </section>

      {actionStatus && (
        <div style={{ background: '#e8f5e9', color: '#2e7d32', padding: '12px 16px', borderRadius: '8px', marginBottom: '16px', fontWeight: 'bold' }}>
          {actionStatus}
        </div>
      )}
      {actionError && (
        <div style={{ background: '#ffebee', color: '#c62828', padding: '12px 16px', borderRadius: '8px', marginBottom: '16px', fontWeight: 'bold' }}>
          {actionError}
        </div>
      )}

      {/* CREATE NEW SCHEME FORM MODAL */}
      {showCreateModal && (
        <section className="content-card" style={{ marginBottom: '24px', border: '2px solid #683693' }}>
          <span className="eyebrow">{t('admin.createSchemeEyebrow')}</span>
          <h3 style={{ margin: '6px 0 16px 0' }}>{t('admin.addScheme')}</h3>
          <form onSubmit={handleCreateScheme}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
              <label style={{ fontSize: '12px', fontWeight: 'bold' }}>
                {t('admin.programmeCode')}
                <input
                  type="text"
                  required
                  placeholder={t('admin.programmeCodePlaceholder')}
                  value={createCode}
                  onChange={(e) => setCreateCode(e.target.value)}
                  style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #ccc', marginTop: '4px' }}
                />
              </label>
              <label style={{ fontSize: '12px', fontWeight: 'bold' }}>
                {t('admin.officialNameRequired')}
                <input
                  type="text"
                  required
                  placeholder={t('admin.officialNamePlaceholder')}
                  value={createName}
                  onChange={(e) => setCreateName(e.target.value)}
                  style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #ccc', marginTop: '4px' }}
                />
              </label>
              <label style={{ fontSize: '12px', fontWeight: 'bold' }}>
                {t('admin.programmeType')}
                <input
                  type="text"
                  value={createType}
                  onChange={(e) => setCreateType(e.target.value)}
                  style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #ccc', marginTop: '4px' }}
                />
              </label>
              <label style={{ fontSize: '12px', fontWeight: 'bold' }}>
                {t('admin.organizationName')}
                <input
                  type="text"
                  required
                  value={createOrgName}
                  onChange={(e) => setCreateOrgName(e.target.value)}
                  style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #ccc', marginTop: '4px' }}
                />
              </label>
            </div>
            <label style={{ fontSize: '12px', fontWeight: 'bold', display: 'block', marginTop: '14px' }}>
              {t('admin.description')}
              <textarea
                rows={3}
                placeholder={t('admin.descriptionPlaceholder')}
                value={createDesc}
                onChange={(e) => setCreateDesc(e.target.value)}
                style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #ccc', marginTop: '4px' }}
              />
            </label>
            <div style={{ display: 'flex', gap: '10px', marginTop: '16px' }}>
              <button type="submit" className="button button-primary">
                <Plus size={14} /> {t('admin.createDraft')}
              </button>
              <button type="button" className="button button-outline" onClick={() => setShowCreateModal(false)}>
                {t('admin.cancel')}
              </button>
            </div>
          </form>
        </section>
      )}

      {/* EDIT SCHEME MODAL */}
      {showEditModal && adminDetail && (
        <section className="content-card" style={{ marginBottom: '24px', border: '2px solid #2e7d32' }}>
          <span className="eyebrow">{t('admin.editSchemeEyebrow')}</span>
          <h3 style={{ margin: '6px 0 16px 0' }}>{t('admin.editScheme', { name: adminDetail.official_name })}</h3>
          <form onSubmit={handleUpdateScheme}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
              <label style={{ fontSize: '12px', fontWeight: 'bold' }}>
                {t('admin.officialName')}
                <input
                  type="text"
                  required
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #ccc', marginTop: '4px' }}
                />
              </label>
              <label style={{ fontSize: '12px', fontWeight: 'bold' }}>
                {t('admin.programmeType')}
                <input
                  type="text"
                  value={editType}
                  onChange={(e) => setEditType(e.target.value)}
                  style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #ccc', marginTop: '4px' }}
                />
              </label>
            </div>
            <label style={{ fontSize: '12px', fontWeight: 'bold', display: 'block', marginTop: '14px' }}>
              {t('admin.description')}
              <textarea
                rows={3}
                value={editDesc}
                onChange={(e) => setEditDesc(e.target.value)}
                style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #ccc', marginTop: '4px' }}
              />
            </label>
            <div style={{ display: 'flex', gap: '10px', marginTop: '16px' }}>
              <button type="submit" className="button button-primary">
                {t('admin.saveChanges')}
              </button>
              <button type="button" className="button button-outline" onClick={() => setShowEditModal(false)}>
                {t('admin.cancel')}
              </button>
            </div>
          </form>
        </section>
      )}

      {/* ALL SCHEMES TABLE (READ) */}
      <section className="content-card" style={{ marginBottom: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '18px' }}>{t('admin.schemeDirectory', { count: schemes.length })}</h2>
            <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: '#666' }}>
              {t('admin.schemeDirectoryDescription')}
            </p>
          </div>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
            <thead>
              <tr style={{ background: '#f5f0fa', textAlign: 'left', borderBottom: '2px solid #e0d5ec' }}>
                <th style={{ padding: '10px' }}>{t('admin.programme')}</th>
                <th style={{ padding: '10px' }}>{t('admin.code')}</th>
                <th style={{ padding: '10px' }}>{t('admin.status')}</th>
                <th style={{ padding: '10px' }}>{t('admin.version')}</th>
                <th style={{ padding: '10px', textAlign: 'right' }}>{t('admin.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {schemes.map((s) => {
                const isSelected = s.id === selectedSchemeId;
                const isVerified = s.review_status === 'verified';
                const isUnderReview = s.review_status === 'under_review';
                return (
                  <tr
                    key={s.id}
                    style={{
                      borderBottom: '1px solid #eee',
                      background: isSelected ? '#fbf8fe' : 'transparent',
                    }}
                  >
                    <td style={{ padding: '10px' }}>
                      <strong style={{ color: isSelected ? '#683693' : '#1a1a1a' }}>
                        {s.official_name || s.name}
                      </strong>
                      <div style={{ fontSize: '11px', color: '#888' }}>{t('admin.id')} {s.id}</div>
                    </td>
                    <td style={{ padding: '10px', fontFamily: 'monospace', fontSize: '11px' }}>
                      {s.programme_code || t('admin.notAvailable')}
                    </td>
                    <td style={{ padding: '10px' }}>
                      <span
                        style={{
                          background: isVerified ? '#e8f5e9' : isUnderReview ? '#e3f2fd' : '#fff3e0',
                          color: isVerified ? '#2e7d32' : isUnderReview ? '#1565c0' : '#e65100',
                          padding: '3px 8px',
                          borderRadius: '4px',
                          fontSize: '10px',
                          fontWeight: 'bold',
                        }}
                      >
                        {statusLabel(s.review_status || 'draft').toUpperCase()}
                      </span>
                    </td>
                    <td style={{ padding: '10px' }}>v{s.version || 1}</td>
                    <td style={{ padding: '10px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                      <button
                        type="button"
                        className="button button-outline"
                        onClick={() => handlePublish(s.id)}
                        style={{ padding: '4px 8px', fontSize: '11px', minHeight: '28px', marginRight: '5px' }}
                        title={t('admin.reindexTitle')}
                      >
                        {t('admin.republishSync')}
                      </button>
                      <button
                        type="button"
                        className="button button-primary"
                        onClick={() => setSelectedSchemeId(s.id)}
                        style={{ padding: '4px 8px', fontSize: '11px', minHeight: '28px', marginRight: '5px' }}
                      >
                        {t('admin.manage')}
                      </button>
                      <button
                        type="button"
                        className="button button-outline"
                        onClick={() => {
                          setSelectedSchemeId(s.id);
                          setShowEditModal(true);
                        }}
                        style={{ padding: '4px 8px', fontSize: '11px', minHeight: '28px', marginRight: '5px' }}
                        title={t('admin.editDetails')}
                      >
                        <Edit size={12} />
                      </button>
                      <button
                        type="button"
                        className="button button-outline"
                        onClick={() => handleDeleteScheme(s.id, s.official_name)}
                        style={{ padding: '4px 8px', fontSize: '11px', minHeight: '28px', color: '#c62828' }}
                        title={t('admin.deleteScheme')}
                      >
                        <Trash2 size={12} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* SELECTED SCHEME WORKSPACE */}
      {selectedSchemeId && adminDetail && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
          {/* Overview & Publication Card */}
          <section className="content-card">
            <span className="eyebrow">{t('admin.workspace')}</span>
            <h3 style={{ margin: '4px 0 8px 0' }}>{adminDetail.official_name}</h3>
            <p style={{ fontSize: '12px', color: '#666', marginBottom: '12px' }}>
              {adminDetail.description || t('admin.noDescription')}
            </p>

            <div style={{ background: '#fafafa', border: '1px solid #eee', borderRadius: '8px', padding: '12px', fontSize: '12px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <div><strong>{t('admin.code')}:</strong> <code>{adminDetail.programme_code}</code></div>
              <div><strong>{t('admin.status')}:</strong> <span style={{ fontWeight: 'bold', color: adminDetail.review_status === 'verified' ? '#2e7d32' : '#e65100' }}>{statusLabel(adminDetail.review_status).toUpperCase()}</span></div>
              <div><strong>{t('admin.version')}:</strong> v{adminDetail.version}</div>
              <div><strong>{t('admin.currentPublished')}</strong> v{syncStatus?.current_published_version || adminDetail.version}</div>
              <div><strong>{t('admin.syncJobs')}</strong> {syncStatus?.jobs?.length || 0} {t('admin.recorded')}</div>
            </div>

            <div style={{ display: 'flex', gap: '8px', marginTop: '16px' }}>
              <button
                type="button"
                className="button button-primary"
                onClick={() => handlePublish(selectedSchemeId)}
                style={{ flex: 1 }}
              >
                {t('admin.republishSyncRag')}
              </button>
              {syncStatus?.jobs?.some((j) => j.status === 'failed') && (
                <button
                  type="button"
                  className="button button-outline"
                  onClick={() => handleRetrySync(selectedSchemeId)}
                  style={{ color: '#c62828' }}
                >
                  {t('admin.retrySync')}
                </button>
              )}
            </div>
          </section>

          {/* Add & Manage Evidence Sources */}
          <section className="content-card">
            <span className="eyebrow">{t('admin.evidenceManagement')}</span>
            <h3 style={{ margin: '4px 0 8px 0' }}>{t('admin.attachEvidenceTitle')}</h3>
            <form onSubmit={handleAddEvidence} style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '8px' }}>
              <label style={{ fontSize: '12px', fontWeight: 'bold' }}>
                {t('admin.documentTitle')}
                <input
                  type="text"
                  required
                  placeholder={t('admin.documentTitlePlaceholder')}
                  value={evidenceTitle}
                  onChange={(e) => setEvidenceTitle(e.target.value)}
                  style={{ width: '100%', padding: '6px 8px', borderRadius: '6px', border: '1px solid #ccc', marginTop: '2px' }}
                />
              </label>
              <label style={{ fontSize: '12px', fontWeight: 'bold' }}>
                {t('admin.officialUrl')}
                <input
                  type="url"
                  required
                  placeholder={t('admin.urlPlaceholder')}
                  value={evidenceUrl}
                  onChange={(e) => setEvidenceUrl(e.target.value)}
                  style={{ width: '100%', padding: '6px 8px', borderRadius: '6px', border: '1px solid #ccc', marginTop: '2px' }}
                />
              </label>
              <label style={{ fontSize: '12px', fontWeight: 'bold' }}>
                {t('admin.issuingBody')}
                <input
                  type="text"
                  value={evidenceBody}
                  onChange={(e) => setEvidenceBody(e.target.value)}
                  style={{ width: '100%', padding: '6px 8px', borderRadius: '6px', border: '1px solid #ccc', marginTop: '2px' }}
                />
              </label>
              <label style={{ fontSize: '12px', fontWeight: 'bold' }}>
                {t('admin.pageReference')}
                <input
                  type="text"
                  value={evidencePage}
                  onChange={(e) => setEvidencePage(e.target.value)}
                  style={{ width: '100%', padding: '6px 8px', borderRadius: '6px', border: '1px solid #ccc', marginTop: '2px' }}
                />
              </label>
              <button type="submit" className="button button-primary" style={{ marginTop: '4px' }}>
                <Plus size={14} /> {t('admin.attachEvidence')}
              </button>
            </form>

            <h4 style={{ margin: '18px 0 8px 0', fontSize: '13px' }}>{t('admin.attachedSources', { count: sources.length })}</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '240px', overflowY: 'auto' }}>
              {sources.map((src) => {
                const isApproved = src.evidence_status === 'approved';
                return (
                  <div key={src.id} style={{ border: '1px solid #eee', padding: '8px 10px', borderRadius: '6px', fontSize: '12px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <strong>{src.source_title}</strong>
                      <span style={{ fontSize: '10px', fontWeight: 'bold', color: isApproved ? '#2e7d32' : '#e65100', background: isApproved ? '#e8f5e9' : '#fff3e0', padding: '2px 6px', borderRadius: '4px' }}>
                        {statusLabel(src.evidence_status || 'unverified').toUpperCase()}
                      </span>
                    </div>
                    <div style={{ color: '#666', fontSize: '11px', marginTop: '2px' }}>{src.issuing_body} ({src.effective_date})</div>
                    {src.source_url && (
                      <a href={src.source_url} target="_blank" rel="noreferrer" style={{ color: '#683693', display: 'inline-flex', alignItems: 'center', gap: '3px', marginTop: '2px' }}>
                        {src.source_url} <ExternalLink size={10} />
                      </a>
                    )}
                    <div style={{ display: 'flex', gap: '6px', marginTop: '6px' }}>
                      {!isApproved && (
                        <button
                          type="button"
                          className="button button-outline"
                          onClick={() => handleApproveSource(src.id)}
                          style={{ padding: '2px 8px', fontSize: '10px', minHeight: '24px', color: '#2e7d32' }}
                        >
                          <CheckCircle size={10} /> {t('admin.approveSource')}
                        </button>
                      )}
                      <button
                        type="button"
                        className="button button-outline"
                        onClick={() => handleDeleteSource(src.id)}
                        style={{ padding: '2px 8px', fontSize: '10px', minHeight: '24px', color: '#c62828' }}
                      >
                        <Trash2 size={10} /> {t('admin.deleteSource')}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Add & Manage Evidence Claims */}
          <section className="content-card">
            <span className="eyebrow">{t('admin.factualClaims')}</span>
            <h3 style={{ margin: '4px 0 8px 0' }}>{t('admin.claimsTitle')}</h3>
            <form onSubmit={handleAddClaim} style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '8px' }}>
              <label style={{ fontSize: '12px', fontWeight: 'bold' }}>
                {t('admin.selectLinkedSource')}
                <select
                  value={claimSourceId}
                  onChange={(e) => setClaimSourceId(e.target.value)}
                  style={{ width: '100%', padding: '6px 8px', borderRadius: '6px', border: '1px solid #ccc', marginTop: '2px' }}
                >
                  <option value="">{t('admin.chooseSource')}</option>
                  {sources.map((s) => (
                    <option key={s.id} value={s.id}>{s.source_title}</option>
                  ))}
                </select>
              </label>
              <label style={{ fontSize: '12px', fontWeight: 'bold' }}>
                {t('admin.fieldPath')}
                <input
                  type="text"
                  value={claimFieldPath}
                  onChange={(e) => setClaimFieldPath(e.target.value)}
                  style={{ width: '100%', padding: '6px 8px', borderRadius: '6px', border: '1px solid #ccc', marginTop: '2px' }}
                />
              </label>
              <label style={{ fontSize: '12px', fontWeight: 'bold' }}>
                {t('admin.claimText')}
                <input
                  type="text"
                  required
                  placeholder={t('admin.claimTextPlaceholder')}
                  value={claimText}
                  onChange={(e) => setClaimText(e.target.value)}
                  style={{ width: '100%', padding: '6px 8px', borderRadius: '6px', border: '1px solid #ccc', marginTop: '2px' }}
                />
              </label>
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                <label style={{ fontSize: '12px', fontWeight: 'bold', flex: 1 }}>
                  {t('admin.sourceLocator')}
                  <input
                    type="text"
                    value={claimLocator}
                    onChange={(e) => setClaimLocator(e.target.value)}
                    style={{ width: '100%', padding: '6px 8px', borderRadius: '6px', border: '1px solid #ccc', marginTop: '2px' }}
                  />
                </label>
                <label style={{ fontSize: '12px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '6px', marginTop: '16px' }}>
                  <input
                    type="checkbox"
                    checked={claimIsCritical}
                    onChange={(e) => setClaimIsCritical(e.target.checked)}
                  />
                  {t('admin.criticalClaim')}
                </label>
              </div>
              <button type="submit" className="button button-primary" style={{ marginTop: '4px' }}>
                <Plus size={14} /> {t('admin.addClaim')}
              </button>
            </form>

            <h4 style={{ margin: '18px 0 8px 0', fontSize: '13px' }}>{t('admin.claimsForScheme', { count: claims.length })}</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '240px', overflowY: 'auto' }}>
              {claims.map((clm) => {
                const isApproved = clm.review_status === 'approved';
                return (
                  <div key={clm.id} style={{ border: '1px solid #eee', padding: '8px 10px', borderRadius: '6px', fontSize: '12px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontFamily: 'monospace', fontSize: '10px', color: '#555' }}>{clm.field_path}</span>
                      <span style={{ fontSize: '10px', fontWeight: 'bold', color: isApproved ? '#2e7d32' : '#e65100', background: isApproved ? '#e8f5e9' : '#fff3e0', padding: '2px 6px', borderRadius: '4px' }}>
                        {statusLabel(clm.review_status || 'pending').toUpperCase()}
                      </span>
                    </div>
                    <div style={{ fontWeight: '500', marginTop: '4px' }}>{clm.claim_text}</div>
                    <div style={{ color: '#888', fontSize: '10px', marginTop: '2px' }}>{t('admin.locator')} {clm.source_locator} {clm.is_critical ? `· ${t('admin.critical')}` : ''}</div>
                    <div style={{ display: 'flex', gap: '6px', marginTop: '6px' }}>
                      {!isApproved && (
                        <button
                          type="button"
                          className="button button-outline"
                          onClick={() => handleApproveClaim(clm.id)}
                          style={{ padding: '2px 8px', fontSize: '10px', minHeight: '24px', color: '#2e7d32' }}
                        >
                          <CheckCircle size={10} /> {t('admin.approveClaim')}
                        </button>
                      )}
                      <button
                        type="button"
                        className="button button-outline"
                        onClick={() => handleDeleteClaim(clm.id)}
                        style={{ padding: '2px 8px', fontSize: '10px', minHeight: '24px', color: '#c62828' }}
                      >
                        <Trash2 size={10} /> {t('admin.delete')}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

export function AssistantPage() {
  const { data, updateData, user } = usePlatform();
  const { language } = useLanguage();
  const t = (key) => translate(language, key);
  const [question, setQuestion] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [retryMessage, setRetryMessage] = useState('');
  const [chatIdentity, setChatIdentity] = useState('');
  const [conversationId, setConversationId] = useState(null);
  const chatEndRef = useRef(null);
  const requestControllerRef = useRef(null);
  const historyRef = useRef(data.chatHistory || []);
  const history = data.chatHistory || [];
  historyRef.current = history;
  const suggestions = ['assistant.suggest1', 'assistant.suggest2', 'assistant.suggest3'].map(t);
  const conversationStorageKey = chatIdentity ? `neravu.chat.conversation.${encodeURIComponent(chatIdentity)}` : '';

  useEffect(() => {
    let active = true;
    requestControllerRef.current?.abort();
    requestControllerRef.current = null;
    setChatIdentity('');
    setConversationId(null);
    historyRef.current = [];
    updateData({ chatHistory: [] });
    getChatIdentity().then((identity) => {
      if (!active) return;
      setChatIdentity(identity);
      try {
        setConversationId(sessionStorage.getItem(`neravu.chat.conversation.${encodeURIComponent(identity)}`));
      } catch {
        setConversationId(null);
      }
    }).catch((caught) => {
      if (active) setError(caught instanceof Error ? caught.message : t('assistant.failed'));
    });
    return () => { active = false; };
  }, [updateData, user?.id]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [history, busy]);

  const sendQuestion = async (text, retry = false) => {
    const normalized = text.trim();
    if (!normalized || busy || !chatIdentity) return;
    setError('');
    const currentHistory = historyRef.current;
    let pending = currentHistory;
    if (!retry) {
      setQuestion('');
      setRetryMessage('');
      pending = [...currentHistory, { id: `${Date.now()}-user`, role: 'user', content: normalized }];
    }
    setBusy(true);
    const assistantId = `${Date.now()}-assistant`;
    pending = [...pending, { id: assistantId, role: 'assistant', content: '', sources: [] }];
    historyRef.current = pending;
    updateData({ chatHistory: pending });
    const controller = new AbortController();
    requestControllerRef.current = controller;
    const timeoutId = window.setTimeout(() => controller.abort(), 90000);
    try {
      const result = await askGuidance({
        question: normalized,
        language,
        conversationId,
        signal: controller.signal,
        onChunk: (chunk) => {
          const nextHistory = historyRef.current.map((message) => message.id === assistantId
            ? { ...message, content: `${message.content}${chunk}` }
            : message);
          historyRef.current = nextHistory;
          updateData({ chatHistory: nextHistory });
        }
      });
      setConversationId(result.conversation_id || null);
      if (conversationStorageKey && result.conversation_id) {
        try { sessionStorage.setItem(conversationStorageKey, result.conversation_id); } catch { setError(t('assistant.sessionStorageWarning')); }
      }
      const completedHistory = historyRef.current.map((message) => message.id === assistantId
        ? { ...message, content: result.answer, sources: result.sources }
        : message);
      historyRef.current = completedHistory;
      updateData({ chatHistory: completedHistory });
      setRetryMessage('');
    } catch (caught) {
      const failureNotice = controller.signal.aborted
        ? t('chat.requestTimeout')
        : (!isRagConfigured ? t('assistant.noBackend') : caught instanceof Error ? caught.message : t('assistant.failed'));
      setError(failureNotice);
      setRetryMessage(normalized);
      const failedHistory = historyRef.current.map((message) => message.id === assistantId
        ? { ...message, content: failureNotice }
        : message);
      historyRef.current = failedHistory;
      updateData({ chatHistory: failedHistory });
    } finally {
      window.clearTimeout(timeoutId);
      if (requestControllerRef.current === controller) requestControllerRef.current = null;
      setBusy(false);
    }
  };
  const send = (event) => {
    event?.preventDefault();
    void sendQuestion(question);
  };
  const clearConversation = () => {
    if (busy) return;
    setError('');
    setRetryMessage('');
    setConversationId(null);
    historyRef.current = [];
    updateData({ chatHistory: [] });
    if (conversationStorageKey) {
      try { sessionStorage.removeItem(conversationStorageKey); } catch { setError(t('assistant.sessionStorageWarning')); }
    }
  };
  return <div className="page-content assistant-page"><PageHeading eyebrow={t('assistant.eyebrow')} title={t('page.assistant')} description={t('assistant.disclaimer')} action={<button className="button button-outline" type="button" onClick={clearConversation} disabled={busy}><Trash2 size={15} /> {t('assistant.newConversation')}</button>} /><DemoNotice>{t('assistant.demoInfo')}</DemoNotice>
    <section className="chat-panel">
      <div className="chat-history" aria-live="polite">
        {!history.length && <div className="chat-welcome"><span className="assistant-avatar"><Sparkles size={20} /></span><h2>{t('chat.pageWelcome')}</h2><p>{t('assistant.suggested')}</p><div className="suggested-questions">{suggestions.map((item) => <button key={item} type="button" onClick={() => setQuestion(item)}>{item}</button>)}</div></div>}
        {history.map((message) => <article className={`chat-message ${message.role}`} key={message.id}><div className="message-label">{message.role === 'user' ? t('assistant.you') : t('assistant.name')}</div><p>{message.content || (busy && message.role === 'assistant' ? t('common.loading') : '')}</p>{message.role === 'assistant' && message.content && <div className="source-list"><strong>{t('assistant.source')} {t('assistant.references')}</strong>{message.sources?.length ? message.sources.map((source, index) => source.url ? <a href={source.url} target="_blank" rel="noreferrer" key={`${source.title}-${index}`}>{source.title}</a> : <span key={`${source.title}-${index}`}>{source.title}</span>) : <span>{t('assistant.noSources')}</span>}</div>}</article>)}
        {busy && <div className="chat-message assistant" role="status">{t('common.loading')}</div>}
        <div ref={chatEndRef} />
      </div>
      <form className="chat-input-row" onSubmit={send}><label className="sr-only" htmlFor="chat-question">{t('assistant.placeholder')}</label><input id="chat-question" value={question} onChange={(event) => setQuestion(event.target.value)} placeholder={t('assistant.placeholder')} disabled={busy || !chatIdentity} /><button className="button button-primary" disabled={busy || !question.trim() || !chatIdentity}>{t('assistant.send')} <ArrowRight size={16} /></button></form>
      {!isRagConfigured && <p className="chat-config-note"><CircleHelp size={15} /> {t('assistant.noBackend')}</p>}
      {error && <p className="form-error chat-error" role="alert">{error}</p>}
      {retryMessage && <button className="button button-outline" type="button" onClick={() => void sendQuestion(retryMessage, true)} disabled={busy}><RotateCcw size={15} /> {t('assistant.retry')}</button>}
    </section>
  </div>;
}


export function ProfilePage() {
  const { data, user, displayName, clearSavedProgress } = usePlatform();
  const { language } = useLanguage();
  const t = (key, values) => translate(language, key, values);
  const navigate = useNavigate();
  const [clearError, setClearError] = useState('');
  const [clearing, setClearing] = useState(false);
  const clearProgress = async () => {
    if (!window.confirm(t('profile.clearConfirm'))) return;
    setClearing(true);
    setClearError('');
    try {
      await clearSavedProgress();
      navigate('/');
    } catch (error) {
      setClearError(error instanceof Error ? error.message : t('profile.clearError'));
    } finally {
      setClearing(false);
    }
  };
  return <div className="page-content"><PageHeading eyebrow={t('profile.eyebrow')} title={t('page.profile')} description={t('profile.description')} /><DemoNotice>{user ? t('profile.accountNotice') : t('profile.guest')}</DemoNotice>
    <section className="content-card profile-card"><span className="profile-avatar"><UserRound size={25} /></span><div><h2>{user ? displayName || user.email : t('profile.guestTitle')}</h2><p>{data.patientRole ? t('profile.relationship', { relationship: translateOption(language, data.patientRole) }) : t('profile.none')}</p><Link to={data.assessmentComplete ? '/assessment/review' : '/assessment/access'} className="text-link">{t('profile.review')} <ArrowRight size={15} /></Link></div></section>
    <section className="content-card privacy-card"><h2>{t('profile.privacyTitle')}</h2><p>{t('profile.privacyText')}</p><button className="button button-danger" disabled={clearing} onClick={clearProgress}>{clearing ? t('common.loading') : t('profile.clear')}</button>{clearError && <p className="form-error" role="alert">{clearError}</p>}</section>
  </div>;
}

export function SettingsPage() {
  const { language } = useLanguage();
  const t = (key) => translate(language, key);
  return <div className="page-content"><PageHeading eyebrow={t('settings.eyebrow')} title={t('page.settings')} description={t('settings.description')} />
    <section className="content-card settings-card"><div className="settings-title"><span className="support-icon-small"><Languages size={19} /></span><div><h2>{t('settings.title')}</h2><p>{t('settings.languageDescription')}</p></div></div><LanguageSelect className="settings-language" />
      <div className="supported-languages"><h3>{t('settings.available')}</h3>{languageOptions.map((option) => <span className="language-tag" key={option.code}>{option.nativeName}<small>{option.name}</small></span>)}</div>
      <DemoNotice>{t('settings.translations')}</DemoNotice>
    </section>
  </div>;
}
