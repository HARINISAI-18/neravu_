import React, { useEffect, useState } from 'react';
import { ArrowRight, HeartHandshake, Linkedin, Mail, ShieldCheck, Users } from 'lucide-react';
import { Link } from 'react-router-dom';
import { BrandLogo, LanguageSelect } from './components';
import { translate, useLanguage } from './i18n';
import './info-pages.css';

const contactEmail = 'optimizers64@gmail.com';

function InfoPageLayout({ activePage, pageTitle, children }) {
  const { language } = useLanguage();
  const t = (key) => translate(language, key);
  useEffect(() => {
    const previousTitle = document.title;
    document.title = `${pageTitle} | Neravu`;
    return () => { document.title = previousTitle; };
  }, [pageTitle]);
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
        <Link to="/" className="brand info-brand" aria-label={t('brand.home')}><BrandLogo /></Link>
        <nav className="info-footer-links" aria-label={t('info.footer.label')}>
          {links.map(({ to, key }) => <Link key={to} to={to}>{t(key)}</Link>)}
          <a href={`mailto:${contactEmail}`}>{contactEmail}</a>
        </nav>
      </footer>
    </div>
  );
}

const storyStages = [
  { title: 'info.about.story.1.title', body: 'info.about.story.1.body' },
  { title: 'info.about.story.2.title', body: 'info.about.story.2.body' },
  { title: 'info.about.story.3.title', body: 'info.about.story.3.body' },
  { title: 'info.about.story.4.title', body: 'info.about.story.4.body' }
];

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

const principles = [
  { title: 'info.about.principle.1.title', body: 'info.about.principle.1.body' },
  { title: 'info.about.principle.2.title', body: 'info.about.principle.2.body' },
  { title: 'info.about.principle.3.title', body: 'info.about.principle.3.body' }
];

export function AboutPage() {
  const { language } = useLanguage();
  const t = (key) => translate(language, key);

  return (
    <InfoPageLayout activePage="/about" pageTitle={t('info.about.title')}>
      <section className="info-hero">
        <span className="eyebrow">{t('info.about.eyebrow')}</span>
        <h1>{t('info.about.title')}</h1>
        <p>{t('info.about.subtitle')}</p>
      </section>

      <section className="info-mission" aria-labelledby="mission-heading">
        <span className="info-section-icon"><HeartHandshake size={23} /></span>
        <div>
          <h2 id="mission-heading">{t('info.about.mission')}</h2>
          <p>{t('info.about.missionText')}</p>
        </div>
      </section>

      <section className="info-section" aria-labelledby="story-heading">
        <div className="info-section-heading">
          <span className="eyebrow">{t('info.about.storyEyebrow')}</span>
          <h2 id="story-heading">{t('info.about.story')}</h2>
        </div>
        <ol className="info-timeline">
          {storyStages.map((stage, index) => (
            <li className="info-timeline-item" key={stage.title}>
              <span className="info-timeline-number">0{index + 1}</span>
              <div><h3>{t(stage.title)}</h3><p>{t(stage.body)}</p></div>
            </li>
          ))}
        </ol>
      </section>

      <section className="info-section" aria-labelledby="team-heading">
        <div className="info-section-heading">
          <span className="eyebrow">{t('info.about.teamEyebrow')}</span>
          <h2 id="team-heading">{t('info.about.team')}</h2>
          <p>{t('info.about.teamIntro')}</p>
        </div>
        <div className="info-team-grid">
          {team.map((member) => (
            <article className="info-team-card" key={member.initials}>
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

      <section className="info-section" aria-labelledby="approach-heading">
        <div className="info-section-heading">
          <span className="eyebrow">{t('info.about.approachEyebrow')}</span>
          <h2 id="approach-heading">{t('info.about.approach')}</h2>
        </div>
        <div className="info-principle-grid">
          {principles.map((principle) => (
            <article className="info-principle-card" key={principle.title}>
              <ShieldCheck size={20} aria-hidden="true" />
              <h3>{t(principle.title)}</h3>
              <p>{t(principle.body)}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="info-cta">
        <div><h2>{t('info.about.ctaTitle')}</h2><p>{t('info.about.ctaText')}</p></div>
        <Link className="button button-primary" to="/assessment/access">{t('info.about.ctaButton')} <ArrowRight size={16} /></Link>
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
