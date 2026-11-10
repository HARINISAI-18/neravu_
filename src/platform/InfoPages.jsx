import React, { useEffect, useState } from 'react';
import {
  ArrowRight, Check, CircleCheck, ExternalLink, FileText, Linkedin,
  Mail, Search, ShieldCheck, Users, Volume2
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { BrandLogo, LanguageSelect } from './components';
import { aboutStatistics, assistanceJourney, evidenceSource, researchObservations, workflowExamples } from './about-page-data';
import { translate, useLanguage } from './i18n';
import './info-pages.css';

const contactEmail = 'optimizers64@gmail.com';

function InfoPageLayout({ activePage, pageTitle, pageDescription, children }) {
  const { language } = useLanguage();
  const t = (key) => translate(language, key);
  useEffect(() => {
    const previousTitle = document.title;
    const description = document.querySelector('meta[name="description"]');
    const previousDescription = description?.content;
    document.title = `${pageTitle} | Neravu`;
    if (description && pageDescription) description.content = pageDescription;
    return () => {
      document.title = previousTitle;
      if (description && previousDescription !== undefined) description.content = previousDescription;
    };
  }, [pageDescription, pageTitle]);
  const links = [
    { to: '/about', key: 'info.nav.about' },
    { to: '/privacy', key: 'info.nav.privacy' },
    { to: '/contact', key: 'info.nav.contact' }
  ];

  return (
    <div className="info-site-shell">
      <header className="info-site-header">
        <Link to="/" className="brand info-brand" aria-label={t('brand.home')}><BrandLogo /></Link>
        <nav className="info-site-nav" aria-label={t('info.nav.label')}>
          {links.map(({ to, key }) => (
            <Link key={to} to={to} aria-current={activePage === to ? 'page' : undefined}>{t(key)}</Link>
          ))}
        </nav>
        <div className="info-header-actions">
          <LanguageSelect />
          <Link className="button button-primary info-header-cta" to="/assessment/access">{t('landing.getStarted')}</Link>
        </div>
      </header>
      <main className="info-main" id="main-content">{children}</main>
      <footer className="info-footer">
        <div className="info-footer-brand">
          <Link to="/" className="brand info-brand" aria-label={t('brand.home')}><BrandLogo /></Link>
          <span>{t('brand.tagline')}</span>
        </div>
        <nav className="info-footer-links" aria-label={t('info.footer.label')}>
          {links.map(({ to, key }) => <Link key={to} to={to}>{t(key)}</Link>)}
          <a href={`mailto:${contactEmail}`}>{contactEmail}</a>
        </nav>
      </footer>
    </div>
  );
}

const team = [
  {
    initials: 'RH',
    name: 'Dr. Reem Hunain',
    role: 'info.about.team.reem.role',
    photo: '/team/reem-hunain.png',
    photoPosition: 'center 36%',
    linkedin: 'https://www.linkedin.com/in/reemhunain/',
    description: 'info.about.team.reem.description'
  },
  {
    initials: 'HS',
    name: 'Ch. Harini Sai',
    role: 'info.about.team.harini.role',
    photo: '/team/harini-sai.jpg',
    photoPosition: 'center 48%',
    linkedin: 'https://www.linkedin.com/in/harini-sai18/',
    description: 'info.about.team.harini.description'
  },
  {
    initials: 'LC',
    name: 'Ch. Leela Chaitanya',
    role: 'info.about.team.chaitanya.role',
    photo: '/team/leela-chaitanya.jpeg',
    photoPosition: 'center 14%',
    linkedin: 'https://www.linkedin.com/in/chunduri-leela-chaitanya-081537217/',
    description: 'info.about.team.chaitanya.description'
  },
  {
    initials: 'RS',
    name: 'R. Santosh',
    role: 'info.about.team.santosh.role',
    photo: '/team/santosh-reddi.png',
    photoPosition: 'center 42%',
    linkedin: 'https://www.linkedin.com/in/santoshreddi-22614cm003/',
    description: 'info.about.team.santosh.description'
  }
];

function AboutSectionHeading({ eyebrow, title, description, id }) {
  const { language } = useLanguage();
  const t = (key) => translate(language, key);
  return (
    <div className="about-section-heading">
      <span className="eyebrow">{t(eyebrow)}</span>
      <h2 id={id}>{t(title)}</h2>
      {description && <p>{t(description)}</p>}
    </div>
  );
}

function CitationLink({ source, label }) {
  return (
    <a className="about-citation" href={source.href} target="_blank" rel="noopener noreferrer">
      {label} <ExternalLink size={13} aria-hidden="true" />
    </a>
  );
}

function AboutStatistics({ t }) {
  return (
    <section className="about-section about-statistics" aria-labelledby="about-stats-heading">
      <AboutSectionHeading eyebrow="info.about.stats.eyebrow" title="info.about.stats.title" id="about-stats-heading" />
      <div className="about-stat-grid">
        {aboutStatistics.map((stat, index) => (
          <article className={`about-stat about-stat-${index + 1}`} key={stat.value}>
            {stat.chartPercent ? (
              <div
                className="about-stat-chart"
                role="img"
                aria-label={`${stat.value}. ${t(stat.description)} ${t(stat.context)}`}
              >
                <svg viewBox="0 0 100 100" aria-hidden="true">
                  <circle className="about-stat-chart-track" cx="50" cy="50" r="42" />
                  <circle
                    className="about-stat-chart-value"
                    cx="50"
                    cy="50"
                    r="42"
                    pathLength="100"
                    strokeDasharray={`${stat.chartPercent} 100`}
                  />
                </svg>
                <span>{stat.value}</span>
              </div>
            ) : <p className="about-stat-value">{stat.value}</p>}
            <p className="about-stat-description">{t(stat.description)}</p>
            <p className="about-stat-context">{t(stat.context)}</p>
            <CitationLink source={stat.source} label={`${t('info.about.sourceLabel')}: ${stat.source.title}`} />
            <p className="about-stat-source-note">{t(stat.source.detail)}</p>
          </article>
        ))}
      </div>
      <div className="about-bar-chart" role="group" aria-label={t('info.about.stats.chartLabel')}>
        <h3>{t('info.about.stats.chartLabel')}</h3>
        <div className="about-bar-axis" aria-hidden="true">
          <span />
          <div className="about-bar-ticks"><span>0%</span><span>25%</span><span>50%</span><span>75%</span><span>100%</span></div>
          <span />
        </div>
        {aboutStatistics.filter((stat) => stat.chartPercent).map((stat) => (
          <div className="about-bar-row" key={stat.value}>
            <span className="about-bar-label">{stat.value}</span>
            <span className="about-bar-track" role="img" aria-label={`${stat.value}: ${t(stat.description)}`}>
              <span style={{ width: `${stat.chartPercent}%` }} />
            </span>
            <span className="about-bar-description">{t(stat.description)}</span>
          </div>
        ))}
      </div>
      <p className="about-stat-footnote">{t('info.about.stats.footnote')}</p>
    </section>
  );
}

function HeroJourneyPreview({ t }) {
  return (
    <aside className="about-hero-preview" aria-label={t('info.about.illustrativeLabel')}>
      <div className="about-preview-heading">
        <span className="about-preview-mark" aria-hidden="true"><FileText size={17} /></span>
        <div>
          <span className="about-preview-label">{t('info.about.illustrativeLabel')}</span>
          <h2>{t('info.about.journey.title')}</h2>
        </div>
      </div>
      <ol className="about-preview-steps">
        {assistanceJourney.slice(0, 3).map((stage, index) => (
          <li key={stage.title}>
            <span className="about-preview-step-number">{index + 1}</span>
            <div>
              <h3>{t(stage.title)}</h3>
              <p>{t(stage.question)}</p>
            </div>
          </li>
        ))}
      </ol>
      <p className="about-preview-footnote">{t('info.about.demo.disclaimer')}</p>
    </aside>
  );
}

function AboutPurpose({ t }) {
  return (
    <aside className="about-purpose-band">
      <span className="eyebrow">{t('info.about.eyebrow')}</span>
      <p>{t('info.about.missionText')}</p>
    </aside>
  );
}

function JourneyMockup({ kind, t }) {
  const mockupText = {
    search: ['info.about.mockup.search.1', 'info.about.mockup.search.2'],
    eligibility: ['info.about.mockup.eligibility.1', 'info.about.mockup.eligibility.2'],
    documents: ['info.about.mockup.documents.1', 'info.about.mockup.documents.2'],
    route: ['info.about.mockup.route.1', 'info.about.mockup.route.2'],
    followup: ['info.about.mockup.followup.1', 'info.about.mockup.followup.2']
  }[kind];
  return (
    <div className={`about-journey-mockup mockup-${kind}`} aria-label={t('info.about.illustrativeLabel')}>
      <span className="about-mockup-status" aria-hidden="true"><span />{t(mockupText[0])}</span>
      <span className="about-mockup-message">{t(mockupText[1])}</span>
    </div>
  );
}

function AssistanceJourney({ t }) {
  return (
    <section className="about-section" aria-labelledby="about-journey-heading">
      <AboutSectionHeading eyebrow="info.about.journey.eyebrow" title="info.about.journey.title" id="about-journey-heading" />
      <ol className="about-journey-list">
        {assistanceJourney.map((stage, index) => (
          <li className="about-journey-step" key={stage.title}>
            <span className="about-journey-index">{String(index + 1).padStart(2, '0')}</span>
            <h3>{t(stage.title)}</h3>
            <p className="about-journey-question">{t(stage.question)}</p>
            <JourneyMockup kind={stage.mockup} t={t} />
          </li>
        ))}
      </ol>
      <p className="about-illustration-note">{t('info.about.journey.note')}</p>
    </section>
  );
}

function DocumentGuidance({ t }) {
  const documents = [
    { key: 'info.about.document.identity', complete: true },
    { key: 'info.about.document.income', complete: false },
    { key: 'info.about.document.medical', complete: true },
    { key: 'info.about.document.referral', complete: false }
  ];
  return (
    <section className="about-section" aria-labelledby="about-documents-heading">
      <AboutSectionHeading eyebrow="info.about.documents.eyebrow" title="info.about.documents.title" id="about-documents-heading" />
      <div className="about-document-compare">
        <article className="about-document-panel about-document-before">
          <span className="about-panel-label">{t('info.about.documents.beforeLabel')}</span>
          <h3>{t('info.about.documents.beforeTitle')}</h3>
          <p>{t('info.about.documents.beforeText')}</p>
          <ul className="about-question-list">
            <li>{t('info.about.documents.question.1')}</li>
            <li>{t('info.about.documents.question.2')}</li>
            <li>{t('info.about.documents.question.3')}</li>
          </ul>
        </article>
        <article className="about-document-panel about-document-after">
          <span className="about-panel-label">{t('info.about.documents.afterLabel')}</span>
          <h3>{t('info.about.documents.afterTitle')}</h3>
          <p>{t('info.about.documents.afterText')}</p>
          <ul className="about-checklist">
            {documents.map(({ key, complete }) => (
              <li key={key} className={complete ? 'is-complete' : 'is-needed'}>
                <span aria-hidden="true">{complete ? <Check size={14} /> : '!'}</span>
                {t(key)}
              </li>
            ))}
          </ul>
          <p className="about-document-help">
            {t('info.about.documents.officialHelp')}{' '}
            <a href="https://services.india.gov.in/" target="_blank" rel="noopener noreferrer">
              {t('info.about.documents.officialLink')} <ExternalLink size={12} aria-hidden="true" />
            </a>
          </p>
        </article>
      </div>
      <aside className="about-evidence-note">
        <span className="about-evidence-label">{t('info.about.evidence.published')}</span>
        <p>{t('info.about.documents.evidence')}</p>
        <CitationLink source={evidenceSource} label={`${evidenceSource.journal} · ${t('info.about.sourceLabel')}`} />
      </aside>
      <p className="about-illustration-note">{t('info.about.documents.note')}</p>
    </section>
  );
}

function ResearchJournal({ t }) {
  return (
    <section className="about-section about-research" aria-labelledby="about-research-heading">
      <AboutSectionHeading eyebrow="info.about.research.eyebrow" title="info.about.research.title" id="about-research-heading" />
      <div className="about-research-layout">
        <ol className="about-research-list">
          {researchObservations.map((observation, index) => (
            <li key={observation.title}>
              <span className="about-research-marker">{String(index + 1).padStart(2, '0')}</span>
              <div><h3>{t(observation.title)}</h3><p>{t(observation.body)}</p></div>
            </li>
          ))}
        </ol>
        <aside className="about-research-artifact">
          <span className="about-panel-label">{t('info.about.research.artifactLabel')}</span>
          <h3>{t('info.about.research.artifactTitle')}</h3>
          <div className="about-research-sheet" aria-hidden="true">
            <div className="about-sheet-row about-sheet-header"><span>{t('info.about.research.field.1')}</span><span>{t('info.about.research.field.2')}</span></div>
            <div className="about-sheet-row"><span>{t('info.about.research.row.1')}</span><span><CircleCheck size={13} /> {t('info.about.research.reviewed')}</span></div>
            <div className="about-sheet-row"><span>{t('info.about.research.row.2')}</span><span><CircleCheck size={13} /> {t('info.about.research.reviewed')}</span></div>
            <div className="about-sheet-row"><span>{t('info.about.research.row.3')}</span><span>{t('info.about.research.check')}</span></div>
          </div>
          <p>{t('info.about.research.artifactNote')}</p>
          <span className="about-research-date">{t('info.about.research.date')}</span>
        </aside>
      </div>
    </section>
  );
}

function PracticalSolution({ t }) {
  const barrierKeys = ['search', 'eligibility', 'documents', 'route', 'progress', 'language'];
  return (
    <section className="about-section about-solution" id="solution" aria-labelledby="about-solution-heading">
      <AboutSectionHeading eyebrow="info.about.solution.eyebrow" title="info.about.solution.title" id="about-solution-heading" />
      <div className="about-solution-table">
        <div className="about-solution-column">
          <h3>{t('info.about.solution.before')}</h3>
          <ul>{barrierKeys.map((key) => <li key={key}>{t(`info.about.solution.before.${key}`)}</li>)}</ul>
        </div>
        <div className="about-solution-column about-solution-neravu">
          <h3>{t('info.about.solution.after')}</h3>
          <ul>{barrierKeys.map((key) => <li key={key}><Check size={15} aria-hidden="true" />{t(`info.about.solution.after.${key}`)}</li>)}</ul>
        </div>
      </div>
      <p className="about-solution-disclaimer">{t('info.about.solution.disclaimer')}</p>
    </section>
  );
}

function WorkflowDemonstration({ t }) {
  const { language } = useLanguage();
  const [activeExample, setActiveExample] = useState(workflowExamples[0].id);
  const active = workflowExamples.find((example) => example.id === activeExample) || workflowExamples[0];
  const checklist = ['info.about.demo.item.identity', 'info.about.demo.item.medical', 'info.about.demo.item.income'];
  return (
    <section className="about-section about-demo" aria-labelledby="about-demo-heading">
      <AboutSectionHeading eyebrow="info.about.demo.eyebrow" title="info.about.demo.title" id="about-demo-heading" />
      <ol className="about-flow" aria-label={t('info.about.demo.flowLabel')}>
        {['person', 'share', 'recommend', 'review', 'apply', 'track'].map((step, index) => (
          <li key={step}><span>{index + 1}</span>{t(`info.about.demo.flow.${step}`)}</li>
        ))}
      </ol>
      <div className="about-demo-shell">
        <div className="about-demo-controls" role="group" aria-label={t('info.about.demo.controlsLabel')}>
          {workflowExamples.map((example) => (
            <button type="button" key={example.id} aria-pressed={activeExample === example.id} onClick={() => setActiveExample(example.id)}>
              {t(example.label)}
            </button>
          ))}
        </div>
        <div className="about-demo-window" aria-live="polite">
          <div className="about-demo-window-top"><span /><span /><span /><span>{t('info.about.demo.sampleLabel')}</span></div>
          <div className="about-demo-content">
            <div className="about-demo-screen">
              <span className="about-demo-product">{t('brand.tagline')}</span>
              <h3>{t(active.heading)}</h3>
              {active.id === 'discovery' && (
                <div className="about-demo-option">
                  <span className="about-demo-option-icon"><Search size={16} aria-hidden="true" /></span>
                  <div><strong>{t('info.about.demo.optionTitle')}</strong><p>{t('info.about.demo.optionDescription')}</p></div>
                  <ArrowRight size={15} aria-hidden="true" />
                </div>
              )}
              {active.id === 'documents' && (
                <ul className="about-demo-checklist">
                  {checklist.map((key, index) => <li key={key}><span className={index === 2 ? 'is-needed' : 'is-complete'}>{index === 2 ? '!' : <Check size={12} />}</span>{t(key)}</li>)}
                </ul>
              )}
              {active.id === 'language' && (
                <div className="about-demo-voice">
                  <span>{t(`info.about.demo.languagePreview.${language}`)}</span><p>{t('info.about.demo.voiceText')}</p><span className="about-demo-audio"><Volume2 size={16} aria-hidden="true" /> {t('info.about.demo.listenLabel')}</span>
                </div>
              )}
              <p className="about-demo-disclaimer">{t('info.about.demo.disclaimer')}</p>
            </div>
            <aside className="about-demo-note">
              <FileText size={17} aria-hidden="true" />
              <p>{t('info.about.demo.helperText')}</p>
            </aside>
          </div>
        </div>
      </div>
      <p className="about-illustration-note">{t('info.about.demo.note')}</p>
    </section>
  );
}

function AboutTeam({ t }) {
  return (
    <section className="about-section" aria-labelledby="team-heading">
      <AboutSectionHeading eyebrow="info.about.teamEyebrow" title="info.about.team" description="info.about.teamIntro" id="team-heading" />
      <div className="info-team-grid">
        {team.map((member) => (
          <article className={`info-team-card${member.initials === 'RH' ? ' info-team-card--lead' : ''}`} key={member.initials}>
            <div className="info-team-person">
              <span className="info-avatar-frame">
                <img
                  className="info-avatar"
                  src={member.photo}
                  alt={member.name}
                  loading="lazy"
                  decoding="async"
                  style={{ objectPosition: member.photoPosition }}
                />
              </span>
              <div className="info-team-identity">
                <h3>{member.name}</h3>
                <span>{t(member.role)}</span>
              </div>
            </div>
            <p>{t(member.description)}</p>
            <a className="info-team-link" href={member.linkedin} target="_blank" rel="noopener noreferrer" aria-label={`${member.name} on ${t('info.about.linkedin')}`}>
              <Linkedin size={15} aria-hidden="true" /> {t('info.about.linkedin')}
            </a>
          </article>
        ))}
      </div>
    </section>
  );
}

function ResponsibleDevelopment({ t }) {
  return (
    <section className="about-section about-responsible" aria-labelledby="about-responsible-heading">
      <AboutSectionHeading eyebrow="info.about.responsible.eyebrow" title="info.about.responsible.title" id="about-responsible-heading" />
      <div className="about-responsible-layout">
        <div>
          <p className="about-responsible-intro">{t('info.about.responsible.intro')}</p>
          <ul className="about-responsible-list">
            {['programmes', 'sources', 'matching', 'languages', 'role'].map((item) => <li key={item}><Check size={15} aria-hidden="true" />{t(`info.about.responsible.${item}`)}</li>)}
          </ul>
        </div>
        <aside className="about-limits">
          <h3>{t('info.about.responsible.limitsTitle')}</h3>
          <ul>
            {['decisions', 'changes', 'verify', 'evaluation', 'outcomes'].map((item) => <li key={item}>{t(`info.about.responsible.limit.${item}`)}</li>)}
          </ul>
          <Link to="/privacy">{t('info.about.responsible.privacy')} <ArrowRight size={14} aria-hidden="true" /></Link>
        </aside>
      </div>
    </section>
  );
}

export function AboutPage() {
  const { language } = useLanguage();
  const t = (key, values) => translate(language, key, values);

  return (
    <InfoPageLayout
      activePage="/about"
      pageTitle={t('info.about.metaTitle')}
      pageDescription={t('info.about.metaDescription')}
    >
      <section className="about-hero" aria-labelledby="about-title">
        <div className="about-hero-copy">
          <span className="eyebrow">{t('info.about.eyebrow')}</span>
          <h1 id="about-title">
            {t('info.about.heroTitleLead')} <span>{t('info.about.heroTitleAccent')}</span>
          </h1>
          <p>{t('info.about.subtitle')}</p>
          <p className="about-hero-byline">{t('info.about.heroByline')}</p>
          <a className="about-hero-link" href="#solution">{t('info.about.heroCta')} <ArrowRight size={16} aria-hidden="true" /></a>
        </div>
        <HeroJourneyPreview t={t} />
      </section>

      <AboutPurpose t={t} />

      <AboutStatistics t={t} />

      <AssistanceJourney t={t} />

      <DocumentGuidance t={t} />

      <ResearchJournal t={t} />

      <PracticalSolution t={t} />

      <WorkflowDemonstration t={t} />

      <AboutTeam t={t} />

      <ResponsibleDevelopment t={t} />

      <section className="about-closing" aria-labelledby="about-closing-heading">
        <div>
          <span className="eyebrow">{t('info.about.closing.eyebrow')}</span>
          <h2 id="about-closing-heading">{t('info.about.closing.title')}</h2>
          <p>{t('info.about.closing.text')}</p>
        </div>
        <div className="about-closing-actions">
          <Link className="button button-primary" to="/assessment/access">{t('info.about.closing.start')} <ArrowRight size={16} aria-hidden="true" /></Link>
          <Link className="about-contact-link" to="/contact">{t('info.about.closing.contact')}</Link>
        </div>
      </section>
    </InfoPageLayout>
  );
}

const privacySections = [
  { id: 'data', title: 'info.privacy.section.data', paragraphs: ['info.privacy.data.1', 'info.privacy.data.2'] },
  { id: 'storage', title: 'info.privacy.section.storage', paragraphs: ['info.privacy.storage.1', 'info.privacy.storage.2'] },
  { id: 'ai', title: 'info.privacy.section.ai', paragraphs: ['info.privacy.ai.1', 'info.privacy.ai.2', 'info.privacy.ai.3'] },
  { id: 'controls', title: 'info.privacy.section.choices', paragraphs: ['info.privacy.choices.1', 'info.privacy.choices.2'] },
  { id: 'security', title: 'info.privacy.section.security', paragraphs: ['info.privacy.security.1', 'info.privacy.security.2', 'info.privacy.security.3'] },
  { id: 'limits', title: 'info.privacy.section.limits', paragraphs: ['info.privacy.limits.1'] }
];

export function PrivacyPage() {
  const { language } = useLanguage();
  const t = (key) => translate(language, key);

  return (
    <InfoPageLayout activePage="/privacy" pageTitle={t('info.privacy.title')}>
      <section className="info-hero info-hero-compact">
        <span className="eyebrow">{t('info.privacy.eyebrow')}</span>
        <h1>{t('info.privacy.title')}</h1>
        <p>{t('info.privacy.subtitle')}</p>
      </section>
      <section className="privacy-summary" aria-labelledby="privacy-summary-heading">
        <ShieldCheck size={21} aria-hidden="true" />
        <div>
          <h2 id="privacy-summary-heading">{t('info.privacy.summaryTitle')}</h2>
          <p>{t('info.privacy.summaryText')}</p>
          <nav aria-label={t('info.privacy.contents')}>
            <a href="#privacy-data" onClick={() => { document.getElementById('privacy-data').open = true; }}>{t('info.privacy.data')}</a>
            <a href="#privacy-storage" onClick={() => { document.getElementById('privacy-storage').open = true; }}>{t('info.privacy.storage')}</a>
            <a href="#privacy-ai" onClick={() => { document.getElementById('privacy-ai').open = true; }}>{t('info.privacy.ai')}</a>
            <a href="#privacy-controls" onClick={() => { document.getElementById('privacy-controls').open = true; }}>{t('info.privacy.controls')}</a>
            <a href="#privacy-security" onClick={() => { document.getElementById('privacy-security').open = true; }}>{t('info.privacy.security')}</a>
          </nav>
        </div>
      </section>
      <div className="info-accordion-list">
        {privacySections.map((section) => (
          <details className="info-accordion" id={`privacy-${section.id}`} key={section.id}>
            <summary>{t(section.title)}</summary>
            <div className="info-accordion-content">{section.paragraphs.map((key) => <p key={key}>{t(key)}</p>)}</div>
          </details>
        ))}
      </div>
      <p className="info-privacy-contact">{t('info.privacy.contact')} <a href={`mailto:${contactEmail}`}>{contactEmail}</a>.</p>
    </InfoPageLayout>
  );
}

const contactRoles = [
  { value: 'Patient / Caregiver', key: 'info.contact.role.patient' },
  { value: 'Healthcare Professional', key: 'info.contact.role.professional' },
  { value: 'NGO / Organisation', key: 'info.contact.role.ngo' },
  { value: 'Researcher', key: 'info.contact.role.researcher' },
  { value: 'Other', key: 'info.contact.role.other' }
];

export function ContactPage() {
  const { language } = useLanguage();
  const t = (key) => translate(language, key);
  const [values, setValues] = useState({
    name: '',
    email: '',
    role: '',
    subject: '',
    message: '',
    consent: false,
    website: ''
  });
  const [formError, setFormError] = useState('');
  const [draftNotice, setDraftNotice] = useState('');

  const updateField = (event) => {
    const { name, value, checked, type } = event.target;
    setValues((current) => ({ ...current, [name]: type === 'checkbox' ? checked : value }));
    setFormError('');
    setDraftNotice('');
  };

  const openEmailDraft = (event) => {
    event.preventDefault();
    setFormError('');
    setDraftNotice('');
    if (values.website) {
      setFormError(t('info.contact.spamError'));
      return;
    }
    if (!event.currentTarget.checkValidity()) {
      event.currentTarget.reportValidity();
      setFormError(t('info.contact.validationError'));
      return;
    }

    const subject = `${t('info.contact.subjectPrefix')}: ${values.subject.trim().replace(/[\r\n]/g, ' ')}`;
    const roleLabel = contactRoles.find(({ value }) => value === values.role);
    const body = [
      `${t('info.contact.namePrefix')}: ${values.name.trim()}`,
      `${t('info.contact.emailPrefix')}: ${values.email.trim()}`,
      `${t('info.contact.rolePrefix')}: ${roleLabel ? t(roleLabel.key) : values.role}`,
      '',
      values.message.trim()
    ].join('\n');
    window.location.href = `mailto:${contactEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    setDraftNotice(t('info.contact.draftNotice'));
  };

  return (
    <InfoPageLayout activePage="/contact" pageTitle={t('info.contact.title')}>
      <section className="info-hero info-hero-compact">
        <span className="eyebrow">{t('info.contact.eyebrow')}</span>
        <h1>{t('info.contact.title')}</h1>
        <p>{t('info.contact.subtitle')}</p>
      </section>

      <div className="contact-layout">
        <aside className="contact-aside">
          <span className="info-section-icon"><Mail size={22} /></span>
          <h2>{t('info.contact.emailTitle')}</h2>
          <p>{t('info.contact.emailHelp')}</p>
          <a className="contact-email-link" href={`mailto:${contactEmail}`}>{contactEmail}</a>
          <div className="contact-collaboration">
            <Users size={19} aria-hidden="true" />
            <h3>{t('info.contact.collaboration')}</h3>
            <p>{t('info.contact.collaborationHelp')}</p>
          </div>
        </aside>

        <section className="contact-form-card" aria-labelledby="contact-form-heading">
          <h2 id="contact-form-heading">{t('info.contact.formTitle')}</h2>
          <p>{t('info.contact.formHelp')}</p>
          <form onSubmit={openEmailDraft} noValidate>
            <div className="contact-form-grid">
              <label>
                <span>{t('info.contact.name')} *</span>
                <input name="name" autoComplete="name" maxLength={100} required value={values.name} onChange={updateField} />
              </label>
              <label>
                <span>{t('info.contact.email')} *</span>
                <input name="email" type="email" autoComplete="email" maxLength={254} required value={values.email} onChange={updateField} />
              </label>
              <label>
                <span>{t('info.contact.role')} *</span>
                <select name="role" required value={values.role} onChange={updateField}>
                  <option value="">{t('info.contact.chooseRole')}</option>
                  {contactRoles.map(({ value, key }) => <option value={value} key={key}>{t(key)}</option>)}
                </select>
              </label>
              <label>
                <span>{t('info.contact.subject')} *</span>
                <input name="subject" maxLength={160} required value={values.subject} onChange={updateField} />
              </label>
              <label className="contact-message-field">
                <span>{t('info.contact.message')} *</span>
                <textarea name="message" rows={6} maxLength={2000} required value={values.message} onChange={updateField} />
                <small>{values.message.length}/2000</small>
              </label>
            </div>
            <div className="contact-honeypot" aria-hidden="true">
              <label htmlFor="contact-website">{t('info.contact.honeypot')}</label>
              <input id="contact-website" name="website" tabIndex={-1} autoComplete="off" value={values.website} onChange={updateField} />
            </div>
            <label className="contact-consent">
              <input name="consent" type="checkbox" required checked={values.consent} onChange={updateField} />
              <span>{t('info.contact.consent')}</span>
            </label>
            <p className="contact-privacy-reminder">{t('info.contact.privacyReminder')}</p>
            {formError && <p className="contact-form-error" role="alert">{formError}</p>}
            {draftNotice && <p className="contact-draft-notice" role="status">{draftNotice}</p>}
            <button type="submit" className="button button-primary">{t('info.contact.openDraft')} <ArrowRight size={16} /></button>
            <p className="contact-delivery-note">{t('info.contact.deliveryNote')}</p>
          </form>
        </section>
      </div>
    </InfoPageLayout>
  );
}
