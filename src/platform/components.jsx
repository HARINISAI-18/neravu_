import React from 'react';
import { NavLink, Link, Outlet } from 'react-router-dom';
import {
  BookOpenCheck, ClipboardCheck, FileText,
  HeartHandshake, Home, Languages, LogIn, LogOut, MessageCircle, Settings, ShieldCheck, UserRound
} from 'lucide-react';
import { languageOptions } from './data';
import { getTranslationCoverage, translate, translateOption, useLanguage } from './i18n';
import { usePlatform } from './PlatformContext';
import { authService, isSupabaseConfigured } from './services';
import { ChatAssistantWidget } from './ChatDrawer';

const baseNavigation = [
  { to: '/dashboard', key: 'nav.dashboard', icon: Home, end: true },
  { to: '/schemes', key: 'nav.schemes', icon: BookOpenCheck },
  { to: '/ngos', key: 'nav.ngos', icon: HeartHandshake },
  { to: '/documents', key: 'nav.documents', icon: FileText },
  { to: '/assistant', key: 'nav.assistant', icon: MessageCircle },
  { to: '/tracker', key: 'nav.tracker', icon: ClipboardCheck },
  { to: '/profile', key: 'nav.profile', icon: UserRound },
  { to: '/settings', key: 'nav.settings', icon: Settings }
];

export function Brand({ compact = false }) {
  const { language } = useLanguage();
  return (
    <Link to="/" className="brand platform-brand" aria-label={translate(language, 'brand.home')}>
      <span className="brand-mark"><HeartHandshake size={20} /></span>
      <span>Neravu{!compact && <small>{translate(language, 'brand.tagline')}</small>}</span>
    </Link>
  );
}

export function LanguageSelect({ className = '' }) {
  const { language, setLanguage } = useLanguage();
  return (
    <label className={`language-select ${className}`}>
      <Languages size={17} aria-hidden="true" />
      <span className="sr-only">{translate(language, 'nav.languageLabel')}</span>
      <select value={language} onChange={(event) => setLanguage(event.target.value)}>
        {languageOptions.map((option) => (
          <option value={option.code} key={option.code}>{option.nativeName}</option>
        ))}
      </select>
    </label>
  );
}

export function TranslationNotice() {
  const { language } = useLanguage();
  const coverage = getTranslationCoverage(language);
  if (language === 'en') return null;
  return (
    <aside className="translation-notice" role="note" data-coverage={coverage} data-review-status="unreviewed-draft">
      <p>{translate(language, 'language.translationNotice')}</p>
      <details>
        <summary>{translate(language, 'language.viewEnglish')}</summary>
        <p>{translate('en', 'language.translationNotice')}</p>
      </details>
    </aside>
  );
}

export function PlatformLayout() {
  const { language } = useLanguage();
  const {
    storageIssue, user, displayName, authLoading, cloudStatus, cloudError, clearLocalCopy,
    needsProgressConsent, pendingCloudProgress, acceptProgressConsent, useCloudProgress, keepDeviceProgress
  } = usePlatform();
  const [consentChecked, setConsentChecked] = React.useState(false);
  const [accountError, setAccountError] = React.useState('');
  const t = (key) => translate(language, key);
  const signOut = async () => {
    setAccountError('');
    try {
      await authService.signOut();
      clearLocalCopy();
    } catch (error) {
      setAccountError(error instanceof Error ? error.message : t('auth.signOutError'));
    }
  };
  const grantConsent = async () => {
    setAccountError('');
    try {
      await acceptProgressConsent(user);
      setConsentChecked(false);
    } catch (error) {
      setAccountError(error instanceof Error ? error.message : t('common.error'));
    }
  };
  return (
    <div className="platform-shell">
      <header className="platform-topbar">
        <Brand />
        <div className="platform-top-actions">
          {user ? <span className="guest-indicator"><ShieldCheck size={15} /> {displayName || user.email}</span> : <span className="guest-indicator"><ShieldCheck size={15} /> {t('common.guest')}</span>}
          <LanguageSelect />
          {user ? <button className="button button-outline top-login" type="button" onClick={signOut}><LogOut size={16} /> {t('nav.signOut')}</button> : <Link className="button button-outline top-login" to="/login"><LogIn size={16} /> {t('nav.login')}</Link>}
          <Link className="icon-link" to="/settings" aria-label={t('nav.settings')}><Settings size={19} /></Link>
        </div>
      </header>
      {storageIssue && <div className="storage-alert" role="status">{storageIssue}</div>}
      <TranslationNotice />
      {user && cloudStatus === 'checking' && <div className="cloud-status" role="status">{t('cloud.checking')}</div>}
      {user && cloudStatus === 'saving' && <div className="cloud-status" role="status">{t('cloud.saving')}</div>}
      {user && cloudStatus === 'saved' && <div className="cloud-status saved" role="status">{t('cloud.saved')}</div>}
      {user && cloudStatus === 'error' && <div className="cloud-status error" role="alert">{cloudError || t('cloud.saveError')}</div>}
      {user && needsProgressConsent && <section className="cloud-consent-banner" aria-labelledby="cloud-consent-title">
        <h2 id="cloud-consent-title">{t('auth.cloudConsentTitle')}</h2>
        <p>{t('auth.cloudConsentBody')}</p>
        <label><input type="checkbox" checked={consentChecked} onChange={(event) => setConsentChecked(event.target.checked)} /> {t('auth.consent')}</label>
        <button className="button button-primary" type="button" disabled={!consentChecked} onClick={grantConsent}>{t('auth.enableSync')}</button>
        {accountError && <p className="form-error" role="alert">{accountError}</p>}
      </section>}
      {user && pendingCloudProgress && <section className="cloud-conflict-banner" aria-labelledby="cloud-conflict-title">
        <h2 id="cloud-conflict-title">{t('cloud.conflictTitle')}</h2>
        <p>{t('cloud.conflictHelp')}</p>
        <div><button className="button button-outline" type="button" onClick={useCloudProgress}>{t('cloud.useAccount')}</button><button className="button button-primary" type="button" onClick={keepDeviceProgress}>{t('cloud.useDevice')}</button></div>
      </section>}
      {accountError && !needsProgressConsent && <div className="storage-alert" role="alert">{accountError}</div>}
      <div className="platform-body">
        <aside className="platform-sidebar" aria-label={t('nav.main')}>
          <div className="sidebar-label">{t('nav.space')}</div>
          <nav className="side-nav">
            {(user?.app_metadata?.role === 'admin'
              ? [...baseNavigation, { to: '/admin', key: 'nav.admin', icon: ShieldCheck }]
              : baseNavigation
            ).map(({ to, key, icon: Icon, end }) => (
              <NavLink key={to} to={to} end={end} className={({ isActive }) => `side-link${isActive ? ' active' : ''}`}>
                <Icon size={18} aria-hidden="true" /><span>{t(key)}</span>
              </NavLink>
            ))}
          </nav>
          <div className="sidebar-bottom">
            <div className="privacy-note"><ShieldCheck size={17} /><span>{t('nav.localNote')}</span></div>
          </div>
        </aside>
        <main className="platform-main" id="main-content">
          {!isSupabaseConfigured && !authLoading && <div className="cloud-status">{t('cloud.local')}</div>}
          <Outlet />
        </main>
      </div>
      <ChatAssistantWidget />
    </div>
  );
}

export function DemoNotice({ children }) {
  const { language } = useLanguage();
  return (
    <div className="demo-notice" role="note">
      <span className="demo-label"><ShieldCheck size={14} /> {translate(language, 'common.demo')}</span>
      <span>{children || translate(language, 'common.notVerified')}</span>
    </div>
  );
}

export function PageHeading({ eyebrow, title, description, action }) {
  return (
    <div className="page-heading">
      <div>
        {eyebrow && <span className="eyebrow">{eyebrow}</span>}
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </div>
      {action}
    </div>
  );
}

export function OptionGrid({ options, value, onChange, multiple = false, name = 'choice', language = 'en' }) {
  const selected = Array.isArray(value) ? value : value == null || value === '' ? [] : [value];
  const choose = (option) => {
    if (multiple) {
      onChange(selected.includes(option) ? selected.filter((item) => item !== option) : [...selected, option]);
    } else {
      onChange(option);
    }
  };
  return (
    <div className={`option-grid${multiple ? ' multi' : ''}`}>
      {options.map((option) => {
        const checked = selected.includes(option);
        return (
          <label className={`option-card${checked ? ' selected' : ''}`} key={option}>
            <input
              type={multiple ? 'checkbox' : 'radio'}
              name={name}
              value={option}
              checked={checked}
              onChange={() => choose(option)}
            />
            <span className="option-check" aria-hidden="true">{checked ? '✓' : ''}</span>
            <span>{translateOption(language, option)}</span>
          </label>
        );
      })}
    </div>
  );
}

export function RouteFooter({ children }) {
  return <div className="route-footer">{children}</div>;
}
