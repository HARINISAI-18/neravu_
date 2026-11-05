import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, Navigate, useLocation, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft, ArrowRight, BookOpenCheck, Check, CircleHelp, ClipboardCheck, RotateCcw, Trash2,
  FileCheck2, FileText, HeartHandshake, Languages, LockKeyhole, MessageCircle, ShieldCheck, Sparkles,
  Stethoscope, UserRound, Wallet
} from 'lucide-react';
import {
  baseChecklist, demoOrganizations, demoSchemes, languageOptions, questionDefinitions, sectionLabels
} from './data';
import { translate, translateOption, useLanguage } from './i18n';
import { usePlatform } from './PlatformContext';
import { askGuidance, authService, getChatIdentity, isRagConfigured, isSupabaseConfigured, supabaseConfigurationIssue } from './services';
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
    await acceptProgressConsent(authenticatedUser);
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

function SchemeCard({ scheme }) {
  const { language } = useLanguage();
  const schemeKeys = {
    pmjay: ['schemes.category.health', 'schemes.pmjay', 'schemes.status.pmjay'],
    pmnrf: ['schemes.category.grant', 'schemes.pnrf', 'schemes.status.pnrf'],
    hmdg: ['schemes.category.grant', 'schemes.hmdg', 'schemes.status.hmdg'],
    state: ['schemes.category.state', 'schemes.state', 'schemes.status.state']
  }[scheme.id];
  return <article className="content-card scheme-card">
    <div className="card-title-row"><span className="support-icon-small"><BookOpenCheck size={18} /></span><span className="status-chip">{translate(language, 'common.demo')}</span></div>
    <span className="card-category">{translate(language, schemeKeys[0])}</span><h2>{scheme.name}</h2><p>{translate(language, schemeKeys[1])}</p>
    <small className="verification-status">{translate(language, schemeKeys[2])}</small>
    {scheme.link ? <a className="button button-outline" href={scheme.link} target="_blank" rel="noreferrer">{translate(language, 'schemes.official')} <ArrowRight size={16} /></a> : <Link className="button button-outline" to="/assistant">{translate(language, 'schemes.guidance')} <ArrowRight size={16} /></Link>}
  </article>;
}

export function DashboardPage() {
  const { data, user, cloudStatus } = usePlatform();
  const { language } = useLanguage();
  const t = (key) => translate(language, key);
  const requestedSupport = assistanceOptions.filter((option) => data.assistanceTypes.includes(option.id));
  return <div className="page-content dashboard-page">
    <PageHeading eyebrow={t('dashboard.eyebrow')} title={t('dashboard.hello')} description={t('dashboard.subtitle')} action={<span className="guest-pill"><ShieldCheck size={15} /> {t('common.guest')}</span>} />
    <DemoNotice>{user ? t('profile.accountNotice') : undefined}</DemoNotice>
    <section className="profile-summary">
      <div>
        <span className="eyebrow">{t('dashboard.startingPoint')}</span>
        <h2>{data.answers.relationship ? `${answerLabel(data.answers.relationship, language)}${data.answers.state ? ` · ${data.answers.state}` : ''}` : t('dashboard.emptySummary')}</h2>
        <p>{requestedSupport.length ? requestedSupport.map((option) => t(option.title)).join(' · ') : t('dashboard.chooseSupport')}</p>
        <small>{t('dashboard.discoveryDisclaimer')}</small>
      </div>
      <Link to={data.assessmentComplete ? '/assessment/review' : '/start/role'} className="text-link">{data.assessmentComplete ? t('common.edit') : t('nav.start')} <ArrowRight size={15} /></Link>
    </section>
    <div className="dashboard-highlight">
      <div><span className="eyebrow">{t('dashboard.match')}</span><h2>{t('dashboard.explore')}</h2><p>{t('dashboard.exploreHelp')}</p></div>
      <Link to="/schemes" className="button button-primary">{t('dashboard.exploreSchemes')} <ArrowRight size={16} /></Link>
    </div>
    <section className="dashboard-section"><div className="section-title-row"><div><span className="eyebrow">{t('dashboard.govSupport')}</span><h2>{t('dashboard.match')}</h2></div><Link className="text-link" to="/schemes">{t('dashboard.viewAll')} <ArrowRight size={15} /></Link></div>
      <div className="scheme-grid compact-schemes">{demoSchemes.slice(0, 3).map((scheme) => <SchemeCard scheme={scheme} key={scheme.id} />)}</div>
    </section>
    <div className="dashboard-two-col">
      <section className="content-card"><span className="eyebrow">{t('dashboard.next')}</span><h2>{t('dashboard.startConfirm')}</h2><ul className="next-step-list">
        <li><span>1</span><div><strong>{t('dashboard.review')}</strong><small>{t('dashboard.reviewHelp')}</small></div></li>
        <li><span>2</span><div><strong>{t('dashboard.gather')}</strong><small>{t('dashboard.gatherHelp')}</small></div></li>
        <li><span>3</span><div><strong>{t('dashboard.verify')}</strong><small>{t('dashboard.verifyHelp')}</small></div></li>
      </ul><Link className="button button-outline" to="/assessment/review">{t('dashboard.completeAssessment')} <ArrowRight size={16} /></Link></section>
      <section className="dashboard-side-stack">
        <article className="content-card progress-card"><span className="eyebrow">{t('dashboard.progress')}</span><h2>{data.assessmentComplete ? t('dashboard.assessmentReviewed') : t('dashboard.assessmentProgress')}</h2><div className="progress-track"><span style={{ width: data.assessmentComplete ? '100%' : data.assessmentStep ? `${Math.round((data.assessmentStep / questionDefinitions.length) * 100)}%` : '8%' }} /></div><p>{user && ['ready', 'saved'].includes(cloudStatus) ? t('cloud.account') : t('dashboard.localProgress')}</p><Link className="text-link" to={data.assessmentAccessGranted ? '/assessment' : '/assessment/access'}>{t('dashboard.continueAssessment')} <ArrowRight size={15} /></Link></article>
        <article className="assistant-promo"><span className="assist-icon"><Sparkles size={20} /></span><div><h2>{t('dashboard.ai')}</h2><p>{t('dashboard.aiHelp')}</p><Link className="text-link" to="/assistant">{t('dashboard.ask')} <ArrowRight size={15} /></Link></div></article>
      </section>
    </div>
  </div>;
}

export function SchemesPage() {
  const { language } = useLanguage();
  return <div className="page-content"><PageHeading eyebrow={translate(language, 'schemes.eyebrow')} title={translate(language, 'page.schemes')} description={translate(language, 'schemes.description')} /><DemoNotice /><div className="scheme-grid">{demoSchemes.map((scheme) => <SchemeCard scheme={scheme} key={scheme.id} />)}</div></div>;
}

export function NgoPage() {
  const { language } = useLanguage();
  const descriptions = ['ngos.ics', 'ngos.cpaa', 'ngos.cansupport', 'ngos.cuddles'];
  return <div className="page-content"><PageHeading eyebrow={translate(language, 'ngos.eyebrow')} title={translate(language, 'page.ngos')} description={translate(language, 'ngos.description')} /><DemoNotice>{translate(language, 'ngos.demo')}</DemoNotice>
    <div className="ngo-grid">{demoOrganizations.map((organization, index) => <article className="content-card ngo-card" key={organization.name}><span className="support-icon-small"><HeartHandshake size={18} /></span><span className="status-chip">{translate(language, 'ngos.listing')}</span><h2>{organization.name}</h2><p>{translate(language, descriptions[index])}</p><Link className="button button-outline" to="/assistant">{translate(language, 'ngos.ask')} <ArrowRight size={16} /></Link></article>)}</div>
  </div>;
}

export function DocumentsPage() {
  const { data, updateData } = usePlatform();
  const { language } = useLanguage();
  const t = (key, values) => translate(language, key, values);
  const checked = data.checkedDocuments;
  const toggle = (item) => updateData({ checkedDocuments: checked.includes(item) ? checked.filter((entry) => entry !== item) : [...checked, item] });
  const documentKeys = ['docs.id', 'docs.records', 'docs.plan', 'docs.income', 'docs.ration', 'docs.bank'];
  return <div className="page-content"><PageHeading eyebrow={t('docs.eyebrow')} title={t('page.documents')} description={t('docs.description')} /><DemoNotice />
    <div className="content-card checklist-card"><div className="checklist-heading"><span className="support-icon-small"><FileText size={19} /></span><div><h2>{t('docs.checklist')}</h2><p>{t('docs.readyCount', { checked: checked.length, total: baseChecklist.length })}</p></div></div>
      <div className="document-list">{baseChecklist.map((item, index) => <label className="document-row" key={item}><input type="checkbox" checked={checked.includes(item)} onChange={() => toggle(item)} /><span className="document-check"><Check size={14} /></span><span>{t(documentKeys[index])}</span><span className="document-status">{checked.includes(item) ? t('docs.ready') : t('docs.toPrepare')}</span></label>)}</div>
      <p className="muted-copy">{t('docs.noUpload')}</p>
    </div>
  </div>;
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
    const timeoutId = window.setTimeout(() => controller.abort(), 30000);
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
      if (!controller.signal.aborted) {
        setError(!isRagConfigured ? t('assistant.noBackend') : caught instanceof Error ? caught.message : t('assistant.failed'));
        setRetryMessage(normalized);
      }
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

export function TrackerPage() {
  const { data, updateData } = usePlatform();
  const { language } = useLanguage();
  const t = (key) => translate(language, key);
  const stages = [1, 2, 3, 4, 5];
  return <div className="page-content"><PageHeading eyebrow={t('tracker.eyebrow')} title={t('page.tracker')} description={t('tracker.description')} /><DemoNotice>{t('tracker.honest')}</DemoNotice>
    <section className="content-card tracker-card"><div className="tracker-title"><span className="support-icon-small"><ClipboardCheck size={19} /></span><div><h2>{t('tracker.title')}</h2><p>{t('tracker.progressLocal')}</p></div></div>{stages.map((stage, index) => {
      const completed = (data.completedStages || []).includes(index);
      return <label className="tracker-stage" key={stage}><input type="checkbox" checked={completed} onChange={() => {
        const current = data.completedStages || [];
        updateData({ completedStages: completed ? current.filter((entry) => entry !== index) : [...current, index] });
      }} /><span className="tracker-step">{completed ? <Check size={14} /> : index + 1}</span><div><strong>{t(`tracker.stage.${stage}`)}</strong><small>{t(`tracker.stage.${stage}Help`)}</small></div><span className={`status-chip${completed ? ' done' : ''}`}>{completed ? t('tracker.done') : t('tracker.notStarted')}</span></label>;
    })}</section>
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
