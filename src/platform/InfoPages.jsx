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
  {
    title: 'We started by exploring existing assistance platforms.',
    body: 'We looked at government and financial-assistance services to understand how families search for help.'
  },
  {
    title: 'Information was often difficult to follow.',
    body: 'Broken links, scattered information, and unclear application instructions made it harder to know what to do next.'
  },
  {
    title: 'We listened and researched.',
    body: 'We contacted NGOs about available support and referral requirements, reviewed official sources, and structured scheme information.'
  },
  {
    title: 'We brought patient and clinical perspectives into the work.',
    body: 'Clinical insight and discussions with three patients and caregivers helped us focus on practical obstacles families encounter.'
  }
];

const team = [
  {
    initials: 'RH',
    name: 'Dr. Reem Hunain',
    role: 'Clinical Lead',
    photo: '/team/reem-hunain.png',
    photoPosition: 'center 36%',
    linkedin: 'https://www.linkedin.com/in/reemhunain/',
    description: 'An MBBS physician and MPH student specialising in Global Health at UC Berkeley, with experience spanning primary care, oncology, and global health research. Provides clinical and patient-centred guidance, helping translate complex assistance requirements into understandable information.'
  },
  {
    initials: 'HS',
    name: 'Ch. Harini Sai',
    role: 'Technical Lead',
    photo: '/team/harini-sai.jpg',
    photoPosition: 'center 48%',
    linkedin: 'https://www.linkedin.com/in/harini-sai18/',
    description: 'Leads frontend development, database architecture, platform integration, user experience, and coordination of technical components.'
  },
  {
    initials: 'LC',
    name: 'Ch. Leela Chaitanya',
    role: 'Team Lead',
    photo: '/team/leela-chaitanya.jpeg',
    photoPosition: 'center 14%',
    linkedin: 'https://www.linkedin.com/in/chunduri-leela-chaitanya-081537217/',
    description: 'Contributes to AI capabilities, intelligent information retrieval, RAG integration, and automation of assistance-related workflows.'
  },
  {
    initials: 'RS',
    name: 'R. Santosh',
    role: 'Backend Development',
    photo: '/team/santosh-reddi.png',
    photoPosition: 'center 42%',
    linkedin: 'https://www.linkedin.com/in/santoshreddi-22614cm003/',
    description: 'Responsible for backend engineering, server-side architecture, APIs, database integration, and reliable communication between frontend and AI components.'
  }
];

const principles = [
  {
    title: 'Patient-centred design',
    body: 'Understand real obstacles before building solutions.'
  },
  {
    title: 'Evidence-guided assistance',
    body: 'Connect families to structured programme information and supporting sources.'
  },
  {
    title: 'Inclusive technology',
    body: 'Make guidance accessible through regional languages, text, and voice.'
  }
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
          <p>We believe finding financial assistance should not become another burden during cancer treatment. Neravu helps families move from searching for support to understanding their next step.</p>
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
              <div><h3>{stage.title}</h3><p>{stage.body}</p></div>
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
                  <span>{member.role}</span>
                </div>
              </div>
              <p>{member.description}</p>
              <a className="info-team-link" href={member.linkedin} target="_blank" rel="noopener noreferrer" aria-label={`${member.name} on LinkedIn`}>
                <Linkedin size={15} aria-hidden="true" /> LinkedIn
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
              <h3>{principle.title}</h3>
              <p>{principle.body}</p>
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
  {
    title: 'Information the guided experience may use',
    content: <>
      <p>The assessment may ask for your state, cancer-care stage or type, treatment costs, hospital and assistance details, and information relevant to programme matching. Checklists and application progress can also be saved.</p>
      <p>Neravu does not automatically collect medical reports, identity documents, or financial account documents through the assessment. Account details, such as your email, are handled by Supabase when you choose to sign in.</p>
    </>
  },
  {
    title: 'Guest mode and saved progress',
    content: <>
      <p>In guest mode, assessment answers and progress are stored in local browser storage on this device. They may be lost if you clear site data or use another browser or device.</p>
      <p>Cloud progress synchronisation is opt-in. When signed in, the app asks for consent before reading or saving your assistance progress to Supabase. The project schema defines row-level security policies for user progress; the deployed database must have the corresponding schema and policies applied for those controls to protect the live project.</p>
    </>
  },
  {
    title: 'AI and external services',
    content: <>
      <p>When you use the assistant, your question and selected language are sent to the Neravu backend, which uses Sarvam AI to generate a response from retrieved information. Voice features send audio or text to the backend for transcription or speech processing with Sarvam.</p>
      <p>Do not include information you do not want processed by these services. Provider handling and retention are subject to the applicable provider terms and configuration; Neravu does not make a blanket claim that provider processing or retention never occurs.</p>
      <p>The repository does not establish a universal retention period for assistant or provider data. Check the deployed service configuration and provider terms for current retention details.</p>
    </>
  },
  {
    title: 'Consent and your choices',
    content: <>
      <p>Optional assessment questions can be skipped. Account progress synchronisation requires a separate affirmative consent. You can continue as a guest and keep progress on this device.</p>
      <p>The contact form does not submit data to a Neravu server. It opens an email draft only after you choose to continue; your email provider receives anything only if you review and send that draft. Neravu does not currently offer a referral-sharing workflow through this page.</p>
    </>
  },
  {
    title: 'Security measures and deployment limits',
    content: <>
      <p>The application uses Supabase authentication. Its database schema defines row-level security for profiles and patient progress, and the backend checks signed Supabase tokens and admin roles for protected administration routes. Guest chat sessions use HMAC-signed tokens.</p>
      <p>These are code-level measures, not a certification. Their effectiveness depends on applying the database schema and policies and setting production secrets correctly. Keep service-role and AI provider keys on the server; never expose them in frontend variables. Hosting and HTTPS configuration should also be checked for the deployed services.</p>
      <p>Neravu does not claim HIPAA compliance, independent security certification, routine penetration testing, or automatic deletion of all data.</p>
    </>
  },
  {
    title: 'Important limits',
    content: <p>Neravu provides informational and application-preparation assistance. AI-generated responses may be incomplete or outdated. Eligibility and funding decisions remain with the responsible organisations. Neravu does not replace medical professionals or provide medical diagnosis. Confirm important requirements through official programme sources.</p>
  }
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
        {privacySections.map((section, index) => (
          <details className="info-accordion" id={`privacy-${['data', 'storage', 'ai', 'controls', 'security', 'limits'][index]}`} key={section.title}>
            <summary>{section.title}</summary>
            <div className="info-accordion-content">{section.content}</div>
          </details>
        ))}
      </div>
      <p className="info-privacy-contact">{t('info.privacy.contact')} <a href={`mailto:${contactEmail}`}>{contactEmail}</a>.</p>
    </InfoPageLayout>
  );
}

const contactRoles = [
  'Patient / Caregiver',
  'Healthcare Professional',
  'NGO / Organisation',
  'Researcher',
  'Other'
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

    const subject = `Neravu contact: ${values.subject.trim().replace(/[\r\n]/g, ' ')}`;
    const body = [
      `Name: ${values.name.trim()}`,
      `Email: ${values.email.trim()}`,
      `I am a: ${values.role}`,
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
                  {contactRoles.map((role) => <option value={role} key={role}>{role}</option>)}
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
              <label htmlFor="contact-website">Leave this field empty</label>
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
