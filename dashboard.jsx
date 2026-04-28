/* global React, ReactDOM */
(function () {
  'use strict';
  const { useState, useEffect, useRef, useMemo } = React;
  // charts.jsx에서 등록한 컴포넌트들을 가져옴
  const { RadarChart, SequenceChart, AngularChart, EnergyFlow, LaybackMeter, IntegratedKineticDiagram } = window;

/* ---------------- THEME ---------------- */
function useTheme() {
  const [theme, setTheme] = useState(() => {
    try { return localStorage.getItem('bbl-theme') || 'dark'; } catch(_) { return 'dark'; }
  });
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    try { localStorage.setItem('bbl-theme', theme); } catch(_) {}
  }, [theme]);
  return [theme, setTheme];
}

/* ---------------- ICONS ---------------- */
const Ic = {
  home:    <svg className="ic-svg" viewBox="0 0 24 24"><path d="M3 12L12 4l9 8M5 10v10h14V10"/></svg>,
  body:    <svg className="ic-svg" viewBox="0 0 24 24"><circle cx="12" cy="5" r="2.4"/><path d="M12 8v6m-3 7l3-7 3 7M9 11h6"/></svg>,
  motion:  <svg className="ic-svg" viewBox="0 0 24 24"><path d="M3 18l5-10 4 6 5-9 4 8"/></svg>,
  velocity:<svg className="ic-svg" viewBox="0 0 24 24"><path d="M3 12a9 9 0 1118 0M12 12l5-3"/></svg>,
  flag:    <svg className="ic-svg" viewBox="0 0 24 24"><path d="M5 21V4m0 0l10 3-3 4 5 3-12 2"/></svg>,
  dumbbell:<svg className="ic-svg" viewBox="0 0 24 24"><path d="M3 9v6m4-9v12m0-6h10m0-6v12m4-9v6"/></svg>,
  star:    <svg className="ic-svg" viewBox="0 0 24 24"><path d="M12 3l3 6 7 1-5 5 1 7-6-3-6 3 1-7-5-5 7-1 3-6z"/></svg>,
  download:<svg className="ic-svg" viewBox="0 0 24 24"><path d="M12 4v12m0 0l-4-4m4 4l4-4M5 20h14"/></svg>,
  compare: <svg className="ic-svg" viewBox="0 0 24 24"><path d="M8 4v16m8-16v16M3 8h5m8 0h5M3 16h5m8 0h5"/></svg>,
  filter:  <svg className="ic-svg" viewBox="0 0 24 24"><path d="M3 5h18l-7 9v6l-4-2v-4z"/></svg>,
  sun:     <svg className="ic-svg" viewBox="0 0 24 24"><circle cx="12" cy="12" r="4"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M5 19l2-2M17 7l2-2"/></svg>,
  moon:    <svg className="ic-svg" viewBox="0 0 24 24"><path d="M20 14A8 8 0 119 4a7 7 0 0011 10z"/></svg>,
  chev:    <svg className="ic-svg" viewBox="0 0 24 24"><path d="M9 6l6 6-6 6"/></svg>,
  menu:    <svg className="ic-svg" viewBox="0 0 24 24"><path d="M4 6h16M4 12h16M4 18h16"/></svg>,
  printer: <svg className="ic-svg" viewBox="0 0 24 24"><path d="M6 9V3h12v6M6 18H4v-6h16v6h-2M8 14h8v6H8z"/></svg>,
};

/* ---------------- PITCHER SELECT (combobox) ---------------- */
function PitcherSelect({ pitchers, activeId, onSelect }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const ref = useRef(null);
  const active = pitchers.find(p => p.id === activeId) || pitchers[0];

  useEffect(() => {
    function onDoc(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const filtered = pitchers.filter(p =>
    !q || p.name.toLowerCase().includes(q.toLowerCase())
  );

  return (
    <div className="ps-wrap" ref={ref}>
      <button className="ps-trigger" onClick={() => setOpen(o => !o)}>
        <div className="ps-avatar">{active.name[0]}</div>
        <div className="ps-info">
          <div className="ps-name">{active.name}</div>
        </div>
        <svg className="ic-svg ps-chev" viewBox="0 0 24 24" style={{ transform: open ? 'rotate(180deg)' : 'none' }}>
          <path d="M6 9l6 6 6-6"/>
        </svg>
      </button>

      {open && (
        <div className="ps-dropdown">
          <input
            className="ps-search"
            type="text"
            placeholder="선수 검색..."
            value={q}
            onChange={e => setQ(e.target.value)}
            autoFocus
          />
          <div className="ps-list">
            {filtered.length === 0 ? (
              <div className="ps-empty">검색 결과 없음</div>
            ) : filtered.map(p => (
              <button key={p.id}
                className={`ps-item ${p.id === activeId ? 'active' : ''}`}
                onClick={() => { onSelect(p.id); setOpen(false); setQ(''); }}>
                <div className="ps-avatar sm">{p.name[0]}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="ps-name">{p.name}</div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------------- SIDEBAR ---------------- */
function Sidebar({ pitchers, activeId, onSelect, mode, onMode, navItems, activeNav, onNavSelect, isOpen, onClose, onBack }) {
  const isSingle = pitchers.length <= 1;
  return (
    <>
      {isOpen && <div className="sb-overlay show" onClick={onClose}/>}
      <aside className={`sidebar ${isOpen ? 'open' : ''}`}>
      <div className="sb-brand">
        <img src="assets/logo-bbl.png" alt="BBL"/>
        <div>
          <div className="name">BioMotion Lab</div>
          <div className="sub">Pitcher Dashboard</div>
        </div>
        <button className="sb-close" onClick={onClose} aria-label="닫기">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M6 6l12 12M18 6L6 18"/>
          </svg>
        </button>
      </div>

      {!isSingle && (
        <>
          <div className="sb-section-title">Pitcher</div>
          <PitcherSelect pitchers={pitchers} activeId={activeId} onSelect={(id) => { onSelect(id); onClose && onClose(); }}/>
        </>
      )}

      <div className="sb-section-title">Sections</div>
      <div className="sb-nav">
        {navItems.map(n => (
          <button key={n.id}
            className={`sb-nav-item ${activeNav === n.id ? 'active' : ''}`}
            onClick={() => { onNavSelect(n.id); onClose && onClose(); }}>
            <span className="ic">{n.icon}</span>
            {n.label}
            <span className="num">{n.num}</span>
          </button>
        ))}
      </div>

      {!isSingle && (
        <>
          <div className="sb-section-title">View Mode</div>
          <div className="sb-nav">
            <button className={`sb-nav-item ${mode === 'single' ? 'active' : ''}`} onClick={() => onMode('single')}>
              <span className="ic">{Ic.home}</span>
              개별 분석
            </button>
            <button className={`sb-nav-item ${mode === 'compare' ? 'active' : ''}`} onClick={() => onMode('compare')}>
              <span className="ic">{Ic.compare}</span>
              선수 비교
            </button>
          </div>
        </>
      )}

      <div className="sb-foot">
        {onBack && (
          <button className="sb-foot-btn" onClick={() => {
            if (confirm('현재 분석 결과를 닫고 새 분석을 시작합니다. 계속하시겠어요?')) onBack();
          }} style={{
            marginBottom: 6, background: 'transparent', border: '1px solid var(--d-border)'
          }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="m15 18-6-6 6-6"/>
            </svg>
            <span>새 분석</span>
          </button>
        )}
        <button className="sb-foot-btn" onClick={() => window.print()}>
          {Ic.printer}
          <span>PDF</span>
        </button>
      </div>
      </aside>
    </>
  );
}

/* ---------------- TOP BAR ---------------- */
function DashTopBar({ pitcher, mode, theme, onTheme, onMenu, onBack }) {
  return (
    <div className="topbar2">
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <button className="menu-toggle" onClick={onMenu}>{Ic.menu}</button>
        <div className="tb-crumbs">
          <span>BBL</span><span className="sep">/</span>
          <span>{mode === 'compare' ? 'Compare Mode' : '개별 분석'}</span>
          {mode !== 'compare' && pitcher && <>
            <span className="sep">/</span>
            <span className="now">{pitcher.name}</span>
          </>}
        </div>
      </div>
      <div className="tb-actions">
        <span className="tb-filter">
          {Ic.filter}
          측정일&nbsp;<b>{pitcher?.date || '2026-04-24'}</b>
        </span>
        <div className="seg-toggle">
          <button className={theme === 'light' ? 'active' : ''} onClick={() => onTheme('light')} title="Light">
            {Ic.sun}
          </button>
          <button className={theme === 'dark' ? 'active' : ''} onClick={() => onTheme('dark')} title="Dark">
            {Ic.moon}
          </button>
        </div>
        {onBack && (
          <button className="tb-btn" onClick={() => {
            if (confirm('현재 분석 결과를 닫고 새 분석을 시작합니다. 계속하시겠어요?')) onBack();
          }} title="새 분석" style={{
            background: 'transparent', border: '1px solid var(--d-border)', color: 'var(--d-fg2)',
            padding: '6px 12px', fontSize: 12, fontWeight: 600, cursor: 'pointer', borderRadius: 6,
            display: 'flex', alignItems: 'center', gap: 6
          }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="m15 18-6-6 6-6"/>
            </svg>
            새 분석
          </button>
        )}
        <button className="tb-btn primary" onClick={() => window.print()}>
          {Ic.download} <span>PDF</span>
        </button>
      </div>
    </div>
  );
}

/* ---------------- KPI CARDS ---------------- */
function KPI({ hero, label, value, unit, deg, band, foot, sparkData }) {
  const bandLabel = { high: '기준 상위', mid: '기준 범위', low: '기준 미만', na: '미측정' };
  return (
    <div className={`kpi ${hero ? 'kpi-hero' : ''}`}>
      <div className="kpi-label"><span className="dot"/>{label}</div>
      <div className="kpi-value">
        {value}
        {deg && <span className="deg">°</span>}
        {unit && <span className="unit">{unit}</span>}
      </div>
      <div className="kpi-foot">
        {band && <span className={`kpi-band ${band}`}>{bandLabel[band]}</span>}
        {foot && <span className="kpi-trend">{foot}</span>}
      </div>
      {sparkData && <Spark data={sparkData}/>}
    </div>
  );
}

function Spark({ data }) {
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const pts = data.map((v,i) => `${(i / (data.length-1)) * 100},${100 - ((v-min)/range)*90}`).join(' ');
  return (
    <svg className="spark" viewBox="0 0 100 100" preserveAspectRatio="none">
      <polyline points={pts} fill="none" stroke="var(--bbl-primary)" strokeWidth="2" vectorEffect="non-scaling-stroke"/>
    </svg>
  );
}

/* ---------------- OVERVIEW PANELS ---------------- */
function VelocityPanel({ p }) {
  const trials = useMemo(() => {
    // synth 10 trials with peak = velocity, avg = velocityAvg
    const base = p.velocityAvg;
    const peak = p.velocity;
    const arr = [];
    for (let i = 0; i < 10; i++) {
      arr.push(base - 1.5 + Math.sin(i * 0.7) * 1.2 + (Math.random() * 0.6));
    }
    arr[Math.floor(Math.random() * 10)] = peak;
    return arr;
  }, [p.id]);
  const max = Math.max(...trials, peak(p));
  const min = Math.min(...trials) - 1;
  function peak(p) { return p.velocity; }
  return (
    <div className="panel" style={{ minHeight: 280 }}>
      <div className="panel-head">
        <div>
          <div className="kicker">Velocity Profile</div>
          <h3>구속 추이 — 10회 시기별</h3>
          <div className="sub">· 피크 {p.velocity.toFixed(1)} · 평균 {p.velocityAvg.toFixed(1)} km/h</div>
        </div>
        <div className="panel-toolbar">
          <span className="panel-pill">10 trials</span>
        </div>
      </div>
      <svg viewBox="0 0 600 200" style={{ width: '100%', height: 200 }}>
        <defs>
          <linearGradient id="velgrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#2563EB" stopOpacity="0.3"/>
            <stop offset="1" stopColor="#2563EB" stopOpacity="0"/>
          </linearGradient>
        </defs>
        {/* horizontal grid */}
        {[0, 1, 2, 3].map(i => (
          <line key={i} x1="40" x2="580" y1={20 + i * 40} y2={20 + i * 40}
            stroke="var(--d-border)" strokeWidth="1"/>
        ))}
        {/* Y labels */}
        {[max, min + (max-min)*0.66, min + (max-min)*0.33, min].map((v,i) => (
          <text key={i} x="34" y={24 + i * 40} fill="var(--d-fg3)" fontSize="10"
            fontFamily="Inter" textAnchor="end" fontWeight="600">{v.toFixed(0)}</text>
        ))}
        {/* avg line */}
        <line x1="40" x2="580" y1={20 + (1 - (p.velocityAvg-min)/(max-min)) * 160}
          y2={20 + (1 - (p.velocityAvg-min)/(max-min)) * 160}
          stroke="#60a5fa" strokeWidth="1" strokeDasharray="4 3" opacity="0.5"/>
        <text x="576" y={20 + (1 - (p.velocityAvg-min)/(max-min)) * 160 - 4}
          fill="#60a5fa" fontSize="9" fontFamily="Inter" textAnchor="end" fontWeight="700">
          AVG {p.velocityAvg.toFixed(1)}
        </text>
        {/* area + line */}
        {(() => {
          const xs = trials.map((_, i) => 40 + (i / 9) * 540);
          const ys = trials.map(v => 20 + (1 - (v-min)/(max-min)) * 160);
          const path = xs.map((x,i) => `${i===0?'M':'L'}${x},${ys[i]}`).join('');
          const area = path + `L${xs[xs.length-1]},180 L${xs[0]},180 Z`;
          return (<g>
            <path d={area} fill="url(#velgrad)"/>
            <path d={path} fill="none" stroke="#2563EB" strokeWidth="2.5"/>
            {xs.map((x,i) => {
              const isPeak = trials[i] === Math.max(...trials);
              return (
                <g key={i}>
                  <circle cx={x} cy={ys[i]} r={isPeak ? 5 : 3.5} fill={isPeak ? '#fff' : '#2563EB'}
                    stroke="#2563EB" strokeWidth="2"/>
                  {isPeak && <text x={x} y={ys[i]-12} fill="var(--d-fg1)"
                    fontSize="11" fontFamily="Inter" fontWeight="800" textAnchor="middle">
                    {trials[i].toFixed(1)} <tspan fill="var(--d-fg3)" fontSize="8">km/h</tspan>
                  </text>}
                </g>
              );
            })}
          </g>);
        })()}
      </svg>
    </div>
  );
}

function usePinchZoom() {
  const ref = useRef(null);
  const stateRef = useRef({ scale: 1, tx: 0, ty: 0, pinchDist: 0, pinchCx: 0, pinchCy: 0, startScale: 1, startTx: 0, startTy: 0, panX: 0, panY: 0, isPanning: false });
  const [trans, setTrans] = useState({ scale: 1, tx: 0, ty: 0 });

  const apply = (s, tx, ty) => {
    stateRef.current.scale = s;
    stateRef.current.tx = tx;
    stateRef.current.ty = ty;
    setTrans({ scale: s, tx, ty });
  };

  const reset = () => apply(1, 0, 0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const dist = (a, b) => Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
    const mid = (a, b) => ({ x: (a.clientX + b.clientX)/2, y: (a.clientY + b.clientY)/2 });

    const onTouchStart = (e) => {
      const s = stateRef.current;
      if (e.touches.length === 2) {
        e.preventDefault();
        const [t1, t2] = e.touches;
        s.pinchDist = dist(t1, t2);
        const m = mid(t1, t2);
        const rect = el.getBoundingClientRect();
        s.pinchCx = m.x - rect.left;
        s.pinchCy = m.y - rect.top;
        s.startScale = s.scale;
        s.startTx = s.tx;
        s.startTy = s.ty;
      } else if (e.touches.length === 1 && s.scale > 1) {
        s.isPanning = true;
        s.panX = e.touches[0].clientX - s.tx;
        s.panY = e.touches[0].clientY - s.ty;
      }
    };

    const onTouchMove = (e) => {
      const s = stateRef.current;
      if (e.touches.length === 2) {
        e.preventDefault();
        const [t1, t2] = e.touches;
        const newDist = dist(t1, t2);
        const ratio = newDist / (s.pinchDist || 1);
        const newScale = Math.max(1, Math.min(5, s.startScale * ratio));
        // 핀치 중심 기준 확대/축소
        const dx = s.pinchCx - (el.clientWidth/2);
        const dy = s.pinchCy - (el.clientHeight/2);
        const newTx = s.startTx - dx * (newScale - s.startScale);
        const newTy = s.startTy - dy * (newScale - s.startScale);
        apply(newScale, newTx, newTy);
      } else if (e.touches.length === 1 && s.isPanning && s.scale > 1) {
        e.preventDefault();
        const newTx = e.touches[0].clientX - s.panX;
        const newTy = e.touches[0].clientY - s.panY;
        apply(s.scale, newTx, newTy);
      }
    };

    const onTouchEnd = (e) => {
      const s = stateRef.current;
      if (e.touches.length === 0) {
        s.isPanning = false;
        if (s.scale < 1.05) reset();
      }
    };

    const onDblClick = (e) => {
      // 버튼/컨트롤 클릭은 zoom 토글에서 제외 (프레임 스텝 연타 오작동 방지)
      if (e.target.closest && e.target.closest('button, .frame-controls, .rate-switch')) return;
      const s = stateRef.current;
      if (s.scale > 1) reset();
      else {
        const rect = el.getBoundingClientRect();
        const dx = (e.clientX - rect.left) - el.clientWidth/2;
        const dy = (e.clientY - rect.top) - el.clientHeight/2;
        apply(2, -dx, -dy);
      }
    };

    el.addEventListener('touchstart', onTouchStart, { passive: false });
    el.addEventListener('touchmove', onTouchMove, { passive: false });
    el.addEventListener('touchend', onTouchEnd);
    el.addEventListener('dblclick', onDblClick);
    return () => {
      el.removeEventListener('touchstart', onTouchStart);
      el.removeEventListener('touchmove', onTouchMove);
      el.removeEventListener('touchend', onTouchEnd);
      el.removeEventListener('dblclick', onDblClick);
    };
  }, []);

  return { ref, trans, reset };
}

function VideoPanel({ p }) {
  const videoRef = useRef(null);
  const [rate, setRate] = useState(1);
  const [isPaused, setIsPaused] = useState(true);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const rates = [1, 0.25, 0.1];
  const src = p.mocapUrl || p.video || p.videoUrl;
  const isYouTube = src && /youtu\.?be/.test(src);
  let ytEmbed = null;
  if (isYouTube) {
    const m = src.match(/(?:youtu\.be\/|v=)([\w-]{11})/);
    if (m) ytEmbed = `https://www.youtube.com/embed/${m[1]}?rel=0&modestbranding=1`;
  }

  useEffect(() => {
    if (videoRef.current) videoRef.current.playbackRate = rate;
  }, [rate]);

  const FRAME = 1 / 30;
  const step = async (dir) => {
    const v = videoRef.current;
    if (!v) return;
    try { await v.pause(); } catch(_) {}
    const dur = isFinite(v.duration) ? v.duration : Infinity;
    v.currentTime = Math.max(0, Math.min(dur, v.currentTime + dir * FRAME));
  };
  const toggle = async () => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) { try { await v.play(); } catch(_) {} } else v.pause();
  };
  const onSeek = (e) => {
    const v = videoRef.current;
    if (!v || !isFinite(v.duration)) return;
    const t = parseFloat(e.target.value);
    v.currentTime = t;
    setCurrentTime(t);
  };
  const formatTime = (t) => {
    if (!isFinite(t) || t < 0) return '0:00.00';
    const m = Math.floor(t / 60);
    const s = (t % 60).toFixed(2).padStart(5, '0');
    return `${m}:${s}`;
  };
  const onKey = (e) => {
    if (e.key === 'ArrowLeft') { e.preventDefault(); step(-1); }
    else if (e.key === 'ArrowRight') { e.preventDefault(); step(1); }
    else if (e.key === ' ') { e.preventDefault(); toggle(); }
  };

  const showScrubber = !!src && !ytEmbed;
  const { ref: zoomRef, trans, reset: resetZoom } = usePinchZoom();
  const zoomed = trans.scale > 1.05;

  return (
    <div className="panel" style={{ minHeight: 280, display: 'flex', flexDirection: 'column' }}>
      <div className="panel-head">
        <div>
          <div className="kicker">Motion Capture</div>
          <h3>투구 영상 시퀀스</h3>
          <div className="sub">· {p.name} {showScrubber ? '· ← → 프레임 · Space 재생/정지 · 핀치 줌' : '· 3D 스켈레톤 트래킹'}</div>
        </div>
        {showScrubber ? (
          <div className="rate-switch">
            {rates.map(r => (
              <button key={r}
                className={`rate-btn ${rate === r ? 'active' : ''}`}
                onClick={() => setRate(r)}>{r}×</button>
            ))}
          </div>
        ) : (
          <div className="mocap-badge">
            <span className="mocap-dot"/> LIVE
          </div>
        )}
      </div>

      <div className="video-wrap" tabIndex={0} onKeyDown={onKey} ref={zoomRef}
           style={{ touchAction: zoomed ? 'none' : 'auto', overflow: 'hidden' }}>
        <div style={{
          width: '100%', height: '100%',
          transform: `translate(${trans.tx}px, ${trans.ty}px) scale(${trans.scale})`,
          transformOrigin: 'center center',
          transition: zoomed ? 'none' : 'transform .25s ease',
        }}>
          {ytEmbed ? (
            <iframe src={ytEmbed} title={`${p.name} mocap`} allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen/>
          ) : src ? (
            <video ref={videoRef} src={src} playsInline preload="auto" muted controls={false} disablePictureInPicture
              onPlay={() => setIsPaused(false)}
              onPause={() => setIsPaused(true)}
              onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
              onLoadedMetadata={(e) => {
                const v = e.currentTarget;
                v.playbackRate = rate;
                setDuration(v.duration || 0);
                // 첫 프레임 강제 표시 (검은 화면 방지)
                try { v.currentTime = 0.001; } catch(_) {}
              }}/>
          ) : (
            <MocapPlaceholder p={p}/>
          )}
        </div>
        {zoomed && (
          <button onClick={resetZoom} style={{
            position: 'absolute', top: 12, right: 12,
            padding: '6px 12px', borderRadius: 6,
            background: 'rgba(0,0,0,.75)', color: '#fff',
            border: '1px solid rgba(255,255,255,.2)',
            fontSize: 11, fontWeight: 600, cursor: 'pointer', zIndex: 5,
          }}>
            {trans.scale.toFixed(1)}× · Reset
          </button>
        )}
      </div>
      {showScrubber && (
        <div className="seek-bar">
          <span className="seek-time">{formatTime(currentTime)}</span>
          <input type="range" className="seek-slider"
                 min={0} max={duration || 0} step={FRAME} value={currentTime}
                 onChange={onSeek}
                 onInput={onSeek}
                 onPointerDown={() => { try { videoRef.current && videoRef.current.pause(); } catch(_) {} }}
                 onTouchStart={() => { try { videoRef.current && videoRef.current.pause(); } catch(_) {} }}
                 style={{ '--seek-progress': `${duration ? (currentTime / duration) * 100 : 0}%` }}
                 aria-label="동영상 시점 이동"/>
          <span className="seek-time">{formatTime(duration)}</span>
        </div>
      )}
      {showScrubber && (
        <div className="frame-controls">
          <button className="frame-btn" onClick={() => step(-1)}>◀ −1f</button>
          <button className="frame-btn play" onClick={toggle}>{isPaused ? '▶ 재생' : '❚❚ 정지'}</button>
          <button className="frame-btn" onClick={() => step(1)}>+1f ▶</button>
        </div>
      )}

      <div className="video-tags">
        <span className="video-tag">{p.archetype}</span>
        <span className="video-tag">{p.velocity.toFixed(0)} km/h</span>
        <span className="video-tag">{p.pitchType || 'Fastball'}</span>
        <span className="video-tag">측정 · {p.date}</span>
      </div>
    </div>
  );
}

/* Motion Capture Placeholder — 3D-스켈레톤 애니메이션 */
function MocapPlaceholder({ p }) {
  return (
    <div className="mocap-stage">
      {/* 그리드 바닥 */}
      <svg className="mocap-grid" viewBox="0 0 400 225" preserveAspectRatio="none">
        <defs>
          <linearGradient id="grid-fade" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="rgba(96,165,250,0)" />
            <stop offset="100%" stopColor="rgba(96,165,250,0.25)" />
          </linearGradient>
        </defs>
        {/* 원근 그리드 */}
        {[...Array(8)].map((_, i) => {
          const y = 140 + i * 12;
          const inset = i * 14;
          return <line key={'h'+i} x1={inset} y1={y} x2={400-inset} y2={y} stroke="url(#grid-fade)" strokeWidth="0.5"/>;
        })}
        {[...Array(11)].map((_, i) => {
          const x1 = 40 + i * 32;
          const x2 = 100 + i * 20;
          return <line key={'v'+i} x1={x1} y1={140} x2={x2} y2={225} stroke="url(#grid-fade)" strokeWidth="0.5"/>;
        })}
      </svg>

      {/* 스켈레톤 (애니메이션 SVG) */}
      <svg className="mocap-skeleton" viewBox="0 0 400 225" preserveAspectRatio="xMidYMid meet">
        <defs>
          <radialGradient id="joint-glow">
            <stop offset="0%" stopColor="#60a5fa" stopOpacity="0.9"/>
            <stop offset="100%" stopColor="#60a5fa" stopOpacity="0"/>
          </radialGradient>
        </defs>

        {/* 본 (라인) */}
        <g className="bones" stroke="#60a5fa" strokeWidth="1.5" strokeLinecap="round" fill="none">
          {/* 척추 */}
          <line x1="200" y1="60" x2="200" y2="130" className="bone"/>
          {/* 어깨 라인 */}
          <line x1="170" y1="80" x2="230" y2="80" className="bone"/>
          {/* 좌측 팔 (글러브) */}
          <line x1="170" y1="80" x2="145" y2="105" className="bone"/>
          <line x1="145" y1="105" x2="125" y2="125" className="bone"/>
          {/* 우측 팔 (투구) — 동적 */}
          <line x1="230" y1="80" x2="265" y2="65" className="bone arm-up"/>
          <line x1="265" y1="65" x2="295" y2="55" className="bone arm-up"/>
          {/* 골반 */}
          <line x1="180" y1="130" x2="220" y2="130" className="bone"/>
          {/* 좌측 다리 (앞발) */}
          <line x1="180" y1="130" x2="165" y2="170" className="bone"/>
          <line x1="165" y1="170" x2="155" y2="205" className="bone"/>
          {/* 우측 다리 (축발) */}
          <line x1="220" y1="130" x2="235" y2="170" className="bone"/>
          <line x1="235" y1="170" x2="225" y2="205" className="bone"/>
        </g>

        {/* 관절 (점) */}
        <g className="joints" fill="#60a5fa">
          {[
            [200,55,3.5,'head'],
            [200,60,2.5,'neck'],
            [170,80,2.5,'sh-l'],
            [230,80,2.5,'sh-r'],
            [145,105,2,'el-l'],
            [125,125,2,'wr-l'],
            [265,65,2,'el-r'],
            [295,55,2.5,'wr-r'],
            [200,130,2.5,'pelvis'],
            [180,130,2,'hip-l'],
            [220,130,2,'hip-r'],
            [165,170,2,'kn-l'],
            [155,205,2,'an-l'],
            [235,170,2,'kn-r'],
            [225,205,2,'an-r'],
          ].map(([x,y,r,k]) => (
            <g key={k}>
              <circle cx={x} cy={y} r={r*2.5} fill="url(#joint-glow)"/>
              <circle cx={x} cy={y} r={r}/>
            </g>
          ))}
        </g>

        {/* 머리 */}
        <circle cx="200" cy="48" r="10" fill="none" stroke="#60a5fa" strokeWidth="1.5"/>

        {/* 공 궤적 */}
        <g className="ball-trace">
          <path d="M 295 55 Q 340 40 380 30" stroke="#fbbf24" strokeWidth="1" strokeDasharray="2 3" fill="none" opacity="0.5"/>
          <circle cx="295" cy="55" r="3" fill="#fbbf24" className="ball"/>
        </g>

        {/* 측정 라벨 */}
        <g className="mocap-labels" fontSize="7" fontFamily="ui-monospace, monospace" fill="#60a5fa" opacity="0.7">
          <text x="305" y="48">WR · {(p.velocity * 0.27).toFixed(1)} m/s</text>
          <text x="100" y="138">PEL · {p.layback?.deg.toFixed(0) || 90}°</text>
          <text x="155" y="220">FT · stride</text>
        </g>
      </svg>

      {/* HUD */}
      <div className="mocap-hud">
        <div className="hud-l">
          <div className="hud-row"><span>SUBJECT</span><b>{p.name}</b></div>
          <div className="hud-row"><span>FRAME</span><b className="frame-counter">000 / 240</b></div>
          <div className="hud-row"><span>FPS</span><b>240</b></div>
        </div>
        <div className="hud-r">
          <div className="hud-row"><span>BALL VEL</span><b>{p.velocity.toFixed(1)} km/h</b></div>
          <div className="hud-row"><span>MAX LAYBACK</span><b>{p.layback?.deg.toFixed(1) || '—'}°</b></div>
          <div className="hud-row"><span>STATUS</span><b style={{color:'#4ade80'}}>● TRACKING</b></div>
        </div>
      </div>
    </div>
  );
}

function CoreIssuePanel({ p }) {
  const sevLabel = p.severity === 'NONE' ? 'BALANCED' : p.severity;
  const sevDesc = {
    'HIGH':     '즉시 개입 권장',
    'MEDIUM':   '교정 우선순위 높음',
    'LOW':      '점진적 개선',
    'BALANCED': '균형 잡힌 상태',
    'NONE':     '균형 잡힌 상태',
  }[sevLabel] || '평가 진행 중';

  const Stat = ({ label, value, color, accent }) => (
    <div style={{
      flex: 1,
      padding: '14px 12px',
      background: 'rgba(8, 8, 12, 0.35)',
      border: `1px solid ${accent || 'var(--d-border)'}`,
      borderRadius: 10,
      textAlign: 'center',
      minWidth: 0,
    }}>
      <div style={{ fontSize: 26, fontWeight: 800, color: color, fontFamily: 'Inter', lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: 10, color: 'var(--d-fg3)', marginTop: 6, fontWeight: 600, letterSpacing: '0.5px' }}>{label}</div>
    </div>
  );

  return (
    <div className="panel">
      <div className="panel-head">
        <div>
          <div className="kicker">Core Issue</div>
          <h3>핵심 진단</h3>
          <div className="sub">· 한눈 요약 · 자세한 내용은 아래 섹션 참조</div>
        </div>
      </div>

      {/* 종합 평가 1줄 */}
      <div className="diag-row" style={{ marginTop: 12 }}>
        <span className={`sev sev-${p.severity}`}>{sevLabel}</span>
        <div style={{ fontSize: 13, color: 'var(--d-fg1)', lineHeight: 1.5, fontWeight: 600 }}>
          {p.coreIssue}
        </div>
      </div>

      {/* 카운트 3개 */}
      <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
        <Stat label="강점 · STRENGTHS"  value={p.strengths.length}  color="#4ade80" accent="rgba(74,222,128,0.35)"/>
        <Stat label="약점 · WEAKNESS"   value={p.weaknesses.length} color="#f87171" accent="rgba(248,113,113,0.35)"/>
        <Stat label="체크 · CHECKPOINT" value={p.flags.length}      color="#fbbf24" accent="rgba(251,191,36,0.35)"/>
      </div>

      {/* 아치타입 강조 */}
      <div style={{
        marginTop: 14,
        padding: '12px 14px',
        background: 'linear-gradient(135deg, rgba(37,99,235,0.12), rgba(37,99,235,0.04))',
        border: '1px solid rgba(37,99,235,0.3)',
        borderRadius: 10,
        display: 'flex',
        alignItems: 'center',
        gap: 12,
      }}>
        <svg width="20" height="20" viewBox="0 0 24 24" style={{ color: '#60a5fa', flexShrink: 0 }}>
          <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 9, color: '#60a5fa', fontWeight: 700, letterSpacing: '1.2px' }}>ARCHETYPE</div>
          <div style={{ fontSize: 14, color: 'var(--d-fg1)', fontWeight: 700, marginTop: 2 }}>{p.archetype}</div>
        </div>
        <div style={{
          marginLeft: 'auto',
          fontSize: 11,
          color: 'var(--d-fg3)',
          fontWeight: 500,
          textAlign: 'right',
          flexShrink: 0,
        }}>
          {sevDesc}
        </div>
      </div>

      <div style={{ marginTop: 14, paddingTop: 12, borderTop: '1px solid var(--d-border)', fontSize: 11, color: 'var(--d-fg3)', display: 'flex', justifyContent: 'space-between' }}>
        <span>측정일 · {p.date}</span>
        <span>아래 섹션에서 상세 분석 →</span>
      </div>
    </div>
  );
}

/* ---------------- EXPECTED VELOCITY (Hybrid model) ----------------
 * Driveline (2021) "Predicted Velocity Through Jump and Strength Testing" 방법론을 차용하여
 * BBL 한국 대학생 투수 표본 분포 기반으로 계수 보정한 hybrid 모델.
 * - Physical: CMJ 단위파워 / RSI-mod / SJ peak power 기반
 * - Mechanical: ETI(T→A) / 상완 회전속도 / max layback / 누수% 기반
 * - 절대 예측이 아닌 "with all other variables equal" 기대값 → 실제 vs 기대 gap으로 lowest hanging fruit 식별
 * - 참고: Driveline (2021), Werner (2008), Stodden (2005), Lehman et al. (2013) 등
 */
function expectedVelocity(p) {
  const BASE = 134.7; // BBL 4인 평균 km/h (한국 고교/대학생 투수 baseline)
  const CAP = 10;     // ±10 km/h cap (소표본 outlier 흡수)

  // 4인 baseline (옵션 D · 절대 + 상대 + mass) — 실측 체중 기반
  const BASE_W_CMJ = 3749;  // 4인 평균 CMJ 절대 W (실측)
  const BASE_W_SJ  = 3325;  // 4인 평균 SJ 절대 W (실측)
  const BASE_MASS  = 76.1;  // 4인 평균 체중 kg (실측)
  const BASE_CMJWKG = 50;   // 4인 평균 CMJ W/kg
  const BASE_RSI    = 0.52; // 4인 평균 RSI-mod

  // null-safe value getter
  const v = (x, dflt) => (x == null || isNaN(x)) ? dflt : x;

  const mass = v(p.physical?.weightKg, BASE_MASS);
  const cmjPerKg = v(p.physical?.cmjPower?.cmj, BASE_CMJWKG);
  const sjPerKg  = v(p.physical?.cmjPower?.sj, BASE_CMJWKG);
  const rsi      = v(p.physical?.reactive?.cmj, BASE_RSI);
  const cmjAbs = v(p.physical?.cmjPower?.cmjAbs, cmjPerKg * mass);
  const sjAbs  = v(p.physical?.cmjPower?.sjAbs,  sjPerKg  * mass);

  // Physical Expected (옵션 D · Driveline 방식 차용)
  const physContrib = {
    'CMJ 절대파워 (W)':   (cmjAbs - BASE_W_CMJ) / 100 * 0.18,
    'SJ 절대파워 (W)':    (sjAbs  - BASE_W_SJ)  / 100 * 0.10,
    'CMJ 단위파워 (W/kg)': (cmjPerKg - BASE_CMJWKG) * 0.08,
    'RSI-mod 반응성':      (rsi - BASE_RSI) * 14.0,
    '체격 (mass)':         (mass - BASE_MASS) * 0.05,
  };
  let physPred = BASE + Object.values(physContrib).reduce((a,b)=>a+b, 0);
  physPred = Math.max(BASE - CAP, Math.min(BASE + CAP, physPred));

  // Mechanical Expected — 메카닉스 기반 (raw 시계열 4인 평균 baseline)
  // 4인 평균: ETI T→A 1.82, arm peak 1478°/s, layback 156°, leak 0%
  const mechContrib = {
    'ETI 상완 전달':   (v(p.energy?.etiTA, 1.82) - 1.82) * 8.0,
    '상완 회전 속도':  (v(p.angular?.arm, 1478) - 1478) / 50 * 1.2,
    'Max layback':    (v(p.layback?.deg, 156) - 156) * 0.10,
    '에너지 누수':    -v(p.energy?.leakPct, 0) * 0.10,
  };
  let mechPred = BASE + Object.values(mechContrib).reduce((a,b)=>a+b, 0);
  mechPred = Math.max(BASE - CAP, Math.min(BASE + CAP, mechPred));

  return { physPred, mechPred, physContrib, mechContrib, base: BASE };
}

function ExpectedVelocityPanel({ p }) {
  const { physPred, mechPred, physContrib, mechContrib } = expectedVelocity(p);
  const actual = p.velocity;
  const gapP = actual - physPred;  // + → 체력 ceiling 위로 outperforming
  const gapM = actual - mechPred;  // + → 메카닉스 ceiling 위로 outperforming
  const ceiling = Math.max(physPred, mechPred);
  const ceilingHeadroom = ceiling - actual;

  // 시나리오 분류 (gap 기준 ±2 km/h를 같음으로 처리)
  // 우리 분석과 모순 방지: 누수 35%↑면 무조건 메카닉스 lagging 우선
  const TOL = 2.0;
  const physLag = gapP < -TOL;  // actual < physPred → 체력 잠재가 더 큼 (체력에 비해 못 던짐)
  const mechLag = gapM < -TOL;  // actual < mechPred → 메카닉스 잠재가 더 큼
  // 단, 실제 누수 35%+면 메카닉스 lagging이 항상 우세
  const heavyLeak = p.energy.leakPct >= 35;

  let scenario, primary, secondary, advice;
  if (physLag && mechLag) {
    scenario = '체력·메카닉스 모두 잠재력 > 실제';
    primary = heavyLeak ? '메카닉스 효율 회복' : '체력 베이스라인 활용';
    secondary = heavyLeak ? '체력 우위 활용' : '메카닉스 다듬기';
    advice = heavyLeak
      ? '누수 우선 차단 → 체력은 이미 충분 · 에너지 전달이 막혀 잠재 미발현'
      : '체력·메카닉 양쪽 모두 보강 시 큰 폭 상승 가능';
  } else if (physLag) {
    scenario = '체력 잠재력 > 실제 (메카닉스 lagging)';
    primary = '메카닉스 다듬기';
    secondary = '체력 유지';
    advice = '체력은 이미 ceiling — 동작 효율(에너지 전달, 시퀀스, layback) 보강이 lowest hanging fruit';
  } else if (mechLag) {
    scenario = '메카닉스 잠재력 > 실제 (체력 lagging)';
    primary = '체력 보강';
    secondary = '메카닉스 유지';
    advice = '메카닉스는 이미 효율적 — 절대 근력·파워 증가가 가장 큰 상승 여력';
  } else if (gapP > TOL && gapM > TOL) {
    scenario = '재능형 · 측정 데이터 위에서 던짐 (Skill Outperforming)';
    primary = '⚠️ 부상 예방 우선 + 체력·메카닉 보강';
    secondary = '워크로드 모니터링';
    advice = '체력·메카닉 기대치 대비 더 잘 던지는 케이스 · 측정에 안 잡히는 강점(악력·SSC·신경근 효율 등)으로 보완 중 추정 · 약한 분절 회전 + 누수 위에 빠른 공 = 어깨·UCL 부하 큼 · 즉시 체력·메카닉 보강 필요 · 보강 시 추가 큰 상승 잠재력';
  } else {
    scenario = '실제 ≈ 기대 (균형형)';
    primary = '전반 동시 향상';
    secondary = '약점 보강';
    advice = '체력·메카닉스 모두 현재 수준으로 ceiling에 근접 — 둘 다 1 SD 향상 시 +2~3 km/h 가능';
  }

  // 시각화: 3개 막대 (실제 / 체력 기대 / 메카닉스 기대)
  const allVals = [actual, physPred, mechPred];
  const maxV = Math.max(...allVals) + 5;
  const minV = Math.min(...allVals) - 5;
  const range = maxV - minV;
  const w = 100; // %
  const toPct = (v) => ((v - minV) / range) * w;

  const Bar = ({ label, en, val, gap, color, isActual }) => {
    const pct = toPct(val);
    const sign = gap > 0 ? '+' : '';
    return (
      <div style={{ marginBottom: 14 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6, fontSize: 12 }}>
          <span style={{ fontWeight: 700, color: 'var(--d-fg1)' }}>
            {label} <span style={{ color: 'var(--d-fg3)', fontSize: 10, fontWeight: 500, marginLeft: 4 }}>{en}</span>
          </span>
          <span>
            <b style={{ color: color, fontSize: 16, fontFamily: 'Inter' }}>{val.toFixed(1)}</b>
            <span style={{ color: 'var(--d-fg3)', fontSize: 10, marginLeft: 3 }}>km/h</span>
            {!isActual && (
              <span style={{
                marginLeft: 8,
                padding: '2px 6px',
                borderRadius: 3,
                fontSize: 10,
                fontWeight: 700,
                background: gap > 1 ? 'rgba(74,222,128,0.15)' : gap < -1 ? 'rgba(248,113,113,0.15)' : 'rgba(148,163,184,0.15)',
                color: gap > 1 ? '#4ade80' : gap < -1 ? '#f87171' : '#94a3b8',
              }}>
                실제 {sign}{gap.toFixed(1)}
              </span>
            )}
          </span>
        </div>
        <div style={{ position: 'relative', height: 8, background: 'rgba(8,8,12,0.4)', borderRadius: 4, overflow: 'hidden' }}>
          <div style={{
            position: 'absolute', left: 0, top: 0, bottom: 0,
            width: `${pct}%`,
            background: `linear-gradient(90deg, ${color}88, ${color})`,
            borderRadius: 4,
          }}/>
        </div>
      </div>
    );
  };

  return (
    <div className="panel">
      <div className="panel-head">
        <div>
          <div className="kicker" style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            Expected Velocity · 기대 구속 모델
            <span style={{
              padding: '2px 7px', borderRadius: 4, fontSize: 9, fontWeight: 700, letterSpacing: '0.5px',
              background: 'rgba(251,191,36,0.15)', border: '1px solid rgba(251,191,36,0.4)', color: '#fbbf24',
            }}>v0.1 · PROTOTYPE</span>
            <span style={{
              padding: '2px 7px', borderRadius: 4, fontSize: 9, fontWeight: 600, letterSpacing: '0.3px',
              background: 'rgba(96,165,250,0.12)', border: '1px solid rgba(96,165,250,0.3)', color: '#93c5fd',
            }}>v1.0 (n=600) 작업 예정</span>
          </div>
          <h3>체력 vs 메카닉스 기대 구속</h3>
          <div className="sub">· 두 ceiling 비교로 가장 효과적인 훈련 방향 자동 추출</div>
        </div>
      </div>

      <div style={{ marginTop: 16 }}>
        <Bar label="실제 구속"          en="Actual"             val={actual}   gap={0}     color="#60a5fa" isActual/>
        <Bar label="체력 기반 기대 구속"   en="Physical Expected"  val={physPred} gap={gapP} color="#4ade80"/>
        <Bar label="메카닉스 기반 기대 구속" en="Mechanical Expected" val={mechPred} gap={gapM} color="#e8965a"/>
      </div>

      {/* 시나리오 + 훈련 방향 */}
      <div style={{
        marginTop: 18,
        padding: '14px 16px',
        background: 'linear-gradient(135deg, rgba(37,99,235,0.10), rgba(37,99,235,0.03))',
        border: '1px solid rgba(37,99,235,0.3)',
        borderRadius: 10,
      }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: '#60a5fa', letterSpacing: '1.2px', marginBottom: 6 }}>
          TRAINING DIRECTION · 훈련 방향
        </div>
        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--d-fg1)', marginBottom: 8 }}>
          {scenario}
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 10 }}>
          <div style={{
            padding: '6px 10px', borderRadius: 6, fontSize: 11, fontWeight: 700,
            background: 'rgba(74,222,128,0.15)', border: '1px solid rgba(74,222,128,0.4)', color: '#4ade80',
          }}>
            우선순위 1 · {primary}
          </div>
          <div style={{
            padding: '6px 10px', borderRadius: 6, fontSize: 11, fontWeight: 600,
            background: 'rgba(148,163,184,0.1)', border: '1px solid rgba(148,163,184,0.3)', color: 'var(--d-fg2)',
          }}>
            보조 · {secondary}
          </div>
        </div>
        <div style={{ fontSize: 12, color: 'var(--d-fg2)', lineHeight: 1.6 }}>
          · {advice}
        </div>
        {ceilingHeadroom > 1 && (
          <div style={{ marginTop: 8, fontSize: 11, color: 'var(--d-fg3)' }}>
            · 추정 잠재력 천장: <b style={{ color: '#fbbf24' }}>{ceiling.toFixed(1)} km/h</b>
            <span style={{ marginLeft: 6 }}>(현재 대비 +{ceilingHeadroom.toFixed(1)} km/h 여력)</span>
          </div>
        )}
      </div>

      {/* Skill Outperforming 케이스 — 가설 박스 (실제 > 기대 둘 다일 때만 표시) */}
      {gapP > TOL && gapM > TOL && (
        <div style={{
          marginTop: 14,
          padding: '14px 16px',
          background: 'linear-gradient(135deg, rgba(251,191,36,0.10), rgba(251,191,36,0.03))',
          border: '1px solid rgba(251,191,36,0.35)',
          borderRadius: 10,
        }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#fbbf24', letterSpacing: '1.2px', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fbbf24" strokeWidth="2.5"><path d="M12 9v4m0 3v.01M12 3l10 18H2z" strokeLinecap="round" strokeLinejoin="round"/></svg>
            WHY THIS PATTERN? · 데이터 역설의 가능한 원인
          </div>
          <div style={{ fontSize: 12, color: 'var(--d-fg2)', lineHeight: 1.7, marginBottom: 10 }}>
            체력·메카닉 측정값보다 더 빠른 공을 던지는 경우 · 측정에 안 잡히는 강점이 작용 중일 가능성:
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px 16px', fontSize: 11.5, lineHeight: 1.65, color: 'var(--d-fg2)' }}>
            <div>
              <b style={{ color: '#fbbf24' }}>① 손목·전완 폭발력</b><br/>
              <span style={{ color: 'var(--d-fg3)' }}>· 악력·grip 자체로 릴리스 직전 추가 가속</span>
            </div>
            <div>
              <b style={{ color: '#fbbf24' }}>② 신경근 효율 (타고난 재능)</b><br/>
              <span style={{ color: 'var(--d-fg3)' }}>· 분절 peak 외 timing 정밀도 + intent</span>
            </div>
            <div>
              <b style={{ color: '#fbbf24' }}>③ 체격적 이점</b><br/>
              <span style={{ color: 'var(--d-fg3)' }}>· 키·팔 길이 → release point 거리·각도 우위</span>
            </div>
            <div>
              <b style={{ color: '#fbbf24' }}>④ SSC 활용 (탄성 회수)</b><br/>
              <span style={{ color: 'var(--d-fg3)' }}>· EUR/RSI 우수 시 측정 외 가속 가능</span>
            </div>
          </div>
          <div style={{
            marginTop: 12,
            padding: '10px 12px',
            background: 'rgba(248,113,113,0.10)',
            border: '1px solid rgba(248,113,113,0.30)',
            borderRadius: 6,
            fontSize: 11.5,
            color: 'var(--d-fg2)',
            lineHeight: 1.6,
          }}>
            <b style={{ color: '#f87171' }}>⚠️ 부상 위험 경고</b> · 약한 분절 회전 + 누수 위에 빠른 공 = 어깨·팔꿈치 보상 부하 큼 ·
            "능력 위에서 던지는" 패턴은 투구 부상의 전형적 프로파일 ·
            <b> 현재 구속에 의존하지 말고 즉시 체력·메카닉 보강 권장</b>
          </div>
        </div>
      )}

      {/* 모델 설명 (작게) */}
      <details style={{ marginTop: 12, fontSize: 11, color: 'var(--d-fg3)' }}>
        <summary style={{ cursor: 'pointer', fontWeight: 600 }}>모델 상세 · 계수 기여도 보기</summary>
        <div style={{ marginTop: 10, padding: 12, background: 'rgba(0,0,0,0.25)', borderRadius: 6, lineHeight: 1.7 }}>
          <div style={{ fontWeight: 700, color: '#4ade80', marginBottom: 4 }}>체력 기반 기여도 (km/h)</div>
          {Object.entries(physContrib).map(([k,v]) => (
            <div key={k} style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px dashed rgba(148,163,184,0.15)', padding: '2px 0' }}>
              <span>· {k}</span>
              <span style={{ color: v >= 0 ? '#4ade80' : '#f87171', fontFamily: 'Inter', fontWeight: 600 }}>{v >= 0 ? '+' : ''}{v.toFixed(2)}</span>
            </div>
          ))}
          <div style={{ fontWeight: 700, color: '#e8965a', margin: '10px 0 4px' }}>메카닉스 기반 기여도 (km/h)</div>
          {Object.entries(mechContrib).map(([k,v]) => (
            <div key={k} style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px dashed rgba(148,163,184,0.15)', padding: '2px 0' }}>
              <span>· {k}</span>
              <span style={{ color: v >= 0 ? '#4ade80' : '#f87171', fontFamily: 'Inter', fontWeight: 600 }}>{v >= 0 ? '+' : ''}{v.toFixed(2)}</span>
            </div>
          ))}
          <div style={{ marginTop: 10, padding: 8, borderTop: '1px solid var(--d-border)', fontSize: 10, color: 'var(--d-fg3)', lineHeight: 1.6 }}>
            <b>방법론 출처</b> · Driveline Baseball (2021) <i>"Predicted Velocity Through Jump and Strength Testing"</i> 모델 차용,
            BBL 한국 대학생 투수 4인 baseline(평균 134.7 km/h)에 맞춰 계수 보정.
            선행 연구: Werner (2008), Stodden et al. (2005), Lehman et al. (2013).
            <br/><b>주의</b> · "with all other variables equal" 기대값 — 절대 예측 아님.
            ±10 km/h cap 적용. 표본 4명 기반이므로 추가 표본 누적 시 정확도 향상 예정.
          </div>

          {/* v1.0 업그레이드 로드맵 */}
          <div style={{ marginTop: 14, padding: 12, background: 'rgba(96,165,250,0.05)', border: '1px solid rgba(96,165,250,0.2)', borderRadius: 6 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: '#93c5fd', letterSpacing: '1px', marginBottom: 8 }}>
              v1.0 UPGRADE ROADMAP · 정식 모델 작업 계획
            </div>
            <div style={{ fontSize: 11, color: 'var(--d-fg2)', lineHeight: 1.7, marginBottom: 10 }}>
              BBL 보유 <b style={{ color: '#93c5fd' }}>약 600명 투수 데이터셋</b>(Uplift Labs 마커리스 모션캡처 + Rapsodo 트래킹 + ForceDecks 포스플레이트 통합)을 활용해
              v0.1 prototype을 검증된 회귀 모델로 업그레이드 예정.
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 10, lineHeight: 1.6 }}>
              <div style={{ padding: 8, background: 'rgba(8,8,12,0.3)', borderRadius: 4, border: '1px solid var(--d-border)' }}>
                <div style={{ fontWeight: 700, color: '#fbbf24', marginBottom: 4 }}>Phase 1 · 데이터 통합</div>
                <div style={{ color: 'var(--d-fg3)' }}>· 세 시스템 측정 매칭<br/>· 결측·이상치 처리<br/>· 수준별 표본 분포 검증</div>
              </div>
              <div style={{ padding: 8, background: 'rgba(8,8,12,0.3)', borderRadius: 4, border: '1px solid var(--d-border)' }}>
                <div style={{ fontWeight: 700, color: '#fbbf24', marginBottom: 4 }}>Phase 2 · 회귀 모델 fit</div>
                <div style={{ color: 'var(--d-fg3)' }}>· 75:25 split · 5-fold CV<br/>· R²·MAE·VIF·잔차 진단<br/>· 95% CI 산출</div>
              </div>
              <div style={{ padding: 8, background: 'rgba(8,8,12,0.3)', borderRadius: 4, border: '1px solid var(--d-border)' }}>
                <div style={{ fontWeight: 700, color: '#93c5fd', marginBottom: 4 }}>Phase 3 · 수준별 baseline</div>
                <div style={{ color: 'var(--d-fg3)' }}>· 고교/대학/실업/프로 분리<br/>· 변수별 percentile 산출<br/>· "프로 상위 N%" 절대 기준</div>
              </div>
              <div style={{ padding: 8, background: 'rgba(8,8,12,0.3)', borderRadius: 4, border: '1px solid var(--d-border)' }}>
                <div style={{ fontWeight: 700, color: '#93c5fd', marginBottom: 4 }}>Phase 4 · 하위 모델 확장</div>
                <div style={{ color: 'var(--d-fg3)' }}>· 부상 위험 모델<br/>· 선발/불펜 분리<br/>· 연령별 발달 곡선</div>
              </div>
            </div>

            <div style={{ marginTop: 10, fontSize: 10, color: 'var(--d-fg3)', lineHeight: 1.6 }}>
              <b>예상 산출물</b> · 한국 대학생 투수 코호트 회귀 모델 (R² 0.55+ 예상) ·
              수준별 percentile 자동 산출 시스템 · 학술 논문화 가능
              ("한국 야구 투수 force plate metrics와 fastball velocity의 관계: 600인 코호트 분석")
            </div>
          </div>
        </div>
      </details>
    </div>
  );
}

/* ---------------- COMMAND PROFILE PANEL ---------------- */
/* ---------------- 신규 패널 (Section 05/06/D/E) ---------------- */

// 학술 변인 설명 박스 — 정의/의미/해석/판단 (펼치기/접기)
function InfoBox({ items }) {
  const [open, setOpen] = useState(false);
  // def / meaning / interpret / judge → 단일 통합 본문으로 결합
  function joinBody(it) {
    if (it.body) return it.body;  // 새 형식: body 필드만 사용
    const parts = [];
    if (it.def)       parts.push(it.def);
    if (it.meaning)   parts.push(it.meaning);
    if (it.interpret) parts.push(it.interpret);
    if (it.judge)     parts.push(it.judge);
    return parts.join(' ');
  }
  return (
    <div style={{ marginTop: 10, border: '1px solid var(--d-border)', borderRadius: 6, overflow: 'hidden' }}>
      <button onClick={() => setOpen(!open)} style={{
        width: '100%', textAlign: 'left', padding: '8px 12px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        background: 'rgba(96,165,250,0.06)', color: '#60a5fa',
        fontSize: 11.5, fontWeight: 700, cursor: 'pointer', border: 'none', fontFamily: 'inherit'
      }} className="info-toggle">
        <span>📖 변인 설명</span>
        <span style={{ color: 'var(--d-fg3)' }}>{open ? '▲ 접기' : '▼ 펼치기'}</span>
      </button>
      {open && (
        <div style={{ padding: 12, background: 'var(--d-bg2)', display: 'flex', flexDirection: 'column', gap: 12 }}>
          {items.map((it, i) => (
            <div key={i} style={{ borderLeft: '2px solid #60a5fa', paddingLeft: 10 }}>
              <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--d-fg1)', marginBottom: 6 }}>{it.term}</div>
              <div style={{ fontSize: 11.5, lineHeight: 1.7, color: 'var(--d-fg2)' }}>
                {joinBody(it)}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Section 02B — 통합 변인 설명 패널 (사용자 요청: 별도 섹션 + 하나의 통합 박스) ───
function UnifiedVariablesPanel() {
  // 카테고리 → 변인 항목 묶음
  const groups = [
    {
      title: '② 어깨 폭발력',
      icon: '💪',
      accent: '#3b82f6',
      items: [
        {
          term: '어깨 폭발력 (Cocking-phase Arm Power · W/kg)',
          body: '코킹(Cocking) 단계 — Foot Contact ~ Maximum External Rotation 사이 — 동안 팔 분절(상완+전완+손)에 가해지는 단위 체중당 평균 파워 (Naito 2014 induced power 분석 기반, ΔKE_arm / Δt ÷ massKg = W/kg). 이 단계는 팔이 가속을 시작하는 결정적 구간이라 어깨가 만들어내는 폭발력이 클수록 빠른 ω가 가능하고 결과적으로 구속이 빨라집니다. 단순 어깨 근력이 아니라 짧은 시간(~50ms)에 폭발적으로 출력되는 단위파워 개념. 값이 높지만 구속이 따라오지 않으면 시퀀싱·누수로 손실되는 중이고, 값이 낮은데 팔꿈치 모멘트가 크면 어깨 폭발력 부족을 팔꿈치가 보상하는 부상 위험 상태입니다. 한국 고교 우수 투수 기준 15-22 W/kg 정상, 22-30 W/kg 우수, 30+ W/kg 엘리트, 15 미만 부족 (Naito 2014 elementary baseline ~12 W/kg, MLB 프로 ~30 W/kg). SD가 크면 코킹 동작 일관성 부족 — 시기마다 다른 출력으로 부상 누적 위험 ↑.'
        }
      ]
    },
    {
      title: '🦶 디딤발 블록',
      icon: '🦶',
      accent: '#a78bfa',
      items: [
        {
          term: '무릎 굴곡 (Front Knee Flexion at FC · °)',
          body: '앞발(디딤발) 착지 시점의 무릎 굴곡각 (0° = 완전 신전, 클수록 굽힘). 앞다리는 키네틱 체인의 "벽(wall)" 역할로, 골반의 전진 운동을 받아 회전 운동으로 전환시키는 지렛대 받침입니다 (Howenstein 2019). 적정 굴곡으로 착지하면 충격 흡수와 회전 동력 전환이 모두 가능. 너무 작으면(< 25°) 뻣뻣한 착지로 충격 미흡수 → 어깨·팔꿈치로 부담 전이 / 너무 크면(> 55°) 회전축 안정성 저하 → 골반 회전 동력 손실. 한국 고교 우수 30-50° 정상, 25-30° 또는 50-60° 주의, 25° 미만 또는 60° 초과 부적정. SD < 5°가 일관성 우수 기준.'
        },
        {
          term: '무릎 무너짐/뻣뻣 (Knee Collapse · ΔKneeFlex FC→BR)',
          body: 'FC ~ BR(Ball Release) 동안의 무릎 굴곡 변화량. 양수(+)면 더 굽혀짐(=무너짐, 주저앉음), 음수(−)면 다시 신전됨(=정상 블록 동작), 0 근처면 굴곡 유지(=뻣뻣). 디딤발이 충격 흡수 후 다시 신전(extension)하면서 골반 회전을 가속하는 "다리 펴기 동작"이 핵심. 무릎이 무너지면 키네틱 체인 기반이 흔들려 회전 동력이 새고, 뻣뻣하면 충격 흡수 부족으로 부상 위험 ↑. Δ > +15°(주저앉음) → 디딤발 근력 부족 또는 stride 너무 길음, 결과: 구속 손실 + 어깨 부담 ↑ / Δ < −15°(강한 신전) → 정상 블록 / −5°~+5°(뻣뻣) → 충격 흡수 부족 + Sleeper-stretch 부담. 한국 고교 우수 −15°~−5° 정상(블록), −5°~+5° 주의(뻣뻣), +5°~+15° 약한 무너짐, +15° 이상 명확한 무너짐(즉시 보강 필요).'
        },
        {
          term: '무릎 SSC 활용 (Stretch-Shortening Cycle)',
          body: 'Stretch-Shortening Cycle. 디딤발 착지 직후 무릎이 잠깐 더 굽혀졌다가(eccentric stretch) 곧바로 다시 펴지는(concentric shortening) 빠른 전환 동작. 인체 결합조직(tendons, fascia)에 잠시 저장된 탄성 에너지를 회전 동력으로 재활용하는 "공짜 에너지" 메커니즘 (Komi 2003). SSC가 잘 활용되면 같은 근력으로 더 큰 출력을 낼 수 있고, 구속 7-12% 향상 효과 (Crotin 2014). Stretch 시간(eccentric phase)이 짧고 깊이가 적정해야 하며 너무 길면(> 200ms) SSC 효과 사라짐. 간접 평가는 CMJ Reactive Strength Index modified로 — RSI-mod > 0.55 m/s 우수, 0.30~0.55 정상, < 0.30 부족. 직접 평가는 디딤발 무릎 굴곡 시계열에서 stretch→shortening 전환 시간 < 150ms 이상적.'
        }
      ]
    },
    {
      title: '골반-몸통 전달 (P→T)',
      icon: '⟶',
      accent: '#60a5fa',
      items: [
        {
          term: 'P→T Energy Transfer (KE_trunk_peak / KE_pelvis_peak)',
          body: '골반이 만든 회전 운동에너지가 몸통(trunk)으로 얼마나 증폭되어 전달되는지의 비율. 인접 분절의 회전 KE 비율로 측정하며, 1.0보다 크면 다음 분절이 더 큰 운동량을 가짐(= 키네틱 체인 amplification 정상). 키네틱 체인의 첫 단계로 하체에서 만든 동력이 상체로 넘어가는 핵심 관문 — P→T 전달이 효율적이지 않으면 하체 출력이 아무리 좋아도 구속에 반영되지 않음(Howenstein 2019). 비율 < 1.5 미약(골반 회전이 몸통으로 전달 안 됨, X-factor 부족 또는 시퀀싱 오류), 1.5-3 약한~정상, 3-5 정상 증폭, 5+ 강한 증폭. P→T가 약하면 다음 단계(T→A)도 자동으로 약해짐. Naito 2011 elementary 야구선수 baseline ~3×, 한국 고교 우수 ≥ 3× 정상.'
        },
        {
          term: '앞발 착지 시 플라잉오픈 (Flying Open at FC · trunkRotAtFP)',
          body: '앞발이 땅에 닿는 시점의 몸통 회전 각도(마운드 정면 기준 0°, 양수는 타자 쪽으로 회전된 상태). 이상적으로 FC 시점에 trunk가 닫혀 있어야(0~5° 이내) 함. 양수가 크면 "플라잉 오픈" — 몸통이 일찍 열린 상태. 플라잉 오픈은 골반-몸통 분리(X-factor)를 손실시키고 회전 동력 전달을 약화시키는 대표적 메카닉 결함입니다. 몸통이 미리 열려 있으면 골반 회전이 와도 추가 토크가 발생하지 않아 P→T 비율이 약해짐(Aguinaldo 2007: trunkRotAtFP > 4°부터 어깨 토크 유의 증가). 0~5° 정상, 5~15° 약한 플라잉오픈(P→T 효율 저하 시작), 15° 이상 명확한 플라잉오픈(X-factor 손실, 어깨 부담↑, 구속·제구 동시 저하). 한국 고교 우수 < 5° 정상, 5-10° 주의, 10-15° 보강 필요, 15° 이상 즉시 점검(mound 정렬 + open shoulder drill).'
        },
        {
          term: 'FC 몸통 자세 (Trunk Forward Tilt at FC · °)',
          body: '앞발 착지 시점의 몸통 전방/후방 기울기. 부호 보존: 양수(+) = 앞으로 굽혀짐, 음수(−) = 뒤로 젖혀짐. 직립(0°) 또는 약간 뒤로 젖힌 상태(음수)가 이상적입니다 — FC 시점에 뒤로 젖혀 있으면 가속거리(forward acceleration distance)를 충분히 확보할 수 있고, 이후 BR 시점까지 35-45° 앞으로 굽히는 큰 swing이 가능해 공에 더 큰 모멘텀을 전달할 수 있습니다(Matsuo 2001, Werner 2008). FC에서 이미 앞으로 무너져 있으면 가속거리가 줄어들어 같은 노력으로도 구속이 낮아지고 어깨 부담 ↑. 한국 고교 우수 ≤ −5°(뒤로 젖힘) 우수, −5°~+5°(직립) 양호, +5°~+15° 약간 앞으로(가속거리 손실 시작), +15° 이상 이미 앞으로 무너짐(즉시 점검).'
        }
      ]
    },
    {
      title: '몸통-팔 전달 (T→A)',
      icon: '⟹',
      accent: '#3b82f6',
      items: [
        {
          term: 'T→A Energy Transfer (KE_arm_peak / KE_trunk_peak)',
          body: '몸통의 회전 운동에너지가 팔로 얼마나 증폭되어 전달되는지의 비율. 분절이 작아질수록(I↓) 같은 에너지에서 더 빠른 ω가 가능하므로 정상적으로는 KE_arm > KE_trunk가 되어야 함. 키네틱 체인의 마지막 핵심 단계 — 몸통의 회전 동력이 팔로 효율적으로 넘어가야 빠른 공이 만들어집니다(Aguinaldo & Escamilla 2019, Naito 2011). T→A 전달이 약하면 몸통 회전 속도가 빨라도 팔 회전 속도가 따라오지 못해 구속이 정체. 비율 < 1.0 에너지 손실(몸통이 팔을 끌어주지 못함, 어깨 가동성 또는 시퀀싱 문제, MER 부족 의심), 1.0-1.7 약한 증폭, 1.7-2.5 정상 증폭, 2.5+ 강한 증폭. 전형적 한국 고교 우수 투수 1.7-2.7×. Naito 2011 baseline ~2.7×, Aguinaldo 2022 induced power 분석에서 전완 파워의 86%가 몸통에서 유래.'
        },
        {
          term: '릴리즈 시 몸통 전방 굴곡 (Trunk Forward Flexion at BR · °)',
          body: 'Ball Release 시점의 몸통 전방 기울기 각도(직립 0°, 앞으로 굽혀질수록 +각도). 한국 고교 우수 투수 35-45°가 일반적. 릴리즈 시 몸통이 적절히 앞으로 기울어져야(forward trunk flexion) 팔이 자연스럽게 회전하면서 공에 마지막 가속을 줄 수 있고, 적정한 전방 굴곡은 팔꿈치 부담을 줄이고 릴리스 포인트를 안정화시킵니다(Fleisig 1999, Matsuo 2001). < 25° 직립 자세(어깨로만 던짐, 어깨 부담↑), 25-35° 약한 굴곡, 35-45° 정상, 45-55° 깊은 굴곡(제구 우수 가능, 시야 확보 주의), > 55° 과도한 굴곡(몸통이 빠지면서 구속 손실). SD < 3° 일관성 우수 — 시기마다 다른 굴곡각이면 릴리스 포인트 흔들림 → 제구 저하. T→A 전달 비율과 함께 분석: 굴곡각 적정 + T→A 정상 = 효율적 마무리.'
        }
      ]
    },
    {
      title: '몸통-팔 힘 배율',
      icon: '×',
      accent: '#a78bfa',
      items: [
        {
          term: 'Trunk-to-Arm Force Amplification (induced power)',
          body: '몸통이 팔에 induce한 파워의 비율(Aguinaldo 2022). 팔의 회전이 만들어내는 총 파워 중 몸통의 회전이 직접 기여한 비율을 분석. T→A 전달(KE 비율)이 운동에너지의 양적 비교라면, 이는 파워 인과 관계의 분석입니다. T→A 전달은 "에너지가 얼마나 증폭됐는가"를, 힘 배율은 "그 증폭의 원인이 어디인가"를 나타냅니다. 힘 배율이 높을수록 → 몸통이 진짜 동력원이고 팔은 잘 끌려가는 효율적 메카닉. 낮으면 → 팔이 자체 출력으로 던지는 비효율적 메카닉(어깨·팔꿈치 부담 ↑). 힘 배율 ≥ 80%(정상): 몸통이 주된 동력원, 팔은 efficient force translation의 도구 — 안전하고 효율적 / 60-80% 정상 범위 / < 60% 팔이 직접 출력 비중 ↑(어깨 토크와 팔꿈치 모멘트 비정상적으로 높을 가능성, 부상 위험 신호). Aguinaldo 2022: 엘리트 투수 평균 86%. 직접 측정은 induced power 분석이 필요해 ±15% 추정 오차 있음. 간접 진단으로 T→A 전달 비율(≥ 1.7×) + 적정 팔꿈치 모멘트(< 100 N·m) + 정상 어깨 폭발력(15-30 W/kg) 조합으로 종합 판단 — 셋이 모두 좋으면 힘 배율도 우수일 가능성 ↑.'
        }
      ]
    }
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
      {groups.map((g, gi) => (
        <div key={gi} style={{
          padding: '14px 16px',
          borderBottom: gi < groups.length - 1 ? '1px solid var(--d-border)' : 'none',
          background: gi % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.012)'
        }}>
          {/* 그룹 헤더 */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12,
            paddingBottom: 10, borderBottom: `2px solid ${g.accent}33`
          }}>
            <span style={{ fontSize: 18, color: g.accent, fontWeight: 800, fontFamily: 'Inter' }}>{g.icon}</span>
            <span style={{ fontSize: 14, fontWeight: 700, color: g.accent, letterSpacing: '0.3px' }}>{g.title}</span>
          </div>
          {/* 그룹 내 항목들 — 본문은 펼쳐진 상태로 한꺼번에 표시 (사용자 요청: 한 박스에 통합) */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {g.items.map((it, ii) => (
              <div key={ii} style={{
                borderLeft: `3px solid ${g.accent}`, paddingLeft: 12,
                paddingTop: 4, paddingBottom: 4
              }}>
                <div style={{
                  fontSize: 12.5, fontWeight: 700, color: 'var(--d-fg1)',
                  marginBottom: 6, letterSpacing: '0.2px'
                }}>
                  {it.term}
                </div>
                <div style={{
                  fontSize: 12, lineHeight: 1.75, color: 'var(--d-fg2)'
                }}>
                  {it.body}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
      {/* 푸터 — 사용된 baseline 출처 */}
      <div style={{
        padding: '10px 16px', fontSize: 10.5, color: 'var(--d-fg3)',
        background: 'rgba(96,165,250,0.04)',
        borderTop: '1px solid var(--d-border)', lineHeight: 1.55
      }}>
        <b style={{ color: '#60a5fa' }}>References ·</b> Naito 2011/2014 (Hum Mov Sci) · Aguinaldo & Escamilla 2019, 2022 · Howenstein 2019 · Matsuo 2001 · Fleisig 1999 · Werner 2008 · Komi 2003 · Crotin 2014. 임계값은 한국 고교 우수 투수 baseline 기준이며 측정 시스템(Uplift / 마커리스)에 따라 ±15% 추정 오차가 있습니다.
      </div>
    </div>
  );
}

// Section 05 — 키네틱 체인 KE/Power/Transfer/Elbow 카드
function KineticChainPanel({ kc }) {
  if (!kc) return null;
  const toneColor = { good: '#10b981', mid: '#60a5fa', low: '#f59e0b', bad: '#ef4444', na: '#94a3b8' };
  const KECard = ({ label, val, sd, total, color }) => (
    <div className="panel" style={{ background: 'transparent', border: '1px solid var(--d-border)', padding: '12px 14px' }}>
      <div className="kicker" style={{ color }}>{label} 회전 KE</div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginTop: 4 }}>
        <span style={{ fontSize: 22, fontWeight: 800, fontFamily: 'Inter', color: 'var(--d-fg1)' }}>
          {val != null ? val.toFixed(1) : '—'}
        </span>
        <span style={{ fontSize: 11, color: 'var(--d-fg3)' }}>J</span>
        {sd != null && sd > 0 && (
          <span style={{ fontSize: 10, color: 'var(--d-fg3)', marginLeft: 4 }}>SD ±{sd.toFixed(1)}</span>
        )}
      </div>
      {val != null && (
        <div style={{ fontSize: 10, color: 'var(--d-fg3)', marginTop: 2 }}>
          추정 ±{(val * 0.12).toFixed(1)}J (±12%)
        </div>
      )}
    </div>
  );
  const TransferCard = ({ label, formula, t }) => (
    <div className="panel" style={{ background: 'transparent', border: `1px solid ${toneColor[t.tone]}40`, padding: '12px 14px' }}>
      <div className="kicker">{label}</div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginTop: 4 }}>
        <span style={{ fontSize: 24, fontWeight: 800, fontFamily: 'Inter', color: 'var(--d-fg1)' }}>
          {t.val != null ? t.val.toFixed(1) : '—'}
        </span>
        <span style={{ fontSize: 11, color: 'var(--d-fg3)' }}>×</span>
      </div>
      <div style={{ fontSize: 10, color: 'var(--d-fg3)', marginTop: 2 }}>{formula}</div>
      <div style={{ fontSize: 11, color: toneColor[t.tone], marginTop: 4, fontWeight: 600 }}>{t.text}</div>
    </div>
  );
  const PowerCard = ({ label, val }) => (
    <div className="panel" style={{ background: 'transparent', border: '1px solid var(--d-border)', padding: '12px 14px' }}>
      <div className="kicker">{label}</div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginTop: 4 }}>
        <span style={{ fontSize: 22, fontWeight: 800, fontFamily: 'Inter', color: 'var(--d-fg1)' }}>
          {val != null ? val.toLocaleString() : '—'}
        </span>
        <span style={{ fontSize: 11, color: 'var(--d-fg3)' }}>W</span>
      </div>
      <div style={{ fontSize: 10, color: 'var(--d-fg3)', marginTop: 2 }}>순간 최대 파워 (dKE/dt max)</div>
    </div>
  );

  const hasKE = kc.KE_pelvis?.val != null || kc.KE_trunk?.val != null || kc.KE_arm?.val != null;
  const hasTransfer = kc.transferPT_KE?.val != null || kc.transferTA_KE?.val != null;
  const hasPower = kc.peakPowerTrunk != null || kc.peakPowerArm != null;
  const hasElbow = kc.elbowPeakTorqueNm?.val != null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {hasKE && (
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--d-fg3)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 8 }}>
            분절 운동에너지 (회전 KE 기준 · ½·I·ω²)
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
            <KECard label="Pelvis" val={kc.KE_pelvis?.val} sd={kc.KE_pelvis?.sd} color="#60a5fa"/>
            <KECard label="Trunk"  val={kc.KE_trunk?.val}  sd={kc.KE_trunk?.sd}  color="#a78bfa"/>
            <KECard label="Arm"    val={kc.KE_arm?.val}    sd={kc.KE_arm?.sd}    color="#f472b6"/>
          </div>
          <div style={{ fontSize: 10, color: 'var(--d-fg3)', fontStyle: 'italic', marginTop: 6 }}>
            Naito 2011 / Aguinaldo & Escamilla 2019 — 키네틱 체인 amplification convention 적용. Ae M, Tang H, Yokoi T (1992) 일본인 운동선수 분절 inertia 표 기반.
          </div>
          <InfoBox items={[{
            term: '분절 운동에너지 (Rotational KE · ½·I·ω²)',
            def: '각 신체 분절(골반·몸통·팔)의 회전 운동에너지를 J(줄) 단위로 측정. 공식 KE = ½·I·ω² (I = 분절의 관성모멘트, ω = 회전 각속도). 회전 KE만 사용하는 이유는 분절별 비교 시 병진 KE의 비대칭성을 제거하기 위함 (몸통은 병진 우세, 팔은 회전 우세).',
            meaning: '투수가 와인드업~릴리스 동안 만들어내는 회전 동력의 절대량. 분절이 클수록(I↑) 또는 빨리 회전할수록(ω↑) 큰 KE가 만들어지고, 이것이 키네틱 체인을 통해 공으로 전달되어 구속을 결정합니다. 공으로 전달되는 최종 에너지의 원천.',
            interpret: 'Pelvis < Trunk < Arm 순으로 KE가 점진 증폭되는 것이 정상입니다. SD가 작으면 일관된 동작(제구에 유리), SD가 크면 시기마다 다른 출력. 절대값이 너무 낮으면 하체 또는 회전 동력 부족, 너무 높은데 구속이 안 따라오면 에너지가 공이 아닌 다른 곳으로 새는 중.',
            judge: 'Pelvis 20-50 J, Trunk 80-150 J, Arm 150-250 J (한국 고교 우수). 절대값보다 분절 간 증폭 패턴(다음 항목 Transfer 비율)이 더 중요합니다. Naito 2011 기준 amplification convention: 다음 분절 KE > 이전 분절 KE.'
          }]}/>
        </div>
      )}
      {hasTransfer && (
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--d-fg3)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 8 }}>
            Transfer 비율 (회전 KE amplification)
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
            <TransferCard label="Pelvis → Trunk" formula="KE_trunk_peak / KE_pelvis_peak · Naito 2011 ~3×" t={kc.transferPT_KE}/>
            <TransferCard label="Trunk → Arm"    formula="KE_arm_peak / KE_trunk_peak · Naito 2011 ~2.7×" t={kc.transferTA_KE}/>
          </div>
          <InfoBox items={[{
            term: 'Transfer 비율 (회전 KE Amplification)',
            def: '인접한 두 분절의 회전 KE 비율. P→T는 KE_trunk_peak / KE_pelvis_peak, T→A는 KE_arm_peak / KE_trunk_peak. 1.0보다 크면 다음 분절이 더 큰 회전 운동량을 가졌다는 뜻 (= 에너지 증폭).',
            meaning: '키네틱 체인의 핵심 지표. 골반에서 만든 동력이 몸통→팔로 얼마나 효율적으로 증폭되는지 정량화합니다. 분절이 작아질수록(I↓) 같은 에너지에서 더 빠른 ω가 가능하므로, 정상적인 키네틱 체인은 단조 증가 비율을 보입니다(Naito 2011, Hirashima 2008).',
            interpret: 'P→T 비율이 약하면 → 골반 회전이 몸통으로 안 넘어감 (timing 문제 또는 골반-몸통 분리 부족). T→A 비율이 약하면 → 몸통이 팔을 끌어주지 못함 (어깨 가동성 또는 시퀀싱 문제). 두 비율 모두 좋으면 키네틱 체인 효율 우수.',
            judge: 'P→T: 3× 이상 정상 증폭, 5× 이상 강한 증폭, 1.5× 미만 미약 / T→A: 1.7× 이상 정상, 2.5× 이상 강한 증폭, 1.0× 미만 에너지 손실. Naito 2011 elementary 야구선수 baseline P→T ~3×, T→A ~2.7×. Aguinaldo 2022 induced power 분석: 전완 파워의 86%는 몸통에서 유래.'
          }]}/>
        </div>
      )}
      {hasPower && (
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--d-fg3)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 8 }}>
            순간 최대 파워 (Peak dE/dt · Wasserberger 2024)
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
            <PowerCard label="Power → Trunk" val={kc.peakPowerTrunk}/>
            <PowerCard label="Power → Arm"   val={kc.peakPowerArm}/>
          </div>
          <InfoBox items={[{
            term: '순간 최대 파워 (Peak dE/dt)',
            def: '분절의 운동에너지가 시간에 대해 변화하는 비율(dKE/dt)의 최댓값. W(와트) = J/s. 시계열로 KE를 계산한 뒤 시간 미분의 peak를 추출. 평균 파워가 아닌 "찰나의 최대 출력". Wasserberger et al. 2024 (Sports Biomech 23:1160-1175)가 도입한 정밀 진단 지표.',
            meaning: '에너지 양(KE)이 아닌 에너지 주입 속도를 봅니다. KE가 같아도 그 에너지를 더 짧은 시간에 폭발적으로 내는 선수가 빠른 공을 던집니다. 누수가 어느 시점에 일어나는지를 진단할 수 있는 정밀 지표.',
            interpret: 'Trunk peak power가 높지만 Arm peak power가 따라오지 못하면 → 몸통에서 만든 폭발이 팔로 정확한 타이밍에 전달되지 않음 (T→A 시퀀싱 문제). 두 값 모두 낮으면 → 절대 출력 부족 (체력 또는 회전 동력 보강 필요).',
            judge: 'Trunk peak power: 800-1500 W = 정상, 1500+ = 우수, 800 미만 = 부족 / Arm peak power: 1500-3000 W = 정상, 3000+ = 우수, 1500 미만 = 부족. 한국 고교 우수 투수 기준 (MLB 프로는 더 높음).'
          }]}/>
        </div>
      )}
      {hasElbow && (
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--d-fg3)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 8 }}>
            팔꿈치 합성 모멘트 (Inverse Dynamics · Yanai 2023)
          </div>
          <div className="panel" style={{ background: 'transparent', border: '1px solid var(--d-border)', padding: '12px 14px' }}>
            <div className="kicker">Peak Resultant Elbow Moment</div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginTop: 4 }}>
              <span style={{ fontSize: 22, fontWeight: 800, fontFamily: 'Inter', color: 'var(--d-fg1)' }}>
                {kc.elbowPeakTorqueNm.val.toFixed(0)}
              </span>
              <span style={{ fontSize: 11, color: 'var(--d-fg3)' }}>N·m</span>
              {kc.elbowPeakTorqueNm.sd != null && (
                <span style={{ fontSize: 10, color: 'var(--d-fg3)', marginLeft: 4 }}>SD ±{kc.elbowPeakTorqueNm.sd.toFixed(1)}</span>
              )}
            </div>
            <div style={{ fontSize: 10, color: 'var(--d-fg3)', fontStyle: 'italic', marginTop: 4 }}>
              팔뚝+손+공 강체 모델 (Feltner 1989) · 추정 ±35%
            </div>
          </div>
          <InfoBox items={[{
            term: '팔꿈치 합성 모멘트 (Resultant Elbow Moment · Inverse Dynamics)',
            def: '팔꿈치 관절에 가해지는 합성 회전 모멘트의 최대값 (N·m). 역동역학(Inverse Dynamics) 방법으로 산출 — 분절(팔뚝+손+공)의 운동방정식을 거꾸로 풀어 관절에 가해진 외력을 추정합니다. 분절 inertia는 Ae M, Tang H, Yokoi T (1992)의 일본인 운동선수 표를 사용 (Yanai et al. 2023, Sci Rep 13:12253과 동일).',
            meaning: '투구 동작에서 팔꿈치 인대(특히 UCL · 척측 측부 인대)가 견뎌야 하는 부하를 정량화하는 핵심 부상 위험 지표. MER 시점부터 BR(공 놓는 순간)까지의 짧은 시간에 팔꿈치는 매우 큰 외반(valgus) 모멘트를 받으며, 이것이 누적되면 UCL 손상(흔히 "토미존 수술" 대상)으로 이어질 수 있습니다.',
            interpret: '값이 클수록 팔꿈치 부하 ↑. 단순히 낮으면 안전한 것이 아니라 — 회전 동력이 부족해서 낮을 수도 있음. 따라서 "회전 파워(Trunk Vel) + 효율(Transfer 비율)"이 함께 좋은데도 elbow moment가 낮은 선수가 진정한 "효율적이고 안전한" 투구 동작입니다. 반대로 회전 파워는 평범한데 elbow moment가 높으면 → 키네틱 체인이 비효율적이라 어깨·팔꿈치로 부담이 집중된 상태.',
            judge: '한국 고교 우수 투수 기준 50-100 N·m 정상 범위. 100-130 N·m 주의 (장기적으로 누적 시 위험), 130+ N·m 위험 (즉각 동작 점검 권장). MLB 프로 평균 ~120 N·m이지만 마커리스 측정의 추정 오차가 ±35% 정도이므로 절대값보다는 SD(시기 간 변동), 동작 점검 후 변화 추적이 더 의미 있습니다. Fleisig 1995 / Aguinaldo 2007 인구 데이터에서 100 N·m 이상부터 급격한 부상 위험 증가가 확인됨.'
          }]}/>
        </div>
      )}
    </div>
  );
}

// Section 06 — 5축 구속 종합 RadarChart + 영역별 카드
function VelocityRadarPanel({ data }) {
  if (!data || data.length === 0) return null;
  const statusOf = (score) => {
    if (score == null) return { color: '#94a3b8', text: '데이터 없음', tone: 'na' };
    if (score >= 80)   return { color: '#10b981', text: '엘리트 상위', tone: 'good' };
    if (score >= 65)   return { color: '#84cc16', text: '엘리트 평균↑', tone: 'mid' };
    if (score >= 50)   return { color: '#84cc16', text: '엘리트 평균', tone: 'mid' };
    if (score >= 35)   return { color: '#f59e0b', text: '평균 미만', tone: 'low' };
    return { color: '#ef4444', text: '낮음', tone: 'bad' };
  };
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1.3fr 1fr', gap: 16, alignItems: 'start' }}>
      <div className="panel" style={{ background: 'transparent', border: '1px solid var(--d-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 12 }}>
        <RadarChart data={data}/>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {data.map(ax => {
          const s = statusOf(ax.value);
          return (
            <div key={ax.label} className="panel" style={{
              background: 'transparent',
              border: `1px solid ${ax.isOurOwn ? 'rgba(20,184,166,0.4)' : 'var(--d-border)'}`,
              padding: '10px 12px'
            }}>
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--d-fg1)' }}>{ax.label}</span>
                    {ax.isOurOwn && (
                      <span style={{
                        fontSize: 9, fontWeight: 700, color: '#5eead4',
                        background: 'rgba(20,184,166,0.15)', padding: '1px 6px', borderRadius: 3
                      }}>우리 시스템</span>
                    )}
                  </div>
                  <div style={{ fontSize: 10.5, color: 'var(--d-fg3)' }}>{ax.sub}</div>
                  {ax.dlMapping && (
                    <div style={{ fontSize: 10, marginTop: 2, color: ax.isOurOwn ? '#5eead4' : 'var(--d-fg3)', fontStyle: 'italic' }}>
                      {ax.dlMapping}
                    </div>
                  )}
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 18, fontWeight: 800, fontFamily: 'Inter', color: 'var(--d-fg1)' }}>
                    {ax.display}
                  </div>
                  <div style={{ fontSize: 10, fontWeight: 700, color: s.color }}>{s.text}</div>
                </div>
              </div>
            </div>
          );
        })}
        <div style={{
          padding: 10, fontSize: 10.5, color: 'var(--d-fg2)', lineHeight: 1.5,
          background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: 6
        }}>
          <b style={{ color: '#fbbf24' }}>점수 산정</b>: 각 축은 핵심 변인을 엘리트 중간값 기준으로 정규화한 후 평균낸 0-100점.
          50점=엘리트 평균, 80점=엘리트 상위. 다각형이 클수록 균형 잡힌 메커닉.
        </div>
      </div>
    </div>
  );
}

// Section D — 제구 일관성과 안정성 (5 영역별 카드 그룹)
function ConsistencyPanel({ cs }) {
  if (!cs) return null;
  const toneColor = { good: '#10b981', mid: '#60a5fa', low: '#f59e0b', bad: '#ef4444', na: '#94a3b8' };
  const gradeColor = { A: '#10b981', B: '#84cc16', C: '#f59e0b', D: '#ef4444' };
  const Group = ({ icon, title, color, grade, desc, cards }) => {
    if (!cards || cards.length === 0) return null;
    return (
      <div style={{ marginBottom: 14 }}>
        <div style={{
          display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 8,
          paddingLeft: 8, borderLeft: `3px solid ${color}`
        }}>
          <span style={{ fontSize: 14 }}>{icon}</span>
          <span style={{ fontSize: 12, fontWeight: 700, color }}>{title}</span>
          <span style={{ fontSize: 10, color: 'var(--d-fg3)' }}>— {desc}</span>
          {grade && grade !== 'N/A' && (
            <span style={{
              marginLeft: 'auto', fontSize: 11, fontWeight: 800,
              color: gradeColor[grade] || '#94a3b8',
              background: `${gradeColor[grade] || '#94a3b8'}1a`,
              padding: '1px 8px', borderRadius: 4
            }}>{grade}</span>
          )}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(cards.length, 3)}, 1fr)`, gap: 8, paddingLeft: 11 }}>
          {cards.map((c, i) => (
            <div key={i} className="panel" style={{
              background: 'transparent',
              border: `1px solid ${c.tone && c.tone !== 'na' ? toneColor[c.tone] + '60' : 'var(--d-border)'}`,
              padding: '10px 12px'
            }}>
              <div style={{ fontSize: 10.5, color: 'var(--d-fg3)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{c.label}</div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginTop: 4 }}>
                <span style={{ fontSize: 18, fontWeight: 800, fontFamily: 'Inter', color: 'var(--d-fg1)' }}>
                  {typeof c.value === 'number' ? c.value.toFixed(c.value < 10 ? 2 : 0) : c.value}
                </span>
                <span style={{ fontSize: 10.5, color: 'var(--d-fg3)' }}>{c.unit}</span>
                <span style={{ fontSize: 10, marginLeft: 'auto', color: toneColor[c.tone] || 'var(--d-fg3)', fontWeight: 600 }}>
                  {c.text}
                </span>
              </div>
              {c.description && <div style={{ fontSize: 10.5, color: 'var(--d-fg3)', marginTop: 4 }}>{c.description}</div>}
            </div>
          ))}
        </div>
      </div>
    );
  };
  return (
    <div>
      <Group icon="🦶" title="Foot Contact" color="#f472b6" grade={cs.footContact.grade}
        desc="FC 시점 자세 일관성 — 키네틱 체인 시작점" cards={cs.footContact.cards}/>
      <Group icon="🌀" title="Sequencing" color="#f472b6" grade={cs.sequencing.grade}
        desc="분절 가속 타이밍 일관성 (lag CV)" cards={cs.sequencing.cards}/>
      <Group icon="💨" title="Power Output" color="#f472b6" grade={cs.powerOutput.grade}
        desc="출력 강도 일관성 (CV)" cards={cs.powerOutput.cards}/>
      <Group icon="🎯" title="Release Position" color="#f472b6" grade={cs.releasePos.grade}
        desc="릴리스 시 자세 일관성 (SD)" cards={cs.releasePos.cards}/>
      <Group icon="⏱️" title="Release Timing" color="#f472b6" grade={cs.releaseTiming.grade}
        desc="공을 놓는 시점 일관성 (CV)" cards={cs.releaseTiming.cards}/>
    </div>
  );
}

// Section E — 종합 평가 (구속·제구·체력 점수 + Mechanical Ceiling + 우선순위)
function SummaryScoresPanel({ ss }) {
  if (!ss) return null;
  const gradeColor = (g) => {
    if (!g || g === '—') return '#94a3b8';
    if (g.startsWith('A')) return '#10b981';
    if (g.startsWith('B')) return '#84cc16';
    if (g.startsWith('C')) return '#f59e0b';
    if (g.startsWith('D') || g === 'F') return '#ef4444';
    return '#94a3b8';
  };
  const ScoreCard = ({ kind, label, score, grade, accent }) => (
    <div className="panel" style={{
      background: 'transparent', border: `1px solid ${accent}60`, padding: '14px 16px'
    }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: accent, textTransform: 'uppercase', letterSpacing: '1px' }}>
        {label}
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 6 }}>
        <span style={{ fontSize: 28, fontWeight: 800, fontFamily: 'Inter', color: gradeColor(grade) }}>
          {grade || '—'}
        </span>
        <span style={{ fontSize: 22, fontWeight: 700, fontFamily: 'Inter', color: 'var(--d-fg1)' }}>
          {score != null ? score : '—'}
        </span>
        <span style={{ fontSize: 11, color: 'var(--d-fg3)' }}>/ 100</span>
      </div>
    </div>
  );
  const PriorityFix = ({ rank, kind, title, detail, action }) => {
    const kindLabel = { velocity: '구속', command: '제구', fitness: '체력', injury: '부상', mixed: '종합' }[kind] || '';
    const kindColor = { velocity: '#f59e0b', command: '#a78bfa', fitness: '#10b981', injury: '#ef4444' }[kind] || '#94a3b8';
    const rankColor = ['#ef4444', '#f59e0b', '#84cc16', '#60a5fa', '#94a3b8'][rank - 1] || '#94a3b8';
    return (
      <div className="panel" style={{
        background: 'transparent', border: '1px solid var(--d-border)',
        padding: '12px 14px', marginBottom: 8,
        borderLeft: `3px solid ${rankColor}`
      }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 4 }}>
          <span style={{
            fontSize: 10, fontWeight: 800, color: rankColor,
            background: `${rankColor}1a`, padding: '2px 8px', borderRadius: 4
          }}>우선순위 {rank}</span>
          {kindLabel && (
            <span style={{ fontSize: 10, fontWeight: 700, color: kindColor }}>· {kindLabel}</span>
          )}
          <span style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--d-fg1)', flex: 1 }}>{title}</span>
        </div>
        {detail && <div style={{ fontSize: 11.5, color: 'var(--d-fg2)', marginTop: 2 }}>{detail}</div>}
        {action && (
          <div style={{ fontSize: 11, color: 'var(--d-fg2)', marginTop: 6,
            padding: '6px 10px', background: 'rgba(96,165,250,0.06)', borderRadius: 4 }}>
            <b style={{ color: '#60a5fa' }}>훈련 제안:</b> {action}
          </div>
        )}
      </div>
    );
  };
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Mechanical Ceiling */}
      {ss.ceiling && (
        <div className="panel" style={{
          background: 'linear-gradient(90deg, rgba(245,158,11,0.08), rgba(20,184,166,0.08))',
          border: '1px solid rgba(20,184,166,0.3)', padding: '14px 18px'
        }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#5eead4', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 8 }}>
            🎯 Mechanical Ceiling — 역학적 잠재 구속
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, flexWrap: 'wrap' }}>
            <div>
              <span style={{ fontSize: 11, color: 'var(--d-fg3)' }}>현재 평균</span>
              <span style={{ fontSize: 16, fontWeight: 700, marginLeft: 6, fontFamily: 'Inter', color: 'var(--d-fg1)' }}>
                {ss.ceiling.currentMph} <span style={{ fontSize: 11, color: 'var(--d-fg3)' }}>mph</span>
                <span style={{ fontSize: 10, color: 'var(--d-fg3)', marginLeft: 4 }}>({ss.ceiling.currentKmh} km/h)</span>
              </span>
            </div>
            <span style={{ color: 'var(--d-fg3)', fontSize: 14 }}>→</span>
            <div>
              <span style={{ fontSize: 11, color: '#5eead4' }}>잠재 구속 (메커닉 100점)</span>
              <span style={{ fontSize: 20, fontWeight: 800, marginLeft: 6, fontFamily: 'Inter', color: '#5eead4' }}>
                {ss.ceiling.ceilingMph} <span style={{ fontSize: 11, color: 'var(--d-fg3)' }}>mph</span>
                <span style={{ fontSize: 10, color: 'var(--d-fg3)', marginLeft: 4 }}>({ss.ceiling.ceilingKmh} km/h)</span>
              </span>
              {ss.ceiling.potentialMphGain >= 1 && (
                <span style={{ fontSize: 11, marginLeft: 8, color: '#fbbf24', fontWeight: 700 }}>
                  +{ss.ceiling.potentialMphGain} mph
                </span>
              )}
            </div>
          </div>
          <div style={{ fontSize: 10.5, marginTop: 8, color: 'var(--d-fg3)', lineHeight: 1.5 }}>
            현재 메커닉 점수가 <b style={{ color: '#fbbf24' }}>{ss.ceiling.velocityScore}/100</b>이며,
            메커닉을 100점까지 향상시키면 <b style={{ color: '#5eead4' }}>{ss.ceiling.ceilingKmh} km/h</b>까지 잠재 구속을 끌어올릴 수 있습니다 (보수적 추정: 메커닉 6점당 1mph).
          </div>
        </div>
      )}

      {/* 4개 점수 카드 — 구속/제구/체력/종합 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
        <ScoreCard label="① 구속 (메카닉)" score={ss.velocity.score} grade={ss.velocity.grade} accent="#f59e0b"/>
        <ScoreCard label="② 제구 (일관성)" score={ss.command.score}  grade={ss.command.grade}  accent="#a78bfa"/>
        <ScoreCard label="③ 체력"           score={ss.fitness.score}  grade={ss.fitness.grade}  accent="#10b981"/>
        <ScoreCard label="🏆 종합 평가"      score={ss.overall.score}  grade={ss.overall.grade}  accent="#5eead4"/>
      </div>

      {/* 점수 산출 근거 (사용자 요청 — 어떻게 점수가 나왔는지 투명하게 표시) */}
      <ScoreSourcesPanel ss={ss}/>

      {/* 우선순위 개선점 */}
      {ss.priorities && ss.priorities.length > 0 && (
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--d-fg3)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 10 }}>
            🎯 우선순위 개선점 ({ss.priorities.length}개)
          </div>
          {ss.priorities.map((p, i) => (
            <PriorityFix key={i} rank={i + 1} kind={p.kind} title={p.title} detail={p.detail} action={p.action}/>
          ))}
        </div>
      )}
    </div>
  );
}

/* ---------------- 점수 산출 근거 패널 ---------------- */
function ScoreSourcesPanel({ ss }) {
  const [open, setOpen] = useState(false);
  const groups = [
    { key: 'velocity', label: '① 구속 (메카닉)', accent: '#f59e0b', score: ss.velocity.score, grade: ss.velocity.grade, sources: ss.velocity.sources, weight: '40%', desc: '평균 구속·몸통 각속도·MER·CoG 등 8개 변인을 한국 고1 우수 baseline으로 정규화한 가중평균' },
    { key: 'command',  label: '② 제구 (일관성)', accent: '#a78bfa', score: ss.command.score,  grade: ss.command.grade,  sources: ss.command.sources,  weight: '30%', desc: '5개 변인의 시기 간 변동(CV/SD)을 0-100 점수로 변환한 가중평균. 작을수록 좋음' },
    { key: 'fitness',  label: '③ 체력',          accent: '#10b981', score: ss.fitness.score,  grade: ss.fitness.grade,  sources: ss.fitness.sources,  weight: '30%', desc: 'BBL 메타 CSV 기반 6개 항목의 band(상위/범위/미만)를 점수화 (high=95 / mid=70 / low=40)' }
  ];
  if (!groups.some(g => g.sources && g.sources.length > 0)) return null;
  return (
    <div style={{ border: '1px solid var(--d-border)', borderRadius: 8, overflow: 'hidden' }}>
      <button onClick={() => setOpen(!open)} style={{
        width: '100%', textAlign: 'left', padding: '10px 14px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        background: 'rgba(96,165,250,0.06)', color: '#60a5fa',
        fontSize: 12, fontWeight: 700, cursor: 'pointer', border: 'none', fontFamily: 'inherit'
      }}>
        <span>📊 점수 산출 근거 (투명한 계산식)</span>
        <span style={{ color: 'var(--d-fg3)' }}>{open ? '▲ 접기' : '▼ 펼치기'}</span>
      </button>
      {open && (
        <div style={{ padding: 14, background: 'var(--d-bg2)', display: 'flex', flexDirection: 'column', gap: 16 }}>
          {groups.map(g => g.sources && g.sources.length > 0 && (
            <div key={g.key} style={{ borderLeft: `3px solid ${g.accent}`, paddingLeft: 12 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: g.accent, marginBottom: 4 }}>
                {g.label}: <span style={{ color: 'var(--d-fg1)' }}>{g.score}/100 ({g.grade})</span>
                <span style={{ fontSize: 10, color: 'var(--d-fg3)', marginLeft: 8, fontWeight: 500 }}>· 종합 가중치 {g.weight}</span>
              </div>
              <div style={{ fontSize: 10.5, color: 'var(--d-fg3)', marginBottom: 8, lineHeight: 1.5 }}>{g.desc}</div>
              <table style={{ width: '100%', fontSize: 11, borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--d-border)', color: 'var(--d-fg3)', fontSize: 10 }}>
                    <th style={{ textAlign: 'left', padding: '4px 6px', fontWeight: 600 }}>변인</th>
                    <th style={{ textAlign: 'right', padding: '4px 6px', fontWeight: 600 }}>측정값</th>
                    <th style={{ textAlign: 'right', padding: '4px 6px', fontWeight: 600 }}>점수</th>
                    <th style={{ textAlign: 'right', padding: '4px 6px', fontWeight: 600 }}>가중치</th>
                    <th style={{ textAlign: 'right', padding: '4px 6px', fontWeight: 600 }}>기여</th>
                  </tr>
                </thead>
                <tbody>
                  {g.sources.map((s, i) => {
                    const contribution = (s.score * s.weight).toFixed(1);
                    const scoreColor = s.score >= 80 ? '#10b981' : s.score >= 65 ? '#84cc16' : s.score >= 50 ? '#f59e0b' : '#ef4444';
                    return (
                      <tr key={i} style={{ borderBottom: '1px dashed var(--d-border)' }}>
                        <td style={{ padding: '5px 6px', color: 'var(--d-fg2)' }}>
                          {s.name}
                          {s.bandLabel && <span style={{ fontSize: 9, color: 'var(--d-fg3)', marginLeft: 4 }}>({s.bandLabel})</span>}
                        </td>
                        <td style={{ padding: '5px 6px', textAlign: 'right', color: 'var(--d-fg2)', fontFamily: 'Inter' }}>
                          {s.value}{s.unit ? ` ${s.unit}` : ''}
                        </td>
                        <td style={{ padding: '5px 6px', textAlign: 'right', fontFamily: 'Inter', fontWeight: 700, color: scoreColor }}>
                          {s.score}
                        </td>
                        <td style={{ padding: '5px 6px', textAlign: 'right', color: 'var(--d-fg3)', fontFamily: 'Inter' }}>
                          {(s.weight * 100).toFixed(0)}%
                        </td>
                        <td style={{ padding: '5px 6px', textAlign: 'right', color: 'var(--d-fg2)', fontFamily: 'Inter' }}>
                          {contribution}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ))}
          <div style={{ fontSize: 10.5, color: 'var(--d-fg3)', lineHeight: 1.6, padding: 10, background: 'rgba(0,0,0,0.2)', borderRadius: 4 }}>
            <b style={{ color: '#fbbf24' }}>종합 평가 계산:</b> 구속 점수 × 0.40 + 제구 점수 × 0.30 + 체력 점수 × 0.30. 일부 변인이 측정 불가능한 경우 해당 변인을 제외하고 가중치를 재정규화합니다.
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------------- COMMAND PROFILE PANEL ---------------- */
function CommandProfilePanel({ cmd, energy, layback, factors }) {
  if (!cmd) return null;
  const { measured, note, isDemo, nTrials } = cmd;

  // 등급 색상 매핑 (7대 요인 카드 표시용)
  const gradeColors = {
    A: { c: '#4ade80', label: '상위', bg: 'rgba(74,222,128,0.10)' },
    B: { c: '#60a5fa', label: '중상', bg: 'rgba(96,165,250,0.10)' },
    C: { c: '#fbbf24', label: '중위', bg: 'rgba(251,191,36,0.10)' },
    D: { c: '#f87171', label: '하위', bg: 'rgba(248,113,113,0.10)' },
    na: { c: '#94a3b8', label: '측정불가', bg: 'rgba(148,163,184,0.10)' },
  };

  // ─── 제구력 7대 요인 학술 설명 (사용자 요청) ───
  const FACTOR_INFO = {
    F1_landing: {
      def: '앞발(디딤발) 착지의 안정성 평가. 핵심 변수: 스트라이드 길이(stride length)·시행간 변동(CV) + FC 시점 무릎 굴곡(front knee flex)·SD. 키네틱 체인의 시작점이라 가장 먼저 평가됨.',
      meaning: '앞다리는 골반 회전을 받아내는 "벽(wall)" 역할 — 매번 같은 위치, 같은 자세로 착지해야 그 다음 동작들도 일관되게 일어납니다. 첫 단추가 흔들리면 모든 후속 동작도 흔들립니다 (Howenstein 2019).',
      interpret: 'stride CV > 5% → 매번 다른 위치 착지 → 릴리스 포인트 흔들림 / knee flex SD > 5° → 충격 흡수 일관성 부족 → 어깨 부담 ↑.',
      judge: '엘리트: stride CV 2-3% · knee 30-50° · SD 3-5°. 한국 고교 우수 stride CV ≤ 4%, knee SD ≤ 5°.'
    },
    F2_separation: {
      def: '골반-몸통 분리(X-factor)와 그 분리 타이밍(P→T lag) 평가. 핵심 변수: 최대 X-factor(°)·SD + P→T lag(ms)·SD.',
      meaning: '하체가 먼저 회전하고 상체가 나중에 따라가는 시간차가 만들어내는 elastic potential energy가 회전 동력의 핵심. 분리각이 크고 일정해야 같은 폭발력이 매번 만들어집니다 (Stodden 2005).',
      interpret: 'X-factor < 30°: 분리 부족 → 회전 동력 약함 / SD > 8°: 매번 다른 분리각 → 시기 간 출력 변동 / lag SD > 10ms: 시퀀싱 일관성 부족.',
      judge: '엘리트: X-factor 40-60° · lag ~50ms · SD < 10ms. 한국 고교 우수 X-factor 35-55°.'
    },
    F3_arm_timing: {
      def: '어깨-팔 타이밍(T→A lag)과 최대 외회전(MER) 일관성 평가. 핵심 변수: T→A lag(ms)·SD + MER(°)·SD.',
      meaning: '몸통 회전이 정점에 도달한 직후 팔이 가속되어야 효율적 — 너무 빠르면(early arm) 어깨 부담↑, 너무 늦으면 동력 손실. MER이 일관되어야 매번 같은 릴리스 패턴이 만들어집니다 (Aguinaldo 2007).',
      interpret: 'T→A lag SD > 8ms: 시기마다 다른 타이밍 → 제구·구속 모두 불안정 / MER SD > 5°: 외회전 가동성 일관성 부족.',
      judge: '엘리트: lag 20-40ms · SD < 5ms · MER 170-185° · SD < 3°. 한국 고교 우수 lag 25-45ms.'
    },
    F4_knee_stability: {
      def: '앞다리 무릎 안정성 평가. 핵심 변수: FC→BR 무릎 굴곡 변화량(Δ)·SD + BR 시점 무릎 신전 정도(lead knee ext at BR).',
      meaning: '디딤발 무릎이 무너지면 회전축 안정성 손실 → 골반 회전 동력이 새고, 어깨로 부담이 전이됩니다. 반대로 강한 신전(extension)은 추가 가속 모멘텀을 제공 (Driveline Block model).',
      interpret: 'Δ > +15° (무너짐): 디딤발 근력 부족 / Δ < -15° (강한 신전): 정상 블록 / SD > 5°: 안정성 일관성 부족.',
      judge: '엘리트: ΔKnee -15°~-5° (블록), 신전각 < 10° at BR. SD < 4°.'
    },
    F5_trunk_tilt: {
      def: '몸통 기울기(전방·측면) 평가. 핵심 변수: 릴리스 시 몸통 전방 기울기(°)·SD + 측면 기울기(lateral tilt at BR)·SD.',
      meaning: '몸통이 적절히 앞으로 기울어져야 팔이 자연스럽게 회전하면서 공에 마지막 가속을 줍니다. 측면 기울기가 너무 크면 어깨 부담 ↑ (Aguinaldo 2022). 일관성이 핵심 — 매번 같은 자세로 던져야 같은 곳으로 갑니다.',
      interpret: 'Forward < 25°: 직립 (어깨로 던짐) / 25-45° 정상 / > 50° 과도 / Lateral > 35°: 측면 기울기 과도 (어깨 부담↑).',
      judge: '엘리트: forward 35-45° · lateral 15-30° · SD < 3°. 한국 고교 우수 forward SD ≤ 4°.'
    },
    F6_head_eyes: {
      def: '머리·시선 안정성 평가. 핵심 변수: 머리 위치 SD (수직·수평) + 시선 방향 일관성. 일부 시스템은 마커리스 측정 한계로 N/A 가능.',
      meaning: '눈은 타겟을 추적하는 핵심 — 머리와 시선이 흔들리면 vestibulo-ocular 시스템이 보정 작업을 하느라 미세 동작 제어가 흔들리고 제구가 떨어집니다. 정확한 투수일수록 머리가 거의 움직이지 않습니다 (Crotin 2014).',
      interpret: '머리 위치 SD > 3cm: 자세 안정성 부족 / 시선 일관성 미흡: 타겟 추적 약화 → 제구 핀포인트 능력 저하.',
      judge: '엘리트: 머리 SD < 2cm. 한국 고교 우수 SD ≤ 3cm. 마커리스 측정에서는 머리 추적 정확도가 제한적이라 N/A 가능 — 영상 검토 권장.'
    },
    F7_grip_release: {
      def: '그립·릴리스 정렬 평가. 핵심 변수: 손목 높이 SD (cm) + Arm slot 각도 SD (°) + 그립 패턴 일관성.',
      meaning: '같은 곳으로 공을 던지려면 매번 같은 손 위치, 같은 손가락 각도로 공을 놓아야 합니다. 손목 높이와 arm slot의 일관성이 직접 도착 위치 분산을 결정합니다 (Wakai 2002).',
      interpret: '손목 높이 SD > 3cm 또는 Arm slot SD > 3°: 매번 다른 릴리스 → 도착 위치 분산 ↑ (직접 제구 저하). 그립 변화가 보이면 구질 일관성 문제.',
      judge: '엘리트: 손목 높이 SD < 1.5cm · Arm slot SD < 2°. 한국 고교 우수 ≤ 2배 이내.'
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* MEASURED 또는 DEMO 배지 */}
      {!isDemo ? (
        <div style={{
          padding: '12px 16px',
          background: 'linear-gradient(135deg, rgba(74,222,128,0.10), rgba(74,222,128,0.03))',
          border: '1px solid rgba(74,222,128,0.4)',
          borderRadius: 8,
          fontSize: 12, color: 'var(--d-fg2)', lineHeight: 1.6,
        }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#4ade80', letterSpacing: '1.2px', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#4ade80" strokeWidth="2.5"><path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" strokeLinecap="round" strokeLinejoin="round"/></svg>
            MEASURED · 10구 실측 데이터 기반
          </div>
          Uplift Labs 마커리스 모션캡처 <b>{nTrials || 10}구</b>의 시행간 표준편차(SD)와 변동계수(CV)를
          기반으로 산출한 메카닉 일관성 점수입니다.
          제구력은 메카닉 일관성과 강한 상관(Whiteside 2016, r ≈ 0.4–0.6)이 있어 추정 지표로 활용됩니다.
          <br/><span style={{ color: 'var(--d-fg3)', fontSize: 10.5 }}>※ Rapsodo 측정 시 plate location SD로 직접 검증·교체 예정</span>
        </div>
      ) : (
        <div style={{
          padding: '12px 16px',
          background: 'linear-gradient(135deg, rgba(251,191,36,0.10), rgba(251,191,36,0.03))',
          border: '1px solid rgba(251,191,36,0.4)',
          borderRadius: 8,
          fontSize: 12, color: 'var(--d-fg2)', lineHeight: 1.6,
        }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#fbbf24', letterSpacing: '1.2px', marginBottom: 6 }}>
            ⚠️ DEMO · 임시 추정치
          </div>
          이 섹션의 수치는 메카닉 평균값 기반 추정 placeholder입니다.
        </div>
      )}

      <div className="dash-grid" style={{ gridTemplateColumns: '1fr', gap: 16 }}>
        {/* 핵심 일관성 분석 (제구력 등급 박스 + 도착 위치 분산 시각화 삭제 — 사용자 요청) */}
        <div className="panel">
          <div className="panel-head">
            <div>
              <div className="kicker">10-Pitch Consistency Snapshot</div>
              <h3>핵심 일관성 분석</h3>
              <div className="sub">· 10구 실측 변동성 — Section D 제구 일관성과 안정성 섹션을 함께 참조하세요</div>
            </div>
          </div>

          {/* 추론 근거 — 5 Domain 종합 요약 */}
          <div style={{
            marginTop: 8, padding: '10px 12px',
            background: 'rgba(8,8,12,0.3)', border: '1px solid var(--d-border)', borderRadius: 6,
            fontSize: 11.5, color: 'var(--d-fg2)', lineHeight: 1.6,
          }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: '#60a5fa', letterSpacing: '1px', marginBottom: 4 }}>
              5 Domain 종합
            </div>
            {note}
          </div>

          {/* 실측 변수 표시 */}
          {measured && (
            <div style={{ marginTop: 12, padding: '10px 12px', background: 'rgba(8,8,12,0.3)', border: '1px solid var(--d-border)', borderRadius: 6 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: '#60a5fa', letterSpacing: '1px', marginBottom: 8 }}>
                10구 실측 변동성 (작을수록 일관 ↑)
              </div>
              {[
                { k: '릴리스 손목 높이 SD', v: measured.wristHeightSdCm, unit: 'cm', good: 2.0, bad: 4.0 },
                { k: '암 슬롯 각도 SD', v: measured.armSlotSdDeg, unit: '°', good: 2.0, bad: 4.0 },
                { k: '몸통 전방 기울기 SD', v: measured.trunkTiltSdDeg, unit: '°', good: 1.5, bad: 3.0 },
                { k: 'Layback 변동계수', v: measured.laybackCvPct, unit: '%', good: 3.0, bad: 10.0 },
                { k: '스트라이드 변동계수', v: measured.strideCvPct, unit: '%', good: 1.5, bad: 3.0 },
                { k: 'FC→Release 변동계수', v: measured.fcReleaseCvPct, unit: '%', good: 3.0, bad: 10.0 },
              ].map((row, i) => {
                const v = row.v;
                if (v == null) return (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0', borderBottom: '1px dashed rgba(148,163,184,0.12)', fontSize: 11 }}>
                    <span style={{ color: 'var(--d-fg3)' }}>· {row.k}</span>
                    <span style={{ color: 'var(--d-fg3)', fontFamily: 'Inter', fontStyle: 'italic' }}>측정 안됨</span>
                  </div>
                );
                const color = v <= row.good ? '#4ade80' : v >= row.bad ? '#f87171' : '#fbbf24';
                return (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0', borderBottom: '1px dashed rgba(148,163,184,0.12)', fontSize: 11 }}>
                    <span style={{ color: 'var(--d-fg2)' }}>· {row.k}</span>
                    <span style={{ color, fontFamily: 'Inter', fontWeight: 600 }}>{v.toFixed(2)}{row.unit}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* 7대 요인 */}
      {factors && factors.length > 0 && (
        <div style={{ marginTop: 4 }}>
          <div style={{
            display: 'flex', alignItems: 'baseline', justifyContent: 'space-between',
            padding: '12px 0 10px', borderBottom: '1px solid var(--d-border)', marginBottom: 14,
            flexWrap: 'wrap', gap: 8,
          }}>
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, color: '#93c5fd', letterSpacing: '1.2px', marginBottom: 4 }}>
                7 BIOMECHANICAL PILLARS · 제구력 7대 요인
              </div>
              <div style={{ fontSize: 12, color: 'var(--d-fg2)' }}>
                각 요인의 측정값 · 시행간 일관성 · MLB 엘리트 기준 비교
              </div>
            </div>
            <div style={{ fontSize: 9.5, color: 'var(--d-fg3)', textAlign: 'right', lineHeight: 1.5 }}>
              <div>등급 기준 (시행간 SD/CV)</div>
              <div>A: 엘리트 수준 · B: 엘리트의 2배 이내</div>
              <div>C: 2-3배 · D: 3배 이상</div>
            </div>
          </div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
            gap: 12,
          }}>
            {factors.map((f, i) => {
              const fg = gradeColors[f.grade] || gradeColors['na'];
              return (
                <div key={f.id} style={{
                  padding: '14px 16px',
                  background: fg.bg,
                  border: `1px solid ${fg.c}55`,
                  borderRadius: 10,
                  display: 'flex', flexDirection: 'column', gap: 8,
                }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--d-fg)', marginBottom: 2 }}>
                        {f.name}
                      </div>
                      {f.elite && (
                        <div style={{ fontSize: 9.5, color: 'var(--d-fg3)', letterSpacing: '0.3px' }}>
                          엘리트 기준: <span style={{ color: 'var(--d-fg2)' }}>{f.elite}</span>
                        </div>
                      )}
                    </div>
                    <div style={{
                      flexShrink: 0,
                      width: 40, height: 40, borderRadius: 10,
                      background: fg.c,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 20, fontWeight: 800, color: '#fff', fontFamily: 'Inter',
                    }}>
                      {f.grade}
                    </div>
                  </div>

                  {/* 측정값 표 */}
                  {f.measured && Object.keys(f.measured).length > 0 && (
                    <div style={{
                      padding: '8px 10px',
                      background: 'rgba(8,8,12,0.4)',
                      borderRadius: 6,
                      fontSize: 10.5, fontFamily: 'Inter',
                      display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '4px 12px',
                    }}>
                      {Object.entries(f.measured).map(([k, v]) => (
                        v !== null && v !== undefined && (
                          <div key={k} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                            <span style={{ color: 'var(--d-fg3)', fontSize: 9.5 }}>{k.replace(/_/g, ' ')}</span>
                            <span style={{ color: fg.c, fontWeight: 600 }}>{v}</span>
                          </div>
                        )
                      ))}
                    </div>
                  )}

                  <div style={{ fontSize: 11, color: 'var(--d-fg2)', lineHeight: 1.55, paddingTop: 4, borderTop: `1px dashed ${fg.c}33` }}>
                    {f.comment}
                  </div>

                  {/* 학술 설명 InfoBox (사용자 요청 — 7대 요인 각각의 정의/의미/해석/판단) */}
                  {FACTOR_INFO[f.id] && (
                    <InfoBox items={[{
                      term: f.name + ' · 학술 설명',
                      def: FACTOR_INFO[f.id].def,
                      meaning: FACTOR_INFO[f.id].meaning,
                      interpret: FACTOR_INFO[f.id].interpret,
                      judge: FACTOR_INFO[f.id].judge
                    }]}/>
                  )}
                </div>
              );
            })}
          </div>

          {/* 약점 우선순위 박스 (D/C 요인 강조) */}
          {(() => {
            const weakest = factors.filter(f => f.grade === 'D' || f.grade === 'C');
            if (weakest.length === 0) return null;
            return (
              <div style={{
                marginTop: 16, padding: '14px 16px',
                background: 'linear-gradient(135deg, rgba(248,113,113,0.08), rgba(251,191,36,0.04))',
                border: '1px solid rgba(248,113,113,0.3)',
                borderRadius: 8,
              }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: '#f87171', letterSpacing: '1.2px', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#f87171" strokeWidth="2.5"><path d="M12 9v4m0 3v.01M12 3l10 18H2z" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  약점 우선순위 · 교정 시작점 (Upstream → Downstream)
                </div>
                <div style={{ fontSize: 11.5, color: 'var(--d-fg2)', lineHeight: 1.7 }}>
                  {weakest.map((w, i) => (
                    <div key={w.id} style={{ paddingLeft: 8 }}>
                      <span style={{ color: w.grade === 'D' ? '#f87171' : '#fbbf24', fontWeight: 700 }}>
                        {i + 1}. {w.name} ({w.grade}등급)
                      </span>
                    </div>
                  ))}
                </div>
                <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid rgba(248,113,113,0.2)', fontSize: 10.5, color: 'var(--d-fg3)', lineHeight: 1.6 }}>
                  <b style={{ color: '#fbbf24' }}>교정 원칙</b> · 손이 아니라 손을 흔드는 그 앞 단계를 먼저 잡아야 함.
                  ① → ② → ③ 순서로 cascade 발생 → upstream 변수가 stable해야 downstream도 안정.
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {/* 방법론 */}
      <details style={{ fontSize: 11, color: 'var(--d-fg3)' }}>
        <summary style={{ cursor: 'pointer', fontWeight: 600, padding: '6px 0' }}>방법론 · 메카닉 일관성 → 제구력 추정 근거</summary>
        <div style={{ marginTop: 8, padding: 12, background: 'rgba(0,0,0,0.25)', borderRadius: 6, lineHeight: 1.7 }}>
          <div style={{ fontWeight: 700, color: '#93c5fd', marginBottom: 6 }}>이론적 인과 chain</div>
          <div style={{ paddingLeft: 8 }}>
            메카닉 시행간 일관성 (low SD/CV)<br/>
            → release point variability ↓<br/>
            → plate location dispersion ↓<br/>
            → strike % ↑
          </div>
          <div style={{ fontWeight: 700, color: '#93c5fd', margin: '12px 0 6px' }}>측정 변수 6종 (Uplift Labs 10구)</div>
          <div style={{ paddingLeft: 8 }}>
            · <b>wrist_height_at_release SD</b> — 릴리스 손목 높이 표준편차<br/>
            · <b>arm_slot_angle SD</b> — 팔 각도 표준편차 (어깨 외전 일관성)<br/>
            · <b>trunk_forward_tilt_at_ball_release SD</b> — 릴리스 몸통 기울기 표준편차<br/>
            · <b>max_layback_angle CV</b> — 최대 layback 변동계수<br/>
            · <b>stride_length CV</b> — 보폭 변동계수 (하체 일관성)<br/>
            · <b>foot_contact → release CV</b> — 풋 컨택트부터 릴리스까지 시간 변동계수 (BBL 자체 검출 · 전체 메카닉 일관성 종합 지표)
          </div>
          <div style={{ fontWeight: 700, color: '#93c5fd', margin: '12px 0 6px' }}>선행 연구</div>
          <div style={{ paddingLeft: 8 }}>
            · Whiteside et al. (2016) — 메카닉 일관성 ↔ 컨트롤 r ≈ 0.4-0.6<br/>
            · Solomito et al. (2018) — 분절 timing variability → release point variability (R² ≈ 0.5)<br/>
            · Werner et al. (2008) — release point SD가 plate location SD를 직접 결정
          </div>
          <div style={{ marginTop: 12, paddingTop: 8, borderTop: '1px solid var(--d-border)', fontSize: 10 }}>
            <b>현재 공식</b> · strike% = 75 − wrist_SD·1.0 − armSlot_SD·0.8 − trunkTilt_SD·1.2 − layback_CV·0.4 − stride_CV·1.5 − fcRelease_CV·0.5<br/>
            <b>한계</b> · 본 추정치는 메카닉 일관성 기반 indirect 추정. 실제 Rapsodo plate location SD로 직접 검증·교체 예정.
          </div>
        </div>
      </details>
    </div>
  );
}

/* ---------------- COLLAPSIBLE SECTION ---------------- */
function SectionBlock({ num, title, sub, defaultOpen = true, children }) {
  const [open, setOpen] = useState(defaultOpen);
  const ref = useRef(null);

  // 외부 네비게이션에서 이 섹션으로 이동할 때 자동 open
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const handler = () => setOpen(true);
    el.addEventListener('__open', handler);
    return () => el.removeEventListener('__open', handler);
  }, []);

  return (
    <div ref={ref} className={`section-block ${open ? 'open' : ''}`} data-section-num={num}>
      <button className="section-bar" onClick={() => setOpen(o => !o)}>
        <div className="num">{num}</div>
        <div>
          <h2>{title}</h2>
          {sub && <div className="sub">{sub}</div>}
        </div>
        <span className="chev">{Ic.chev}</span>
      </button>
      <div className="section-body">
        {children}
      </div>
    </div>
  );
}

/* ---------------- VIDEO CARD (reused) ---------------- */
function VideoCard({ src }) {
  const videoRef = useRef(null);
  const [rate, setRate] = useState(1);
  const [isPaused, setIsPaused] = useState(true);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const rates = [1, 0.25, 0.1];
  useEffect(() => {
    if (videoRef.current) videoRef.current.playbackRate = rate;
  }, [rate]);
  const FRAME = 1 / 30;
  const step = async (dir) => {
    const v = videoRef.current;
    if (!v) return;
    try { await v.pause(); } catch(_) {}
    const dur = isFinite(v.duration) ? v.duration : Infinity;
    v.currentTime = Math.max(0, Math.min(dur, v.currentTime + dir * FRAME));
  };
  const toggle = async () => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) { try { await v.play(); } catch(_) {} } else v.pause();
  };
  const onSeek = (e) => {
    const v = videoRef.current;
    if (!v || !isFinite(v.duration)) return;
    const t = parseFloat(e.target.value);
    v.currentTime = t;
    setCurrentTime(t);
  };
  const formatTime = (t) => {
    if (!isFinite(t) || t < 0) return '0:00.00';
    const m = Math.floor(t / 60);
    const s = (t % 60).toFixed(2).padStart(5, '0');
    return `${m}:${s}`;
  };
  const onKey = (e) => {
    if (e.key === 'ArrowLeft') { e.preventDefault(); step(-1); }
    else if (e.key === 'ArrowRight') { e.preventDefault(); step(1); }
    else if (e.key === ' ') { e.preventDefault(); toggle(); }
  };
  return (
    <div className="video-card">
      <div className="card-head" style={{ marginBottom: 12 }}>
        <div>
          <div className="section-kicker" style={{ fontSize: 10 }}>Motion Capture</div>
          <h3 className="card-title" style={{ marginTop: 4, fontSize: 14 }}>투구 영상 시퀀스</h3>
          <div className="card-sub" style={{ fontSize: 11 }}>← → 프레임 · Space 재생/정지</div>
        </div>
        <div className="rate-switch">
          {rates.map(r => (
            <button key={r}
              className={`rate-btn ${rate === r ? 'active' : ''}`}
              onClick={() => setRate(r)}>{r}×</button>
          ))}
        </div>
      </div>
      <div className="video-wrap" tabIndex={0} onKeyDown={onKey} style={{ position: 'relative' }}>
        <video ref={videoRef} src={src} playsInline preload="auto" muted controls={false} disablePictureInPicture
          onPlay={() => setIsPaused(false)}
          onPause={() => setIsPaused(true)}
          onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
          onLoadedMetadata={(e) => {
            const v = e.currentTarget;
            v.playbackRate = rate;
            setDuration(v.duration || 0);
            try { v.currentTime = 0.001; } catch(_) {}
          }}
          style={{ width: '100%', display: 'block', borderRadius: 12, background: '#000' }}/>
      </div>
      <div className="seek-bar">
        <span className="seek-time">{formatTime(currentTime)}</span>
        <input type="range" className="seek-slider"
               min={0} max={duration || 0} step={FRAME} value={currentTime}
               onChange={onSeek}
               onInput={onSeek}
               onPointerDown={() => { try { videoRef.current && videoRef.current.pause(); } catch(_) {} }}
               onTouchStart={() => { try { videoRef.current && videoRef.current.pause(); } catch(_) {} }}
               style={{ '--seek-progress': `${duration ? (currentTime / duration) * 100 : 0}%` }}
               aria-label="동영상 시점 이동"/>
        <span className="seek-time">{formatTime(duration)}</span>
      </div>
      <div className="frame-controls">
        <button className="frame-btn" onClick={() => step(-1)}>◀ −1f</button>
        <button className="frame-btn play" onClick={toggle}>{isPaused ? '▶ 재생' : '❚❚ 정지'}</button>
        <button className="frame-btn" onClick={() => step(1)}>+1f ▶</button>
      </div>
    </div>
  );
}

/* ---------------- SINGLE PITCHER VIEW ---------------- */
function SinglePitcherView({ p }) {
  const _ = (v, dash = '—') => (v == null || (typeof v === 'number' && isNaN(v))) ? dash : v;
  const physRows = [
    { k: '폭발력', sub: 'CMJ 단위파워 · W/kg', val: _(p.physical?.cmjPower?.cmj), band: p.physical?.cmjPower?.band || 'na' },
    { k: '버티는 힘', sub: '절대근력 IMTP · N/kg', val: _(p.physical?.maxStrength?.perKg), band: p.physical?.maxStrength?.band || 'na' },
    { k: '빠른 반동', sub: '반응성 RSI-mod · m/s', val: _(p.physical?.reactive?.cmj), band: p.physical?.reactive?.band || 'na' },
    { k: '반동 활용', sub: 'EUR · CMJ/SJ 비율', val: _(p.physical?.ssc?.value), band: p.physical?.ssc?.band || 'na' },
    { k: '손목 힘', sub: '악력 · kg', val: _(p.physical?.release?.value), band: p.physical?.release?.band || 'na' },
  ];
  const bandLabel = { high: '상위', mid: '범위', low: '미만', na: '미측정' };
  const etiTA = p.energy?.etiTA;
  const taLeak = etiTA != null && etiTA < 0.85;

  return (
    <>
      {/* Page head */}
      <div className="page-head">
        <div>
          <h1 className="page-title">{p.name}</h1>
          <div className="pitcher-meta" style={{ marginTop: 8 }}>
            <div>유형<b>{p.archetype}</b></div>
            <div>측정일<b>{p.date}</b></div>
            <div>태그<b>{p.tags.join(' · ') || '—'}</b></div>
          </div>
        </div>
        <span className={`sev sev-${p.severity}`} style={{ fontSize: 11, padding: '6px 12px' }}>
          {p.severity === 'NONE' ? 'BALANCED' : p.severity + ' PRIORITY'}
        </span>
      </div>

      {/* Hero — Video Sequence Panel (추후 활성화 — VideoPanel 함수는 보존) */}
      {/* <div style={{ marginBottom: 20 }}>
        <VideoPanel p={p}/>
      </div> */}

      {/* KPI grid */}
      <div className="kpi-grid">
        <KPI hero label="Peak Velocity" value={p.velocity.toFixed(1)} unit="km/h"
          foot={`평균 ${p.velocityAvg.toFixed(1)}`}/>
        {p.spinRate != null && p.spinRate > 0 && (
          <KPI label="Avg Spin Rate" value={Math.round(p.spinRate)} unit="rpm"
            foot="평균 회전수"/>
        )}
        <KPI label="Max Layback" value={p.layback.deg.toFixed(1)} deg
          band={p.layback.band}
          foot="프로 160°–180°"/>
        <KPI label="Trunk → Arm ETI" value={p.energy.etiTA.toFixed(2)}
          band={taLeak ? 'low' : 'high'}
          foot={taLeak ? `${p.energy.leakPct}% 손실` : '효율 전달'}/>
        <KPI label="CMJ 단위파워" value={p.physical?.cmjPower?.cmj ?? '—'} unit="W/kg"
          band={p.physical?.cmjPower?.band || 'na'}
          foot="기준 50+"/>
      </div>

      {/* Core Issue — KPI와 구속 관련 체력 사이 */}
      <div style={{ marginBottom: 24 }}>
        <CoreIssuePanel p={p}/>
      </div>

      {/* Expected Velocity Panel — 향후 활성화 (현재 v0.1 prototype, n=4 baseline로 미완성) */}
      {/* <div style={{ marginBottom: 24 }}>
        <ExpectedVelocityPanel p={p}/>
      </div> */}

      {/* Section: Physical */}
      <SectionBlock num="01" title="Velocity Drivers · 구속 관련 체력 요소"
        sub="· 빠른 공을 만드는 6가지 신체 능력 종합 평가">
        <div className="dash-grid">
          <div className="panel" style={{ background: 'transparent', border: '1px solid var(--d-border)' }}>
            <div className="panel-head">
              <div>
                <div className="kicker">Velocity Drivers Map</div>
                <h3>구속 관련 체력 현황</h3>
                <div className="sub">· 안쪽 · 기준 미만 (보강 필요) / 바깥 · 기준 상위 (잘 갖춤)</div>
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 0' }}>
              <RadarChart data={p.radar}/>
            </div>
            {/* 각 요소가 구속에 어떻게 기여하는지 안내 */}
            <div style={{ marginTop: 8, padding: '12px 14px', background: 'rgba(8,8,12,0.3)', border: '1px solid var(--d-border)', borderRadius: 8 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: '#60a5fa', letterSpacing: '1px', marginBottom: 8 }}>
                각 요소가 구속에 기여하는 방식
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 14px', fontSize: 11, lineHeight: 1.6, color: 'var(--d-fg2)' }}>
                <div><b style={{ color: '#60a5fa' }}>· 폭발력</b> — 하체에서 공으로 가는 힘의 시작점</div>
                <div><b style={{ color: '#60a5fa' }}>· 순수파워</b> — 와인드업 없이도 만드는 힘</div>
                <div><b style={{ color: '#60a5fa' }}>· 버티는 힘</b> — 디딤발 착지 시 무너지지 않는 힘</div>
                <div><b style={{ color: '#60a5fa' }}>· 빠른 반동</b> — 짧은 시간에 힘을 폭발시키는 능력</div>
                <div><b style={{ color: '#60a5fa' }}>· 반동 활용</b> — 근육 늘림 → 수축 효율</div>
                <div><b style={{ color: '#60a5fa' }}>· 손목 힘</b> — 마지막 가속 + 릴리스 안정성</div>
              </div>
            </div>
          </div>
          <div className="panel">
            <div className="panel-head">
              <div>
                <div className="kicker">Detailed Metrics</div>
                <h3>측정값 · 측정 단위 보기</h3>
                <div className="sub">· 정확한 수치와 기준 비교</div>
              </div>
            </div>
            <div>
              {physRows.map((r,i) => (
                <div className="metric-row" key={i}>
                  <div className="lbl">{r.k}<small>{r.sub}</small></div>
                  <div className="val">{r.val}</div>
                  <div className={`band band-${r.band}`}>{bandLabel[r.band]}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </SectionBlock>

      {/* Section: Mechanics */}
      <SectionBlock num="02" title="Velocity Mechanics · 구속 관련 메카닉스"
        sub="· 에너지 전달 · 키네매틱 시퀀스 · 분절 회전 속도">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="panel">
            <div className="panel-head">
              <div>
                <div className="kicker">Energy Transfer · 5편 논문 정밀 지표</div>
                <h3>에너지 전달과 누수</h3>
                <div className="sub">· 통합 마네킹: 키네틱 체인 에너지 흐름 + 정밀 지표 (elbow load, cocking power, transfer KE T→A, leg asymmetry)</div>
              </div>
            </div>
            {IntegratedKineticDiagram
              ? <IntegratedKineticDiagram energy={p.energy} precision={p.precision}/>
              : <EnergyFlow energy={p.energy}/>
            }
            <div className="chart-caption">{p.energy.comment}</div>
          </div>
          <div className="panel">
            <div className="panel-head">
              <div>
                <div className="kicker">Sequence Timing</div>
                <h3>키네매틱 시퀀스 — 분절 피크 회전 속도의 순서</h3>
                <div className="sub">· 이상적: 골반 → 몸통 → 상완 (proximal-to-distal) · 인접 분절 피크 시점 간격 30–60 ms</div>
              </div>
            </div>
            <SequenceChart sequence={p.sequence}/>
            <div className="chart-caption">{p.sequence.comment}</div>
          </div>
          <div className="panel">
            <div className="panel-head">
              <div>
                <div className="kicker">Peak Angular Velocity</div>
                <h3>분절별 최대 회전 속도</h3>
                <div className="sub">· 한국 우수 고1 기준: 골반 500–600 · 몸통 750–900 · 상완 1350–1550 °/s</div>
              </div>
            </div>
            <AngularChart angular={p.angular}/>
            <div className="chart-caption">{p.angular.comment}</div>
            <div className="chip-row">
              <div className="gain-chip">골반→몸통 <b>×{p.angular.gainPT.toFixed(2)}</b></div>
              <div className="gain-chip">몸통→상완 <b>×{p.angular.gainTA.toFixed(2)}</b></div>
            </div>
          </div>
          <div className="panel">
            <div className="panel-head">
              <div>
                <div className="kicker">Max Layback</div>
                <h3>팔 뒤로 젖힘 — 가속 거리</h3>
                <div className="sub">· 프로 범위 160°–180°</div>
              </div>
            </div>
            <div className="layback-card" style={{ padding: 0, background: 'transparent', border: 'none', display: 'grid', gridTemplateColumns: '1fr auto', gap: 32, alignItems: 'center' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 16 }}>
                  <div className="layback-value">{p.layback.deg.toFixed(1)}<span className="deg">°</span></div>
                  <div className={`band band-${p.layback.band}`} style={{ fontSize: 11 }}>
                    {bandLabel[p.layback.band]}
                  </div>
                </div>
                <div style={{ color: 'var(--d-fg2)', marginTop: 12, fontSize: 13 }}>{p.layback.note}</div>
                <div className="layback-photo" style={{ maxWidth: 220, marginTop: 16 }}>
                  <img src="assets/max-layback.png" alt="Max Layback reference"/>
                </div>
                <div className="layback-photo-caption" style={{ marginTop: 6 }}>Reference</div>
              </div>
              <div style={{ flexShrink: 0 }}>
                <LaybackMeter deg={p.layback.deg}/>
              </div>
            </div>
          </div>
        </div>
      </SectionBlock>

      {/* Section 02B — 변인 설명 (사용자 요청: 별도 섹션으로 분리, 하나의 통합 박스) */}
      <SectionBlock num="02B" title="Velocity Variables Reference · 구속 메카닉스 변인 설명"
        sub="· 마네킹에 표시된 핵심 변인들의 정의 · 투구에서의 의미 · 해석 · 판단 기준 (참고용)">
        <div className="panel" style={{ padding: '4px 4px 4px 4px' }}>
          <UnifiedVariablesPanel/>
        </div>
      </SectionBlock>

      {/* Section 05 — 키네틱 체인 & 정밀 지표 통합 분석 (files Section 5 포팅) */}
      {p.kineticChain && (
        <SectionBlock num="05" title="Kinetic Chain & Precision · 키네틱 체인 & 정밀 지표 통합 분석"
          sub={`· 분절 운동에너지 · Transfer 비율 · Peak Power · Elbow Inverse Dynamics${p.energy?.leakPct ? ` · 종합 누수율 ${p.energy.leakPct}%` : ''}`}>
          <KineticChainPanel kc={p.kineticChain}/>
        </SectionBlock>
      )}

      {/* Section 06 — 구속 요인 종합 (5축 RadarChart + 영역별 카드) */}
      {p.velocityRadar && p.velocityRadar.length > 0 && (
        <SectionBlock num="06" title="Velocity Synthesis · 구속 요인 종합"
          sub="· 5영역 종합 평가 — 드라이브라인 4모델 + ⭐ 키네틱 체인 효율 (우리 시스템 고유)">
          <VelocityRadarPanel data={p.velocityRadar}/>
        </SectionBlock>
      )}

      {/* Section: Command Profile (7대 요인) */}
      <SectionBlock num="03" title="Command Mechanics · 제구 관련 메카닉스"
        sub="· 10구 메카닉 일관성 + 제구력 7대 요인 평가 · Uplift Labs 실측">
        {/* 5 Domain Radar — 풋컨택트·시퀀싱·파워·릴리즈 포지션·릴리즈 타이밍 일관성 */}
        {p.command?.radarData && p.command.radarData.length > 0 && (
          <div className="panel" style={{ marginBottom: 16 }}>
            <div className="panel-head">
              <div>
                <div className="kicker">5 Domain Consistency</div>
                <h3>제구력 5대 영역 일관성 레이더</h3>
                <div className="sub">· 풋 컨택트 · 시퀀싱 · 파워 아웃풋 · 릴리즈 포지션 · 릴리즈 타이밍 — 외곽으로 갈수록 우수 (50점 미만 = 보강 필요)</div>
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'center', padding: '8px 0' }}>
              <RadarChart data={p.command.radarData}/>
            </div>
            <div className="chart-caption">{p.command.note}</div>
          </div>
        )}
        <CommandProfilePanel cmd={p.command} energy={p.energy} layback={p.layback} factors={p.factors}/>
      </SectionBlock>

      {/* Section D 삭제됨 — 사용자 요청에 따라 제거 (Section 03 제구 메카닉스 + Section E 종합 평가로 정리) */}

      {/* Section E — 종합 평가 (구속·제구·체력 점수 + 우선순위 개선점) */}
      {p.summaryScores && (
        <SectionBlock num="E" title="Comprehensive Evaluation · 종합 평가"
          sub="· 구속 · 제구 · 체력 3축 종합 점수 + Mechanical Ceiling + 우선순위 개선점">
          <SummaryScoresPanel ss={p.summaryScores}/>
        </SectionBlock>
      )}

      {/* Section: SW */}
      <SectionBlock num="04" title="Strengths & Weaknesses · 강점·약점"
        sub="· 통합 판정 기반">
        <div className="sw-grid">
          <div>
            <div className="sw-title pos">
              <svg width="14" height="14" viewBox="0 0 16 16"><path d="M3 8l4 4 6-8" stroke="#4ade80" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/></svg>
              강점 · Strengths
            </div>
            <div className="sw-list">
              {p.strengths.map((s,i) => (
                <div className="sw-item pos" key={i}>
                  <div className="t">{s.title}</div>
                  <div className="d">{s.detail}</div>
                </div>
              ))}
            </div>
          </div>
          <div>
            <div className="sw-title neg">
              <svg width="14" height="14" viewBox="0 0 16 16"><path d="M4 4l8 8M12 4l-8 8" stroke="#f87171" strokeWidth="2.5" fill="none" strokeLinecap="round"/></svg>
              약점 · Improvement
            </div>
            <div className="sw-list">
              {p.weaknesses.map((w,i) => (
                <div className="sw-item neg" key={i}>
                  <div className="t">{w.title}</div>
                  <div className="d">{w.detail}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </SectionBlock>

      {/* Section: Flags — 항상 표시 (빈 경우 '특이사항 없음' 메시지) */}
      <SectionBlock num="05B" title="Check Points · 체크 포인트"
        sub="· 자동 규칙 엔진이 감지한 확인 필요 항목">
        {p.flags.length > 0 ? p.flags.map((f,i) => (
          <div className={`flag-item ${f.severity}`} key={i}>
            <div className="head">
              <span className={`sev sev-${f.severity}`} style={{ padding: '4px 8px', fontSize: 10 }}>{f.severity}</span>
              <span className="t">{f.title}</span>
            </div>
            <ul>{f.evidence.map((e,j) => <li key={j}>{e}</li>)}</ul>
            <div className="impl">{f.implication}</div>
          </div>
        )) : (
          <div style={{
            padding: '32px 24px',
            borderRadius: 12,
            border: '1px dashed var(--d-border)',
            background: 'rgba(74, 222, 128, 0.04)',
            textAlign: 'center',
          }}>
            <div style={{
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              width: 44, height: 44, borderRadius: '50%',
              background: 'rgba(74, 222, 128, 0.15)',
              border: '1px solid rgba(74, 222, 128, 0.4)',
              marginBottom: 14,
            }}>
              <svg width="22" height="22" viewBox="0 0 16 16">
                <path d="M3 8l4 4 6-8" stroke="#4ade80" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--d-fg1)', marginBottom: 6 }}>
              특이사항 없음
            </div>
            <div style={{ fontSize: 12, color: 'var(--d-fg3)', lineHeight: 1.6 }}>
              · 측정 전 영역에서 주의·경계 신호 미감지<br/>
              · 현재 수준 유지 + 보강 여력 확보 차원의 트레이닝 권장
            </div>
          </div>
        )}
      </SectionBlock>

      {/* Training/Drills 섹션은 사용자 요청에 따라 비활성화 */}

      <div style={{ marginTop: 24, padding: 20, borderRadius: 14, background: 'var(--d-surface)', border: '1px solid var(--d-border)', fontSize: 11, color: 'var(--d-fg3)', textAlign: 'center' }}>
        <b style={{ color: 'var(--d-fg1)' }}>BioMotion Baseball Lab</b> · Kookmin University · 
        <a href="https://biomotion.kr" style={{ color: 'var(--bbl-primary)', marginLeft: 4 }}>biomotion.kr</a>
        <div style={{ marginTop: 4 }}>· Uplift Labs 마커리스 모션캡처 · VALD ForceDecks · 랩소도 통합 분석</div>
      </div>
    </>
  );
}

/* ---------------- MECHANIC DRILLS ---------------- */
const DRILL_CATALOG = [
  {
    id: 'hip-shoulder',
    tag: '분리',
    title: 'Hip-Shoulder Separation · 골반-어깨 분리 드릴',
    target: '몸통-골반 분리각 부족 · 시퀀스 동기화 불량',
    triggers: ['시퀀스', '몸통', '골반', 'ETI', '분리'],
    level: '기본',
    equipment: '긴 막대(PVC·배트·수건 묶음) 1개',
    duration: '10분',
    cue: '"골반 먼저, 가슴은 늦게 — 고무줄을 비틀어 감는 느낌"',
    steps: [
      { t: '거울 세팅', d: '전신 거울 앞 또는 휴대폰을 삼각대/벽에 기대 측면에서 촬영. 앞발 착지 자세로 시작.' },
      { t: '막대 올리기', d: '막대를 어깨 위에 수평으로 얹는다. 양손으로 잡고 어깨와 평행 유지.' },
      { t: '골반 선행', d: '골반을 타겟 쪽으로 먼저 돌린다. 이때 어깨(막대)는 측방(1·3루 방향)을 유지 — 스스로 "골반 1박, 어깨 2박" 카운트.' },
      { t: '지연 회전', d: '골반이 완전히 열렸다는 감각이 온 뒤에 어깨를 던진다. 스냅 없이 풀리듯.' },
      { t: '셀프 체크', d: '영상을 보며 골반 라인과 어깨 라인 각도가 엇갈리는 순간이 한 프레임 이상 유지되는지 확인.' },
    ],
    reps: '3세트 × 6회 (던지는 쪽만)',
    fail: [
      '골반과 어깨가 동시에 회전 → 분리각 0°',
      '상체가 먼저 열림 → 팔이 끌려나옴',
    ],
    selfCheck: '측면 영상에서 골반 라인과 어깨 라인의 교차 각도가 30–45°로 0.05초 이상 유지되는지. 스마트폰 슬로우모션(240fps)으로 찍으면 프레임 단위로 확인 가능.',
  },
  {
    id: 'layback',
    tag: '레이백',
    title: 'External Rotation Layback · 최대 외회전 드릴',
    target: '최대 외회전(Layback) 부족 · 경직된 어깨',
    triggers: ['레이백', 'layback', '외회전', 'ER', '어깨'],
    level: '기본 → 중급',
    equipment: '야구공 1개 · 벽',
    duration: '8분',
    cue: '"공을 뒤로 던지듯 눕혀라 — 손목이 귀 뒤에 위치"',
    steps: [
      { t: '벽 터치 세팅', d: '투구측 옆면을 벽에 대고 선다. 앞발 착지 자세(스트라이드 상태)까지 만든다.' },
      { t: '공 젖히기', d: '공을 든 손을 뒤로 눕혀 손등이 벽에 닿도록. 팔꿈치 높이는 어깨와 같은 높이(90°).' },
      { t: '정지 유지', d: '그 자세로 2초 정지. 통증 없이 자연스러운 젖힘 범위에서 멈춘다.' },
      { t: '리듬 추가', d: '정지 없이 "하나-눕혀-둘-앞으로" 리듬으로 반복. 릴리스는 공을 멀리 안 보내도 OK.' },
      { t: '셀프 체크', d: '정면 셀카 동영상으로 공을 든 손이 귀 뒤쪽 위치까지 눕는지, 팔꿈치가 어깨 높이와 같은지 확인.' },
    ],
    reps: '3세트 × 5회',
    fail: [
      '팔꿈치가 어깨보다 낮음 → 회전근개 부담 ↑',
      '상체가 과도하게 측굴 → 진짜 레이백이 아닌 몸통 기울임',
    ],
    selfCheck: '정면에서 찍은 영상에서 공이 최대로 젖혀진 순간, 팔꿈치가 어깨 라인과 수평이면 OK. 팔꿈치가 아래로 처지면 힘을 뺀 후 다시 시도.',
  },
  {
    id: 'stride',
    tag: '스트라이드',
    title: 'Directional Stride · 스트라이드 방향 드릴',
    target: '스트라이드 방향 이탈 · 앞발 착지 불안정',
    triggers: ['스트라이드', 'stride', '방향', '앞발', '착지'],
    level: '기본',
    equipment: '마스킹 테이프 또는 분필 · 콘 1개(없으면 신발)',
    duration: '10분',
    cue: '"타겟과 앞발 발가락을 한 줄로 — 수평으로 눕히듯"',
    steps: [
      { t: '라인 그리기', d: '평지에서 타겟(콘 또는 신발)까지 직선을 테이프로 표시. 양 옆 5cm 지점에도 허용선을 그린다.' },
      { t: '쉐도우 투구', d: '공 없이 와인드업 → 앞발 착지. 앞발이 라인 위 또는 허용선 안에 정확히 떨어지는지 눈으로 확인.' },
      { t: '느린 속도 투구', d: '공 들고 50% 강도로 실제 투구. 매 투구 후 본인이 앞발 위치 바로 체크.' },
      { t: '점진 증가', d: '80% → 100%로 올리면서 10구 중 8구 이상 허용선 내 성공 시 다음 단계.' },
      { t: '셀프 체크', d: '휴대폰으로 마운드 뒤 상단 각도에서 촬영. 앞발 착지점과 타겟이 같은 수직선상인지.' },
    ],
    reps: '4세트 × 10구 (정확도 > 속도)',
    fail: [
      '앞발이 타겟 라인 안쪽으로 교차(크로스파이어) → 몸통 회전 차단',
      '앞발이 바깥쪽 이탈 → 몸통 조기 열림',
    ],
    selfCheck: '정면 상단(등 뒤에 카메라 높이 세우고) 영상에서 앞발 착지점이 타겟과 한 직선상에 있는지. 벗어나면 허용선 안에 들 때까지 반복.',
  },
  {
    id: 'front-block',
    tag: '차단',
    title: 'Front Leg Block · 앞다리 차단 드릴',
    target: '앞다리 차단(브레이싱) 부족 · 체중 이동 누수',
    triggers: ['차단', '브레이싱', '앞다리', '앞발', 'block', 'front leg', '체중'],
    level: '중급',
    equipment: '박스 또는 낮은 계단(15cm) · (선택) 2kg 공 또는 물통',
    duration: '12분',
    cue: '"앞무릎을 잠그고 몸통을 튕겨라 — 기둥처럼 서라"',
    steps: [
      { t: '스텝업 홀드', d: '앞발을 박스/계단 위에 올리고 축각으로 체중을 앞으로 이동. 앞무릎이 발끝을 넘지 않게 잠근다. 5초 × 5회.' },
      { t: '메디볼 슬램', d: '공(또는 물통)을 머리 위에서 앞발 직전 바닥으로 내려찍기. 앞다리가 "벽" 역할. 3세트 × 6회.' },
      { t: '쉐도우 피치', d: '박스 없이 평지에서 투구 동작. 착지 순간 앞무릎을 "탁" 하고 펴지는 감각에 집중.' },
      { t: '셀프 체크', d: '측면 촬영 후 앞발 착지 프레임 → 릴리스 프레임을 비교. 무릎 각도가 넓어지는(펴지는) 방향이어야 정상.' },
    ],
    reps: '3세트 × 6회 (스텝업) + 3세트 × 6회 (슬램)',
    fail: [
      '착지 후 앞무릎이 계속 굽음 → 에너지 누수',
      '무릎이 안쪽으로 무너짐(발생 시 즉시 중단, 통증 여부 확인)',
    ],
    selfCheck: '측면 슬로우모션 영상에서 앞발 착지 → 릴리스 사이 무릎 각도 변화를 확인. 각도가 40–50° 정도 "펴지면" 정상 블로킹.',
  },
  {
    id: 'arm-path',
    tag: '팔궤도',
    title: 'Clean Arm Path · 팔 궤적 정리 드릴',
    target: '팔 궤적 비효율 · 릴리스 포인트 불안정',
    triggers: ['팔', '궤도', 'arm', 'path', '릴리스', 'release'],
    level: '기본',
    equipment: '수건 1장 · 야구공',
    duration: '10분',
    cue: '"엄지 아래로 → 공은 위로 — W가 아닌 반원"',
    steps: [
      { t: '타월 드릴', d: '공 대신 수건을 쥐고 투구 동작. 팔을 뒤로 보낼 때 엄지가 아래(thumbs down)로 향하는지 스스로 확인.' },
      { t: '피봇 픽오프', d: '축각만으로 회전해 공 없이 릴리스. 팔꿈치가 어깨보다 아래로 떨어지지 않도록 한다.' },
      { t: '리버스 스로우', d: '타겟을 등지고 선 상태에서 공을 머리 위 방향으로 가볍게 던진다(4m). 팔 궤도 리듬 회복용.' },
      { t: '실투 통합', d: '캐치볼로 교정된 팔 궤도를 실제 투구에 적용. 20m × 15개, 힘 70%.' },
      { t: '셀프 체크', d: '후면 영상으로 팔이 "큰 원"을 그리는지 확인. 팔꿈치가 어깨 아래로 떨어지면 타월 드릴 재반복.' },
    ],
    reps: '3세트 × 8회 (타월) + 캐치볼 15구',
    fail: [
      '팔꿈치가 어깨보다 낮음 (elbow drop / inverted W)',
      '릴리스 포인트가 매번 바뀜 → 제구 흔들림',
    ],
    selfCheck: '후면에서 슬로우모션으로 팔 궤적을 찍어 팔꿈치 높이를 프레임별로 본다. 어깨 라인 아래로 내려가면 OUT, 같거나 높으면 OK.',
  },
  {
    id: 'tempo',
    tag: '템포',
    title: 'Tempo Reset · 동작 타이밍 드릴',
    target: '동작 타이밍 붕괴 · 에너지 전달 지연',
    triggers: ['템포', 'tempo', '타이밍', '시퀀스', '에너지', '전달'],
    level: '기본',
    equipment: '스마트폰 메트로놈 앱 · 거울 또는 셀카 영상',
    duration: '10분',
    cue: '"1-2-3 리듬 — 들어, 모아, 던져"',
    steps: [
      { t: '메트로놈 60bpm', d: '앱 실행(60bpm). "1박: 와인드업, 2박: 핸드브레이크, 3박: 릴리스". 박자에 맞춰 천천히 반복.' },
      { t: '가속 구간 강조', d: '앞발 착지 → 릴리스까지는 반박(0.5박)에 빠르게. 앞은 느리게, 뒤는 폭발적으로.' },
      { t: '거울/셀카 피드백', d: '거울 앞에서 동작. 각 구간 정지 포지션에서 자세 점검. 또는 셀카 영상으로 확인.' },
      { t: '실투 전환', d: '메트로놈 없이 캐치볼 20개. 몸으로 익힌 리듬을 유지하는지 스스로 느낀다.' },
      { t: '셀프 체크', d: '영상 스톱워치로 핸드브레이크 → 릴리스 구간을 측정. 0.4–0.5초가 이상적.' },
    ],
    reps: '3세트 × 10회 (리듬 드릴) + 캐치볼 20구',
    fail: [
      '전반이 너무 빠름 → 후반 가속 불가',
      '핸드브레이크에서 멈춤이 길어 리듬 붕괴',
    ],
    selfCheck: '스마트폰 스톱워치/영상 플레이어로 앞발 착지 프레임과 릴리스 프레임을 찍어 시간차 계산. 0.4–0.5초 범위면 정상.',
  },
];

function pickDrills(p) {
  // 선수 약점 + 코어이슈 + 플래그 텍스트를 매칭에 사용
  const haystack = [
    p.coreIssue || '',
    ...(p.weaknesses||[]).map(w => w.title + ' ' + (w.detail||'')),
    ...(p.flags||[]).map(f => f.title + ' ' + (f.detail||'')),
  ].join(' ').toLowerCase();

  const scored = DRILL_CATALOG.map(d => {
    const hits = d.triggers.filter(tr => haystack.includes(tr.toLowerCase())).length;
    return { d, hits };
  }).sort((a,b) => b.hits - a.hits);

  const picked = scored.filter(s => s.hits > 0).map(s => s.d);
  if (picked.length < 3) {
    DRILL_CATALOG.forEach(d => {
      if (picked.length < 3 && !picked.includes(d)) picked.push(d);
    });
  }
  return picked.slice(0, 4);
}

function MechanicDrills({ p }) {
  const drills = pickDrills(p);
  const [activeIdx, setActiveIdx] = useState(0);
  const active = drills[activeIdx] || drills[0];

  return (
    <div className="drills-wrap">
      {/* 상단 인트로 */}
      <div className="drills-intro">
        <div className="drills-intro-head">
          <div className="drills-intro-kicker">For Athletes · 선수용</div>
          <h3 className="drills-intro-title">혼자서 수행하는 교정 드릴 {drills.length}개</h3>
          <div className="drills-intro-sub">
            {p.name} 선수의 <b>진단 결과</b>에 따라 자동 선별된 드릴입니다.
            모든 드릴은 <b>최소 장비 · 셀프 체크 방법 · 단계별 지시</b>를 포함해
            혼자서도 안전하게 진행할 수 있도록 구성했습니다.
          </div>
        </div>
        <div className="drills-legend">
          <div className="dl-item"><span className="dl-dot" style={{background:'#60a5fa'}}/>타겟</div>
          <div className="dl-item"><span className="dl-dot" style={{background:'#fbbf24'}}/>단계</div>
          <div className="dl-item"><span className="dl-dot" style={{background:'#f87171'}}/>주의</div>
          <div className="dl-item"><span className="dl-dot" style={{background:'#4ade80'}}/>셀프 체크</div>
        </div>
      </div>

      {/* 탭 */}
      <div className="drills-tabs">
        {drills.map((d, i) => (
          <button key={d.id}
            className={`drill-tab ${i === activeIdx ? 'active' : ''}`}
            onClick={() => setActiveIdx(i)}>
            <span className="dt-num">0{i+1}</span>
            <div className="dt-txt">
              <div className="dt-tag">{d.tag}</div>
              <div className="dt-title">{d.title}</div>
            </div>
          </button>
        ))}
      </div>

      {/* 드릴 상세 */}
      {active && (
        <div className="drill-card" key={active.id}>
          <div className="dc-head">
            <div>
              <div className="dc-tag">{active.tag} · {active.level}</div>
              <h3 className="dc-title">{active.title}</h3>
              <div className="dc-target">🎯 <b>타겟</b> · {active.target}</div>
            </div>
            <div className="dc-meta">
              <div className="dcm-row"><span>장비</span><b>{active.equipment}</b></div>
              <div className="dcm-row"><span>소요</span><b>{active.duration}</b></div>
              <div className="dcm-row"><span>세트</span><b>{active.reps}</b></div>
            </div>
          </div>

          <div className="dc-cue">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 18l6-6-6-6"/></svg>
            <span>{active.cue}</span>
          </div>

          <div className="dc-body">
            <div className="dc-col">
              <div className="dc-col-title">
                <span className="dl-dot" style={{background:'#fbbf24'}}/>
                단계별 실행
              </div>
              <ol className="dc-steps">
                {active.steps.map((s, i) => (
                  <li key={i}>
                    <span className="ds-num">{i+1}</span>
                    <div>
                      <b>{s.t}</b>
                      <p>{s.d}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </div>

            <div className="dc-col">
              <div className="dc-col-title">
                <span className="dl-dot" style={{background:'#f87171'}}/>
                주의할 실수
              </div>
              <ul className="dc-fails">
                {active.fail.map((f, i) => <li key={i}>⚠️ {f}</li>)}
              </ul>

              <div className="dc-col-title" style={{ marginTop: 20 }}>
                <span className="dl-dot" style={{background:'#4ade80'}}/>
                셀프 체크 방법
              </div>
              <div className="dc-coach">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#4ade80" strokeWidth="2"><circle cx="12" cy="12" r="9"/><path d="M8 12l3 3 5-6"/></svg>
                <span>{active.selfCheck}</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------------- COMPARE VIEW ---------------- */
function CompareCol({ p }) {
  const bandLabel = { high: '상위', mid: '범위', low: '미만', na: '—' };
  const taLeak = p.energy.etiTA < 0.85;
  const gradeColors = {
    A: { c: '#4ade80', bg: 'rgba(74,222,128,0.10)' },
    B: { c: '#60a5fa', bg: 'rgba(96,165,250,0.10)' },
    C: { c: '#fbbf24', bg: 'rgba(251,191,36,0.10)' },
    D: { c: '#f87171', bg: 'rgba(248,113,113,0.10)' },
    na: { c: '#94a3b8', bg: 'rgba(148,163,184,0.10)' },
  };
  const cmd = p.command || {};
  const cmdGrade = cmd.grade || 'na';
  const cmdFg = gradeColors[cmdGrade] || gradeColors.na;
  
  // 섹션 헤더 스타일
  const sectionHeader = {
    fontSize: 10, fontWeight: 700, color: '#93c5fd', letterSpacing: '1.2px',
    paddingTop: 14, marginTop: 14, marginBottom: 10,
    borderTop: '1px solid var(--d-border)',
  };
  
  return (
    <div className="compare-col">
      <div className="col-head">
        <div className="av">{p.name[0]}</div>
        <div>
          <div className="nm">{p.name}</div>
          <div className="meta">{p.archetype} · {p.date}</div>
        </div>
      </div>
      <div className="col-body">
        {/* === 헤드라인 — Velocity + Strike% === */}
        <div style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
          <div style={{ flex: 1, padding: '10px 12px', background: 'var(--d-surface-3)', borderRadius: 8, border: '1px solid var(--d-border)' }}>
            <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--d-fg3)', letterSpacing: '1px', marginBottom: 4 }}>VELOCITY</div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
              <div style={{ fontFamily: 'Inter', fontSize: 26, fontWeight: 900, color: 'var(--d-fg1)', letterSpacing: '-0.02em', lineHeight: 1 }}>
                {p.velocity.toFixed(1)}
              </div>
              <div style={{ fontSize: 10, color: 'var(--d-fg3)', fontWeight: 600 }}>km/h</div>
            </div>
            <div style={{ fontSize: 10, color: 'var(--d-fg3)', marginTop: 4 }}>평균 {p.velocityAvg.toFixed(1)}</div>
          </div>
          <div style={{ flex: 1, padding: '10px 12px', background: cmdFg.bg, borderRadius: 8, border: `1px solid ${cmdFg.c}55` }}>
            <div style={{ fontSize: 9, fontWeight: 700, color: cmdFg.c, letterSpacing: '1px', marginBottom: 4 }}>COMMAND</div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
              <div style={{ fontFamily: 'Inter', fontSize: 26, fontWeight: 900, color: cmdFg.c, letterSpacing: '-0.02em', lineHeight: 1 }}>
                {cmdGrade}
              </div>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--d-fg2)' }}>
                {cmd.strikePct ? cmd.strikePct.toFixed(1) + '%' : '—'}
              </div>
            </div>
            <div style={{ fontSize: 10, color: 'var(--d-fg3)', marginTop: 4 }}>plate {cmd.plateSdCm ? cmd.plateSdCm + 'cm' : '—'}</div>
          </div>
        </div>

        <span className={`sev sev-${p.severity}`} style={{ fontSize: 10, padding: '4px 8px', display: 'inline-block', marginBottom: 12 }}>
          {p.severity === 'NONE' ? 'BALANCED' : p.severity + ' PRIORITY'}
        </span>

        {/* === ① 구속 관련 체력 === */}
        <div style={sectionHeader}>① 구속 관련 체력</div>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 8 }}>
          <RadarChart data={p.radar}/>
        </div>
        <div className="compare-stat">
          <span className="lbl">CMJ 단위파워 (W/kg)</span>
          <span className="val">{p.physical.cmjPower.cmj}</span>
          <span className={`band ${p.physical.cmjPower.band}`}>{bandLabel[p.physical.cmjPower.band]}</span>
        </div>
        <div className="compare-stat">
          <span className="lbl">절대근력 IMTP (N/kg)</span>
          <span className="val">{p.physical.maxStrength.perKg ?? '—'}</span>
          <span className={`band ${p.physical.maxStrength.band}`}>{bandLabel[p.physical.maxStrength.band]}</span>
        </div>
        <div className="compare-stat">
          <span className="lbl">반응성 RSI-mod</span>
          <span className="val">{p.physical.reactive.cmj}</span>
          <span className={`band ${p.physical.reactive.band}`}>{bandLabel[p.physical.reactive.band]}</span>
        </div>
        <div className="compare-stat">
          <span className="lbl">반동 활용 EUR</span>
          <span className="val">{p.physical.ssc.value}</span>
          <span className={`band ${p.physical.ssc.band}`}>{bandLabel[p.physical.ssc.band]}</span>
        </div>
        <div className="compare-stat">
          <span className="lbl">악력 (kg)</span>
          <span className="val">{p.physical.release.value}</span>
          <span className={`band ${p.physical.release.band}`}>{bandLabel[p.physical.release.band]}</span>
        </div>

        {/* === ② 구속 관련 메카닉스 === */}
        <div style={sectionHeader}>② 구속 관련 메카닉스</div>
        <div className="compare-stat">
          <span className="lbl">Pelvis 회전속도 (°/s)</span>
          <span className="val">{p.angular.pelvis}</span>
          <span className={`band ${p.angular.pelvisBand}`}>{bandLabel[p.angular.pelvisBand]}</span>
        </div>
        <div className="compare-stat">
          <span className="lbl">Trunk 회전속도 (°/s)</span>
          <span className="val">{p.angular.trunk}</span>
          <span className={`band ${p.angular.trunkBand}`}>{bandLabel[p.angular.trunkBand]}</span>
        </div>
        <div className="compare-stat">
          <span className="lbl">Arm 회전속도 (°/s)</span>
          <span className="val">{p.angular.arm}</span>
          <span className={`band ${p.angular.armBand}`}>{bandLabel[p.angular.armBand]}</span>
        </div>
        <div className="compare-stat">
          <span className="lbl">Pelvis→Trunk gain</span>
          <span className="val">{p.energy.etiPT.toFixed(2)}</span>
          <span className={`band ${p.energy.etiPT >= 1.3 ? 'high' : p.energy.etiPT >= 1.1 ? 'mid' : 'low'}`}>
            {p.energy.etiPT >= 1.3 ? '상위' : p.energy.etiPT >= 1.1 ? '범위' : '미만'}
          </span>
        </div>
        <div className="compare-stat">
          <span className="lbl">Trunk→Arm gain (ETI)</span>
          <span className="val">{p.energy.etiTA.toFixed(2)}</span>
          <span className={`band ${taLeak ? 'low' : 'high'}`}>{taLeak ? '미만' : '상위'}</span>
        </div>
        <div className="compare-stat">
          <span className="lbl">Max Layback (°)</span>
          <span className="val">{p.layback.deg.toFixed(1)}</span>
          <span className={`band ${p.layback.band}`}>{bandLabel[p.layback.band]}</span>
        </div>
        <div className="compare-stat">
          <span className="lbl">P→T lag (ms)</span>
          <span className="val">{p.sequence.g1}</span>
          <span className={`band ${p.sequence.g1 >= 30 && p.sequence.g1 <= 60 ? 'high' : 'mid'}`}>
            {p.sequence.g1 >= 30 && p.sequence.g1 <= 60 ? '정상' : '범위'}
          </span>
        </div>
        <div className="compare-stat">
          <span className="lbl">T→A lag (ms)</span>
          <span className="val">{p.sequence.g2}</span>
          <span className={`band ${p.sequence.g2 >= 30 && p.sequence.g2 <= 70 ? 'high' : 'mid'}`}>
            {p.sequence.g2 >= 30 && p.sequence.g2 <= 70 ? '정상' : '범위'}
          </span>
        </div>

        {/* === ③ 제구 관련 메카닉스 (7대 요인) === */}
        <div style={sectionHeader}>③ 제구 관련 메카닉스 · 7대 요인</div>
        {p.factors && p.factors.length > 0 ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4, marginBottom: 10 }}>
            {p.factors.map((f, i) => {
              const fg = gradeColors[f.grade] || gradeColors.na;
              return (
                <div key={f.id} title={f.name + ' — ' + (f.comment || '')}
                  style={{
                    padding: '8px 4px',
                    background: fg.bg,
                    border: `1px solid ${fg.c}55`,
                    borderRadius: 4,
                    textAlign: 'center',
                  }}>
                  <div style={{ fontSize: 8.5, fontWeight: 700, color: 'var(--d-fg3)', marginBottom: 2 }}>
                    {String(i+1).padStart(2,'0')}
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 800, color: fg.c, fontFamily: 'Inter', lineHeight: 1 }}>
                    {f.grade}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div style={{ fontSize: 11, color: 'var(--d-fg3)', fontStyle: 'italic', padding: 8 }}>제구 7대 요인 데이터 없음</div>
        )}

        {/* 7대 요인 상세 (작은 표) */}
        {p.factors && p.factors.length > 0 && (
          <div style={{ marginTop: 6 }}>
            {p.factors.map((f, i) => {
              const fg = gradeColors[f.grade] || gradeColors.na;
              return (
                <div key={f.id} className="compare-stat" style={{ padding: '6px 8px' }}>
                  <span className="lbl" style={{ fontSize: 10.5 }}>{f.name}</span>
                  <span className="val" style={{ fontSize: 11 }}>—</span>
                  <span style={{
                    background: fg.c, color: '#fff', fontWeight: 700,
                    padding: '2px 8px', borderRadius: 4, fontSize: 10, fontFamily: 'Inter',
                  }}>{f.grade}</span>
                </div>
              );
            })}
          </div>
        )}

        {/* === Core Issue === */}
        <div style={{ marginTop: 16, padding: 12, borderRadius: 8, background: 'var(--d-surface-3)', border: '1px solid var(--d-border)' }}>
          <div style={{ fontSize: 10, color: 'var(--d-fg3)', fontFamily: 'Inter', letterSpacing: 1.5, fontWeight: 700, textTransform: 'uppercase', marginBottom: 6 }}>Core Issue</div>
          <div style={{ fontSize: 13, color: 'var(--d-fg1)', fontWeight: 600, lineHeight: 1.5 }}>{p.coreIssue}</div>
        </div>
      </div>
    </div>
  );
}

function CompareSummary({ left, right }) {
  if (!left || !right) return null;
  
  const GRADE_PT = { A: 4, B: 3, C: 2, D: 1, na: 2.5 };
  const ARROW = ' → ';
  
  // 색상 팔레트
  const C = {
    a: '#60a5fa',   // 선수 A 색
    b: '#fbbf24',   // 선수 B 색
    pos: '#4ade80', // 우월
    neg: '#f87171', // 약점
    neu: 'var(--d-fg2)',
  };
  
  // === 데이터 분석 ===
  
  // 1. 구속 비교
  const velDiff = left.velocity - right.velocity;
  const velAvgDiff = left.velocityAvg - right.velocityAvg;
  
  // 2. 체력 비교 (CMJ, IMTP, RSI)
  const cmpPhys = (a, b) => {
    if (a == null || b == null || a === '—' || b === '—') return null;
    return Number(a) - Number(b);
  };
  const cmjDiff = cmpPhys(left.physical.cmjPower.cmj, right.physical.cmjPower.cmj);
  const imtpDiff = cmpPhys(left.physical.maxStrength.perKg, right.physical.maxStrength.perKg);
  const rsiDiff = cmpPhys(left.physical.reactive.cmj, right.physical.reactive.cmj);
  const gripDiff = cmpPhys(left.physical.release.value, right.physical.release.value);
  
  // 체력 우세도 카운트
  const physWinL = [cmjDiff, imtpDiff, rsiDiff, gripDiff].filter(d => d !== null && d > 0).length;
  const physWinR = [cmjDiff, imtpDiff, rsiDiff, gripDiff].filter(d => d !== null && d < 0).length;
  
  // 3. 메카닉스 비교
  const armDiff = left.angular.arm - right.angular.arm;
  const trunkDiff = left.angular.trunk - right.angular.trunk;
  const pelvisDiff = left.angular.pelvis - right.angular.pelvis;
  const etiTaDiff = left.energy.etiTA - right.energy.etiTA;
  const laybackDiff = left.layback.deg - right.layback.deg;
  
  // 4. 제구 비교
  const strikeDiff = (left.command?.strikePct || 0) - (right.command?.strikePct || 0);
  const leftGrade = left.command?.grade || 'na';
  const rightGrade = right.command?.grade || 'na';
  
  // 5. 7대 요인 등급 비교 + 종합 점수
  const leftFactors = left.factors || [];
  const rightFactors = right.factors || [];
  const leftAvgPt = leftFactors.length ? leftFactors.reduce((s, f) => s + GRADE_PT[f.grade], 0) / leftFactors.length : 0;
  const rightAvgPt = rightFactors.length ? rightFactors.reduce((s, f) => s + GRADE_PT[f.grade], 0) / rightFactors.length : 0;
  
  // 7대 요인 칸별 우세
  const factorWins = leftFactors.map((lf, i) => {
    const rf = rightFactors[i];
    if (!rf) return 'tie';
    const ld = GRADE_PT[lf.grade];
    const rd = GRADE_PT[rf.grade];
    if (ld > rd) return 'L';
    if (rd > ld) return 'R';
    return 'tie';
  });
  const factorWinL = factorWins.filter(w => w === 'L').length;
  const factorWinR = factorWins.filter(w => w === 'R').length;
  
  // === 자연어 요약 생성 ===
  
  // 헤드라인
  const headline = (() => {
    if (Math.abs(velDiff) >= 5 && Math.abs(strikeDiff) >= 8) {
      // 구속/제구 모두 차이
      const velSup = velDiff > 0 ? left.name : right.name;
      const strikeSup = strikeDiff > 0 ? left.name : right.name;
      if (velSup === strikeSup) {
        return `${velSup}이(가) 구속과 제구 모두에서 우위`;
      } else {
        return `${velSup}은(는) 구속에서, ${strikeSup}은(는) 제구에서 우위 (트레이드오프 패턴)`;
      }
    } else if (Math.abs(velDiff) >= 5) {
      const velSup = velDiff > 0 ? left.name : right.name;
      return `${velSup}이(가) 구속에서 ${Math.abs(velDiff).toFixed(1)} km/h 우위 · 제구는 비슷`;
    } else if (Math.abs(strikeDiff) >= 8) {
      const strikeSup = strikeDiff > 0 ? left.name : right.name;
      return `구속은 비슷하나 ${strikeSup}이(가) 제구에서 분명한 우위`;
    } else {
      return `구속·제구 모두 비슷한 수준의 두 투수 비교`;
    }
  })();
  
  // 요약 섹션 1: 종합 한 줄
  const overall = (() => {
    const lc = leftAvgPt > 3.5 ? 'A급 메카닉' : leftAvgPt > 2.5 ? '안정적 메카닉' : '개선 여지 큼';
    const rc = rightAvgPt > 3.5 ? 'A급 메카닉' : rightAvgPt > 2.5 ? '안정적 메카닉' : '개선 여지 큼';
    return `${left.name} ${left.velocity.toFixed(1)}km/h · ${leftGrade} (${lc})  vs  ${right.name} ${right.velocity.toFixed(1)}km/h · ${rightGrade} (${rc})`;
  })();
  
  // 체력 분석
  const physAnalysis = (() => {
    const items = [];
    if (cmjDiff !== null) {
      const dom = cmjDiff > 0 ? left.name : right.name;
      const mag = Math.abs(cmjDiff);
      if (mag >= 5) items.push(`CMJ 단위파워는 ${dom}이(가) ${mag.toFixed(1)} W/kg 우위`);
    }
    if (imtpDiff !== null) {
      const dom = imtpDiff > 0 ? left.name : right.name;
      const mag = Math.abs(imtpDiff);
      if (mag >= 1) items.push(`절대근력은 ${dom}이(가) ${mag.toFixed(1)} N/kg 높음`);
    }
    if (rsiDiff !== null) {
      const dom = rsiDiff > 0 ? left.name : right.name;
      const mag = Math.abs(rsiDiff);
      if (mag >= 0.05) items.push(`RSI(반응성)는 ${dom}이(가) ${mag.toFixed(2)} 높음`);
    }
    if (items.length === 0) return '두 선수의 체력 변수는 거의 비슷한 수준입니다.';
    return items.join(' · ') + '.';
  })();
  
  // 메카닉스 분석
  const mechAnalysis = (() => {
    const items = [];
    if (Math.abs(armDiff) >= 100) {
      const dom = armDiff > 0 ? left.name : right.name;
      items.push(`팔 회전속도는 ${dom}이(가) ${Math.abs(armDiff).toFixed(0)}°/s 빠름`);
    }
    if (Math.abs(trunkDiff) >= 80) {
      const dom = trunkDiff > 0 ? left.name : right.name;
      items.push(`몸통 회전은 ${dom}이(가) ${Math.abs(trunkDiff).toFixed(0)}°/s 빠름`);
    }
    if (Math.abs(etiTaDiff) >= 0.15) {
      const dom = etiTaDiff > 0 ? left.name : right.name;
      items.push(`Trunk→Arm 에너지 전달 효율(ETI)은 ${dom}이(가) ${Math.abs(etiTaDiff).toFixed(2)} 우월`);
    }
    if (Math.abs(laybackDiff) >= 10) {
      const dom = laybackDiff > 0 ? left.name : right.name;
      items.push(`Layback(어깨 외회전)은 ${dom}이(가) ${Math.abs(laybackDiff).toFixed(0)}° 더 큼`);
    }
    if (items.length === 0) return '구속 관련 메카닉 변수는 두 선수가 비슷한 패턴입니다.';
    return items.join(' · ') + '.';
  })();
  
  // 제구 분석 + D등급 식별 (recommendation에서도 사용)
  const lefDs = leftFactors.filter(f => f.grade === 'D');
  const rightDs = rightFactors.filter(f => f.grade === 'D');
  
  const cmdAnalysis = (() => {
    if (factorWinL + factorWinR === 0) return '제구 메카닉 데이터가 충분하지 않습니다.';
    
    const items = [];
    items.push(`7대 요인 우세 카운트: ${left.name} ${factorWinL}개 vs ${right.name} ${factorWinR}개 (동등 ${7 - factorWinL - factorWinR}개)`);
    
    if (lefDs.length > 0) {
      items.push(`${left.name} D등급 요인: ${lefDs.map(f => f.name).join(', ')}`);
    }
    if (rightDs.length > 0) {
      items.push(`${right.name} D등급 요인: ${rightDs.map(f => f.name).join(', ')}`);
    }
    return items.join(' · ') + '.';
  })();
  
  // 트레이닝 권장
  // === 두 선수 각자의 장단점 + 훈련 방향 (자동 도출) ===
  const analyzeOnePlayer = (self, other) => {
    const strengths = [];
    const weaknesses = [];
    const training = [];
    
    // === 1. 구속 (Velocity) ===
    const velSelf = self.velocity;
    const velOther = other.velocity;
    if (velSelf > velOther + 3) {
      strengths.push(`구속 ${velSelf.toFixed(1)} km/h — 비교 선수 대비 ${(velSelf - velOther).toFixed(1)} km/h 빠름`);
    } else if (velSelf < velOther - 3) {
      weaknesses.push(`구속 ${velSelf.toFixed(1)} km/h — 비교 선수 대비 ${(velOther - velSelf).toFixed(1)} km/h 부족`);
    }
    
    // === 2. 체력 (Physical) ===
    const cmpVar = (a, b, threshold = 0.05) => {
      if (a == null || b == null || a === '—' || b === '—') return 0;
      const diff = Number(a) - Number(b);
      if (Math.abs(diff) < threshold) return 0;
      return diff > 0 ? 1 : -1;
    };
    
    const physVars = [
      { name: 'CMJ 단위파워(폭발력)', s: self.physical.cmjPower.cmj, o: other.physical.cmjPower.cmj, band: self.physical.cmjPower.band, th: 3 },
      { name: '절대근력(IMTP)', s: self.physical.maxStrength.perKg, o: other.physical.maxStrength.perKg, band: self.physical.maxStrength.band, th: 1 },
      { name: '반응성(RSI-mod)', s: self.physical.reactive.cmj, o: other.physical.reactive.cmj, band: self.physical.reactive.band, th: 0.05 },
      { name: '반동활용(EUR)', s: self.physical.ssc.value, o: other.physical.ssc.value, band: self.physical.ssc.band, th: 0.05 },
      { name: '악력', s: self.physical.release.value, o: other.physical.release.value, band: self.physical.release.band, th: 2 },
    ];
    
    physVars.forEach(v => {
      const cmp = cmpVar(v.s, v.o, v.th);
      if (cmp > 0 && v.band === 'high') {
        strengths.push(`${v.name} 우수 (${v.s})`);
      } else if (v.band === 'low') {
        weaknesses.push(`${v.name} 부족 (${v.s})`);
      }
    });
    
    // === 3. 메카닉스 (구속 관련) ===
    if (self.energy.etiTA >= 1.5) {
      strengths.push(`Trunk→Arm 에너지 전달 효율 우수 (ETI ${self.energy.etiTA.toFixed(2)})`);
    } else if (self.energy.etiTA < 0.85) {
      weaknesses.push(`Trunk→Arm 에너지 누수 (ETI ${self.energy.etiTA.toFixed(2)} · 약 ${self.energy.leakPct}% 손실)`);
    }
    
    if (self.layback.band === 'high') {
      strengths.push(`Layback ${self.layback.deg.toFixed(0)}° (가속 거리 충분)`);
    } else if (self.layback.band === 'low') {
      weaknesses.push(`Layback ${self.layback.deg.toFixed(0)}° (가속 거리 부족)`);
    }
    
    if (self.angular.armBand === 'high') {
      strengths.push(`팔 회전속도 ${self.angular.arm}°/s (상위 그룹)`);
    } else if (self.angular.armBand === 'low') {
      weaknesses.push(`팔 회전속도 ${self.angular.arm}°/s (보강 필요)`);
    }
    
    // === 4. 제구 (7대 요인) ===
    const factors = self.factors || [];
    const aFactors = factors.filter(f => f.grade === 'A');
    const dFactors = factors.filter(f => f.grade === 'D');
    const cFactors = factors.filter(f => f.grade === 'C');
    
    if (aFactors.length >= 5) {
      strengths.push(`제구력 7대 요인 중 ${aFactors.length}개 A등급 (메카닉 일관성 우수)`);
    } else if (aFactors.length >= 3) {
      strengths.push(`${aFactors.map(f => f.name).join(', ')} 일관성 우수`);
    }
    
    if (dFactors.length > 0) {
      weaknesses.push(`${dFactors.map(f => f.name).join(', ')} (D등급 — 시행간 변동 큼)`);
    }
    if (cFactors.length > 0 && dFactors.length === 0) {
      weaknesses.push(`${cFactors.map(f => f.name).join(', ')} (C등급 — 보강 여지)`);
    }
    
    // === 5. 훈련 방향 도출 ===
    
    // 5-1. 폭발력/순발력 부족 → 점프·플라이오메트릭
    if (self.physical.cmjPower.band === 'low' || self.physical.reactive.band === 'low') {
      training.push({
        priority: 'HIGH',
        cat: '체력',
        what: '하체 폭발력 + 순발력 강화',
        how: 'CMJ·SJ 파워 향상 — 박스 점프, 댑스 점프, 메디신볼 던지기 등 플라이오메트릭 위주 (주 2-3회)',
      });
    }
    
    // 5-2. 절대근력 부족
    if (self.physical.maxStrength.band === 'low') {
      training.push({
        priority: 'MID',
        cat: '체력',
        what: '하체 절대근력 보강',
        how: '백스쿼트, 데드리프트, 트랩바 데드리프트 등 다관절 근력 운동 (주 2회, 80% 1RM 이상)',
      });
    }
    
    // 5-3. ETI 누수 → 메카닉 분절 시퀀스 교정
    if (self.energy.etiTA < 0.85) {
      training.push({
        priority: 'HIGH',
        cat: '메카닉',
        what: 'Trunk → Arm 에너지 전달 회복',
        how: '몸통 회전 정점 후 어깨 외회전 가속이 늦지 않도록 timing drill (Wall Drill, Towel Drill)',
      });
    }
    
    // 5-4. Layback 작음
    if (self.layback.band === 'low') {
      training.push({
        priority: 'MID',
        cat: '메카닉',
        what: '어깨 외회전 가동범위 확보',
        how: 'Sleeper Stretch, Cross-Body Stretch + Connection Ball drill로 layback 거리 확보',
      });
    }
    
    // 5-5. D등급 요인별 맞춤 처방
    dFactors.forEach(f => {
      const id = f.id;
      let drill = null;
      if (id === 'F1_landing') {
        drill = { what: '앞발 착지 위치 일정화', how: '거울 앞 미러링 + foot strike marker로 매 투구 같은 위치에 착지하도록 반복' };
      } else if (id === 'F2_separation') {
        drill = { what: '골반-몸통 분리 일관성', how: 'Hip Hinge Drill + 의식적으로 몸통 회전 늦추기 (Late Trunk Rotation cue)' };
      } else if (id === 'F3_arm_timing') {
        drill = { what: '어깨-팔 타이밍 일관화', how: 'Connection Ball drill + Plyo Ball으로 팔 동작 패턴 자동화 (주 3회)' };
      } else if (id === 'F4_knee') {
        drill = { what: '앞 무릎 안정성 (blocking) 회복', how: 'Single-Leg RDL + Single-Leg Squat + 앞다리 등척성 홀드 (주 2-3회)' };
      } else if (id === 'F5_tilt') {
        drill = { what: '몸통 기울기 일관성', how: '코어 안정성 강화 + Side Plank, Rotational Core 운동 (주 3회)' };
      } else if (id === 'F6_head') {
        drill = { what: '머리·시선 안정성 회복', how: 'Mirror Drill + 시선 고정 투구 + 호흡 통제 (가벼운 무게 던지기로 천천히 적응)' };
      } else if (id === 'F7_wrist') {
        drill = { what: '손목 정렬 일관성', how: 'Towel Drill + 슬로우 모션 릴리스 반복 + 그립 일정화' };
      }
      if (drill) {
        training.push({
          priority: 'HIGH',
          cat: '제구',
          what: drill.what,
          how: drill.how,
        });
      }
    });
    
    return {
      strengths: strengths.slice(0, 5),
      weaknesses: weaknesses.slice(0, 5),
      training: training.slice(0, 5),
    };
  };
  
  const leftAnalysis = analyzeOnePlayer(left, right);
  const rightAnalysis = analyzeOnePlayer(right, left);
  
  // === 렌더링 ===
  
  return (
    <div style={{
      marginTop: 20,
      padding: '20px 24px',
      background: 'var(--d-surface-2)',
      border: '1px solid var(--d-border)',
      borderRadius: 12,
    }}>
      {/* 헤더 */}
      <div style={{
        paddingBottom: 14,
        marginBottom: 16,
        borderBottom: '1px solid var(--d-border)',
      }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: '#93c5fd', letterSpacing: '1.5px', marginBottom: 6 }}>
          COMPARISON SUMMARY · 비교 요약
        </div>
        <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--d-fg1)', lineHeight: 1.4 }}>
          {headline}
        </div>
        <div style={{ fontSize: 12, color: 'var(--d-fg3)', marginTop: 6, fontFamily: 'Inter' }}>
          {overall}
        </div>
      </div>
      
      {/* 분석 섹션들 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 14, marginBottom: 16 }}>
        {/* 구속 차이 */}
        <div style={{ padding: '12px 14px', background: 'var(--d-surface-3)', borderRadius: 8, border: '1px solid var(--d-border)' }}>
          <div style={{ fontSize: 9.5, fontWeight: 700, color: '#93c5fd', letterSpacing: '1.2px', marginBottom: 6 }}>VELOCITY 구속</div>
          <div style={{ fontSize: 12, color: 'var(--d-fg2)', lineHeight: 1.6 }}>
            {Math.abs(velDiff) >= 1 ? (
              <>
                Peak 구속 차이: <b style={{ color: velDiff > 0 ? C.a : C.b, fontFamily: 'Inter' }}>{Math.abs(velDiff).toFixed(1)} km/h</b> ({velDiff > 0 ? left.name : right.name} 우위)
                <br/>평균 구속 차이: <span style={{ fontFamily: 'Inter' }}>{Math.abs(velAvgDiff).toFixed(1)} km/h</span>
              </>
            ) : (
              <>두 선수 구속 차이는 1 km/h 미만, 동등 수준입니다.</>
            )}
          </div>
        </div>
        
        {/* 체력 비교 */}
        <div style={{ padding: '12px 14px', background: 'var(--d-surface-3)', borderRadius: 8, border: '1px solid var(--d-border)' }}>
          <div style={{ fontSize: 9.5, fontWeight: 700, color: '#93c5fd', letterSpacing: '1.2px', marginBottom: 6 }}>① 구속 관련 체력</div>
          <div style={{ fontSize: 12, color: 'var(--d-fg2)', lineHeight: 1.6 }}>
            우세 변수 카운트: <b style={{ color: C.a, fontFamily: 'Inter' }}>{left.name} {physWinL}개</b> vs <b style={{ color: C.b, fontFamily: 'Inter' }}>{right.name} {physWinR}개</b>
            <br/>
            <span style={{ fontSize: 11, color: 'var(--d-fg3)' }}>{physAnalysis}</span>
          </div>
        </div>
        
        {/* 구속 메카닉스 */}
        <div style={{ padding: '12px 14px', background: 'var(--d-surface-3)', borderRadius: 8, border: '1px solid var(--d-border)' }}>
          <div style={{ fontSize: 9.5, fontWeight: 700, color: '#93c5fd', letterSpacing: '1.2px', marginBottom: 6 }}>② 구속 관련 메카닉스</div>
          <div style={{ fontSize: 12, color: 'var(--d-fg2)', lineHeight: 1.6 }}>
            <span style={{ fontSize: 11, color: 'var(--d-fg3)' }}>{mechAnalysis}</span>
          </div>
        </div>
        
        {/* 제구 메카닉스 */}
        <div style={{ padding: '12px 14px', background: 'var(--d-surface-3)', borderRadius: 8, border: '1px solid var(--d-border)' }}>
          <div style={{ fontSize: 9.5, fontWeight: 700, color: '#93c5fd', letterSpacing: '1.2px', marginBottom: 6 }}>③ 제구 관련 메카닉스</div>
          <div style={{ fontSize: 12, color: 'var(--d-fg2)', lineHeight: 1.6 }}>
            Strike% 차이: <b style={{ color: strikeDiff > 0 ? C.a : C.b, fontFamily: 'Inter' }}>{Math.abs(strikeDiff).toFixed(1)}%</b> ({strikeDiff > 0 ? left.name : right.name} 우위)
            <br/>
            <span style={{ fontSize: 11, color: 'var(--d-fg3)' }}>{cmdAnalysis}</span>
          </div>
        </div>
      </div>
      
      {/* 7대 요인 등급 비교 표 */}
      {leftFactors.length > 0 && rightFactors.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 9.5, fontWeight: 700, color: '#93c5fd', letterSpacing: '1.2px', marginBottom: 8 }}>7대 요인 한 눈에 비교</div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--d-border)' }}>
                  <th style={{ padding: '6px 8px', textAlign: 'left', color: 'var(--d-fg3)', fontWeight: 600, fontSize: 10 }}>요인</th>
                  <th style={{ padding: '6px 8px', textAlign: 'center', color: C.a, fontWeight: 700 }}>{left.name}</th>
                  <th style={{ padding: '6px 8px', textAlign: 'center', color: C.b, fontWeight: 700 }}>{right.name}</th>
                  <th style={{ padding: '6px 8px', textAlign: 'center', color: 'var(--d-fg3)', fontWeight: 600, fontSize: 10 }}>우세</th>
                </tr>
              </thead>
              <tbody>
                {leftFactors.map((lf, i) => {
                  const rf = rightFactors[i];
                  if (!rf) return null;
                  const lpt = GRADE_PT[lf.grade];
                  const rpt = GRADE_PT[rf.grade];
                  const winner = lpt > rpt ? 'L' : rpt > lpt ? 'R' : 'tie';
                  const gColor = (g) => g === 'A' ? '#4ade80' : g === 'B' ? '#60a5fa' : g === 'C' ? '#fbbf24' : g === 'D' ? '#f87171' : '#94a3b8';
                  return (
                    <tr key={lf.id} style={{ borderBottom: '1px solid var(--d-border)' }}>
                      <td style={{ padding: '6px 8px', color: 'var(--d-fg2)' }}>{lf.name}</td>
                      <td style={{ padding: '6px 8px', textAlign: 'center' }}>
                        <span style={{ background: gColor(lf.grade), color: '#fff', padding: '2px 8px', borderRadius: 4, fontWeight: 700, fontFamily: 'Inter', fontSize: 11 }}>{lf.grade}</span>
                      </td>
                      <td style={{ padding: '6px 8px', textAlign: 'center' }}>
                        <span style={{ background: gColor(rf.grade), color: '#fff', padding: '2px 8px', borderRadius: 4, fontWeight: 700, fontFamily: 'Inter', fontSize: 11 }}>{rf.grade}</span>
                      </td>
                      <td style={{ padding: '6px 8px', textAlign: 'center', fontSize: 11, color: winner === 'L' ? C.a : winner === 'R' ? C.b : 'var(--d-fg3)' }}>
                        {winner === 'L' ? '◀' : winner === 'R' ? '▶' : '='}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
      
      {/* === 두 선수 각자의 장단점 + 훈련 방향 === */}
      {(() => {
        const PriorityBadge = ({ priority }) => {
          const colors = {
            HIGH: { bg: '#fef2f2', border: '#fca5a5', text: '#b91c1c' },
            MID: { bg: '#fffbeb', border: '#fcd34d', text: '#b45309' },
            LOW: { bg: '#f0fdf4', border: '#86efac', text: '#15803d' },
          };
          const c = colors[priority] || colors.MID;
          return (
            <span style={{
              fontSize: 8.5, fontWeight: 700, fontFamily: 'Inter',
              padding: '1px 6px', borderRadius: 3,
              background: c.bg, color: c.text, border: `1px solid ${c.border}`,
              flexShrink: 0,
            }}>{priority}</span>
          );
        };
        
        const PlayerSummary = ({ player, analysis, accentColor }) => (
          <div style={{
            padding: '14px 16px',
            background: 'var(--d-surface-3)',
            border: '1px solid var(--d-border)',
            borderRadius: 8,
            display: 'flex', flexDirection: 'column', gap: 14,
          }}>
            {/* 선수 헤더 */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: 10,
              paddingBottom: 10, borderBottom: `2px solid ${accentColor}`,
            }}>
              <div style={{
                width: 32, height: 32, borderRadius: '50%',
                background: accentColor, color: '#fff',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontWeight: 800, fontSize: 14,
              }}>{player.name[0]}</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--d-fg1)' }}>{player.name}</div>
                <div style={{ fontSize: 10, color: 'var(--d-fg3)' }}>
                  {player.velocity.toFixed(1)} km/h · {player.command?.grade || '—'} · {player.archetype}
                </div>
              </div>
            </div>
            
            {/* 강점 */}
            <div>
              <div style={{
                fontSize: 9.5, fontWeight: 700, color: '#15803d', letterSpacing: '1.2px',
                marginBottom: 6, display: 'flex', alignItems: 'center', gap: 5,
              }}>
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#15803d" strokeWidth="2.5">
                  <path d="M5 12l5 5L20 7" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                STRENGTHS · 강점
              </div>
              {analysis.strengths.length > 0 ? (
                <ul style={{ margin: 0, paddingLeft: 16, fontSize: 11.5, color: 'var(--d-fg2)', lineHeight: 1.6 }}>
                  {analysis.strengths.map((s, i) => <li key={i} style={{ marginBottom: 3 }}>{s}</li>)}
                </ul>
              ) : (
                <div style={{ fontSize: 11, color: 'var(--d-fg3)', fontStyle: 'italic', paddingLeft: 8 }}>두드러진 강점 없음</div>
              )}
            </div>
            
            {/* 약점 */}
            <div>
              <div style={{
                fontSize: 9.5, fontWeight: 700, color: '#b91c1c', letterSpacing: '1.2px',
                marginBottom: 6, display: 'flex', alignItems: 'center', gap: 5,
              }}>
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#b91c1c" strokeWidth="2.5">
                  <path d="M12 9v4m0 3v.01M12 3l10 18H2z" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                WEAKNESSES · 약점
              </div>
              {analysis.weaknesses.length > 0 ? (
                <ul style={{ margin: 0, paddingLeft: 16, fontSize: 11.5, color: 'var(--d-fg2)', lineHeight: 1.6 }}>
                  {analysis.weaknesses.map((w, i) => <li key={i} style={{ marginBottom: 3 }}>{w}</li>)}
                </ul>
              ) : (
                <div style={{ fontSize: 11, color: 'var(--d-fg3)', fontStyle: 'italic', paddingLeft: 8 }}>뚜렷한 약점 없음</div>
              )}
            </div>
            
            {/* 훈련 방향 */}
            <div style={{ paddingTop: 10, borderTop: '1px dashed var(--d-border)' }}>
              <div style={{
                fontSize: 9.5, fontWeight: 700, color: accentColor, letterSpacing: '1.2px',
                marginBottom: 8, display: 'flex', alignItems: 'center', gap: 5,
              }}>
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke={accentColor} strokeWidth="2.5">
                  <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                TRAINING DIRECTION · 훈련 방향
              </div>
              {analysis.training.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {analysis.training.map((t, i) => (
                    <div key={i} style={{
                      padding: '8px 10px',
                      background: 'rgba(255,255,255,0.5)',
                      border: '1px solid var(--d-border)',
                      borderRadius: 6,
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                        <PriorityBadge priority={t.priority}/>
                        <span style={{ fontSize: 9, fontWeight: 700, color: 'var(--d-fg3)', letterSpacing: '0.5px' }}>
                          {t.cat}
                        </span>
                        <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--d-fg1)', flex: 1 }}>
                          {t.what}
                        </span>
                      </div>
                      <div style={{ fontSize: 10.5, color: 'var(--d-fg2)', lineHeight: 1.55, paddingLeft: 4 }}>
                        {t.how}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{
                  padding: '8px 10px', fontSize: 11, color: 'var(--d-fg3)', fontStyle: 'italic',
                  background: 'rgba(74,222,128,0.06)', borderRadius: 6, textAlign: 'center',
                }}>
                  현재 메카닉·체력 모두 양호 · 현 수준 유지 + 점진적 부하 증가
                </div>
              )}
            </div>
          </div>
        );
        
        return (
          <div>
            <div style={{
              fontSize: 11, fontWeight: 700, color: 'var(--d-fg1)', marginBottom: 10,
              display: 'flex', alignItems: 'center', gap: 8,
            }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--d-fg2)" strokeWidth="2">
                <path d="M9 11l3 3L22 4M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              <span>선수별 장단점 및 훈련 방향</span>
            </div>
            <div style={{
              display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12,
            }}>
              <PlayerSummary player={left} analysis={leftAnalysis} accentColor={C.a}/>
              <PlayerSummary player={right} analysis={rightAnalysis} accentColor={C.b}/>
            </div>
          </div>
        );
      })()}
      
      <div style={{ marginTop: 12, fontSize: 9.5, color: 'var(--d-fg3)', fontStyle: 'italic', textAlign: 'right' }}>
        본 요약은 두 선수의 데이터를 기계적으로 비교·진단한 결과입니다. 실제 코칭 적용은 영상 분석과 함께 진행하시기 바랍니다.
      </div>
    </div>
  );
}

function CompareView({ pitchers, leftId, rightId, onLeft, onRight }) {
  const left = pitchers.find(p => p.id === leftId);
  const right = pitchers.find(p => p.id === rightId);
  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">Compare Mode · 선수 비교</h1>
          <div className="page-sub">2명 동시 비교 · 체력 + 구속 메카닉스 + 제구 메카닉스 종합</div>
        </div>
      </div>
      <div className="compare-bar">
        <span className="label">A</span>
        <div className="compare-slot">
          <select value={leftId} onChange={(e) => onLeft(e.target.value)}>
            {pitchers.map(p => (
              <option key={p.id} value={p.id} disabled={p.id === rightId}>
                {p.name} · {p.velocity.toFixed(1)} km/h · {p.command?.grade || '—'}
              </option>
            ))}
          </select>
        </div>
        <span className="label" style={{ marginLeft: 12 }}>vs</span>
        <span className="label">B</span>
        <div className="compare-slot">
          <select value={rightId} onChange={(e) => onRight(e.target.value)}>
            {pitchers.map(p => (
              <option key={p.id} value={p.id} disabled={p.id === leftId}>
                {p.name} · {p.velocity.toFixed(1)} km/h · {p.command?.grade || '—'}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="compare-grid">
        {left && <CompareCol p={left}/>}
        {right && <CompareCol p={right}/>}
      </div>
      
      {/* === 비교 요약 (텍스트 기반 자동 생성) === */}
      <CompareSummary left={left} right={right}/>
    </>
  );
}

/* ---------------- APP ---------------- */
function App({ onBack }) {
  const pitchers = window.BBL_PITCHERS || [];
  // Hooks를 모든 조건문 이전에 호출 (React Hooks 규칙)
  const fallbackId = pitchers[0]?.id || 'none';
  const [activeId, setActiveId] = useState(fallbackId);
  const [mode, setMode] = useState('single');
  const [leftId, setLeftId] = useState(fallbackId);
  const [rightId, setRightId] = useState(pitchers[Math.min(1, pitchers.length - 1)]?.id || fallbackId);
  const [theme, setTheme] = useTheme();
  const [activeNav, setActiveNav] = useState('overview');
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // pitchers 비어 있으면 안내 화면
  if (!pitchers.length) {
    return (
      <div style={{
        minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: '#0a1628', color: '#e2e8f0', flexDirection: 'column', gap: 16
      }}>
        <div style={{ fontSize: 18, fontWeight: 700 }}>분석된 선수 데이터가 없습니다</div>
        {onBack && (
          <button onClick={onBack} style={{
            padding: '8px 18px', background: '#2563EB', color: '#fff', border: 'none', borderRadius: 6,
            cursor: 'pointer', fontSize: 13, fontWeight: 600
          }}>← 입력 페이지로</button>
        )}
      </div>
    );
  }
  const active = pitchers.find(p => p.id === activeId) || pitchers[0];

  const navItems = [
    { id: 'overview', label: 'Overview',     icon: Ic.home,     num: '00' },
    { id: 'physical', label: '구속 관련 체력', icon: Ic.body,     num: '01' },
    { id: 'mech',     label: '구속 관련 메카닉스', icon: Ic.motion,   num: '02' },
    { id: 'mechVars', label: '구속 변인 설명',     icon: Ic.motion,   num: '02B' },
    { id: 'kinetic',  label: '키네틱 체인 정밀',   icon: Ic.motion,   num: '05' },
    { id: 'velSyn',   label: '구속 요인 종합',     icon: Ic.star,     num: '06' },
    { id: 'command',  label: '제구 관련 메카닉스', icon: Ic.flag,     num: '03' },
    { id: 'summary',  label: '종합 평가',          icon: Ic.star,     num: 'E' },
    { id: 'sw',       label: '강점·약점',          icon: Ic.star,     num: '04' },
    { id: 'flags',    label: '체크 포인트',        icon: Ic.flag,     num: '05B' },
  ];

  // Smooth scroll to section
  const onNavSelect = (id) => {
    setActiveNav(id);
    if (id === 'overview') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    const numMap = { physical: '01', mech: '02', mechVars: '02B', command: '03', sw: '04', flags: '05B', kinetic: '05', velSyn: '06', summary: 'E' };
    const targetNum = numMap[id];
    setTimeout(() => {
      const block = document.querySelector(`.section-block[data-section-num="${targetNum}"]`);
      if (block) {
        // React 내부 state도 변경되도록 커스텀 이벤트 발송
        block.dispatchEvent(new Event('__open'));
        // open 클래스 적용 대기 후 스크롤
        setTimeout(() => {
          const y = block.getBoundingClientRect().top + window.pageYOffset - 16;
          window.scrollTo({ top: y, behavior: 'smooth' });
        }, 80);
      }
    }, 50);
  };

  return (
    <>
      <div className="scene" aria-hidden="true"/>
      <div className="dash">
        <Sidebar pitchers={pitchers} activeId={activeId} onSelect={setActiveId}
          mode={mode} onMode={setMode}
          navItems={navItems} activeNav={activeNav} onNavSelect={onNavSelect}
          isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} onBack={onBack}/>
        <div className="main">
          <DashTopBar pitcher={active} mode={mode} theme={theme} onTheme={setTheme}
            onMenu={() => setSidebarOpen(o => !o)} onBack={onBack}/>
          <div className="content">
            {mode === 'single' && active && <SinglePitcherView p={active} key={activeId}/>}
            {mode === 'compare' && (
              <CompareView pitchers={pitchers}
                leftId={leftId} rightId={rightId}
                onLeft={setLeftId} onRight={setRightId}/>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

window.BBLDashboardApp = App;
})();
