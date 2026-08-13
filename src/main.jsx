import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { appMeta, semesters, resourceLibrary, weeklyTemplate } from './data/content';
import { cloud } from './lib/supabase.js';
import './styles/app.css';

const STORAGE = 'nsu-master-hub-v3';
const DEFAULT_STATE = {
  tab: 'dashboard', activeSem: 'sem1', selectedTopic: null,
  progress: {}, notes: {}, bookmarks: {},
  dsa: { easy: 0, medium: 0, hard: 0 },
  planner: {}, studyLog: [], customResources: [],
  theme: 'dark', query: '', resourceFilter: 'all',
  todayOverride: null, cloudUser: null, cloudAdmin: false, cloudConnected: false
};

function loadState() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE));
    return parsed ? { ...DEFAULT_STATE, ...parsed, dsa: { ...DEFAULT_STATE.dsa, ...(parsed.dsa || {}) } } : DEFAULT_STATE;
  } catch { return DEFAULT_STATE; }
}

function App() {
  const [state, setState] = useState(loadState);
  const [timer, setTimer] = useState(25 * 60);
  const [timerRunning, setTimerRunning] = useState(false);
  const [mobileNav, setMobileNav] = useState(false);
  const [commandOpen, setCommandOpen] = useState(false);
  const [cloudMessage, setCloudMessage] = useState('');
  const [adminResources, setAdminResources] = useState([]);
  const [cloudBooted, setCloudBooted] = useState(false);

  useEffect(() => localStorage.setItem(STORAGE, JSON.stringify(state)), [state]);
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
    if (!cloud.configured || !state.cloudUser || !cloudBooted) return;
    const id = setTimeout(() => {
      const { cloudUser, cloudAdmin, cloudConnected, ...snapshot } = state;
      cloud.saveUserState(state.cloudUser.id, snapshot)
        .then(() => setCloudMessage('Cloud saved ✓'))
        .catch(() => setCloudMessage('Cloud save failed'));
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
    const onMove = (e) => {
      const x = (e.clientX / window.innerWidth) * 100;
      const y = (e.clientY / window.innerHeight) * 100;
      document.documentElement.style.setProperty('--mx', `${x}%`);
      document.documentElement.style.setProperty('--my', `${y}%`);
    };
    window.addEventListener('pointermove', onMove, { passive: true });
    return () => window.removeEventListener('pointermove', onMove);
  }, []);
  useEffect(() => {
    if (!timerRunning) return;
    const id = setInterval(() => setTimer(v => {
      if (v <= 1) { setTimerRunning(false); return 25 * 60; }
      return v - 1;
    }), 1000);
    return () => clearInterval(id);
  }, [timerRunning]);

  const set = patch => setState(s => ({ ...s, ...patch }));
  const openTab = (tab) => { set({ tab }); setMobileNav(false); };
  const selectSem = id => { set({ activeSem: id, tab: 'semester', selectedTopic: null }); setMobileNav(false); };
  const toggleProgress = id => setState(s => ({ ...s, progress: { ...s.progress, [id]: !s.progress[id] } }));
  const toggleBookmark = id => setState(s => ({ ...s, bookmarks: { ...s.bookmarks, [id]: !s.bookmarks[id] } }));
  const updateNote = (id, value) => setState(s => ({ ...s, notes: { ...s.notes, [id]: value } }));
  const openTopic = (topic, semester) => set({ selectedTopic: { ...topic, sem: semester.number }, tab: 'topic' });

  const allTasks = useMemo(() => semesters.flatMap(s => s.industry.flatMap(track => track.topics.map((topic, i) => ({
    id: `${s.id}:${track.id}:${i}`, sem: s.number, semId: s.id, trackId: track.id, trackTitle: track.title, label: topic
  })))), []);
  const completed = allTasks.filter(t => state.progress[t.id]).length;
  const overall = Math.round((completed / Math.max(1, allTasks.length)) * 100);
  const sem = semesters.find(s => s.id === state.activeSem) || semesters[0];
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
      if (`${r.name} ${r.focus} ${r.lang}`.toLowerCase().includes(q)) out.push({ type: 'resource', resource: r });
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
        {state.tab === 'topic' && state.selectedTopic && <TopicView topic={state.selectedTopic} state={state} setState={setState} toggleProgress={toggleProgress} toggleBookmark={toggleBookmark} updateNote={updateNote} goBack={() => selectSem(`sem${state.selectedTopic.sem}`)} />}
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
    <footer className="footer"><span>NSU Master Hub v0.4</span><span>Local-first • Resource-driven • Dependency-aware</span><span>© 2026</span></footer>
  </div>;
}

function Nav({ id, label, icon, state, set }) { return <button className={`nav-btn ${state.tab === id ? 'active' : ''}`} onClick={() => set({ tab: id })}><span className="nav-icon">{icon}</span><span>{label}</span></button>; }
function Card({ children, className='' }) { return <section className={`card ${className}`}>{children}</section>; }
function Badge({ children, tone='blue' }) { return <span className={`badge ${tone}`}>{children}</span>; }
function SectionHeader({ title, action }) { return <div className="section-header"><h2>{title}</h2>{action && <span className="muted caps">{action}</span>}</div>; }
function Stat({ label, value, meta }) { return <Card className="stat"><div className="muted caps">{label}</div><div className="stat-value">{value}</div><div className="muted">{meta}</div></Card>; }
function ProgressBar({ value, tone='blue' }) { return <div className={`progress-track ${tone}`}><span style={{ width: `${Math.max(0, Math.min(100, value))}%` }} /></div>; }

function Dashboard({ state, set, sem, overall, completed, totalTasks, totalDsa, today, openTopic, selectSem }) {
  const firstTrack = sem.industry[0];
  const todayLabel = today?.label || firstTrack.topics[0];
  return <>
    <section className="hero">
      <div className="hero-copy">
        <div className="eyebrow">PERSONAL LEARNING OPERATING SYSTEM</div>
        <h1>Build the engineer you want to become.</h1>
        <p>NSU academics, industry skills, practice, projects, notes and career prep — arranged by prerequisites instead of hype.</p>
        <div className="hero-actions"><button className="btn primary" onClick={() => openTopic(firstTrack, sem)}>Continue {firstTrack.title} →</button><button className="btn ghost" onClick={() => set({ tab: 'roadmap' })}>Explore 4-year map</button></div>
        <div className="hero-tags"><Badge>{sem.phase}</Badge><Badge tone="green">Semester {sem.number}</Badge><Badge tone="purple">Hindi/Hinglish-first</Badge></div>
      </div>
      <div className="hero-ring-wrap"><div className="ring" style={{ '--pct': `${overall * 3.6}deg` }}><span>{overall}%</span></div><div><div className="caps">ROADMAP COMPLETION</div><strong>{completed}/{totalTasks}</strong><div className="muted">industry checkpoints</div></div></div>
    </section>

    <div className="stat-grid">
      <Stat label="NSU credits" value="168" meta="8 semesters" />
      <Stat label="Target CGPA" value="8.5+" meta="academic baseline" />
      <Stat label="Current phase" value={`Sem ${sem.number}`} meta={sem.phase} />
      <Stat label="DSA solved" value={totalDsa} meta={`${state.dsa.medium} medium · ${state.dsa.hard} hard`} />
    </div>

    <div className="section-title-row"><div><div className="eyebrow">TODAY</div><h2>What should you do next?</h2></div><button className="btn ghost small" onClick={() => set({ tab: 'planner' })}>Open planner →</button></div>
    <div className="grid two">
      <Card className="mission-card">
        <SectionHeader title="Next best action" action="dependency-first" />
        <div className="mission"><div className="mission-icon">01</div><div><Badge tone="purple">Semester {today?.sem || sem.number}</Badge><h3>{todayLabel}</h3><p className="muted">Complete the concept, write code yourself, then do unguided practice. The next checkpoint unlocks after you mark this complete.</p><button className="btn primary small" onClick={() => openTopic(firstTrack, sem)}>Open learning path →</button></div></div>
      </Card>
      <Card>
        <SectionHeader title="Current semester" action={`${semProgressFromSemester(sem, state)}% complete`} />
        {sem.industry.slice(0, 3).map((track, i) => <MiniTrack key={track.id} track={track} sem={sem} state={state} index={i} openTopic={openTopic} />)}
      </Card>
    </div>

    <div className="section-title-row"><div><div className="eyebrow">4-YEAR VIEW</div><h2>From foundation to job-ready</h2></div><button className="btn ghost small" onClick={() => set({ tab: 'roadmap' })}>See full roadmap →</button></div>
    <div className="year-grid">{['Foundation','Core CS + Data','AI/ML + Systems','Capstone + Career'].map((x,i)=><Card key={x} className="year-card"><div className="year-num">0{i+1}</div><div><div className="muted caps">YEAR {i+1}</div><h3>{x}</h3><p className="muted">{['C++ · OOP · Git · DSA','Python · Math · ML · DBMS','DL · NLP · APIs · Docker · GenAI','MLOps · System Design · Capstone · Placement'][i]}</p></div></Card>)}</div>
  </>;
}

function semProgressFromSemester(sem, state) { const total = sem.industry.reduce((n,t)=>n+t.topics.length,0); const done = sem.industry.reduce((n,t)=>n+t.topics.filter((_,i)=>state.progress[`${sem.id}:${t.id}:${i}`]).length,0); return Math.round(done/Math.max(1,total)*100); }
function MiniTrack({ track, sem, state, index, openTopic }) { const done = track.topics.filter((_,i)=>state.progress[`${sem.id}:${track.id}:${i}`]).length; return <button className="mini-track" onClick={() => openTopic(track, sem)}><div className="track-index">0{index+1}</div><div className="mini-track-main"><strong>{track.title}</strong><span className="muted">{done}/{track.topics.length} checkpoints</span><ProgressBar value={done/Math.max(1,track.topics.length)*100} /></div><span className="arrow">→</span></button>; }

function Roadmap({ selectSem, openTopic }) { return <div><div className="page-head"><div><div className="eyebrow">MASTER ROADMAP</div><h1>Eight semesters. One dependency-aware path.</h1><p>University courses remain the academic backbone. Industry tracks fill the gaps without pretending they are official NSU topic lists.</p></div></div><div className="timeline">{semesters.map((s,i)=><Card key={s.id} className="timeline-card"><div className="timeline-left"><div className="semester-index large">{s.number}</div><div><div className="muted caps">SEMESTER {s.number} • {s.credits} CREDITS</div><h2>{s.phase}</h2><p className="muted">{s.subjects.map(x=>x[1]).slice(0,4).join(' · ')}</p></div></div><div className="timeline-right">{s.industry.map(track=><button key={track.id} className="road-track" onClick={()=>openTopic(track,s)}><div><strong>{track.title}</strong><span className="muted">{track.weeks} weeks · {track.priority}</span></div><span>→</span></button>)}</div><button className="btn ghost small" onClick={()=>selectSem(s.id)}>Open Semester {s.number} →</button></Card>)}</div></div>; }

function SemesterView({ sem, state, semProgress, toggleProgress, toggleBookmark, openTopic }) { return <div><div className="page-head compact"><div><div className="eyebrow">SEMESTER {sem.number} • {sem.credits} CREDITS</div><h1>{sem.phase}</h1><p>Official subjects are shown separately from recommended industry mastery.</p></div><div className="head-progress"><strong>{semProgress}%</strong><ProgressBar value={semProgress} /><span className="muted">industry checkpoints</span></div></div><div className="grid two align-start"><Card><SectionHeader title="NSU academic backbone" action="official structure"/><div className="subject-list">{sem.subjects.map(([code,name,credits,tag])=><div key={code} className="subject-row"><div><strong>{code}</strong><span>{name}</span></div><Badge tone="blue">{credits} cr</Badge></div>)}</div><div className="source-note">Note: the provided university PDF establishes the subject/credit structure, but does not consistently provide detailed topic-level outlines. Topic breakdowns in the other column are recommendations.</div></Card><Card><SectionHeader title="Industry mastery track" action="recommended"/>{sem.industry.map(track=><TrackCard key={track.id} track={track} sem={sem} state={state} toggleProgress={toggleProgress} toggleBookmark={toggleBookmark} openTopic={openTopic}/>)}</Card></div></div>; }

function TrackCard({ track, sem, state, toggleProgress, toggleBookmark, openTopic }) { const done = track.topics.filter((_,i)=>state.progress[`${sem.id}:${track.id}:${i}`]).length; return <div className="track-card"><div className="track-head"><div><Badge tone={track.priority==='MUST'?'red':'green'}>{track.priority}</Badge><h3>{track.title}</h3><p className="muted">Prereq: {track.prereq} · {track.weeks} weeks</p></div><button className={`icon-action ${state.bookmarks[`${sem.id}:${track.id}`]?'bookmarked':''}`} onClick={()=>toggleBookmark(`${sem.id}:${track.id}`)}>★</button></div><ProgressBar value={done/Math.max(1,track.topics.length)*100} /><div className="topic-grid">{track.topics.map((t,i)=>{const id=`${sem.id}:${track.id}:${i}`; return <label key={id} className={`topic-row ${state.progress[id]?'done':''}`}><input type="checkbox" checked={!!state.progress[id]} onChange={()=>toggleProgress(id)}/><span>{t}</span><button className="tiny-link" type="button" onClick={()=>openTopic(track,sem)}>open</button></label>;})}</div><div className="resource-inline"><span>Primary: <strong>{track.resource.name}</strong></span><a href={track.resource.url} target="_blank" rel="noreferrer">Open resource ↗</a></div><button className="btn ghost small wide" onClick={()=>openTopic(track,sem)}>Deep dive →</button></div>; }

function TopicView({ topic, state, setState, toggleProgress, toggleBookmark, updateNote, goBack }) { const semId=`sem${topic.sem}`; const sem=semesters.find(s=>s.id===semId)||semesters[0]; const done=topic.topics.map((_,i)=>state.progress[`${sem.id}:${topic.id}:${i}`]).filter(Boolean).length; return <div><div className="page-head compact"><div><button className="text-link" onClick={goBack}>← Back to Semester {topic.sem}</button><div className="eyebrow">TOPIC DEEP DIVE</div><h1>{topic.title}</h1><p>{topic.prereq}</p></div><div className="topic-score"><strong>{done}/{topic.topics.length}</strong><span className="muted">checkpoints</span></div></div><div className="grid two align-start"><Card><SectionHeader title="Learning sequence" action="unlock in order"/>{topic.topics.map((label,i)=>{const id=`${sem.id}:${topic.id}:${i}`; const prev=i===0 || state.progress[`${sem.id}:${topic.id}:${i-1}`]; return <div key={id} className={`deep-topic ${state.progress[id]?'complete':''} ${!prev?'locked':''}`}><div className="deep-num">{String(i+1).padStart(2,'0')}</div><div className="deep-main"><strong>{label}</strong><span className="muted">{i===0?'Start here':prev?'Unlocked':'Complete the previous checkpoint'}</span></div><label className="check-wrap"><input type="checkbox" disabled={!prev} checked={!!state.progress[id]} onChange={()=>toggleProgress(id)}/></label></div>})}</Card><div className="stack"><Card><SectionHeader title="Primary resource" action="open & learn"/><ResourceCard resource={topic.resource}/><div className="resource-box"><strong>Practice</strong><div>{topic.practice?.name || 'Build a tiny exercise set'}</div>{topic.practice?.url && topic.practice.url !== '#' && <a href={topic.practice.url} target="_blank" rel="noreferrer">Open practice ↗</a>}</div></Card><Card><SectionHeader title="My notes" action="autosaved locally"/><textarea className="notes-editor" value={state.notes[`topic:${sem.id}:${topic.id}`]||''} onChange={e=>updateNote(`topic:${sem.id}:${topic.id}`,e.target.value)} placeholder="Write formulas, mistakes, examples, links, interview questions..."/><div className="note-actions"><button className={`btn ${state.bookmarks[`${sem.id}:${topic.id}`]?'warning':'ghost'} small`} onClick={()=>toggleBookmark(`${sem.id}:${topic.id}`)}>{state.bookmarks[`${sem.id}:${topic.id}`]?'★ Bookmarked':'☆ Bookmark topic'}</button></div></Card><Card className="rule-card"><strong>7-step mastery loop</strong><p className="muted">Learn → Understand → Code → Practice → Build → Explain → Revise. Avoid copy-paste learning; use AI for hints after your own attempt.</p></Card></div></div></div>; }

function ResourceCard({ resource }) { return <div className="resource-card"><div><Badge tone={resource.lang?.includes('Hindi')?'green':'blue'}>{resource.lang || 'Resource'}</Badge><h3>{resource.name}</h3><p className="muted">{resource.focus}</p></div><a className="btn primary small" href={resource.url} target="_blank" rel="noreferrer">Open ↗</a></div>; }

function Resources({ state, set }) { const all=[...resourceLibrary,...(state.customResources||[])]; const filter=state.resourceFilter; const visible=all.filter(r=>filter==='all'||(r.lang||'').toLowerCase().includes(filter)); const [name,setName]=useState(''); const [url,setUrl]=useState(''); const [focus,setFocus]=useState(''); const add=()=>{if(!name||!url)return; const resource={name,url,focus:focus||'Custom resource',lang:'Custom'}; set({customResources:[...(state.customResources||[]),resource]});setName('');setUrl('');setFocus('');}; return <div><PageTitle eyebrow="RESOURCE LIBRARY" title="One place for learning sources" subtitle="Keep resource content centralized so links can be refreshed without redesigning the application."/><div className="filter-row">{['all','hindi','english','custom'].map(x=><button key={x} className={`filter-btn ${filter===x?'active':''}`} onClick={()=>set({resourceFilter:x})}>{x}</button>)}</div><div className="resource-grid">{visible.map(r=><Card key={r.name+r.url}><ResourceCard resource={r}/></Card>)}</div><Card className="add-resource"><SectionHeader title="Add a resource locally" action="easy to update"/><div className="form-grid"><input value={name} onChange={e=>setName(e.target.value)} placeholder="Resource name"/><input value={url} onChange={e=>setUrl(e.target.value)} placeholder="URL"/><input value={focus} onChange={e=>setFocus(e.target.value)} placeholder="Focus / topic"/><button className="btn primary" onClick={add}>Add resource</button></div><p className="muted">Custom resources live in your browser state. The master catalog remains in <code>src/data/content.js</code> for developer-managed updates.</p></Card></div>; }

function Practice({ timer, setTimer, running, setRunning, dsa, setState }) { const [lang,setLang]=useState('cpp'); const fmt=t=>`${String(Math.floor(t/60)).padStart(2,'0')}:${String(t%60).padStart(2,'0')}`; const d=(key,delta)=>setState(s=>({...s,dsa:{...s.dsa,[key]:Math.max(0,Number(s.dsa[key]||0)+delta)}})); const editor={cpp:'https://onecompiler.com/embed/cpp?theme=dark',python:'https://onecompiler.com/embed/python?theme=dark',sql:'https://onecompiler.com/embed/sql?theme=dark'}; return <div><PageTitle eyebrow="PRACTICE LAB" title="Code, solve, reflect." subtitle="Use the embedded runner for quick experiments; keep serious projects in your local editor and Git repository."/><div className="practice-grid"><Card className="editor-card"><div className="lab-toolbar"><div className="segmented">{['cpp','python','sql'].map(x=><button key={x} className={lang===x?'active':''} onClick={()=>setLang(x)}>{x.toUpperCase()}</button>)}</div><a className="text-link" href="https://jupyter.org/try" target="_blank" rel="noreferrer">Open Jupyter ↗</a></div><iframe className="editor-frame" src={editor[lang]} title={`${lang} editor`} /></Card><div className="stack"><Card><SectionHeader title="Focus timer" action="25 / 5"/><div className="timer-wrap"><div className="timer">{fmt(timer)}</div><div className="timer-actions"><button className="btn primary" onClick={()=>setRunning(!running)}>{running?'Pause':'Start'}</button><button className="btn ghost" onClick={()=>{setRunning(false);setTimer(25*60)}}>Reset</button></div></div></Card><Card><SectionHeader title="DSA log" action="manual, not estimated"/><div className="dsa-grid">{[['easy','Easy'],['medium','Medium'],['hard','Hard']].map(([key,label])=><div className="dsa-box" key={key}><span>{label}</span><strong>{dsa[key]}</strong><div className="dsa-actions"><button onClick={()=>d(key,-1)}>−</button><button onClick={()=>d(key,1)}>+</button></div></div>)}</div></Card></div></div></div>; }

function Planner({ state, setState, today }) { const days=weeklyTemplate; const [editing,setEditing]=useState(false); const plan=state.planner||{}; const toggle=(day)=>setState(s=>({...s,planner:{...s.planner,[day]:!s.planner?.[day]}})); return <div><PageTitle eyebrow="WEEKLY PLANNER" title="A sustainable study week" subtitle="Use the template as a baseline; adapt around lectures, labs, exams and life."/><div className="planner-banner"><div><Badge tone="purple">NEXT ACTION</Badge><h3>{today?.label}</h3><p className="muted">Finish the smallest complete learning unit before chasing new topics.</p></div><button className="btn ghost" onClick={()=>setEditing(v=>!v)}>{editing?'Done':'Customize week'}</button></div><div className="planner-grid">{days.map(d=><Card key={d.day} className={plan[d.day]?'planned':''}><div className="planner-day"><div className="day-badge">{d.day}</div><div><div className="muted caps">{d.minutes} min</div><h3>{d.focus}</h3></div></div>{editing ? <textarea className="planner-note" value={state.notes[`plan:${d.day}`]||''} onChange={e=>setState(s=>({...s,notes:{...s.notes,[`plan:${d.day}`]:e.target.value}}))} placeholder="Write exact tasks..."/> : <div className="planner-task"><span>{state.notes[`plan:${d.day}`]||'Add tasks in Customize week'}</span><button className="tiny-link" onClick={()=>toggle(d.day)}>{plan[d.day]?'Mark done':'Mark planned'}</button></div>}</Card>)}</div></div>; }

function Notes({ state, updateNote }) { const noteKeys=Object.keys(state.notes||{}).filter(k=>k.startsWith('topic:')); const [active,setActive]=useState(noteKeys[0]||'quick'); const value=state.notes[active]||''; return <div><PageTitle eyebrow="NOTES" title="Your learning notebook" subtitle="Topic notes and weekly notes stay local in this version. Export them before moving devices."/><div className="notes-layout"><Card className="notes-sidebar"><SectionHeader title="Notebook"/><button className={active==='quick'?'note-nav active':'note-nav'} onClick={()=>setActive('quick')}>Quick note</button>{noteKeys.map(k=><button key={k} className={active===k?'note-nav active':'note-nav'} onClick={()=>setActive(k)}>{k.replace('topic:','').replaceAll(':',' / ')}</button>)}</Card><Card><div className="note-top"><div><div className="eyebrow">{active==='quick'?'QUICK NOTE':'TOPIC NOTE'}</div><h2>{active==='quick'?'Scratchpad':active.replace('topic:','')}</h2></div><span className="muted">autosaved</span></div><textarea className="notes-big" value={value} onChange={e=>updateNote(active,e.target.value)} placeholder="Write your notes here..."/></Card></div></div>; }

function Projects({ state, set }) { const projects=[['Year 1','C++ Student / Bank Management CLI','C++ · OOP · File I/O'],['Year 2','Data Analytics Dashboard','Python · Pandas · Streamlit'],['Year 2','SQL-backed Web App','SQL · API · JS'],['Year 3','Image Classification Application','PyTorch · CNN · API'],['Year 3','NLP Service','Transformers · FastAPI · Docker'],['Year 4','RAG + Knowledge Base','Embeddings · Retrieval · Evaluation'],['Year 4','Capstone System','Research · Engineering · Deployment']]; return <div><PageTitle eyebrow="PROJECT STUDIO" title="Build proof, not just certificates." subtitle="Projects should grow with your prerequisites. Keep the scope realistic and document what you learned."/><div className="project-grid">{projects.map(([year,title,stack],i)=><Card key={title} className="project-card"><div className="project-year">{year}</div><h3>{title}</h3><p className="muted">{stack}</p><ProgressBar value={state.progress[`project:${i}`]?100:0} tone="green"/><button className="btn ghost small wide" onClick={()=>set({progress:{...state.progress,[`project:${i}`]:!state.progress[`project:${i}`]}})}>{state.progress[`project:${i}`]?'Completed ✓':'Mark project checkpoint'}</button></Card>)}</div></div>; }

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
