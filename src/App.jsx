import React, { lazy, Suspense, useState } from 'react';
import { HeartHandshake, Menu, X, ArrowDown, Languages, FileCheck2, SearchCheck, Headset } from 'lucide-react';
import { Link, Navigate, Route, Routes } from 'react-router-dom';
import { PlatformProvider } from './platform/PlatformContext';
import { LanguageSelect, PlatformLayout, TranslationNotice } from './platform/components';
import { translate, useLanguage } from './platform/i18n';

const HospitalScene = lazy(() => import('./scene/HospitalScene'));
const SetupPage = lazy(() => import('./platform/screens').then((module) => ({ default: module.SetupPage })));
const AssessmentAccessPage = lazy(() => import('./platform/screens').then((module) => ({ default: module.AssessmentAccessPage })));
const AssessmentPage = lazy(() => import('./platform/screens').then((module) => ({ default: module.AssessmentPage })));
const ReviewPage = lazy(() => import('./platform/screens').then((module) => ({ default: module.ReviewPage })));
const AuthPage = lazy(() => import('./platform/screens').then((module) => ({ default: module.AuthPage })));
const DashboardPage = lazy(() => import('./platform/screens').then((module) => ({ default: module.DashboardPage })));
const SchemesPage = lazy(() => import('./platform/screens').then((module) => ({ default: module.SchemesPage })));
const SchemeGuidancePage = lazy(() => import('./platform/screens').then((module) => ({ default: module.SchemeGuidancePage })));
const NgoPage = lazy(() => import('./platform/screens').then((module) => ({ default: module.NgoPage })));
const DocumentsPage = lazy(() => import('./platform/screens').then((module) => ({ default: module.DocumentsPage })));
const AssistantPage = lazy(() => import('./platform/screens').then((module) => ({ default: module.AssistantPage })));
const TrackerPage = lazy(() => import('./platform/screens').then((module) => ({ default: module.TrackerPage })));
const ProfilePage = lazy(() => import('./platform/screens').then((module) => ({ default: module.ProfilePage })));
const AdminPage = lazy(() => import('./platform/screens').then((module) => ({ default: module.AdminPage })));
const SettingsPage = lazy(() => import('./platform/screens').then((module) => ({ default: module.SettingsPage })));

const features = [
  { icon: SearchCheck, title: 'landing.feature.1.title', text: 'landing.feature.1.body' },
  { icon: Languages, title: 'landing.feature.2.title', text: 'landing.feature.2.body' },
  { icon: FileCheck2, title: 'landing.feature.3.title', text: 'landing.feature.3.body' },
  { icon: Headset, title: 'landing.feature.4.title', text: 'landing.feature.4.body' }
];

const chapters = [
  { id: 1, align: 'left' },
  { id: 2, align: 'right' },
  { id: 3, align: 'left' },
  { id: 4, align: 'center' },
  { id: 5, align: 'right' },
  { id: 6, align: 'left' },
  { id: 7, align: 'center' }
];

function useTranslator() {
  const { language } = useLanguage();
  return (key, values) => translate(language, key, values);
}

function RouteLoading() {
  const t = useTranslator();
  return <div className="route-loading" role="status">{t('route.loading')}</div>;
}

function Navbar() {
  const [open, setOpen] = useState(false);
  const t = useTranslator();

  return (
    <header className="navbar">
      <a className="brand" href="#top">
        <span className="brand-mark"><HeartHandshake size={22} /></span>Neravu
      </a>
      <button
        className="menu-toggle"
        type="button"
        onClick={() => setOpen(!open)}
        aria-label={t('landing.menu')}
      >
        {open ? <X /> : <Menu />}
      </button>
      <nav className={open ? 'nav-links open' : 'nav-links'}>
        <a href="#story" onClick={() => setOpen(false)}>{t('landing.nav.approach')}</a>
        <a href="#features" onClick={() => setOpen(false)}>{t('landing.nav.help')}</a>
        <a href="#support" onClick={() => setOpen(false)}>{t('landing.nav.human')}</a>
      </nav>
      <LanguageSelect className="landing-language" />
      <Link className="nav-cta" to="/start/role">{t('landing.getStarted')}</Link>
    </header>
  );
}

function StoryChapter({ chapter }) {
  const t = useTranslator();

  return (
    <article className={`chapter chapter-${chapter.align}`}>
      <span className="eyebrow">{t(`landing.chapter.${chapter.id}.eyebrow`)}</span>
      <h2>{t(`landing.chapter.${chapter.id}.title`)}</h2>
      <p>{t(`landing.chapter.${chapter.id}.body`)}</p>
    </article>
  );
}

function Story() {
  const t = useTranslator();

  return (
    <section id="story" className="story-section">
      <div className="story-sticky">
        <div className="scene-topline">
          <span className="scene-dot" /> {t('landing.story.journey')}
          <span className="scene-counter">{t('landing.story.sceneCount')}</span>
        </div>
        <Suspense fallback={<div className="canvas-wrap" aria-hidden="true" />}>
          <HospitalScene />
        </Suspense>
        <div className="story-caption">
          <span>{t('landing.story.caption')}</span>
          <span>{t('landing.story.scroll')}</span>
        </div>
      </div>
      <div className="story-track">
        {chapters.map((chapter) => <StoryChapter key={chapter.id} chapter={chapter} />)}
      </div>
    </section>
  );
}

function LandingPage() {
  const t = useTranslator();

  return (
    <div id="top" className="site-shell">
      <Navbar />
      <TranslationNotice />
      <main>
        <section className="hero">
          <div className="hero-copy">
            <span className="eyebrow">{t('landing.hero.eyebrow')}</span>
            <h1>{t('landing.hero.title')}</h1>
            <p>{t('landing.hero.description')}</p>
            <Link className="primary-button" to="/start/role">
              {t('landing.getStarted')} <ArrowDown size={16} />
            </Link>
          </div>
          <div className="hero-art">
            <div className="hero-orbit orbit-one" />
            <div className="hero-orbit orbit-two" />
            <div className="hero-symbol"><HeartHandshake size={76} strokeWidth={1.2} /></div>
            <span className="hero-caption">{t('landing.careValues')}</span>
          </div>
        </section>

        <Story />

        <section id="features" className="features-section">
          <div className="section-heading">
            <span className="eyebrow">{t('landing.features.eyebrow')}</span>
            <h2>{t('landing.features.title')}</h2>
            <p>{t('landing.features.description')}</p>
          </div>
          <div className="feature-grid">
            {features.map(({ icon: Icon, title, text }, index) => (
              <article className="feature-card" key={title}>
                <span className="feature-icon"><Icon size={23} /></span>
                <span className="feature-number">0{index + 1}</span>
                <h3>{t(title)}</h3>
                <p>{t(text)}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="support-section" id="support">
          <div className="support-icon"><HeartHandshake size={34} /></div>
          <span className="eyebrow">{t('landing.support.eyebrow')}</span>
          <h2>{t('landing.support.title')}</h2>
          <p>{t('landing.support.description')}</p>
        </section>
      </main>
      <footer>
        <a className="brand" href="#top">
          <span className="brand-mark"><HeartHandshake size={20} /></span>Neravu
        </a>
        <span>{t('landing.footer.tagline')}</span>
        <span>{t('landing.footer.disclaimer')}</span>
      </footer>
    </div>
  );
}

export default function App() {
  return (
    <PlatformProvider>
      <Suspense fallback={<RouteLoading />}>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/start" element={<Navigate to="/start/role" replace />} />
          <Route path="/start/:step" element={<SetupPage />} />
          <Route path="/assessment/access" element={<AssessmentAccessPage />} />
          <Route path="/assessment" element={<AssessmentPage />} />
          <Route path="/assessment/review" element={<ReviewPage />} />
          <Route path="/login" element={<AuthPage />} />
          <Route path="/signup" element={<AuthPage />} />
          <Route path="/forgot-password" element={<AuthPage />} />
          <Route path="/reset-password" element={<AuthPage />} />
          <Route element={<PlatformLayout />}>
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/schemes" element={<SchemesPage />} />
            <Route path="/schemes/:schemeId" element={<SchemeGuidancePage />} />
            <Route path="/ngos" element={<NgoPage />} />
            <Route path="/documents" element={<DocumentsPage />} />
            <Route path="/assistant" element={<AssistantPage />} />
            <Route path="/tracker" element={<TrackerPage />} />
            <Route path="/profile" element={<ProfilePage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/admin" element={<AdminPage />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </PlatformProvider>
  );
}
