import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { appMeta, semesters, resourceLibrary, weeklyTemplate } from './data/content';
import { cloud } from './lib/supabase.js';
import './styles/app.css';

const STORAGE = 'nsu-master-hub-v3';
const DESIGN_VERSION = 'v2.0';
const DEFAULT_STATE = {
  tab: 'dashboard', activeSem: 'sem1', selectedTopic: null,
  progress: {}, notes: {}, bookmarks: {},
  dsa: { easy: 0, medium: 0, hard: 0 },
  planner: {}, studyLog: [], customResources: [],
  theme: 'light', query: '', resourceFilter: 'all', designVersion: DESIGN_VERSION,
  todayOverride: null, cloudUser: null, cloudAdmin: false, cloudConnected: false
};

function loadState() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE));
    if (!parsed) return DEFAULT_STATE;
    const merged = { ...DEFAULT_STATE, ...parsed, dsa: { ...DEFAULT_STATE.dsa, ...(parsed.dsa || {}) } };
    if (parsed.designVersion !== DESIGN_VERSION) {
      merged.theme = 'light';
      merged.designVersion = DESIGN_VERSION;
    }
    return merged;
  } catch { return DEFAULT_STATE; }
}


function routeToHash(route) {
  if (!route || !route.tab) return '#dashboard';
  if (route.tab === 'semester') return `#semester/${route.activeSem || 'sem1'}`;
  if (route.tab === 'topic') {
    const topicId = route.selectedTopic?.id || 'current';
    return `#topic/${route.activeSem || `sem${route.selectedTopic?.sem || 1}`}/${topicId}`;
  }
  return `#${route.tab}`;
}

function routeFromLocation() {
  const raw = (window.location.hash || '#dashboard').replace(/^#/, '');
  const parts = raw.split('/');
  if (parts[0] === 'semester') return { tab: 'semester', activeSem: parts[1] || 'sem1', selectedTopic: null };
  if (parts[0] === 'topic') return { tab: 'topic', activeSem: parts[1] || 'sem1', selectedTopic: null, topicId: parts[2] || null };
  return { tab: parts[0] || 'dashboard', selectedTopic: null };
}

function App() {
  const [state, setState] = useState(() => ({ ...loadState(), ...routeFromLocation() }));
  const [timer, setTimer] = useState(25 * 60);
  const [timerRunning, setTimerRunning] = useState(false);
  const [mobileNav, setMobileNav] = useState(false);
  const [commandOpen, setCommandOpen] = useState(false);
  const [cloudMessage, setCloudMessage] = useState('');
  const [adminResources, setAdminResources] = useState([]);
  const [cloudBooted, setCloudBooted] = useState(false);

  useEffect(() => localStorage.setItem(STORAGE, JSON.stringify(state)), [state]);

  useEffect(() => {
    const onPopState = (event) => {
      const route = event.state?.nsuRoute || routeFromLocation();
      setState(s => ({ ...s, tab: route.tab || 'dashboard', activeSem: route.activeSem || s.activeSem, selectedTopic: route.selectedTopic || null }));
    };
    if (!window.location.hash) {
      window.history.replaceState({ nsuRoute: { tab: state.tab, activeSem: state.activeSem, selectedTopic: null } }, '', routeToHash(state));
    } else if (!window.history.state?.nsuRoute) {
      window.history.replaceState({ nsuRoute: { tab: state.tab, activeSem: state.activeSem, selectedTopic: null } }, '', window.location.href);
    }
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
    // Route listener intentionally mounts once; navigation helpers own history entries.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!cloud.configured) { if (!cancelled) setCloudBooted(true); return; }
      try {
        const user = await cloud.getUser();
        if (!user) { if (!cancelled) setCloudBooted(true); return; }
        const isAdmin = await cloud.isAdmin(user.id).catch(() => false);
        const remote = await cloud.loadUserState(user.id).catch(() => null);
        const rs = await cloud.listResources().catch(() => []);
        if (!cancelled) {
          if (remote) setState(s => ({ ...s, ...remote, dsa:{...s.dsa,...(remote.dsa||{})}, cloudUser:user, cloudAdmin:isAdmin, cloudConnected:true }));
          else setState(s => ({ ...s, cloudUser:user, cloudAdmin:isAdmin, cloudConnected:true }));
          setAdminResources(rs || []);
          if (rs?.length) setState(s => ({ ...s, customResources: rs }));
        }
      } finally { if (!cancelled) setCloudBooted(true); }
    })();
    return () => { cancelled = true; };
  }, []);
  useEffect(() => {
  if (!state.configured || !state.cloudUser || !cloudBooted) return;

  const id = setTimeout(() => {
    const { cloudUser, cloudAdmin, cloudConnected, ...snapshot } = state;

    cloud.saveUserState(state.cloudUser.id, snapshot)
      .then(() => {
        setCloudMessage('Cloud saved ✓');
        setTimeout(() => setCloudMessage(''), 2000);
      })
      .catch(() => {
        setCloudMessage('Cloud save failed');
        setTimeout(() => setCloudMessage(''), 3000);
      });
  }, 900);

  return () => clearTimeout(id);
}, [state]);
  useEffect(() => {
    const onKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setCommandOpen(true); }
      if (e.key === 'Escape') { setCommandOpen(false); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  useEffect(() => {
    if (!timerRunning) return;
    const id = setInterval(() => setTimer(v => {
      if (v <= 1) { setTimerRunning(false); return 25 * 60; }
      return v - 1;
    }), 1000);
    return () => clearInterval(id);
  }, [timerRunning]);

  const pushRoute = (route) => {
    const cleaned = { tab: route.tab || 'dashboard', activeSem: route.activeSem || state.activeSem || 'sem1', selectedTopic: route.selectedTopic || null };
    const nextHash = routeToHash(cleaned);
    if (window.location.hash === nextHash && window.history.state?.nsuRoute) return;
    window.history.pushState({ nsuRoute: cleaned }, '', nextHash);
  };

  const set = patch => {
    const isNavigationPatch = Object.prototype.hasOwnProperty.call(patch, 'tab') ||
      Object.prototype.hasOwnProperty.call(patch, 'activeSem') ||
      Object.prototype.hasOwnProperty.call(patch, 'selectedTopic');
    if (isNavigationPatch) {
      const nextTab = patch.tab ?? state.tab;
      const nextSem = patch.activeSem ?? state.activeSem;
      const nextTopic = Object.prototype.hasOwnProperty.call(patch, 'selectedTopic') ? patch.selectedTopic : state.selectedTopic;
      pushRoute({ tab: nextTab, activeSem: nextSem, selectedTopic: nextTopic });
    }
    setState(s => ({ ...s, ...patch }));
  };

  const openTab = (tab) => { set({ tab, selectedTopic: null }); setMobileNav(false); };
  const selectSem = id => { set({ activeSem: id, tab: 'semester', selectedTopic: null }); setMobileNav(false); };
  const toggleProgress = id => setState(s => ({ ...s, progress: { ...s.progress, [id]: !s.progress[id] } }));
  const toggleBookmark = id => setState(s => ({ ...s, bookmarks: { ...s.bookmarks, [id]: !s.bookmarks[id] } }));
  const updateNote = (id, value) => setState(s => ({ ...s, notes: { ...s.notes, [id]: value } }));
  const openTopic = (topic, semester) => {
    const selectedTopic = { ...topic, sem: semester.number };
    set({ selectedTopic, tab: 'topic', activeSem: semester.id });
  };

  const allTasks = useMemo(() => semesters.flatMap(s => s.industry.flatMap(track => track.topics.map((topic, i) => ({
    id: `${s.id}:${track.id}:${i}`, sem: s.number, semId: s.id, trackId: track.id, trackTitle: track.title, label: topic
  })))), []);
  const completed = allTasks.filter(t => state.progress[t.id]).length;
  const overall = Math.round((completed / Math.max(1, allTasks.length)) * 100);
  const sem = semesters.find(s => s.id === state.activeSem) || semesters[0];

  useEffect(() => {
    const route = routeFromLocation();
    if (route.tab !== 'topic' || state.selectedTopic || !route.topicId) return;
    const targetSem = semesters.find(s => s.id === route.activeSem) || semesters[0];
    const track = targetSem.industry.find(t => t.id === route.topicId);
    if (track) setState(s => ({ ...s, activeSem: targetSem.id, tab: 'topic', selectedTopic: { ...track, sem: targetSem.number } }));
  }, []);
  const totalDsa = Number(state.dsa.easy || 0) + Number(state.dsa.medium || 0) + Number(state.dsa.hard || 0);

  const today = useMemo(() => {
    const next = allTasks.find(t => !state.progress[t.id]);
    return next || allTasks[0];
  }, [allTasks, state.progress]);

  const searchResults = useMemo(() => {
    const q = state.query.trim().toLowerCase();
    if (!q) return [];
    const out = [];
    semesters.forEach(s => {
      s.subjects.forEach(sub => {
        if (sub.join(' ').toLowerCase().includes(q)) out.push({ type: 'subject', sem: s, subject: sub });
      });
      s.industry.forEach(track => {
        const trackHay = [track.title, track.prereq, ...(track.tags || [])].join(' ').toLowerCase();
        if (trackHay.includes(q)) out.push({ type: 'topic', sem: s, topic: track, match: track.title });
        (track.topics || []).forEach(label => {
          if (label.toLowerCase().includes(q)) out.push({ type: 'topic', sem: s, topic: track, match: `${track.title} — ${label}` });
        });
      });
    });
    [...resourceLibrary, ...(state.customResources || [])].forEach(r => {
      if (`${r.name} ${r.focus} ${r.lang} ${r.semester||''} ${r.subject||''} ${r.topic||''} ${r.priority||''}`.toLowerCase().includes(q)) out.push({ type: 'resource', resource: r });
    });
    return out.slice(0, 30);
  }, [state.query, state.customResources]);

  const activeTopicProgress = sem.industry.flatMap(track => track.topics.map((label, i) => `${sem.id}:${track.id}:${i}`))
    .filter(id => state.progress[id]).length;
  const semTaskTotal = sem.industry.reduce((n, t) => n + t.topics.length, 0);
  const semProgress = Math.round(activeTopicProgress / Math.max(1, semTaskTotal) * 100);

  return <div className={`app ${state.theme}`}>
    <header className="topbar">
      <button className="brand" onClick={() => openTab('dashboard')} aria-label="Open dashboard">
        <div className="brand-mark">N</div>
        <div><div className="brand-title">NSU Master Hub</div><div className="brand-sub">CSE • AI & ML • 4-Year Learning OS</div></div>
      </button>
      <div className="top-actions">
        <button className="global-search" onClick={() => setCommandOpen(true)}><span>⌕</span><span className="search-placeholder">Search roadmap, topics, resources...</span><kbd>Ctrl K</kbd></button>
        <button className="icon-action" onClick={() => setState(s => ({ ...s, theme: s.theme === 'dark' ? 'light' : 'dark' }))}>{state.theme === 'dark' ? '☀' : '☾'}</button>
        <div className="progress-chip">{overall}% done</div>
        <button className="icon-action mobile-only" onClick={() => setMobileNav(v => !v)}>☰</button>
      </div>
    </header>

    {commandOpen && (
      <CommandPalette
        onClose={() => setCommandOpen(false)}
        query={state.query}
        results={searchResults}
        setQuery={q => set({ query: q })}
        openTab={openTab}
        selectSem={selectSem}
        openTopic={openTopic}
        clearQuery={() => set({ query: '' })}
      />
    )}

    <div className="app-shell">
      <aside className={`sidebar ${mobileNav ? 'show' : ''}`}>
        <div className="nav-label">MAIN</div>
        <Nav id="dashboard" label="Dashboard" icon="⌂" state={state} set={set} />
        <Nav id="roadmap" label="4-Year Roadmap" icon="◈" state={state} set={set} />
        <div className="nav-label">SEMESTERS</div>
        {semesters.map(s => <button key={s.id} className={`nav-btn ${state.tab === 'semester' && state.activeSem === s.id ? 'active' : ''}`} onClick={() => selectSem(s.id)}><span className="semester-index">{s.number}</span><span>Semester {s.number}</span><span className="nav-credit">{s.credits}</span></button>)}
        <div className="nav-label">WORKSPACE</div>
        {[['resources','Resources','▦'],['practice','Practice Lab','⌘'],['planner','Weekly Planner','◫'],['notes','Notes','▤'],['projects','Projects','◇'],['career','Career','↗'],['analytics','Analytics','◔'],['settings','Settings','⚙']].map(([id,label,icon]) => <Nav key={id} id={id} label={label} icon={icon} state={state} set={set} />)}
        {state.cloudAdmin && <><div className="nav-label">ADMIN</div><Nav id="admin" label="Admin Console" icon="✦" state={state} set={set} /></>}
        <div className="sidebar-footer">
          <div className="mini-stat"><span>Roadmap</span><strong>{overall}%</strong></div>
          <div className="mini-bar"><span style={{ width: `${overall}%` }} /></div>
          <small>{state.cloudConnected ? 'Cloud sync active • resources can be managed from Admin.' : 'Local-first • add Supabase later for cloud sync and Admin.'}</small>
        </div>
      </aside>

      <main className="main page-transition">
        {state.tab === 'dashboard' && <Dashboard state={state} set={set} sem={sem} overall={overall} completed={completed} totalTasks={allTasks.length} totalDsa={totalDsa} today={today} openTopic={openTopic} selectSem={selectSem} />}
        {state.tab === 'roadmap' && <Roadmap selectSem={selectSem} openTopic={openTopic} />}
        {state.tab === 'semester' && <SemesterView sem={sem} state={state} semProgress={semProgress} toggleProgress={toggleProgress} toggleBookmark={toggleBookmark} openTopic={openTopic} />}
        {state.tab === 'topic' && state.selectedTopic && <TopicView topic={state.selectedTopic} state={state} setState={setState} toggleProgress={toggleProgress} toggleBookmark={toggleBookmark} updateNote={updateNote} goBack={() => window.history.length > 1 ? window.history.back() : selectSem(`sem${state.selectedTopic.sem}`)} />}
        {state.tab === 'resources' && <Resources state={state} set={set} />}
        {state.tab === 'practice' && <Practice timer={timer} setTimer={setTimer} running={timerRunning} setRunning={setTimerRunning} dsa={state.dsa} setState={setState} />}
        {state.tab === 'planner' && <Planner state={state} setState={setState} today={today} />}
        {state.tab === 'notes' && <Notes state={state} updateNote={updateNote} />}
        {state.tab === 'projects' && <Projects state={state} set={set} />}
        {state.tab === 'career' && <Career state={state} set={set} />}
        {state.tab === 'analytics' && <Analytics state={state} overall={overall} completed={completed} totalTasks={allTasks.length} totalDsa={totalDsa} />}
        {state.tab === 'settings' && <Settings state={state} setState={setState} cloudMessage={cloudMessage}
          onLogin={async (email,password) => { try { const user = await cloud.signIn(email,password); const admin = await cloud.isAdmin(user.id).catch(()=>false); const remote = await cloud.loadUserState(user.id).catch(()=>null); const rs = await cloud.listResources().catch(()=>[]); setAdminResources(rs||[]); setState(s=>({...s,...(remote||{}),customResources:rs||s.customResources,cloudUser:user,cloudAdmin:admin,cloudConnected:true})); setCloudMessage(admin?'Admin access granted':'Cloud connected'); } catch(e) { setCloudMessage(e.message); } }}
          onSignup={async (email,password) => { try { const user = await cloud.signUp(email,password); setCloudMessage(user ? 'Account created. Check your email if confirmation is enabled.' : 'Account created.'); } catch(e){ setCloudMessage(e.message); } }}
          onLogout={async()=>{await cloud.signOut(); setState(s=>({...s,cloudUser:null,cloudAdmin:false,cloudConnected:false})); setCloudMessage('Signed out');}} />}
        {state.tab === 'admin' && state.cloudAdmin && <AdminConsole resources={adminResources} setResources={(rows)=>{setAdminResources(rows); setState(s=>({...s,customResources:rows}));}} message={cloudMessage} />}
      </main>
    </div>
    <footer className="footer"><span>NSU Master Hub</span><span>Personal Learning OS • Resource-driven • Dependency-aware</span><span>© 2026</span></footer>
  </div>;
}

function Nav({ id, label, icon, state, set }) { return <button className={`nav-btn ${state.tab === id ? 'active' : ''}`} onClick={() => set({ tab: id })}><span className="nav-icon">{icon}</span><span>{label}</span></button>; }
function Card({ children, className='' }) { return <section className={`card ${className}`}>{children}</section>; }
function Badge({ children, tone='blue' }) { return <span className={`badge ${tone}`}>{children}</span>; }
function SectionHeader({ title, action }) { return <div className="section-header"><h2>{title}</h2>{action && <span className="muted caps">{action}</span>}</div>; }
function Stat({ label, value, meta, tone='' }) { return <Card className={`stat ${tone ? `stat-${tone}` : ''}`}><div className="muted caps">{label}</div><div className="stat-value">{value}</div><div className="muted">{meta}</div></Card>; }
function ProgressBar({ value, tone='blue' }) { return <div className={`progress-track ${tone}`}><span style={{ width: `${Math.max(0, Math.min(100, value))}%` }} /></div>; }

function Dashboard({ state, set, sem, overall, completed, totalTasks, totalDsa, today, openTopic, selectSem }) {
  const firstTrack = sem.industry[0];
  const todayLabel = today?.label || firstTrack.topics[0];
  const yearMeta = [
    ['01','Foundation','C++ · OOP · Git · DSA','Build reliable programming instincts.'],
    ['02','Core CS + Data','Python · Math · DBMS · ML','Turn code into useful data systems.'],
    ['03','AI/ML + Systems','DL · NLP · APIs · Docker · GenAI','Ship intelligent software, not demos.'],
    ['04','Capstone + Career','MLOps · System Design · Placement','Turn your portfolio into evidence.']
  ];
  return <>
    <section className="hero hero-gcore">
      <div className="hero-gcore-copy">
        <div className="eyebrow">YOUR 4-YEAR ENGINEERING JOURNEY</div>
        <h1>Build the engineer <span>you want to become.</span></h1>
        <p>Your deliberate learning system for NSU academics, industry skills, practice and projects — sequenced so every milestone opens the next useful one.</p>
        <div className="hero-actions">
          <button className="btn primary" onClick={() => openTopic(firstTrack, sem)}>Continue learning <span>→</span></button>
          <button className="btn ghost" onClick={() => set({ tab: 'roadmap' })}>Explore 4-year roadmap</button>
        </div>
        <div className="hero-tags"><Badge>{sem.phase}</Badge><Badge tone="green">Semester {sem.number}</Badge><Badge tone="purple">Hindi/Hinglish-first</Badge></div>
      </div>

      <div className="hero-gcore-stage" aria-label="NSU Learning OS skill network">
        <div className="gcore-ambient" aria-hidden="true"></div>
        <div className="gcore-network">
          <svg className="gcore-lines" viewBox="0 0 520 320" preserveAspectRatio="none" aria-hidden="true">
            <path d="M80 70 H176 L260 160 L344 70 H440" />
            <path d="M80 250 H176 L260 160 L344 250 H440" />
            <path d="M176 70 L176 250 M344 70 L344 250" />
          </svg>
          <div className="gcore-node gcore-cpp"><strong>C++</strong><span>Foundation</span></div>
          <div className="gcore-node gcore-ml"><strong>ML</strong><span>Intelligence</span></div>
          <div className="gcore-node gcore-dsa"><strong>DSA</strong><span>Problem solving</span></div>
          <div className="gcore-node gcore-python"><strong>Python</strong><span>Data + AI</span></div>
          <div className="gcore-node gcore-ai"><strong>AI</strong><span>Reasoning</span></div>
          <div className="gcore-node gcore-projects"><strong>Projects</strong><span>Proof</span></div>
          <div className="gcore-core">
            <span>NSU</span>
            <strong>Learning<br/>OS</strong>
            <small>2026 → 2030</small>
          </div>
        </div>
        <div className="gcore-metrics">
          <div className="gcore-metric"><span>ROADMAP</span><strong>{overall}%</strong><small>{completed}/{totalTasks} checkpoints</small></div>
          <div className="gcore-metric feature"><span>CURRENT FOCUS</span><strong>{todayLabel}</strong><small>Semester {sem.number} · {sem.phase}</small></div>
          <div className="gcore-metric"><span>DSA SOLVED</span><strong>{totalDsa}</strong><small>{state.dsa.medium} medium · {state.dsa.hard} hard</small></div>
        </div>
      </div>
    </section>

    <div className="stat-grid stat-strip">
      <Stat tone="blue" label="NSU credits" value="168" meta="8 semesters" />
      <Stat tone="amber" label="Target CGPA" value="8.5+" meta="academic baseline" />
      <Stat tone="teal" label="Current phase" value={`Sem ${sem.number}`} meta={sem.phase} />
      <Stat tone="violet" label="DSA solved" value={totalDsa} meta={`${state.dsa.medium} medium · ${state.dsa.hard} hard`} />
    </div>

    <div className="section-title-row editorial-row"><div><div className="eyebrow">TODAY</div><h2>Make the next hour count.</h2><p className="muted">One focused unit is better than ten tabs left open.</p></div><button className="btn ghost small" onClick={() => set({ tab: 'planner' })}>Open planner →</button></div>
    <div className="today-grid">
      <Card className="mission-card mission-v12">
        <div className="mission-kicker"><Badge tone="purple">NEXT BEST ACTION</Badge><span className="caps">DEPENDENCY-FIRST</span></div>
        <div className="mission-main"><div className="mission-number">01</div><div><div className="muted caps">SEMESTER {today?.sem || sem.number}</div><h3>{todayLabel}</h3><p className="muted">Learn the concept, write the code without copying, then do unguided practice. Finish this checkpoint before opening the next one.</p><div className="mission-actions"><button className="btn primary small" onClick={() => openTopic(firstTrack, sem)}>Open learning path →</button><button className="text-link" onClick={()=>selectSem(sem.id)}>View semester</button></div></div></div>
        <div className="learn-loop"><div><span>01</span><strong>Learn</strong><small>Understand the idea</small></div><div><span>02</span><strong>Code</strong><small>Type it yourself</small></div><div><span>03</span><strong>Practice</strong><small>Prove you can use it</small></div></div>
      </Card>
      <Card className="semester-pulse">
        <div className="section-header"><h2>Semester {sem.number}</h2><span className="muted caps">{semProgressFromSemester(sem, state)}% complete</span></div>
        <div className="semester-pulse-head"><div><strong>{sem.phase}</strong><p className="muted">{sem.subjects.map(x=>x[1]).slice(0,2).join(' · ')}</p></div><div className="semester-ring"><span>{semProgressFromSemester(sem,state)}%</span></div></div>
        <div className="pulse-list">{sem.industry.slice(0,3).map((track,i)=><MiniTrack key={track.id} track={track} sem={sem} state={state} index={i} openTopic={openTopic} />)}</div>
      </Card>
    </div>

    <div className="section-title-row editorial-row"><div><div className="eyebrow">THE LONG GAME</div><h2>Four years. Four different jobs to do.</h2><p className="muted">Each phase earns the right to learn the next one.</p></div><button className="btn ghost small" onClick={() => set({ tab: 'roadmap' })}>See full roadmap →</button></div>
    <div className="year-showcase">{yearMeta.map(([num,title,stack,desc],i)=><button key={title} className={`year-showcase-card year-accent-${i+1}`} onClick={()=>selectSem(`sem${i*2+1}`)}><div className="year-showcase-top"><span>{num}</span><span className="caps">YEAR {i+1}</span></div><div><h3>{title}</h3><p>{desc}</p></div><div className="year-stack">{stack}</div><span className="year-arrow">↗</span></button>)}</div>
  </>;
}

function semProgressFromSemester(sem, state) { const total = sem.industry.reduce((n,t)=>n+t.topics.length,0); const done = sem.industry.reduce((n,t)=>n+t.topics.filter((_,i)=>state.progress[`${sem.id}:${t.id}:${i}`]).length,0); return Math.round(done/Math.max(1,total)*100); }
function MiniTrack({ track, sem, state, index, openTopic }) { const done = track.topics.filter((_,i)=>state.progress[`${sem.id}:${track.id}:${i}`]).length; return <button className="mini-track" onClick={() => openTopic(track, sem)}><div className="track-index">0{index+1}</div><div className="mini-track-main"><strong>{track.title}</strong><span className="muted">{done}/{track.topics.length} checkpoints</span><ProgressBar value={done/Math.max(1,track.topics.length)*100} /></div><span className="arrow">→</span></button>; }

function Roadmap({ selectSem, openTopic }) {
  const years = [
    { label:'YEAR 01', title:'Foundation', tone:'violet', sems:semesters.slice(0,2), copy:'Programming instincts, mathematics and problem solving.' },
    { label:'YEAR 02', title:'Core CS + Data', tone:'coral', sems:semesters.slice(2,4), copy:'Data structures, ML, databases, systems and software.' },
    { label:'YEAR 03', title:'AI/ML + Systems', tone:'teal', sems:semesters.slice(4,6), copy:'Advanced ML, NLP, deep learning and production foundations.' },
    { label:'YEAR 04', title:'Capstone + Career', tone:'amber', sems:semesters.slice(6,8), copy:'Specialize, ship the capstone and convert work into evidence.' },
  ];
  return <div className="roadmap-v12 page-roadmap">
    <div className="page-head roadmap-hero-head"><div><div className="eyebrow">MASTER ROADMAP</div><h1>Eight semesters.<br/><em>One compounding path.</em></h1><p>University courses remain the academic backbone. The industry track fills the gaps — with every topic placed after the prerequisites it actually needs.</p></div><div className="roadmap-head-stat"><span className="caps">DESIGN PRINCIPLE</span><strong>Learn → Build → Prove</strong><small>Depth over noise.</small></div></div>
    <div className="year-rail-v12">{years.map((year,yi)=><section key={year.label} className={`year-section-v12 tone-${year.tone}`}><div className="year-marker"><span>{String(yi+1).padStart(2,'0')}</span><small>{year.label}</small></div><div className="year-copy"><div className="eyebrow">{year.label}</div><h2>{year.title}</h2><p>{year.copy}</p></div><div className="year-semesters">{year.sems.map(s=><article key={s.id} className="semester-journey-card"><div className="semester-journey-head"><div><span className="caps">SEMESTER {s.number} • {s.credits} CREDITS</span><h3>{s.phase}</h3><p>{s.subjects.map(x=>x[1]).slice(0,3).join(' · ')}</p></div><button className="round-arrow" onClick={()=>selectSem(s.id)}>↗</button></div><div className="semester-track-stack">{s.industry.map((track,idx)=><button key={track.id} className="semester-track-pill" onClick={()=>openTopic(track,s)}><span className="track-num">{String(idx+1).padStart(2,'0')}</span><span><strong>{track.title}</strong><small>{track.weeks} weeks · {track.priority}</small></span><span className="track-arrow">→</span></button>)}</div></article>)}</div></section>)}</div>
  </div>;
}

function SemesterView({ sem, state, semProgress, toggleProgress, toggleBookmark, openTopic }) {
  const academicCredits = sem.subjects.reduce((n,s)=>n + Number(s[2] || 0), 0);
  return <div className="semester-v13 page-semester">
    <div className="semester-hero-v13">
      <div><div className="eyebrow">SEMESTER {sem.number} · {sem.credits} CREDITS</div><h1>{sem.phase}</h1><p>University structure stays on the left. Your industry path sits beside it — so you always know what to study for college and what to learn to become job-ready.</p><div className="semester-meta-row"><Badge tone="green">{academicCredits} academic credits listed</Badge><Badge tone="purple">{sem.industry.length} industry tracks</Badge><Badge>Hindi/Hinglish-first</Badge></div></div>
      <div className="semester-progress-panel-v13"><div className="caps">INDUSTRY MASTERY</div><div className="big-percent-v13">{semProgress}%</div><ProgressBar value={semProgress} tone="green"/><div className="muted">Complete checkpoints in order to unlock the next layer.</div></div>
    </div>
    <div className="semester-columns-v13">
      <section className="academic-panel-v13"><div className="panel-kicker-row"><div><div className="eyebrow">01 · UNIVERSITY</div><h2>Academic backbone</h2></div><span className="caps">OFFICIAL STRUCTURE</span></div><div className="subject-list-v13">{sem.subjects.map(([code,name,credits,tag],i)=><div key={code} className="subject-card-v13"><span className="subject-index-v13">{String(i+1).padStart(2,'0')}</span><div className="subject-copy-v13"><div className="caps">{code} · {credits} CR</div><strong>{name}</strong>{tag && <span>{tag}</span>}</div><span className="subject-arrow-v13">↗</span></div>)}</div><div className="source-note-v13"><strong>Source note</strong><span>The provided university PDF establishes subject/credit structure, but does not consistently provide detailed topic-level outlines. Detailed breakdowns in the industry column are recommendations.</span></div></section>
      <section className="industry-panel-v13"><div className="panel-kicker-row"><div><div className="eyebrow">02 · INDUSTRY</div><h2>Mastery track</h2></div><span className="caps">RECOMMENDED</span></div><div className="industry-stack-v13">{sem.industry.map((track,idx)=><TrackCard key={track.id} track={track} sem={sem} state={state} toggleProgress={toggleProgress} toggleBookmark={toggleBookmark} openTopic={openTopic} index={idx}/>)}</div></section>
    </div>
  </div>;
}

function TrackCard({ track, sem, state, toggleProgress, toggleBookmark, openTopic, index=0 }) {
  const done=track.topics.filter((_,i)=>state.progress[`${sem.id}:${track.id}:${i}`]).length; const pct=Math.round(done/Math.max(1,track.topics.length)*100);
  return <article className={`track-card-v13 accent-${(index%4)+1}`}><div className="track-top-v13"><div className="track-num-v13">{String(index+1).padStart(2,'0')}</div><div className="track-title-v13"><Badge tone={track.priority==='MUST'?'red':'green'}>{track.priority}</Badge><h3>{track.title}</h3><p>{track.prereq} · {track.weeks} weeks</p></div><button className={`icon-action ${state.bookmarks[`${sem.id}:${track.id}`]?'bookmarked':''}`} onClick={()=>toggleBookmark(`${sem.id}:${track.id}`)}>★</button></div><div className="track-progress-row-v13"><ProgressBar value={pct} tone="green"/><span>{done}/{track.topics.length}</span></div><div className="track-topic-stack-v13">{track.topics.map((t,i)=>{const id=`${sem.id}:${track.id}:${i}`; const unlocked=i===0 || state.progress[`${sem.id}:${track.id}:${i-1}`]; return <button key={id} className={`track-topic-v13 ${state.progress[id]?'done':''} ${!unlocked?'locked':''}`} onClick={()=>openTopic(track,sem)}><span className="topic-check-v13">{state.progress[id]?'✓':String(i+1).padStart(2,'0')}</span><span>{t}</span><span>{unlocked?'→':'LOCKED'}</span></button>})}</div><div className="track-footer-v13"><div><span className="caps">PRIMARY RESOURCE</span><strong>{track.resource?.name || 'Curated resource'}</strong></div><div className="track-links-v13"><a href={track.resource?.url} target="_blank" rel="noreferrer">Open ↗</a><button onClick={()=>openTopic(track,sem)}>Deep dive →</button></div></div></article>;
}

function TopicView({ topic, state, setState, toggleProgress, toggleBookmark, updateNote, goBack }) {
  const semId=`sem${topic.sem}`; const sem=semesters.find(s=>s.id===semId)||semesters[0]; const done=topic.topics.map((_,i)=>state.progress[`${sem.id}:${topic.id}:${i}`]).filter(Boolean).length; const pct=Math.round(done/Math.max(1,topic.topics.length)*100); const nextIndex=Math.min(done,Math.max(0,topic.topics.length-1));
  return <div className="topic-v13 page-topic"><div className="topic-hero-v13"><div><button className="text-link" onClick={goBack}>← Semester {topic.sem}</button><div className="eyebrow">TOPIC DEEP DIVE · {sem.phase}</div><h1>{topic.title}</h1><p>{topic.prereq}</p><div className="topic-hero-actions"><Badge tone="purple">{topic.priority}</Badge><Badge tone="green">{topic.weeks} weeks</Badge><a className="btn primary small" href={topic.resource?.url} target="_blank" rel="noreferrer">Open primary resource ↗</a></div></div><div className="topic-score-v13"><span className="caps">CHECKPOINTS</span><strong>{done}/{topic.topics.length}</strong><ProgressBar value={pct} tone="green"/><small>Next: {topic.topics[nextIndex] || 'Complete'}</small></div></div>
  <div className="topic-layout-v13"><section className="topic-sequence-v13"><div className="sequence-head-v13"><div><div className="eyebrow">01 · LEARNING PATH</div><h2>Unlock the sequence.</h2></div><span className="caps">DEPENDENCY-FIRST</span></div><div className="sequence-list-v13">{topic.topics.map((label,i)=>{const id=`${sem.id}:${topic.id}:${i}`; const prev=i===0 || state.progress[`${sem.id}:${topic.id}:${i-1}`]; const doneNow=!!state.progress[id]; return <div key={id} className={`sequence-item-v13 ${doneNow?'complete':''} ${!prev?'locked':''}`}><div className="sequence-number-v13">{String(i+1).padStart(2,'0')}</div><div className="sequence-main-v13"><strong>{label}</strong><span>{doneNow?'Completed':prev?'Unlocked':'Complete the previous step first'}</span></div><label className="sequence-check-v13"><input type="checkbox" disabled={!prev} checked={doneNow} onChange={()=>toggleProgress(id)}/><span>{doneNow?'✓':'+'}</span></label></div>})}</div></section>
  <aside className="topic-side-v13"><section className="topic-resource-v13"><div className="eyebrow">02 · LEARN</div><h3>Primary resource</h3><div className="topic-resource-card-v13"><Badge tone={topic.resource?.lang?.includes('Hindi')?'green':'blue'}>{topic.resource?.lang || 'Resource'}</Badge><strong>{topic.resource?.name || 'Curated resource'}</strong><span>{topic.resource?.focus || topic.title}</span><a href={topic.resource?.url} target="_blank" rel="noreferrer">Open lesson ↗</a></div><div className="practice-link-v13"><span className="caps">PRACTICE</span><strong>{topic.practice?.name || 'Build a tiny exercise set'}</strong>{topic.practice?.url && topic.practice.url!=='#' && <a href={topic.practice.url} target="_blank" rel="noreferrer">Open practice ↗</a>}</div></section><section className="topic-notes-v13"><div className="note-head-v13"><div className="eyebrow">03 · REFLECT</div><button className={`btn ${state.bookmarks[`${sem.id}:${topic.id}`]?'warning':'ghost'} small`} onClick={()=>toggleBookmark(`${sem.id}:${topic.id}`)}>{state.bookmarks[`${sem.id}:${topic.id}`]?'★ Saved':'☆ Save'}</button></div><h3>Your notes</h3><textarea value={state.notes[`topic:${sem.id}:${topic.id}`]||''} onChange={e=>updateNote(`topic:${sem.id}:${topic.id}`,e.target.value)} placeholder="Formulas, bugs, examples, questions, interview notes..."/><small>Autosaved with your workspace.</small></section></aside></div></div>;
}

function ResourceCard({ resource, index }) { const tones=['violet','teal','amber','coral','blue','pink']; return <article className={`resource-card-v13 resource-tone-${tones[index%tones.length]}`}><div className="resource-card-top"><Badge tone={resource.lang?.includes('Hindi')?'green':'blue'}>{resource.kind || resource.lang || 'Resource'}</Badge><span className="resource-index">{String(index+1).padStart(2,'0')}</span></div><div className="resource-card-main-v13"><h3>{resource.name}</h3><p>{resource.description || resource.focus || 'Learning resource'}</p><div className="resource-meta-v13">{[resource.lang,resource.semester,resource.subject,resource.topic,resource.priority].filter(Boolean).map(x=><span key={x}>{x}</span>)}</div></div><div className="resource-card-action-v13"><a className="btn primary small" href={resource.url} target="_blank" rel="noreferrer">Open ↗</a>{resource.practice_url && <a className="text-link" href={resource.practice_url} target="_blank" rel="noreferrer">Practice ↗</a>}</div></article>; }

function Resources({ state, set }) {
  const all=useMemo(()=>[...resourceLibrary,...(state.customResources||[])],[state.customResources]); const [q,setQ]=useState(''); const filter=state.resourceFilter; const visible=all.filter(r=>{const hay=`${r.name} ${r.focus} ${r.semester||''} ${r.subject||''} ${r.topic||''} ${r.lang||''} ${r.priority||''}`.toLowerCase(); const matchesFilter=filter==='all'||(filter==='custom'?Boolean(r.id):(r.lang||'').toLowerCase().includes(filter)); return (!q||hay.includes(q.toLowerCase()))&&matchesFilter;}); const featured=visible.find(r=>r.priority==='MUST')||visible[0];
  return <div className="resources-v13 page-resources"><div className="resources-hero-v13"><div><div className="eyebrow">RESOURCE LIBRARY</div><h1>Learn from the right source at the right time.</h1><p>Every resource should answer a specific question in the roadmap. Hindi/Hinglish stays first where quality is strong; English enters when documentation or depth requires it.</p><div className="resource-filter-pills">{['all','hindi','english','custom'].map(x=><button key={x} className={filter===x?'active':''} onClick={()=>set({resourceFilter:x})}>{x}</button>)}</div></div><div className="resource-hero-count"><span className="caps">CURATED SOURCES</span><strong>{all.length}</strong><small>stored in your learning catalog</small></div></div>
  <div className="resource-toolbar-v13"><div><div className="eyebrow">DISCOVER</div><h2>{visible.length} resources</h2></div><input value={q} onChange={e=>setQ(e.target.value)} placeholder="Search topic, subject, semester…" /></div>
  {featured&&<div className="featured-resource-v13"><div><div className="eyebrow">FEATURED / {featured.priority||'RESOURCE'}</div><h2>{featured.name}</h2><p>{featured.description||featured.focus}</p><div className="featured-chips">{[featured.lang,featured.semester,featured.subject,featured.topic].filter(Boolean).map(x=><span key={x}>{x}</span>)}</div></div><div className="featured-action-v13"><div className="featured-mark">↗</div><a className="btn primary" href={featured.url} target="_blank" rel="noreferrer">Open resource</a>{featured.practice_url&&<a className="text-link" href={featured.practice_url} target="_blank" rel="noreferrer">Practice ↗</a>}</div></div>}
  <div className="resource-list-v13">{visible.map((r,i)=><ResourceCard key={`${r.id||r.name}-${r.url}`} resource={r} index={i}/>) }{!visible.length&&<div className="empty-state-v13"><strong>No resources matched.</strong><span>Try a broader topic or remove the filter.</span></div>}</div>
  <Card className="resource-note-v13"><div><div className="eyebrow">MAINTENANCE</div><h3>Keep the catalog fresh without touching the UI.</h3><p className="muted">Your cloud-backed Admin Console can edit resources without redeploying the application.</p></div><button className="btn ghost" onClick={()=>set({tab:state.cloudAdmin?'admin':'settings'})}>{state.cloudAdmin?'Open Admin Console →':'Open Settings →'}</button></Card></div>;
}

function Practice({ timer, setTimer, running, setRunning, dsa, setState }) { const [lang,setLang]=useState('cpp'); const fmt=t=>`${String(Math.floor(t/60)).padStart(2,'0')}:${String(t%60).padStart(2,'0')}`; const d=(key,delta)=>setState(s=>({...s,dsa:{...s.dsa,[key]:Math.max(0,Number(s.dsa[key]||0)+delta)}})); const editor={cpp:'https://onecompiler.com/embed/cpp?theme=dark',python:'https://onecompiler.com/embed/python?theme=dark',sql:'https://onecompiler.com/embed/sql?theme=dark'}; return <div><PageTitle eyebrow="PRACTICE LAB" title="Code, solve, reflect." subtitle="Use the embedded runner for quick experiments; keep serious projects in your local editor and Git repository."/><div className="practice-grid"><Card className="editor-card"><div className="lab-toolbar"><div className="segmented">{['cpp','python','sql'].map(x=><button key={x} className={lang===x?'active':''} onClick={()=>setLang(x)}>{x.toUpperCase()}</button>)}</div><a className="text-link" href="https://jupyter.org/try" target="_blank" rel="noreferrer">Open Jupyter ↗</a></div><iframe className="editor-frame" src={editor[lang]} title={`${lang} editor`} /></Card><div className="stack"><Card><SectionHeader title="Focus timer" action="25 / 5"/><div className="timer-wrap"><div className="timer">{fmt(timer)}</div><div className="timer-actions"><button className="btn primary" onClick={()=>setRunning(!running)}>{running?'Pause':'Start'}</button><button className="btn ghost" onClick={()=>{setRunning(false);setTimer(25*60)}}>Reset</button></div></div></Card><Card><SectionHeader title="DSA log" action="manual, not estimated"/><div className="dsa-grid">{[['easy','Easy'],['medium','Medium'],['hard','Hard']].map(([key,label])=><div className="dsa-box" key={key}><span>{label}</span><strong>{dsa[key]}</strong><div className="dsa-actions"><button onClick={()=>d(key,-1)}>−</button><button onClick={()=>d(key,1)}>+</button></div></div>)}</div></Card></div></div></div>; }

function Planner({ state, setState, today }) { const days=weeklyTemplate; const [editing,setEditing]=useState(false); const plan=state.planner||{}; const toggle=(day)=>setState(s=>({...s,planner:{...s.planner,[day]:!s.planner?.[day]}})); const category=(focus)=>focus.includes('DSA')?'violet':focus.includes('Project')?'amber':focus.includes('Math')?'blue':'teal'; return <div><PageTitle eyebrow="WEEKLY PLANNER" title="A sustainable study week" subtitle="Turn the roadmap into a calm, realistic week — then protect the sessions that matter."/><div className="planner-banner"><div><Badge tone="coral">NEXT ACTION</Badge><h3>{today?.label}</h3><p className="muted">Finish the smallest complete learning unit before chasing new topics.</p></div><button className="btn ghost" onClick={()=>setEditing(v=>!v)}>{editing?'Done':'Customize week'}</button></div><div className="planner-grid">{days.map(d=><Card key={d.day} className={`planner-card ${plan[d.day]?'planned':''}`}><div className="planner-day"><div className="day-badge">{d.day}</div><div><div className="planner-meta"><Badge tone={category(d.focus)}>{d.focus.includes('DSA')?'DSA':d.focus.includes('Project')?'PROJECT':d.focus.includes('Math')?'REVISION':'STUDY'}</Badge><span>{d.minutes} min</span></div><h3>{d.focus}</h3></div></div>{editing ? <textarea className="planner-note" value={state.notes[`plan:${d.day}`]||''} onChange={e=>setState(s=>({...s,notes:{...s.notes,[`plan:${d.day}`]:e.target.value}}))} placeholder="Write exact tasks..."/> : <div className="planner-task"><span>{state.notes[`plan:${d.day}`]||'Add tasks in Customize week'}</span><button className="tiny-link" onClick={()=>toggle(d.day)}>{plan[d.day]?'Completed ✓':'Mark complete'}</button></div>}</Card>)}</div></div>; }

function Notes({ state, updateNote }) { const noteKeys=Object.keys(state.notes||{}).filter(k=>k.startsWith('topic:')); const [active,setActive]=useState(noteKeys[0]||'quick'); const value=state.notes[active]||''; return <div><PageTitle eyebrow="NOTES" title="Your learning notebook" subtitle="Topic notes and weekly notes stay local in this version. Export them before moving devices."/><div className="notes-layout"><Card className="notes-sidebar"><SectionHeader title="Notebook"/><button className={active==='quick'?'note-nav active':'note-nav'} onClick={()=>setActive('quick')}>Quick note</button>{noteKeys.map(k=><button key={k} className={active===k?'note-nav active':'note-nav'} onClick={()=>setActive(k)}>{k.replace('topic:','').replaceAll(':',' / ')}</button>)}</Card><Card><div className="note-top"><div><div className="eyebrow">{active==='quick'?'QUICK NOTE':'TOPIC NOTE'}</div><h2>{active==='quick'?'Scratchpad':active.replace('topic:','')}</h2></div><span className="muted">autosaved</span></div><textarea className="notes-big" value={value} onChange={e=>updateNote(active,e.target.value)} placeholder="Write your notes here..."/></Card></div></div>; }

function Projects({ state, set }) { const projects=[['Year 1','C++ Student / Bank Management CLI','C++ · OOP · File I/O','Foundation','Build a reliable command-line product with persistent records.'],['Year 2','Data Analytics Dashboard','Python · Pandas · Streamlit','Data','Turn a messy dataset into a decision-ready story.'],['Year 2','SQL-backed Web App','SQL · API · JS','Systems','Model, query, and surface a useful workflow.'],['Year 3','Image Classification Application','PyTorch · CNN · API','AI/ML','Take a model from experiment to a usable interface.'],['Year 3','NLP Service','Transformers · FastAPI · Docker','AI/ML','Package an NLP capability as an observable service.'],['Year 4','RAG + Knowledge Base','Embeddings · Retrieval · Evaluation','GenAI','Ground answers in a source-aware knowledge system.'],['Year 4','Capstone System','Research · Engineering · Deployment','Capstone','Ship a focused product with evidence and a narrative.']]; const tones=['violet','teal','blue','pink','coral','amber','violet']; return <div><PageTitle eyebrow="PROJECT STUDIO" title="Build proof, not just certificates." subtitle="Projects are portfolio artifacts: clear scope, real constraints, and evidence that you can ship."/><div className="project-grid">{projects.map(([year,title,stack,kind,description],i)=><Card key={title} className={`project-card project-tone-${tones[i]}`}><div className="project-card-head"><div><div className="project-year">{year}</div><Badge tone={tones[i]}>{kind}</Badge></div><span className="project-count">0{i+1}</span></div><h3>{title}</h3><p className="muted">{description}</p><div className="project-stack">{stack.split(' · ').map(item=><span key={item}>{item}</span>)}</div><div className="project-progress"><span>Milestone progress</span><ProgressBar value={state.progress[`project:${i}`]?100:0} tone={tones[i]}/></div><button className="btn ghost small wide" onClick={()=>set({progress:{...state.progress,[`project:${i}`]:!state.progress[`project:${i}`]}})}>{state.progress[`project:${i}`]?'Completed ✓':'Mark milestone complete'}</button></Card>)}</div></div>; }

function Career({ state, set }) { const stages=[['Year 1','GitHub + first projects','Create a clean profile and make three small but complete repositories.'],['Year 2','Internship foundations','Strengthen DSA, projects, resume and basic web/API skills.'],['Year 3','Real internship + production skills','Ship ML applications, APIs, Docker, testing and deployment.'],['Year 4','Placement + capstone','Polish portfolio, practice interviews and finish the capstone strongly.']]; return <div><PageTitle eyebrow="CAREER" title="Graduate with evidence." subtitle="Use this as a guide, not a checklist of hype. Projects and fundamentals matter more than badge collecting."/><div className="career-grid">{stages.map(([year,title,desc],i)=><Card key={year}><Badge tone="purple">{year}</Badge><h2>{title}</h2><p className="muted">{desc}</p><ul className="clean-list">{['GitHub presence','Project documentation','Resume-ready evidence','Interview practice'].map(x=><li key={x}>✓ {x}</li>)}</ul><button className="btn ghost small" onClick={()=>set({tab:'analytics'})}>View progress →</button></Card>)}</div></div>; }

function Analytics({ state, overall, completed, totalTasks, totalDsa }) { const buckets=[['Programming', semScore(state,'C++','OOP')],['DSA',Math.min(100,totalDsa/2)],['Math / AI',semScore(state,'Math','ML')],['AI / ML',semScore(state,'ML','DL','NLP','GenAI')],['Projects',projectScore(state)],['Career',careerScore(state)]]; return <div><PageTitle eyebrow="ANALYTICS" title="See whether your effort is moving." subtitle="These signals are directional, not a judgement. Use them to choose the next weak area."/><div className="analytics-top"><Stat label="Roadmap" value={`${overall}%`} meta={`${completed}/${totalTasks} checkpoints`} /><Stat label="DSA solved" value={totalDsa} meta="manual counter"/><Stat label="Saved notes" value={Object.keys(state.notes||{}).length} meta="local"/><Stat label="Bookmarks" value={Object.values(state.bookmarks||{}).filter(Boolean).length} meta="saved topics"/></div><div className="analytics-grid">{buckets.map(([name,score])=><Card key={name}><div className="metric-head"><strong>{name}</strong><span>{Math.round(score)}%</span></div><ProgressBar value={score} tone={score>70?'green':'blue'} /><p className="muted">Use this bar to decide where your next focused session goes.</p></Card>)}</div></div>; }
function semScore(state,...terms){ const all=semesters.flatMap(s=>s.industry).filter(t=>terms.some(term=>[t.title,...(t.tags||[])].join(' ').toLowerCase().includes(term.toLowerCase()))); let total=0,done=0; all.forEach(t=>t.topics.forEach((_,i)=>{total++; if(state.progress[`${findSemId(t)}:${t.id}:${i}`])done++;})); return done/Math.max(1,total)*100; }
function findSemId(track){const s=semesters.find(s=>s.industry.some(t=>t.id===track.id)); return s?.id||'sem1';}
function projectScore(state){const total=7;const done=Array.from({length:total},(_,i)=>state.progress[`project:${i}`]).filter(Boolean).length;return done/total*100;}
function careerScore(state){return Math.min(100, Object.keys(state.bookmarks||{}).filter(k=>k.includes('sem')).length*4 + Math.min(60,(state.dsa?.medium||0)/2));}

function Settings({ state, setState, cloudMessage, onLogin, onSignup, onLogout }) {
  const [email,setEmail]=useState('');
  const [password,setPassword]=useState('');
  const exportData=()=>{const blob=new Blob([JSON.stringify(state,null,2)],{type:'application/json'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='nsu-master-hub-backup.json';a.click();URL.revokeObjectURL(a.href);};
  const importData=e=>{const file=e.target.files?.[0];if(!file)return;const r=new FileReader();r.onload=()=>{try{setState(s=>({...s,...JSON.parse(r.result)}));}catch{alert('Invalid backup file');}};r.readAsText(file);};
  const reset=()=>{if(confirm('Reset all local progress, notes and DSA counts?'))setState(s=>({...s,progress:{},notes:{},bookmarks:{},dsa:{easy:0,medium:0,hard:0},planner:{},studyLog:[],customResources:[]}));};
  return <div><PageTitle eyebrow="SETTINGS" title="Control your workspace" subtitle="Local-first by default. Add Supabase when you want cloud sync, login and the private Admin Console."/>
    <div className="settings-grid">
      <Card><SectionHeader title="Appearance"/><button className="btn ghost" onClick={()=>setState(s=>({...s,theme:s.theme==='dark'?'light':'dark'}))}>Switch to {state.theme==='dark'?'light':'dark'} mode</button></Card>
      <Card><SectionHeader title="Cloud sync" action={cloud.configured?'configured':'not configured'} />
        {state.cloudUser ? <><p className="muted">Signed in as <strong>{state.cloudUser.email}</strong>. {state.cloudAdmin?'Admin access is enabled.':'Standard user access is enabled.'}</p><div className="inline-actions"><button className="btn primary" onClick={onLogout}>Sign out</button></div></> : <>
          <p className="muted">Create an account or sign in to sync your progress, notes and bookmarks across devices.</p>
          <div className="form-grid compact"><label><span>Email</span><input value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@example.com" /></label><label><span>Password</span><input type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="••••••••" /></label></div>
          <div className="inline-actions"><button className="btn primary" disabled={!cloud.configured} onClick={()=>onLogin(email,password)}>Sign in</button><button className="btn ghost" disabled={!cloud.configured} onClick={()=>onSignup(email,password)}>Create account</button></div>
          {!cloud.configured && <p className="muted">Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to .env.local, then restart the dev server.</p>}
        </>}
        {cloudMessage && <div className="notice">{cloudMessage}</div>}
      </Card>
      <Card><SectionHeader title="Backup" action="portable"/><p className="muted">Export progress, notes, bookmarks, planner and counters to a JSON file.</p><div className="inline-actions"><button className="btn primary" onClick={exportData}>Export JSON</button><label className="btn ghost file-btn">Import JSON<input type="file" accept="application/json" onChange={importData}/></label></div></Card>
      <Card className="danger"><SectionHeader title="Danger zone"/><p className="muted">Reset local learning data. This does not delete your Supabase account.</p><button className="btn danger-btn" onClick={reset}>Reset local data</button></Card>
    </div></div>;
}


function AdminConsole({ resources, setResources, message }) {
  const [editing, setEditing] = useState(null);
  const [name, setName] = useState('');
  const [focus, setFocus] = useState('');
  const [semester, setSemester] = useState('');
  const [subject, setSubject] = useState('');
  const [topic, setTopic] = useState('');
  const [priority, setPriority] = useState('HIGH');
  const [lang, setLang] = useState('Hindi/Hinglish');
  const [kind, setKind] = useState('YouTube');
  const [url, setUrl] = useState('');
  const [practiceUrl, setPracticeUrl] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState('');
  const [saving, setSaving] = useState(false);
  const [filter, setFilter] = useState('');

  const resetForm = () => {
    setEditing(null);
    setName(''); setFocus(''); setSemester(''); setSubject(''); setTopic(''); setPriority('HIGH');
    setLang('Hindi/Hinglish'); setKind('YouTube'); setUrl(''); setPracticeUrl(''); setDescription('');
  };

  const startEdit = (row) => {
    setEditing(row.id);
    setName(row.name || ''); setFocus(row.focus || ''); setSemester(row.semester || ''); setSubject(row.subject || ''); setTopic(row.topic || '');
    setPriority(row.priority || 'HIGH'); setLang(row.lang || 'Hindi/Hinglish'); setKind(row.kind || 'YouTube'); setUrl(row.url || '');
    setPracticeUrl(row.practice_url || ''); setDescription(row.description || ''); setStatus('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const save = async () => {
    if (!name.trim() || !url.trim()) return setStatus('Name and URL are required.');
    setSaving(true); setStatus('Saving…');
    try {
      const payload = {
        name: name.trim(), focus: focus.trim(), semester: semester.trim(), subject: subject.trim(), topic: topic.trim(),
        priority, lang, kind, url: url.trim(), practice_url: practiceUrl.trim(), description: description.trim()
      };
      if (editing) {
        const row = await cloud.updateResource(editing, payload);
        if (!row) throw new Error('Resource update returned no row.');
        setResources(resources.map(r => r.id === editing ? row : r));
        setStatus('Resource updated ✓');
      } else {
        const row = await cloud.createResource(payload);
        if (!row) throw new Error('Resource creation returned no row.');
        setResources([...resources, row].sort((a,b)=>String(a.name).localeCompare(String(b.name))));
        setStatus('Resource added ✓');
      }
      resetForm();
    } catch (e) { setStatus(e?.message || 'Could not save resource.'); }
    finally { setSaving(false); }
  };

  const remove = async (id) => {
    if (!confirm('Delete this resource from the cloud catalog?')) return;
    try {
      await cloud.deleteResource(id);
      setResources(resources.filter(r => r.id !== id));
      if (editing === id) resetForm();
      setStatus('Resource deleted ✓');
    } catch (e) { setStatus(e?.message || 'Could not delete resource.'); }
  };

  const visible = resources.filter(r => {
    const q = filter.trim().toLowerCase();
    return !q || `${r.name} ${r.focus} ${r.semester||''} ${r.subject||''} ${r.topic||''} ${r.lang||''} ${r.priority||''}`.toLowerCase().includes(q);
  });

  return <div>
    <PageTitle eyebrow="ADMIN CONSOLE" title="Maintain the learning catalog." subtitle="Edit cloud-backed resources without touching the React code or redeploying the app." />
    {message && <div className="notice">{message}</div>}
    {status && <div className="notice">{status}</div>}
    <Card className="admin-editor">
      <div className="admin-toolbar">
        <div><div className="eyebrow">RESOURCE MANAGER</div><h2>{editing ? 'Edit resource' : 'Add resource'}</h2></div>
        <div className="admin-actions">{editing && <button className="btn ghost small" onClick={resetForm}>Cancel edit</button>}<button className="btn primary small" disabled={saving} onClick={save}>{saving ? 'Saving…' : editing ? 'Save changes' : 'Add resource'}</button></div>
      </div>
      <div className="form-grid">
        <label><span>Name</span><input value={name} onChange={e=>setName(e.target.value)} placeholder="e.g. CampusX" /></label>
        <label><span>Focus</span><input value={focus} onChange={e=>setFocus(e.target.value)} placeholder="e.g. Machine Learning" /></label>
        <label><span>Semester</span><input value={semester} onChange={e=>setSemester(e.target.value)} placeholder="e.g. Sem 3" /></label>
        <label><span>Subject</span><input value={subject} onChange={e=>setSubject(e.target.value)} placeholder="e.g. Introduction to ML" /></label>
        <label><span>Topic</span><input value={topic} onChange={e=>setTopic(e.target.value)} placeholder="e.g. Linear Regression" /></label>
        <label><span>Priority</span><select value={priority} onChange={e=>setPriority(e.target.value)}><option>MUST</option><option>HIGH</option><option>USEFUL</option><option>OPTIONAL</option><option>LATER</option></select></label>
        <label><span>Language</span><select value={lang} onChange={e=>setLang(e.target.value)}><option>Hindi</option><option>Hindi/Hinglish</option><option>Hinglish</option><option>English</option></select></label>
        <label><span>Type</span><select value={kind} onChange={e=>setKind(e.target.value)}><option>YouTube</option><option>Website</option><option>Docs</option><option>Course</option></select></label>
        <label style={{gridColumn:'1 / -1'}}><span>Primary URL</span><input value={url} onChange={e=>setUrl(e.target.value)} placeholder="https://..." /></label>
        <label style={{gridColumn:'1 / -1'}}><span>Practice URL</span><input value={practiceUrl} onChange={e=>setPracticeUrl(e.target.value)} placeholder="https://leetcode.com/... or https://..." /></label>
        <label style={{gridColumn:'1 / -1'}}><span>Description</span><input value={description} onChange={e=>setDescription(e.target.value)} placeholder="Short description shown to students" /></label>
      </div>
    </Card>

    <Card>
      <SectionHeader title={`Cloud resources (${resources.length})`} action="stored in Supabase" />
      <input className="admin-search" value={filter} onChange={e=>setFilter(e.target.value)} placeholder="Search resource, semester, subject, topic…" />
      <div className="admin-list">
        {visible.map(row => <div key={row.id} className="subject-row resource-admin-row">
          <div>
            <strong>{row.name}</strong>
            <span>{[row.semester,row.subject,row.topic,row.priority,row.lang,row.kind].filter(Boolean).join(' · ')}</span>
            <span className="muted">{row.focus}</span>
            <a href={row.url} target="_blank" rel="noreferrer">{row.url}</a>
            {row.practice_url && <a href={row.practice_url} target="_blank" rel="noreferrer">Practice ↗</a>}
          </div>
          <div className="admin-actions"><button className="btn ghost small" onClick={()=>startEdit(row)}>Edit</button><button className="btn danger-btn small" onClick={()=>remove(row.id)}>Delete</button></div>
        </div>)}
        {!visible.length && <p className="muted">No matching cloud resources.</p>}
      </div>
    </Card>
  </div>;
}

function PageTitle({ eyebrow, title, subtitle }) { return <div className="page-head"><div><div className="eyebrow">{eyebrow}</div><h1>{title}</h1><p>{subtitle}</p></div></div>; }
function CommandPalette({ onClose, query, results, setQuery, openTab, selectSem, openTopic, clearQuery }) {
  const q = query.trim();
  const activate = (fn) => { fn(); clearQuery(); onClose(); };
  return <div className="overlay" onMouseDown={e=>{ if(e.target===e.currentTarget) onClose(); }}>
    <div className="command" role="dialog" aria-modal="true" aria-label="Search NSU Master Hub">
      <div className="command-top">
        <input
          autoFocus
          value={query}
          placeholder="Search roadmap, topics, subjects, resources..."
          onChange={e=>setQuery(e.target.value)}
          onKeyDown={e=>{
            if(e.key==='Escape') onClose();
            if(e.key==='Enter' && results[0]) {
              const r=results[0];
              activate(()=>{
                if(r.type==='subject') selectSem(r.sem.id);
                else if(r.type==='topic') openTopic(r.topic,r.sem);
                else openTab('resources');
              });
            }
          }}
        />
        {q && <button aria-label="Clear search" onClick={clearQuery}>×</button>}
        <button aria-label="Close search" onClick={onClose}>Esc</button>
      </div>
      {!q ? <div className="command-grid">
        <button onClick={()=>activate(()=>openTab('dashboard'))}>Dashboard</button>
        <button onClick={()=>activate(()=>openTab('resources'))}>Resource library</button>
        <button onClick={()=>activate(()=>openTab('practice'))}>Practice lab</button>
        <button onClick={()=>activate(()=>openTab('planner'))}>Weekly planner</button>
        {semesters.slice(0,4).map(s=><button key={s.id} onClick={()=>activate(()=>selectSem(s.id))}>Semester {s.number}</button>)}
      </div> : <div className="command-results">
        <div className="search-head"><strong>{results.length} result{results.length===1?'':'s'}</strong><span className="muted">Enter opens the first match</span></div>
        {results.length===0 ? <div className="empty-search"><strong>No matches</strong><span className="muted">Try a subject, topic, resource or skill name.</span></div> : results.map((r,i)=><button key={`${r.type}-${i}`} className="search-row" onClick={()=>activate(()=>{ if(r.type==='subject') selectSem(r.sem.id); else if(r.type==='topic') openTopic(r.topic,r.sem); else openTab('resources'); })}>
          <span className="result-type">{r.type}</span>
          <span className="result-copy">{r.match || (r.type==='resource'?r.resource.name:r.subject?.[1] || r.topic?.title)}<small>{r.type==='topic'?`Semester ${r.sem.number} · ${r.topic.title}`:r.type==='subject'?`Semester ${r.sem.number}`:r.resource?.focus || ''}</small></span>
        </button>)}
      </div>}
      <p className="muted">Tip: Ctrl / Cmd + K opens this anywhere. Click outside or press Esc to close.</p>
    </div>
  </div>;
}
function SearchOverlay({ results, close, selectSem, openTopic }) { return <div className="search-results"><div className="search-head"><strong>Search results</strong><button onClick={close}>×</button></div>{results.length===0?<p className="muted">No matches.</p>:results.map((r,i)=><button key={i} className="search-row" onClick={()=>{if(r.type==='topic')openTopic(r.topic,r.sem); else if(r.type==='subject')selectSem(r.sem.id); close();}}><span className="result-type">{r.type}</span><span>{r.type==='topic'?r.topic.title:r.type==='resource'?r.resource.name:r.subject[1]}</span></button>)}</div>; }

createRoot(document.getElementById('root')).render(<App />);
