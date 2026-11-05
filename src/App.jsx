import React, { lazy, Suspense, useState } from 'react';
import { HeartHandshake, Menu, X, ArrowDown, Languages, FileCheck2, SearchCheck, Headset } from 'lucide-react';
import { Link, Navigate, Route, Routes } from 'react-router-dom';
import { PlatformProvider } from './platform/PlatformContext';
import { LanguageSelect, PlatformLayout, TranslationNotice } from './platform/components';

const HospitalScene = lazy(() => import('./scene/HospitalScene'));
const SetupPage = lazy(() => import('./platform/screens').then((module) => ({ default: module.SetupPage })));
const AssessmentAccessPage = lazy(() => import('./platform/screens').then((module) => ({ default: module.AssessmentAccessPage })));
const AssessmentPage = lazy(() => import('./platform/screens').then((module) => ({ default: module.AssessmentPage })));
const ReviewPage = lazy(() => import('./platform/screens').then((module) => ({ default: module.ReviewPage })));
const AuthPage = lazy(() => import('./platform/screens').then((module) => ({ default: module.AuthPage })));
const DashboardPage = lazy(() => import('./platform/screens').then((module) => ({ default: module.DashboardPage })));
const SchemesPage = lazy(() => import('./platform/screens').then((module) => ({ default: module.SchemesPage })));
const NgoPage = lazy(() => import('./platform/screens').then((module) => ({ default: module.NgoPage })));
const DocumentsPage = lazy(() => import('./platform/screens').then((module) => ({ default: module.DocumentsPage })));
const AssistantPage = lazy(() => import('./platform/screens').then((module) => ({ default: module.AssistantPage })));
const TrackerPage = lazy(() => import('./platform/screens').then((module) => ({ default: module.TrackerPage })));
const ProfilePage = lazy(() => import('./platform/screens').then((module) => ({ default: module.ProfilePage })));
const SettingsPage = lazy(() => import('./platform/screens').then((module) => ({ default: module.SettingsPage })));

const features = [
  { icon: SearchCheck, title: 'Find relevant assistance', text: 'Explore government scheme information and charitable support options. Confirm details with each official programme.' },
  { icon: Languages, title: 'Understand in your language', text: 'Get clear explanations in English, Telugu and Hindi, with more languages planned.' },
  { icon: FileCheck2, title: 'Get application-ready', text: 'Understand eligibility, prepare documents and follow a personalized checklist.' },
  { icon: Headset, title: 'Know what to do next', text: 'Navigate confusing steps and learn where to verify information with a trusted human guide.' }
];
function Navbar(){const [open,setOpen]=useState(false);return <header className="navbar"><a className="brand" href="#top"><span className="brand-mark"><HeartHandshake size={22}/></span>Neravu</a><button className="menu-toggle" onClick={()=>setOpen(!open)} aria-label="Toggle navigation">{open?<X/>:<Menu/>}</button><nav className={open?'nav-links open':'nav-links'}><a href="#story" onClick={()=>setOpen(false)}>Our approach</a><a href="#features" onClick={()=>setOpen(false)}>How it helps</a><a href="#support" onClick={()=>setOpen(false)}>Human support</a></nav><LanguageSelect className="landing-language" /><Link className="nav-cta" to="/start/role">Get started</Link></header>}
const chapters=[
 {eyebrow:'01 / THE HOSPITAL WARD',title:'No family should navigate this journey alone.',body:'A patient is receiving care. Beside the bed, their daughter holds their hand, trying to stay strong while worrying about what comes next.',align:'left'},
 {eyebrow:'02 / SEARCHING FOR HELP',title:'When treatment begins, finding financial support becomes another challenge.',body:'The caregiver approaches the hospital reception. Staff are doing their best to help many families, but finding a clear answer takes time.',align:'right'},
 {eyebrow:'03 / LOST IN THE SYSTEM',title:'Which scheme applies? Am I eligible? What documents do I need?',body:'Bills, scheme forms and insurance paperwork pile up. The family is left trying to make sense of requirements and where to begin.',align:'left'},
 {eyebrow:'04 / A MOMENT OF CLARITY',title:'A clearer path changes what feels possible.',body:'The noise begins to fade. Fragmented information comes together as one understandable journey.',align:'center'},
 {eyebrow:'05 / FIND RELEVANT SUPPORT',title:'See the support that may fit your situation.',body:'Explore information about potential government schemes and charitable support—without having to piece every source together alone.',align:'right'},
 {eyebrow:'06 / KNOW YOUR NEXT STEP',title:'Understand what to prepare and what comes next.',body:'Get a personalized document checklist, clear explanations of next steps, and guidance on where to verify programme requirements with a trusted source.',align:'left'},
 {eyebrow:'07 / CARE WITH CLARITY',title:'Your family deserves support at every step.',body:'Neravu helps bring financial guidance and human support closer, so families can focus on caring for one another.',align:'center'}
];
function StoryChapter({chapter}){return <article className={`chapter chapter-${chapter.align}`}><span className="eyebrow">{chapter.eyebrow}</span><h2>{chapter.title}</h2><p>{chapter.body}</p></article>}
function Story(){return <section id="story" className="story-section"><div className="story-sticky"><div className="scene-topline"><span className="scene-dot"/> THE JOURNEY WITH NERAVU <span className="scene-counter">7 SCENES / 1 JOURNEY</span></div><Suspense fallback={<div className="canvas-wrap" aria-hidden="true"/>}><HospitalScene/></Suspense><div className="story-caption"><span>CARE SHOULD NOT COME WITH CONFUSION</span><span>SCROLL ↓</span></div></div><div className="story-track">{chapters.map((c)=><StoryChapter key={c.eyebrow} chapter={c}/> )}</div></section>}
function LandingPage(){return <div id="top" className="site-shell"><Navbar/><TranslationNotice/><main><section className="hero"><div className="hero-copy"><span className="eyebrow">FINANCIAL NAVIGATION FOR CANCER CARE</span><h1>No family should navigate this journey alone.</h1><p>Neravu helps patients and caregivers understand and access financial assistance with personalized, multilingual guidance.</p><Link className="primary-button" to="/start/role">Get started <ArrowDown size={16}/></Link></div><div className="hero-art"><div className="hero-orbit orbit-one"/><div className="hero-orbit orbit-two"/><div className="hero-symbol"><HeartHandshake size={76} strokeWidth={1.2}/></div><span className="hero-caption">Care · Clarity · Support</span></div></section><Story/><section id="features" className="features-section"><div className="section-heading"><span className="eyebrow">ONE CONNECTED JOURNEY</span><h2>Practical guidance, when it matters.</h2><p>Neravu is designed to help families understand available support and take informed next steps.</p></div><div className="feature-grid">{features.map(({icon:Icon,title,text},i)=><article className="feature-card" key={title}><span className="feature-icon"><Icon size={23}/></span><span className="feature-number">0{i+1}</span><h3>{title}</h3><p>{text}</p></article>)}</div></section><section className="support-section" id="support"><div className="support-icon"><HeartHandshake size={34}/></div><span className="eyebrow">HUMAN SUPPORT STILL MATTERS</span><h2>Technology can guide. People can support.</h2><p>Neravu is designed to help families find verified helplines, hospital counsellors and authorized support organizations. A live directory and referral service are not connected in this demo.</p></section></main><footer><a className="brand" href="#top"><span className="brand-mark"><HeartHandshake size={20}/></span>Neravu</a><span>Support at every step.</span><span>Information is guidance, not a guarantee of scheme approval.</span></footer></div>}

export default function App(){
  return <PlatformProvider><Suspense fallback={<div className="route-loading" role="status">Loading Neravu…</div>}><Routes>
    <Route path="/" element={<LandingPage/>}/>
    <Route path="/start" element={<Navigate to="/start/role" replace/>}/>
    <Route path="/start/:step" element={<SetupPage/>}/>
    <Route path="/assessment/access" element={<AssessmentAccessPage/>}/>
    <Route path="/assessment" element={<AssessmentPage/>}/>
    <Route path="/assessment/review" element={<ReviewPage/>}/>
    <Route path="/login" element={<AuthPage/>}/>
    <Route path="/signup" element={<AuthPage/>}/>
    <Route path="/forgot-password" element={<AuthPage/>}/>
    <Route path="/reset-password" element={<AuthPage/>}/>
    <Route element={<PlatformLayout/>}>
      <Route path="/dashboard" element={<DashboardPage/>}/>
      <Route path="/schemes" element={<SchemesPage/>}/>
      <Route path="/ngos" element={<NgoPage/>}/>
      <Route path="/documents" element={<DocumentsPage/>}/>
      <Route path="/assistant" element={<AssistantPage/>}/>
      <Route path="/tracker" element={<TrackerPage/>}/>
      <Route path="/profile" element={<ProfilePage/>}/>
      <Route path="/settings" element={<SettingsPage/>}/>
    </Route>
    <Route path="*" element={<Navigate to="/" replace/>}/>
  </Routes></Suspense></PlatformProvider>
}
