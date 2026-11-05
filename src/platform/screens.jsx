import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, Navigate, useLocation, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft, ArrowRight, BookOpenCheck, Check, CircleHelp, ClipboardCheck, RotateCcw, Trash2,
  FileCheck2, FileText, HeartHandshake, Languages, LockKeyhole, MessageCircle, ShieldCheck, Sparkles,
  Stethoscope, UserRound, Wallet, ExternalLink, AlertCircle, Plus, RefreshCw, Key, Edit, CheckCircle
} from 'lucide-react';
import {
  baseChecklist, demoOrganizations, demoSchemes, languageOptions, questionDefinitions, sectionLabels
} from './data';
import { translate, translateOption, useLanguage } from './i18n';
import { openChatAssistant } from './ChatDrawer';
import { usePlatform } from './PlatformContext';
import {
  fetchDirectoryNgos, fetchDirectoryStates, fetchDirectoryTaxonomies,
  askGuidance, authService, getChatIdentity, isRagConfigured, isSupabaseConfigured, supabaseConfigurationIssue,
  fetchSchemes, fetchSchemeDetail, fetchSchemeJourney, evaluateEligibility, checkDocuments,
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


function SchemeCard({ scheme, onSelectDetail, onScreenEligibility }) {
  const { language } = useLanguage();
  const isLive = Boolean(scheme.programme_code || scheme.official_name);
  const title = scheme.official_name || scheme.name;
  const category = scheme.programme_type || (scheme.category ? translate(language, scheme.category) : 'Government healthcare scheme');
  const description = scheme.description || (scheme.summary ? translate(language, scheme.summary) : 'Government healthcare and cancer assistance programme.');
  const isVerified = scheme.review_status === 'verified';

  return (
    <article className="content-card scheme-card">
      <div className="card-title-row">
        <span className="support-icon-small"><BookOpenCheck size={18} /></span>
        <span className={`status-chip ${isVerified ? 'verified-chip' : ''}`}>
          {isVerified ? 'VERIFIED EVIDENCE' : translate(language, 'common.demo')}
        </span>
      </div>
      <span className="card-category">{category}</span>
      <h2>{title}</h2>
      <p>{description}</p>
      {scheme.version && (
        <small className="verification-status">
          Scheme Version {scheme.version} · Evidence Status: {scheme.review_status}
        </small>
      )}
      <div className="scheme-actions-row" style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: 'auto', width: '100%' }}>
        {scheme.id && isLive ? (
          <>
            <button
              type="button"
              className="button button-primary"
              style={{ flex: 1, minWidth: '130px' }}
              onClick={() => onSelectDetail && onSelectDetail(scheme.id)}
            >
              Official Details <ArrowRight size={15} />
            </button>
            <button
              type="button"
              className="button button-outline"
              style={{ minWidth: '110px' }}
              onClick={() => onScreenEligibility && onScreenEligibility(scheme)}
            >
              Eligibility
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
  const [ngos, setNgos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [selectedState, setSelectedState] = useState('');
  const [directAidFilter, setDirectAidFilter] = useState('');

  const loadNgos = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetchDirectoryNgos({
        search: search.trim() || undefined,
        state: selectedState || undefined,
        directAid: directAidFilter || undefined,
      });
      setNgos(res.ngos || []);
    } catch (err) {
      setError(err.message || 'Failed to load NGO directory');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadNgos();
  }, [search, selectedState, directAidFilter]);

  const stateOptions = [
    'All India', 'Maharashtra', 'Delhi', 'West Bengal', 'Uttarakhand',
    'Andhra Pradesh', 'Telangana', 'Tamil Nadu', 'Karnataka', 'Kerala',
    'Punjab', 'Haryana', 'Rajasthan', 'Gujarat', 'Assam'
  ];

  return (
    <div className="page-content">
      <PageHeading
        eyebrow="NATIONAL DIRECTORY"
        title="Cancer Support NGOs & Charitable Trusts"
        description="Comprehensive directory of verified NGOs, foundations, and hospices providing direct financial aid, free medicines, nutrition, and patient navigation across India."
      />

      {/* Filter Toolbar */}
      <section className="content-card" style={{ marginBottom: '20px', padding: '16px' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'center' }}>
          <div style={{ flex: '1 1 240px' }}>
            <input
              type="text"
              placeholder="Search by NGO name, city, or support type..."
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
              <option value="">All States / UTs</option>
              {stateOptions.map((st) => (
                <option key={st} value={st}>{st}</option>
              ))}
            </select>
          </div>

          <div style={{ flex: '0 1 180px' }}>
            <select
              value={directAidFilter}
              onChange={(e) => setDirectAidFilter(e.target.value)}
              style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #ccc', fontSize: '13px' }}
            >
              <option value="">All Aid Types</option>
              <option value="Yes">Direct Financial Aid Only</option>
              <option value="No">Non-Cash / Service Only</option>
            </select>
          </div>

          <button
            type="button"
            className="button button-outline"
            onClick={() => { setSearch(''); setSelectedState(''); setDirectAidFilter(''); }}
            style={{ minHeight: '36px', fontSize: '12px' }}
          >
            Reset
          </button>
        </div>
      </section>

      {loading && <div style={{ textAlign: 'center', padding: '40px', color: '#683693' }}>Loading verified NGO directory from Supabase...</div>}
      {error && <div style={{ background: '#ffebee', color: '#c62828', padding: '12px 16px', borderRadius: '8px', marginBottom: '20px' }}>{error}</div>}

      {!loading && ngos.length === 0 && (
        <div className="content-card" style={{ textAlign: 'center', padding: '40px' }}>
          <h3>No matching organisations found</h3>
          <p style={{ color: '#666', fontSize: '13px' }}>Try clearing your search query or selecting a different state.</p>
        </div>
      )}

      {/* NGO Cards Grid */}
      <div className="ngo-grid">
        {ngos.map((ngo) => {
          const hasDirectAid = ngo.direct_financial_aid?.toLowerCase().startsWith('yes');
          return (
            <article className="content-card ngo-card" key={ngo.id} style={{ display: 'flex', flexDirection: 'column' }}>
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
                  {hasDirectAid ? 'DIRECT FINANCIAL AID' : ngo.organization_type?.toUpperCase() || 'SUPPORT NGO'}
                </span>
              </div>

              <h2 style={{ fontSize: '16px', margin: '4px 0 6px 0', color: '#1a1a1a' }}>{ngo.organization_name}</h2>
              <div style={{ fontSize: '11px', color: '#666', marginBottom: '8px' }}>
                <strong>Coverage:</strong> {ngo.state_coverage} {ngo.city_district ? `· ${ngo.city_district}` : ''}
              </div>

              <p style={{ fontSize: '12px', lineHeight: '1.5', color: '#444', flex: 1, margin: '0 0 12px 0' }}>
                {ngo.what_support_offered || ngo.support_type}
              </p>

              {ngo.aid_amount_limit && (
                <div style={{ background: '#fdf8e2', border: '1px solid #fae8a4', borderRadius: '6px', padding: '6px 10px', fontSize: '11px', color: '#7a5b00', marginBottom: '10px' }}>
                  <strong>Aid Limit:</strong> {ngo.aid_amount_limit}
                </div>
              )}

              {ngo.contact_phone && (
                <div style={{ fontSize: '11px', color: '#555', marginBottom: '4px' }}>
                  <strong>Phone:</strong> {ngo.contact_phone}
                </div>
              )}

              {ngo.contact_email && (
                <div style={{ fontSize: '11px', color: '#555', marginBottom: '8px' }}>
                  <strong>Email:</strong> {ngo.contact_email}
                </div>
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
                    Official Portal <ExternalLink size={12} />
                  </a>
                )}
                <Link
                  className="button button-primary"
                  to="/assistant"
                  style={{ fontSize: '11px', minHeight: '30px', padding: '4px 10px' }}
                >
                  Ask Assistant <ArrowRight size={14} />
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
  const { data } = usePlatform();
  const [schemes, setSchemes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeDetail, setActiveDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [eligibilityModal, setEligibilityModal] = useState(null);
  const [eligibilityLoading, setEligibilityLoading] = useState(false);

  useEffect(() => {
    let active = true;
    fetchSchemes()
      .then((res) => {
        if (!active) return;
        if (res?.schemes && res.schemes.length > 0) {
          setSchemes(res.schemes);
        } else {
          setSchemes(demoSchemes);
        }
      })
      .catch((err) => {
        if (!active) return;
        setError('Connecting to live schemes catalog...');
        setSchemes(demoSchemes);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, []);

  const loadDetail = async (schemeId) => {
    setDetailLoading(true);
    try {
      const res = await fetchSchemeDetail(schemeId);
      setActiveDetail(res);
    } catch (err) {
      alert('Could not load scheme detail: ' + err.message);
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
        eyebrow="PUBLISHED PROGRAMMES"
        title={translate(language, 'page.schemes')}
        description="Official evidence-backed cancer assistance schemes verified with official ministry guidelines, gazettes, and operational rules."
      />
      {loading && <div className="route-loading" role="status">Loading live published schemes...</div>}
      {error && <DemoNotice>{error}</DemoNotice>}

      <div className="scheme-grid">
        {schemes.map((scheme) => (
          <SchemeCard
            scheme={scheme}
            key={scheme.id}
            onSelectDetail={loadDetail}
            onScreenEligibility={handleScreenEligibility}
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
              ✕ Close
            </button>
            <span className="eyebrow">OFFICIAL EVIDENCE & COVERAGE</span>
            <h2>{activeDetail.official_name}</h2>
            <p style={{ marginTop: '8px', color: '#666' }}>{activeDetail.description || activeDetail.programme_type}</p>

            {activeDetail.coverage && (
              <div style={{ background: '#f5f0fa', padding: '15px', borderRadius: '12px', margin: '15px 0' }}>
                <h3 style={{ margin: '0 0 8px 0', fontSize: '15px', color: '#4a2574' }}>Verified Coverage Scope</h3>
                <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '13px' }}>
                  {activeDetail.coverage.annual_cover_inr && <li><strong>Annual Cover:</strong> ₹{activeDetail.coverage.annual_cover_inr.toLocaleString()}</li>}
                  {activeDetail.coverage.senior_cover_inr && <li><strong>Senior Citizen Dedicated Top-Up:</strong> ₹{activeDetail.coverage.senior_cover_inr.toLocaleString()}</li>}
                  <li><strong>Cashless Hospitalization:</strong> {activeDetail.coverage.cashless ? 'Yes, in empanelled hospitals' : 'Reimbursement grant basis'}</li>
                  <li><strong>Portability:</strong> {activeDetail.coverage.pan_india_portability ? 'All-India empanelled network' : 'Designated medical centers'}</li>
                </ul>
              </div>
            )}

            <h3 style={{ marginTop: '20px' }}>Official Evidence Sources ({activeDetail.evidence_sources?.length || 0})</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '10px' }}>
              {(activeDetail.evidence_sources || []).map((src) => (
                <div key={src.id} style={{ border: '1px solid #e2d9ec', borderRadius: '10px', padding: '12px', background: '#fff' }}>
                  <strong>{src.source_title}</strong>
                  <div style={{ fontSize: '12px', color: '#555', marginTop: '4px' }}>
                    <span>Issuing Body: {src.issuing_body}</span> · <span>Effective Date: {src.effective_date}</span>
                  </div>
                  {src.page_reference && (
                    <div style={{ fontSize: '11px', color: '#777', marginTop: '4px' }}>
                      <em>Locator: {src.page_reference}</em>
                    </div>
                  )}
                  {src.source_url && (
                    <a
                      href={src.source_url}
                      target="_blank"
                      rel="noreferrer"
                      style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '12px', color: '#683693', marginTop: '6px', fontWeight: 'bold' }}
                    >
                      Open Official Document <ExternalLink size={13} />
                    </a>
                  )}
                </div>
              ))}
            </div>

            <div style={{ marginTop: '20px', textAlign: 'right' }}>
              <button type="button" className="button button-primary" onClick={() => setActiveDetail(null)}>Done</button>
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
              ✕ Close
            </button>
            <span className="eyebrow">DETERMINISTIC ELIGIBILITY SCREENING</span>
            <h2>{eligibilityModal.scheme?.official_name || eligibilityModal.scheme?.name}</h2>

            {eligibilityLoading ? (
              <p>Evaluating official scheme rules...</p>
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
                  <span>PRELIMINARY VERDICT: {eligibilityModal.result.result}</span>
                </div>
                <p style={{ fontSize: '13px', marginTop: '10px', color: '#555' }}>{eligibilityModal.result.disclaimer}</p>

                <h4 style={{ marginTop: '15px' }}>Evaluated Rule Pathways:</h4>
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

export function DocumentsPage() {
  const { data, updateData } = usePlatform();
  const { language } = useLanguage();
  const t = (key, values) => translate(language, key, values);
  const checked = data.checkedDocuments || [];
  const toggle = (item) => updateData({ checkedDocuments: checked.includes(item) ? checked.filter((entry) => entry !== item) : [...checked, item] });

  const [schemes, setSchemes] = useState([]);
  const [selectedSchemeId, setSelectedSchemeId] = useState('');
  const [evidenceDocs, setEvidenceDocs] = useState([]);
  const [docStatus, setDocStatus] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchSchemes().then((res) => {
      if (res?.schemes && res.schemes.length > 0) {
        setSchemes(res.schemes);
        setSelectedSchemeId(res.schemes[0].id);
      }
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (!selectedSchemeId) return;
    setLoading(true);
    const patientFacts = {
      age: Number(data.answers?.age) || 72,
      annual_income: Number(data.answers?.annual_income) || 120000,
      state: data.answers?.state || 'Andhra Pradesh',
    };
    checkDocuments(selectedSchemeId, patientFacts, checked)
      .then((res) => {
        setEvidenceDocs(res.documents || []);
        setDocStatus(res.status || '');
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [selectedSchemeId, checked, data.answers]);

  return (
    <div className="page-content">
      <PageHeading eyebrow={t('docs.eyebrow')} title={t('page.documents')} description={t('docs.description')} />

      {schemes.length > 0 && (
        <div style={{ marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <label style={{ fontWeight: 'bold', fontSize: '13px' }}>Select Scheme to Verify Checklist:</label>
          <select
            value={selectedSchemeId}
            onChange={(e) => setSelectedSchemeId(e.target.value)}
            style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid #ccc', fontSize: '13px', background: '#fff' }}
          >
            {schemes.map((s) => (
              <option key={s.id} value={s.id}>{s.official_name || s.name}</option>
            ))}
          </select>
        </div>
      )}

      {loading && <p>Checking evidence requirements for scheme...</p>}

      <div className="content-card checklist-card">
        <div className="checklist-heading">
          <span className="support-icon-small"><FileText size={19} /></span>
          <div>
            <h2>Evidence-Backed Document Checklist</h2>
            <p>
              Status: <strong>{docStatus || 'INCOMPLETE'}</strong> · Documents verified against official gazette rules
            </p>
          </div>
        </div>

        {evidenceDocs.length > 0 ? (
          <div className="document-list">
            {evidenceDocs.map((doc) => {
              const isProvided = doc.state === 'provided';
              const isNotReq = doc.state === 'not_required';
              return (
                <div key={doc.document_name} className="document-row" style={{ display: 'flex', flexDirection: 'column', gap: '4px', padding: '12px 0', borderBottom: '1px solid #eee' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={isProvided || checked.includes(doc.document_name)}
                        onChange={() => toggle(doc.document_name)}
                      />
                      <strong style={{ fontSize: '14px' }}>{doc.document_name}</strong>
                    </label>
                    <span className={`status-chip ${isProvided ? 'done' : isNotReq ? '' : 'missing-chip'}`} style={{
                      background: isProvided ? '#e8f5e9' : isNotReq ? '#f5f5f5' : '#ffebee',
                      color: isProvided ? '#2e7d32' : isNotReq ? '#757575' : '#c62828',
                      padding: '4px 8px', borderRadius: '6px', fontSize: '10px', fontWeight: 'bold'
                    }}>
                      {doc.state?.toUpperCase()}
                    </span>
                  </div>
                  {doc.accepted_alternatives?.length > 0 && (
                    <small style={{ color: '#666', marginLeft: '26px' }}>
                      Accepted alternatives: {doc.accepted_alternatives.join(', ')}
                    </small>
                  )}
                  {doc.evidence_source && (
                    <small style={{ color: '#683693', marginLeft: '26px' }}>
                      Policy Citation: {doc.evidence_source.title} ({doc.source_reference})
                    </small>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="document-list">
            {baseChecklist.map((item, index) => (
              <label className="document-row" key={item}>
                <input type="checkbox" checked={checked.includes(item)} onChange={() => toggle(item)} />
                <span className="document-check"><Check size={14} /></span>
                <span>{item}</span>
                <span className="document-status">{checked.includes(item) ? t('docs.ready') : t('docs.toPrepare')}</span>
              </label>
            ))}
          </div>
        )}
        <p className="muted-copy">{t('docs.noUpload')}</p>
      </div>
    </div>
  );
}

export function TrackerPage() {
  const { data, updateData } = usePlatform();
  const { language } = useLanguage();
  const t = (key) => translate(language, key);

  const [schemes, setSchemes] = useState([]);
  const [selectedSchemeId, setSelectedSchemeId] = useState('');
  const [journey, setJourney] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchSchemes().then((res) => {
      if (res?.schemes && res.schemes.length > 0) {
        setSchemes(res.schemes);
        setSelectedSchemeId(res.schemes[0].id);
      }
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (!selectedSchemeId) return;
    setLoading(true);
    fetchSchemeJourney(selectedSchemeId)
      .then((res) => setJourney(res))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [selectedSchemeId]);

  return (
    <div className="page-content">
      <PageHeading eyebrow={t('tracker.eyebrow')} title={t('page.tracker')} description={t('tracker.description')} />

      {schemes.length > 0 && (
        <div style={{ marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <label style={{ fontWeight: 'bold', fontSize: '13px' }}>Select Scheme Journey:</label>
          <select
            value={selectedSchemeId}
            onChange={(e) => setSelectedSchemeId(e.target.value)}
            style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid #ccc', fontSize: '13px', background: '#fff' }}
          >
            {schemes.map((s) => (
              <option key={s.id} value={s.id}>{s.official_name || s.name}</option>
            ))}
          </select>
        </div>
      )}

      {loading && <p>Loading official scheme milestones...</p>}

      <section className="content-card tracker-card">
        <div className="tracker-title">
          <span className="support-icon-small"><ClipboardCheck size={19} /></span>
          <div>
            <h2>{journey?.official_name || t('tracker.title')}</h2>
            <p>{journey ? 'Official Application & Preauthorization Journey' : t('tracker.progressLocal')}</p>
          </div>
        </div>

        {journey?.steps?.length > 0 ? (
          <div>
            {journey.steps.map((st, index) => {
              const completed = (data.completedStages || []).includes(index);
              return (
                <label className="tracker-stage" key={st.step_number} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '14px 0', borderBottom: '1px solid #f0f0f0' }}>
                  <input
                    type="checkbox"
                    checked={completed}
                    onChange={() => {
                      const current = data.completedStages || [];
                      updateData({ completedStages: completed ? current.filter((entry) => entry !== index) : [...current, index] });
                    }}
                  />
                  <span className="tracker-step" style={{ minWidth: '24px', height: '24px', borderRadius: '50%', background: completed ? '#2e7d32' : '#e0e0e0', color: '#fff', display: 'grid', placeItems: 'center', fontSize: '12px', fontWeight: 'bold' }}>
                    {completed ? <Check size={14} /> : st.step_number}
                  </span>
                  <div style={{ flex: 1 }}>
                    <strong style={{ fontSize: '13px' }}>Step {st.step_number}</strong>
                    <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: '#555' }}>{st.description}</p>
                  </div>
                  <span className={`status-chip${completed ? ' done' : ''}`}>
                    {completed ? t('tracker.done') : t('tracker.notStarted')}
                  </span>
                </label>
              );
            })}
            {journey.disclaimer && (
              <p style={{ fontSize: '11px', color: '#888', marginTop: '15px' }}>{journey.disclaimer}</p>
            )}
          </div>
        ) : (
          [1, 2, 3, 4, 5].map((stage, index) => {
            const completed = (data.completedStages || []).includes(index);
            return (
              <label className="tracker-stage" key={stage}>
                <input
                  type="checkbox"
                  checked={completed}
                  onChange={() => {
                    const current = data.completedStages || [];
                    updateData({ completedStages: completed ? current.filter((entry) => entry !== index) : [...current, index] });
                  }}
                />
                <span className="tracker-step">{completed ? <Check size={14} /> : index + 1}</span>
                <div>
                  <strong>{t(`tracker.stage.${stage}`)}</strong>
                  <small>{t(`tracker.stage.${stage}Help`)}</small>
                </div>
                <span className={`status-chip${completed ? ' done' : ''}`}>
                  {completed ? t('tracker.done') : t('tracker.notStarted')}
                </span>
              </label>
            );
          })
        )}
      </section>
    </div>
  );
}

export function AdminPage() {
  const { user } = usePlatform();
  const { language } = useLanguage();
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
      setActionStatus(`Scheme "${newScheme.official_name}" created successfully (Draft)!`);
      setShowCreateModal(false);
      setCreateCode('');
      setCreateName('');
      setCreateDesc('');
      await loadAdminSchemes();
      setSelectedSchemeId(newScheme.id);
    } catch (err) {
      setActionError(`Create scheme failed: ${err.message}`);
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
      setActionStatus(`Scheme "${updated.official_name}" updated successfully!`);
      setShowEditModal(false);
      await loadAdminSchemes();
      await loadSelectedSchemeData(selectedSchemeId);
    } catch (err) {
      setActionError(`Update scheme failed: ${err.message}`);
    }
  };

  // DELETE SCHEME
  const handleDeleteScheme = async (schemeId, schemeName) => {
    if (!window.confirm(`Are you sure you want to delete "${schemeName || 'this scheme'}"? This action will remove all attached sources, claims, and publication records.`)) return;
    setActionStatus('');
    setActionError('');
    try {
      await deleteAdminScheme(schemeId);
      setActionStatus('Scheme deleted successfully.');
      if (selectedSchemeId === schemeId) {
        setSelectedSchemeId('');
        setAdminDetail(null);
      }
      setSchemes((prev) => prev.filter((s) => s.id !== schemeId));
      await loadAdminSchemes();
    } catch (err) {
      setActionError(`Delete scheme failed: ${err.message}`);
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
      setActionStatus('Official evidence source attached successfully!');
      setEvidenceUrl('');
      setEvidenceTitle('');
      await loadSelectedSchemeData(selectedSchemeId);
    } catch (err) {
      setActionError(`Failed to add evidence: ${err.message}`);
    }
  };

  // APPROVE SOURCE
  const handleApproveSource = async (sourceId) => {
    setActionStatus('');
    setActionError('');
    try {
      await reviewAdminSource(selectedSchemeId, sourceId, 'approved', 'Verified official documentation', '2028-12-31');
      setActionStatus('Evidence source approved successfully with 2-year validity!');
      await loadSelectedSchemeData(selectedSchemeId);
    } catch (err) {
      setActionError(`Approve source failed: ${err.message}`);
    }
  };

  // DELETE SOURCE
  const handleDeleteSource = async (sourceId) => {
    if (!window.confirm('Delete this evidence source?')) return;
    setActionStatus('');
    setActionError('');
    try {
      await deleteAdminSource(selectedSchemeId, sourceId);
      setActionStatus('Evidence source deleted.');
      await loadSelectedSchemeData(selectedSchemeId);
    } catch (err) {
      setActionError(`Delete source failed: ${err.message}`);
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
      setActionStatus('Evidence claim added successfully!');
      setClaimText('');
      await loadSelectedSchemeData(selectedSchemeId);
    } catch (err) {
      setActionError(`Failed to add claim: ${err.message}`);
    }
  };

  // APPROVE CLAIM
  const handleApproveClaim = async (claimId) => {
    setActionStatus('');
    setActionError('');
    try {
      await reviewAdminClaim(selectedSchemeId, claimId, 'approved', 'Claim verified against source');
      setActionStatus('Evidence claim approved successfully!');
      await loadSelectedSchemeData(selectedSchemeId);
    } catch (err) {
      setActionError(`Approve claim failed: ${err.message}`);
    }
  };

  // DELETE CLAIM
  const handleDeleteClaim = async (claimId) => {
    if (!window.confirm('Delete this evidence claim?')) return;
    setActionStatus('');
    setActionError('');
    try {
      await deleteAdminClaim(selectedSchemeId, claimId);
      setActionStatus('Claim deleted.');
      await loadSelectedSchemeData(selectedSchemeId);
    } catch (err) {
      setActionError(`Delete claim failed: ${err.message}`);
    }
  };

  // PUBLISH & SYNC
  const handlePublish = async (schemeId) => {
    setActionStatus('');
    setActionError('');
    try {
      const res = await publishScheme(schemeId);
      setActionStatus(res.message || `Scheme published successfully! Version ${res.published_version} reindexed to RAG.`);
      await loadAdminSchemes();
      await loadSelectedSchemeData(schemeId);
    } catch (err) {
      setActionError(`Publish failed: ${err.message}`);
    }
  };

  // RETRY SYNC
  const handleRetrySync = async (schemeId) => {
    setActionStatus('');
    setActionError('');
    try {
      await retryAdminSync(schemeId);
      setActionStatus('Sync retry queued.');
      await loadSelectedSchemeData(schemeId);
    } catch (err) {
      setActionError(`Retry sync failed: ${err.message}`);
    }
  };

  // If user is not authenticated or not an admin, strictly lock down the page
  if (!isAdminUser) {
    return (
      <div className="page-content">
        <PageHeading
          eyebrow="ACCESS RESTRICTED"
          title="Admin Authentication Required"
          description="This section is restricted to authorized administrative users only."
        />
        <div className="content-card" style={{ maxWidth: '640px', margin: '40px auto', textAlign: 'center', padding: '40px 24px', boxShadow: '0 8px 30px rgba(0,0,0,0.06)' }}>
          <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: '#ffebee', color: '#c62828', display: 'grid', placeItems: 'center', margin: '0 auto 20px' }}>
            <LockKeyhole size={32} />
          </div>
          <h2 style={{ fontSize: '22px', margin: '0 0 12px 0', color: '#1a1a1a' }}>403 — Administrator Access Required</h2>
          <p style={{ color: '#555', fontSize: '14px', lineHeight: '1.6', margin: '0 0 24px 0' }}>
            {user ? (
              <>
                You are currently signed in as <strong>{user.email}</strong> (Role: <code style={{ color: '#c62828' }}>{user.app_metadata?.role || 'none'}</code>). Your account does not possess administrator privileges.
              </>
            ) : (
              'You are not currently signed in. Please sign in with an authorized administrator account.'
            )}
          </p>

          <div style={{ background: '#f5f0fa', border: '1px solid #e5d7f2', padding: '16px 20px', borderRadius: '12px', fontSize: '12px', color: '#444', textAlign: 'left', marginBottom: '28px' }}>
            <strong style={{ color: '#4a2574', display: 'block', marginBottom: '8px', fontSize: '13px' }}>
              How new administrators are created:
            </strong>
            <p style={{ margin: '0 0 8px 0', lineHeight: '1.5' }}>
              New admins can be assigned <strong>via the Supabase Dashboard only</strong>:
            </p>
            <ol style={{ margin: 0, paddingLeft: '20px', lineHeight: '1.6' }}>
              <li>Log in to your <strong>Supabase Dashboard</strong>.</li>
              <li>Go to <strong>Authentication &gt; Users</strong>.</li>
              <li>Select or create the user account (e.g. <code>{user ? user.email : 'admin@domain.com'}</code>).</li>
              <li>Under <strong>User Metadata / App Metadata</strong>, add: <code style={{ background: '#fff', padding: '2px 6px', borderRadius: '4px', border: '1px solid #ddd' }}>{`{"role": "admin"}`}</code>.</li>
              <li>Save and have the user sign in again to receive their verified administrator token.</li>
            </ol>
          </div>

          <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
            <Link to="/dashboard" className="button button-primary">
              Return to Dashboard <ArrowRight size={16} />
            </Link>
            {!user && (
              <Link to="/login?next=%2Fadmin" className="button button-outline">
                Sign In <ArrowRight size={16} />
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
        eyebrow="PRIVILEGED SCHEME MANAGEMENT"
        title="Admin Scheme Management & RAG Portal"
        description="Comprehensive CRUD administration portal for creating, editing, verifying evidence sources, approving factual claims, and publishing schemes with automatic RAG synchronization."
      />

      {/* Security Status Banner for Authorized Admin */}
      <section className="content-card" style={{ marginBottom: '20px', borderLeft: '4px solid #2e7d32' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <ShieldCheck size={20} color="#2e7d32" />
              <strong style={{ fontSize: '15px', color: '#1b5e20' }}>
                Admin Privileges Active & Verified via Supabase
              </strong>
            </div>
            <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: '#666' }}>
              Authenticated User: <strong>{user?.email}</strong> · Supabase App Metadata: <code style={{ color: '#2e7d32' }}>role="admin"</code>
            </p>
          </div>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              type="button"
              className="button button-primary"
              onClick={() => setShowCreateModal((prev) => !prev)}
              style={{ minHeight: '34px', fontSize: '12px' }}
            >
              <Plus size={14} /> {showCreateModal ? 'Cancel Create' : 'Create New Scheme'}
            </button>
            <button
              type="button"
              className="button button-outline"
              onClick={loadAdminSchemes}
              disabled={loading}
              style={{ minHeight: '34px', fontSize: '12px' }}
            >
              <RefreshCw size={14} /> Refresh
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
          <span className="eyebrow">CREATE NEW SCHEME</span>
          <h3 style={{ margin: '6px 0 16px 0' }}>Add Government Scheme or Assistance Programme</h3>
          <form onSubmit={handleCreateScheme}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
              <label style={{ fontSize: '12px', fontWeight: 'bold' }}>
                Programme Code *
                <input
                  type="text"
                  required
                  placeholder="e.g. CMCHS-TN-01"
                  value={createCode}
                  onChange={(e) => setCreateCode(e.target.value)}
                  style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #ccc', marginTop: '4px' }}
                />
              </label>
              <label style={{ fontSize: '12px', fontWeight: 'bold' }}>
                Official Name *
                <input
                  type="text"
                  required
                  placeholder="e.g. Chief Minister Comprehensive Health Scheme"
                  value={createName}
                  onChange={(e) => setCreateName(e.target.value)}
                  style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #ccc', marginTop: '4px' }}
                />
              </label>
              <label style={{ fontSize: '12px', fontWeight: 'bold' }}>
                Programme Type
                <input
                  type="text"
                  value={createType}
                  onChange={(e) => setCreateType(e.target.value)}
                  style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #ccc', marginTop: '4px' }}
                />
              </label>
              <label style={{ fontSize: '12px', fontWeight: 'bold' }}>
                Organization Name *
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
              Description
              <textarea
                rows={3}
                placeholder="Comprehensive coverage details, financial benefits, and eligible treatments..."
                value={createDesc}
                onChange={(e) => setCreateDesc(e.target.value)}
                style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #ccc', marginTop: '4px' }}
              />
            </label>
            <div style={{ display: 'flex', gap: '10px', marginTop: '16px' }}>
              <button type="submit" className="button button-primary">
                <Plus size={14} /> Create Scheme (Draft)
              </button>
              <button type="button" className="button button-outline" onClick={() => setShowCreateModal(false)}>
                Cancel
              </button>
            </div>
          </form>
        </section>
      )}

      {/* EDIT SCHEME MODAL */}
      {showEditModal && adminDetail && (
        <section className="content-card" style={{ marginBottom: '24px', border: '2px solid #2e7d32' }}>
          <span className="eyebrow">EDIT SCHEME DETAILS</span>
          <h3 style={{ margin: '6px 0 16px 0' }}>Edit: {adminDetail.official_name}</h3>
          <form onSubmit={handleUpdateScheme}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
              <label style={{ fontSize: '12px', fontWeight: 'bold' }}>
                Official Name
                <input
                  type="text"
                  required
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #ccc', marginTop: '4px' }}
                />
              </label>
              <label style={{ fontSize: '12px', fontWeight: 'bold' }}>
                Programme Type
                <input
                  type="text"
                  value={editType}
                  onChange={(e) => setEditType(e.target.value)}
                  style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #ccc', marginTop: '4px' }}
                />
              </label>
            </div>
            <label style={{ fontSize: '12px', fontWeight: 'bold', display: 'block', marginTop: '14px' }}>
              Description
              <textarea
                rows={3}
                value={editDesc}
                onChange={(e) => setEditDesc(e.target.value)}
                style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #ccc', marginTop: '4px' }}
              />
            </label>
            <div style={{ display: 'flex', gap: '10px', marginTop: '16px' }}>
              <button type="submit" className="button button-primary">
                Save Scheme Changes
              </button>
              <button type="button" className="button button-outline" onClick={() => setShowEditModal(false)}>
                Cancel
              </button>
            </div>
          </form>
        </section>
      )}

      {/* ALL SCHEMES TABLE (READ) */}
      <section className="content-card" style={{ marginBottom: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '18px' }}>Scheme Directory ({schemes.length})</h2>
            <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: '#666' }}>
              Complete repository of draft, under review, and verified schemes.
            </p>
          </div>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
            <thead>
              <tr style={{ background: '#f5f0fa', textAlign: 'left', borderBottom: '2px solid #e0d5ec' }}>
                <th style={{ padding: '10px' }}>Programme</th>
                <th style={{ padding: '10px' }}>Code</th>
                <th style={{ padding: '10px' }}>Status</th>
                <th style={{ padding: '10px' }}>Version</th>
                <th style={{ padding: '10px', textAlign: 'right' }}>Actions</th>
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
                      <div style={{ fontSize: '11px', color: '#888' }}>ID: {s.id}</div>
                    </td>
                    <td style={{ padding: '10px', fontFamily: 'monospace', fontSize: '11px' }}>
                      {s.programme_code || 'N/A'}
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
                        {s.review_status?.toUpperCase() || 'DRAFT'}
                      </span>
                    </td>
                    <td style={{ padding: '10px' }}>v{s.version || 1}</td>
                    <td style={{ padding: '10px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                      <button
                        type="button"
                        className="button button-outline"
                        onClick={() => handlePublish(s.id)}
                        style={{ padding: '4px 8px', fontSize: '11px', minHeight: '28px', marginRight: '5px' }}
                        title="Re-index to pgvector RAG"
                      >
                        Re-Publish & Sync
                      </button>
                      <button
                        type="button"
                        className="button button-primary"
                        onClick={() => setSelectedSchemeId(s.id)}
                        style={{ padding: '4px 8px', fontSize: '11px', minHeight: '28px', marginRight: '5px' }}
                      >
                        Manage
                      </button>
                      <button
                        type="button"
                        className="button button-outline"
                        onClick={() => {
                          setSelectedSchemeId(s.id);
                          setShowEditModal(true);
                        }}
                        style={{ padding: '4px 8px', fontSize: '11px', minHeight: '28px', marginRight: '5px' }}
                        title="Edit details"
                      >
                        <Edit size={12} />
                      </button>
                      <button
                        type="button"
                        className="button button-outline"
                        onClick={() => handleDeleteScheme(s.id, s.official_name)}
                        style={{ padding: '4px 8px', fontSize: '11px', minHeight: '28px', color: '#c62828' }}
                        title="Delete scheme"
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
            <span className="eyebrow">SCHEME WORKSPACE</span>
            <h3 style={{ margin: '4px 0 8px 0' }}>{adminDetail.official_name}</h3>
            <p style={{ fontSize: '12px', color: '#666', marginBottom: '12px' }}>
              {adminDetail.description || 'No description provided.'}
            </p>

            <div style={{ background: '#fafafa', border: '1px solid #eee', borderRadius: '8px', padding: '12px', fontSize: '12px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <div><strong>Code:</strong> <code>{adminDetail.programme_code}</code></div>
              <div><strong>Status:</strong> <span style={{ fontWeight: 'bold', color: adminDetail.review_status === 'verified' ? '#2e7d32' : '#e65100' }}>{adminDetail.review_status?.toUpperCase()}</span></div>
              <div><strong>Version:</strong> v{adminDetail.version}</div>
              <div><strong>Current Published:</strong> v{syncStatus?.current_published_version || adminDetail.version}</div>
              <div><strong>Sync Jobs:</strong> {syncStatus?.jobs?.length || 0} recorded</div>
            </div>

            <div style={{ display: 'flex', gap: '8px', marginTop: '16px' }}>
              <button
                type="button"
                className="button button-primary"
                onClick={() => handlePublish(selectedSchemeId)}
                style={{ flex: 1 }}
              >
                Re-Publish & Sync to RAG
              </button>
              {syncStatus?.jobs?.some((j) => j.status === 'failed') && (
                <button
                  type="button"
                  className="button button-outline"
                  onClick={() => handleRetrySync(selectedSchemeId)}
                  style={{ color: '#c62828' }}
                >
                  Retry Sync
                </button>
              )}
            </div>
          </section>

          {/* Add & Manage Evidence Sources */}
          <section className="content-card">
            <span className="eyebrow">EVIDENCE MANAGEMENT</span>
            <h3 style={{ margin: '4px 0 8px 0' }}>Attach Official Evidence Source</h3>
            <form onSubmit={handleAddEvidence} style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '8px' }}>
              <label style={{ fontSize: '12px', fontWeight: 'bold' }}>
                Document Title *
                <input
                  type="text"
                  required
                  placeholder="e.g. Official Gazette Cancer Treatment Guidelines"
                  value={evidenceTitle}
                  onChange={(e) => setEvidenceTitle(e.target.value)}
                  style={{ width: '100%', padding: '6px 8px', borderRadius: '6px', border: '1px solid #ccc', marginTop: '2px' }}
                />
              </label>
              <label style={{ fontSize: '12px', fontWeight: 'bold' }}>
                Official Source HTTPS URL *
                <input
                  type="url"
                  required
                  placeholder="https://mohfw.gov.in/guidelines"
                  value={evidenceUrl}
                  onChange={(e) => setEvidenceUrl(e.target.value)}
                  style={{ width: '100%', padding: '6px 8px', borderRadius: '6px', border: '1px solid #ccc', marginTop: '2px' }}
                />
              </label>
              <label style={{ fontSize: '12px', fontWeight: 'bold' }}>
                Issuing Ministry / Body
                <input
                  type="text"
                  value={evidenceBody}
                  onChange={(e) => setEvidenceBody(e.target.value)}
                  style={{ width: '100%', padding: '6px 8px', borderRadius: '6px', border: '1px solid #ccc', marginTop: '2px' }}
                />
              </label>
              <label style={{ fontSize: '12px', fontWeight: 'bold' }}>
                Page / Clause Reference
                <input
                  type="text"
                  value={evidencePage}
                  onChange={(e) => setEvidencePage(e.target.value)}
                  style={{ width: '100%', padding: '6px 8px', borderRadius: '6px', border: '1px solid #ccc', marginTop: '2px' }}
                />
              </label>
              <button type="submit" className="button button-primary" style={{ marginTop: '4px' }}>
                <Plus size={14} /> Attach Evidence Source
              </button>
            </form>

            <h4 style={{ margin: '18px 0 8px 0', fontSize: '13px' }}>Attached Sources ({sources.length})</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '240px', overflowY: 'auto' }}>
              {sources.map((src) => {
                const isApproved = src.evidence_status === 'approved';
                return (
                  <div key={src.id} style={{ border: '1px solid #eee', padding: '8px 10px', borderRadius: '6px', fontSize: '12px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <strong>{src.source_title}</strong>
                      <span style={{ fontSize: '10px', fontWeight: 'bold', color: isApproved ? '#2e7d32' : '#e65100', background: isApproved ? '#e8f5e9' : '#fff3e0', padding: '2px 6px', borderRadius: '4px' }}>
                        {src.evidence_status?.toUpperCase() || 'UNVERIFIED'}
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
                          <CheckCircle size={10} /> Approve Source
                        </button>
                      )}
                      <button
                        type="button"
                        className="button button-outline"
                        onClick={() => handleDeleteSource(src.id)}
                        style={{ padding: '2px 8px', fontSize: '10px', minHeight: '24px', color: '#c62828' }}
                      >
                        <Trash2 size={10} /> Delete
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Add & Manage Evidence Claims */}
          <section className="content-card">
            <span className="eyebrow">FACTUAL CLAIMS</span>
            <h3 style={{ margin: '4px 0 8px 0' }}>Evidence Claims & Citations</h3>
            <form onSubmit={handleAddClaim} style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '8px' }}>
              <label style={{ fontSize: '12px', fontWeight: 'bold' }}>
                Select Linked Source *
                <select
                  value={claimSourceId}
                  onChange={(e) => setClaimSourceId(e.target.value)}
                  style={{ width: '100%', padding: '6px 8px', borderRadius: '6px', border: '1px solid #ccc', marginTop: '2px' }}
                >
                  <option value="">-- Choose Attached Source --</option>
                  {sources.map((s) => (
                    <option key={s.id} value={s.id}>{s.source_title}</option>
                  ))}
                </select>
              </label>
              <label style={{ fontSize: '12px', fontWeight: 'bold' }}>
                Field Path
                <input
                  type="text"
                  value={claimFieldPath}
                  onChange={(e) => setClaimFieldPath(e.target.value)}
                  style={{ width: '100%', padding: '6px 8px', borderRadius: '6px', border: '1px solid #ccc', marginTop: '2px' }}
                />
              </label>
              <label style={{ fontSize: '12px', fontWeight: 'bold' }}>
                Claim Text *
                <input
                  type="text"
                  required
                  placeholder="e.g. Cashless treatment up to 5 lakh INR per year"
                  value={claimText}
                  onChange={(e) => setClaimText(e.target.value)}
                  style={{ width: '100%', padding: '6px 8px', borderRadius: '6px', border: '1px solid #ccc', marginTop: '2px' }}
                />
              </label>
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                <label style={{ fontSize: '12px', fontWeight: 'bold', flex: 1 }}>
                  Source Locator
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
                  Critical Claim
                </label>
              </div>
              <button type="submit" className="button button-primary" style={{ marginTop: '4px' }}>
                <Plus size={14} /> Add Claim
              </button>
            </form>

            <h4 style={{ margin: '18px 0 8px 0', fontSize: '13px' }}>Claims for Scheme ({claims.length})</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '240px', overflowY: 'auto' }}>
              {claims.map((clm) => {
                const isApproved = clm.review_status === 'approved';
                return (
                  <div key={clm.id} style={{ border: '1px solid #eee', padding: '8px 10px', borderRadius: '6px', fontSize: '12px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontFamily: 'monospace', fontSize: '10px', color: '#555' }}>{clm.field_path}</span>
                      <span style={{ fontSize: '10px', fontWeight: 'bold', color: isApproved ? '#2e7d32' : '#e65100', background: isApproved ? '#e8f5e9' : '#fff3e0', padding: '2px 6px', borderRadius: '4px' }}>
                        {clm.review_status?.toUpperCase() || 'PENDING'}
                      </span>
                    </div>
                    <div style={{ fontWeight: '500', marginTop: '4px' }}>{clm.claim_text}</div>
                    <div style={{ color: '#888', fontSize: '10px', marginTop: '2px' }}>Locator: {clm.source_locator} {clm.is_critical ? '· Critical' : ''}</div>
                    <div style={{ display: 'flex', gap: '6px', marginTop: '6px' }}>
                      {!isApproved && (
                        <button
                          type="button"
                          className="button button-outline"
                          onClick={() => handleApproveClaim(clm.id)}
                          style={{ padding: '2px 8px', fontSize: '10px', minHeight: '24px', color: '#2e7d32' }}
                        >
                          <CheckCircle size={10} /> Approve Claim
                        </button>
                      )}
                      <button
                        type="button"
                        className="button button-outline"
                        onClick={() => handleDeleteClaim(clm.id)}
                        style={{ padding: '2px 8px', fontSize: '10px', minHeight: '24px', color: '#c62828' }}
                      >
                        <Trash2 size={10} /> Delete
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
        ? 'The request took longer than expected to verify with official scheme sources. Please try asking again.'
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
  return <div className="page-content assistant-page"><PageHeading eyebrow="GROUNDED GUIDANCE" title={t('page.assistant')} description={t('assistant.disclaimer')} action={<button className="button button-outline" type="button" onClick={clearConversation} disabled={busy}><Trash2 size={15} /> {t('assistant.newConversation')}</button>} /><DemoNotice>{t('assistant.demoInfo')}</DemoNotice>
    <section className="chat-panel">
      <div className="chat-history" aria-live="polite">
        {!history.length && <div className="chat-welcome"><span className="assistant-avatar"><Sparkles size={20} /></span><h2>How can I help you navigate support?</h2><p>{t('assistant.suggested')}</p><div className="suggested-questions">{suggestions.map((item) => <button key={item} type="button" onClick={() => setQuestion(item)}>{item}</button>)}</div></div>}
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
