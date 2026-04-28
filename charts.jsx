/* global React */
(function () {
  'use strict';
  const { useState, useEffect, useRef, useMemo } = React;

// ----------------- Radar Chart -----------------
function RadarChart({ data }) {
  const size = 420, pad = 70;
  const cx = size/2, cy = size/2;
  const rMax = size/2 - pad;
  const n = data.length;

  // normalize each value relative to its axis: map [0..lo] to [0..0.5], [lo..hi] to [0.5..1.0], above hi saturates at ~1.15
  const norm = (axis) => {
    if (axis.value == null) return 0.15;
    const { lo, hi, value } = axis;
    if (value <= lo) return Math.max(0.15, (value / lo) * 0.55);
    if (value <= hi) return 0.55 + ((value - lo) / (hi - lo)) * 0.35;
    // above hi
    const over = (value - hi) / hi;
    return Math.min(1.12, 0.90 + over * 0.35);
  };

  const pt = (i, r) => {
    const ang = -Math.PI/2 + (i / n) * Math.PI * 2;
    return [cx + Math.cos(ang) * r * rMax, cy + Math.sin(ang) * r * rMax];
  };

  const polyPoints = data.map((d,i) => pt(i, norm(d)).join(',')).join(' ');
  const ringVals = [0.3, 0.55, 0.78, 1.0];
  const axisLines = data.map((_,i) => pt(i, 1.0));

  return (
    <svg className="chart" viewBox={`0 0 ${size} ${size}`} style={{ maxWidth: 480 }}>
      <defs>
        <radialGradient id="radarFill" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#60a5fa" stopOpacity="0.35"/>
          <stop offset="100%" stopColor="#2563EB" stopOpacity="0.25"/>
        </radialGradient>
      </defs>
      {/* rings */}
      {ringVals.map((r,i) => (
        <circle key={i} cx={cx} cy={cy} r={r*rMax}
          fill={r === 0.55 ? "rgba(148,163,184,0.04)" : "none"}
          stroke={r === 0.55 ? "rgba(239,68,68,0.28)" : r === 0.9 ? "rgba(34,197,94,0.25)" : "rgba(255,255,255,0.06)"}
          strokeDasharray={r === 0.55 || r === 0.9 ? "4 4" : "0"}
          strokeWidth={1}/>
      ))}
      {/* axes */}
      {axisLines.map(([x,y], i) => (
        <line key={i} x1={cx} y1={cy} x2={x} y2={y} stroke="rgba(255,255,255,0.08)" />
      ))}
      {/* polygon */}
      <polygon points={polyPoints}
        fill="url(#radarFill)"
        stroke="#2563EB" strokeWidth="2"
        style={{ filter: 'drop-shadow(0 0 12px rgba(37,99,235,0.4))' }}/>
      {/* dots */}
      {data.map((d, i) => {
        const [x,y] = pt(i, norm(d));
        return d.value != null ? (
          <circle key={i} cx={x} cy={y} r="5" fill="#60a5fa" stroke="#08080c" strokeWidth="2"/>
        ) : null;
      })}
      {/* axis labels */}
      {data.map((d, i) => {
        const [x, y] = pt(i, 1.22);
        return (
          <g key={i}>
            <text x={x} y={y-8} textAnchor="middle" className="label-ko">{d.label}</text>
            <text x={x} y={y+6} textAnchor="middle" className="label-en">({d.sub})</text>
            <text x={x} y={y+22} textAnchor="middle" className="value" style={{ fontSize: 14 }}>{d.display}</text>
          </g>
        );
      })}
      {/* band labels */}
      <text x={cx} y={cy - 0.55*rMax - 4} textAnchor="middle" fill="rgba(239,68,68,0.6)" fontSize="9" fontFamily="Inter">기준 미만</text>
      <text x={cx} y={cy - 0.9*rMax - 4} textAnchor="middle" fill="rgba(34,197,94,0.6)" fontSize="9" fontFamily="Inter">기준 상위</text>
    </svg>
  );
}

// ----------------- Kinematic Sequence (timeline) -----------------
function SequenceChart({ sequence }) {
  const { pelvisMs, trunkMs, armMs, g1, g2 } = sequence;
  const uid = React.useMemo(() => Math.random().toString(36).slice(2, 8), []);

  const tMin = -30, tMax = 150;
  const w = 800, h = 340;
  const padL = 24, padR = 24, padT = 30, padB = 90;
  const plotW = w - padL - padR;
  const plotH = h - padT - padB;
  const toX = (ms) => padL + ((ms - tMin) / (tMax - tMin)) * plotW;
  const toY = (v)  => padT + plotH - v * plotH;

  const segs = [
    { ko: '골반', en: 'Pelvis', peakMs: pelvisMs, amp: 0.42, color: '#4a90c2', sigma: 26 },
    { ko: '몸통', en: 'Trunk',  peakMs: trunkMs,  amp: 0.66, color: '#5db885', sigma: 24 },
    { ko: '상완', en: 'Arm',    peakMs: armMs,    amp: 0.95, color: '#e8965a', sigma: 20 },
  ];

  const sample = (peak, amp, sigma, t) => {
    const z = (t - peak) / sigma;
    return amp * Math.exp(-(z * z) / 2);
  };

  const curvePath = (peak, amp, sigma) => {
    let d = '';
    for (let t = tMin; t <= tMax; t += 2) {
      const x = toX(t).toFixed(2);
      const y = toY(sample(peak, amp, sigma, t)).toFixed(2);
      d += (d === '' ? `M ${x} ${y}` : ` L ${x} ${y}`);
    }
    return d;
  };

  const okG1 = g1 >= 30 && g1 <= 60;
  const okG2 = g2 >= 30 && g2 <= 60;

  // Δt 두 행 (stagger)
  const dtRow1Y = padT + plotH + 26;
  const dtRow2Y = padT + plotH + 58;

  return (
    <div className="energy-silhouette">
      <svg viewBox={`0 0 ${w} ${h}`} className="silhouette-svg" role="img" aria-label="키네매틱 시퀀스">
        <defs>
          <filter id={`curveGlow-${uid}`} x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="3" result="b"/>
            <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
          </filter>
          <filter id={`peakGlow-${uid}`} x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="4" result="b"/>
            <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
          </filter>
          <linearGradient id={`plotBg-${uid}`} x1="0" x2="1" y1="0" y2="0">
            <stop offset="0" stopColor="#0a1322"/>
            <stop offset="1" stopColor="#0d182b"/>
          </linearGradient>
          {segs.map((s, i) => (
            <path key={i} id={`seqCurve-${i}-${uid}`} d={curvePath(s.peakMs, s.amp, s.sigma)} fill="none"/>
          ))}
        </defs>

        {/* plot 배경 */}
        <rect x={padL} y={padT} width={plotW} height={plotH} fill={`url(#plotBg-${uid})`} rx="4"/>

        {/* 이상 Δt 띠 (30-60 ms / 60-120 ms 시각적 가이드) */}
        <rect x={toX(30)} y={padT} width={toX(60) - toX(30)} height={plotH} fill="rgba(74,222,128,0.05)"/>
        <rect x={toX(60)} y={padT} width={toX(120) - toX(60)} height={plotH} fill="rgba(74,222,128,0.04)"/>

        {/* 시각용 그리드 (숫자 라벨 없음) */}
        {[-30, 0, 30, 60, 90, 120, 150].map(t => (
          <line key={t} x1={toX(t)} x2={toX(t)} y1={padT} y2={padT + plotH}
                stroke="#1e293b" strokeWidth="1" strokeDasharray="2 4"/>
        ))}

        {/* 0 ms 기준선 (골반 피크) */}
        <line x1={toX(0)} x2={toX(0)} y1={padT} y2={padT + plotH}
              stroke="#475569" strokeWidth="1.5" strokeOpacity="0.6"/>

        {/* 곡선 + 다이나믹 (라벨 없음) */}
        {segs.map((s, i) => {
          const d = curvePath(s.peakMs, s.amp, s.sigma);
          const peakX = toX(s.peakMs);
          const peakY = toY(s.amp);
          const partDur = 2.0;
          const partDelay = -((segs.length - 1 - i) * 0.35).toFixed(2);
          return (
            <g key={i}>
              <path d={`${d} L ${toX(tMax)} ${toY(0)} L ${toX(tMin)} ${toY(0)} Z`}
                    fill={s.color} opacity="0.10"/>
              <path d={d} stroke={s.color} strokeWidth="2.6" fill="none" strokeLinecap="round"
                    style={{ filter: `url(#curveGlow-${uid})` }}/>
              <path d={d} stroke="#ffffff" strokeOpacity="0.5" strokeWidth="1.2" fill="none"
                    strokeDasharray="10 22">
                <animate attributeName="stroke-dashoffset" values="32;0" dur="1.6s" repeatCount="indefinite"/>
              </path>
              {[0, 0.5].map((offset, j) => (
                <circle key={j} r="3.2" fill={s.color} opacity="0.95"
                        style={{ filter: `url(#curveGlow-${uid})` }}>
                  <animateMotion dur={`${partDur}s`} repeatCount="indefinite"
                                 begin={`${(parseFloat(partDelay) - offset * partDur).toFixed(2)}s`}>
                    <mpath href={`#seqCurve-${i}-${uid}`}/>
                  </animateMotion>
                </circle>
              ))}
              <circle cx={peakX} cy={peakY} r="10" fill="none" stroke={s.color} strokeOpacity="0.65" strokeWidth="2">
                <animate attributeName="r" values="8;20;8" dur="1.6s" repeatCount="indefinite" begin={`${i * 0.4}s`}/>
                <animate attributeName="stroke-opacity" values="0.7;0;0.7" dur="1.6s" repeatCount="indefinite" begin={`${i * 0.4}s`}/>
              </circle>
              <circle cx={peakX} cy={peakY} r="6.5" fill={s.color} stroke="#08080c" strokeWidth="2"
                      style={{ filter: `url(#peakGlow-${uid})` }}/>
            </g>
          );
        })}

        {/* Δt 표시 (유일하게 남은 텍스트) - 2 행 stagger */}
        {[
          { x1: toX(pelvisMs), x2: toX(trunkMs), val: g1, ok: okG1, label: '골반→몸통', y: dtRow1Y },
          { x1: toX(trunkMs),  x2: toX(armMs),   val: g2, ok: okG2, label: '몸통→상완', y: dtRow2Y },
        ].map((b, i) => {
          const xmid = (b.x1 + b.x2) / 2;
          const clr = b.ok ? '#4ade80' : '#f87171';
          return (
            <g key={i}>
              <line x1={b.x1} x2={b.x1} y1={b.y - 6} y2={b.y + 6} stroke={clr} strokeWidth="2"/>
              <line x1={b.x2} x2={b.x2} y1={b.y - 6} y2={b.y + 6} stroke={clr} strokeWidth="2"/>
              <line x1={b.x1 + 2} x2={b.x2 - 2} y1={b.y} y2={b.y} stroke={clr} strokeWidth="1.8"/>
              <polygon points={`${b.x1 + 8},${b.y - 4} ${b.x1 + 2},${b.y} ${b.x1 + 8},${b.y + 4}`} fill={clr}/>
              <polygon points={`${b.x2 - 8},${b.y - 4} ${b.x2 - 2},${b.y} ${b.x2 - 8},${b.y + 4}`} fill={clr}/>
              <rect x={xmid - 64} y={b.y - 22} width="128" height="18" rx="3"
                    fill="#0b1220" stroke={clr} strokeOpacity="0.75"/>
              <text x={xmid} y={b.y - 9} textAnchor="middle" fontSize="11" fill={clr} fontWeight="700">
                Δt {b.label} {b.val} ms
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

// ----------------- Angular Velocity Bars -----------------
function AngularChart({ angular }) {
  const segs = [
    { ko: '골반', en: 'Pelvis', val: angular.pelvis, band: angular.pelvisBand, lo: 580,  hi: 640,  color: '#4a90c2', max: 700  },
    { ko: '몸통', en: 'Trunk',  val: angular.trunk,  band: angular.trunkBand,  lo: 800,  hi: 900,  color: '#5db885', max: 1000 },
    { ko: '상완', en: 'Arm',    val: angular.arm,    band: angular.armBand,    lo: 1450, hi: 1600, color: '#e8965a', max: 1700 },
  ];
  const uid = React.useMemo(() => Math.random().toString(36).slice(2, 8), []);
  const bandLabel = (b) => b === 'high' ? '기준 상위' : b === 'mid' ? '기준 범위' : '기준 미만';
  const bandClr   = (b) => b === 'high' ? '#4ade80' : b === 'mid' ? '#c8c8d8' : '#f87171';

  // 골반을 위로 올린 keypoints (pelvis 264→244, knee 12 위로)
  const K = {
    head:     [470, 100],
    neck:     [478, 138],
    rShoulder:[520, 162],
    lShoulder:[438, 158],
    rElbow:   [572, 108],
    rWrist:   [612, 72],
    ball:     [634, 60],
    lElbow:   [376, 176],
    lWrist:   [424, 220],
    pelvisR:  [506, 280],
    pelvisL:  [446, 280],
    pelvisC:  [476, 280],
    rKnee:    [556, 358],
    rAnkle:   [620, 412],
    lKnee:    [370, 384],
    lAnkle:   [332, 472],
    lToe:     [290, 474],
    rToe:     [658, 420],
  };

  // 회전 호 메타데이터 — 화살표 방향 반대 (반시계방향 sweep, sweep flag 0)
  // start/end가 이전 버전 대비 swap된 형태
  const arcs = [
    { center: [K.pelvisC[0], K.pelvisC[1] - 4], rx: 78, ry: 22, startDeg: 340, endDeg: 200,
      val: segs[0].val, max: segs[0].max, color: segs[0].color, name: 'pelvis' },
    { center: [(K.lShoulder[0]+K.rShoulder[0])/2 + 3, (K.lShoulder[1]+K.rShoulder[1])/2 + 32],
      rx: 92, ry: 28, startDeg: 340, endDeg: 200,
      val: segs[1].val, max: segs[1].max, color: segs[1].color, name: 'trunk' },
    { center: [K.rShoulder[0], K.rShoulder[1]], rx: 108, ry: 108, startDeg: 5, endDeg: 245,
      val: segs[2].val, max: segs[2].max, color: segs[2].color, name: 'arm' },
  ];

  // 반시계방향 ellipse 호 path (sweep flag = 0)
  const arcPath = (cx, cy, rx, ry, startDeg, endDeg) => {
    const sR = startDeg * Math.PI / 180;
    const eR = endDeg * Math.PI / 180;
    const x1 = cx + rx * Math.cos(sR);
    const y1 = cy + ry * Math.sin(sR);
    const x2 = cx + rx * Math.cos(eR);
    const y2 = cy + ry * Math.sin(eR);
    const sweep = ((startDeg - endDeg) + 360) % 360;
    const largeArc = sweep > 180 ? 1 : 0;
    return `M ${x1.toFixed(2)} ${y1.toFixed(2)} A ${rx} ${ry} 0 ${largeArc} 0 ${x2.toFixed(2)} ${y2.toFixed(2)}`;
  };

  // 호 끝 화살표 (반시계 sweep tangent: tx = +rx*sin(r), ty = -ry*cos(r))
  const arrowHead = (cx, cy, rx, ry, deg, size, color) => {
    const r = deg * Math.PI / 180;
    const x = cx + rx * Math.cos(r);
    const y = cy + ry * Math.sin(r);
    const tx =  rx * Math.sin(r);
    const ty = -ry * Math.cos(r);
    const tl = Math.hypot(tx, ty);
    const ux = tx / tl, uy = ty / tl;
    const nx = -uy, ny = ux;
    const tip = [x + ux * size * 0.6, y + uy * size * 0.6];
    const b1  = [x - ux * size * 0.4 + nx * size * 0.6, y - uy * size * 0.4 + ny * size * 0.6];
    const b2  = [x - ux * size * 0.4 - nx * size * 0.6, y - uy * size * 0.4 - ny * size * 0.6];
    return (
      <polygon points={`${tip[0].toFixed(1)},${tip[1].toFixed(1)} ${b1[0].toFixed(1)},${b1[1].toFixed(1)} ${b2[0].toFixed(1)},${b2[1].toFixed(1)}`} fill={color}/>
    );
  };

  const arcStroke = (val, max) => Math.max(8, Math.min(26, 8 + (val / max) * 18));
  // 빠를수록 짧은 dur (다이나믹: 0.6s ~ 1.6s)
  const animDur = (val, max) => (1.6 - (val / max) * 1.0).toFixed(2) + 's';

  return (
    <div className="energy-silhouette">
      <svg viewBox="0 0 800 520" className="silhouette-svg" role="img" aria-label="투구 실루엣 위의 분절별 최대 회전 속도">
        <defs>
          <linearGradient id={`bg-${uid}`} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor="#0b1220" stopOpacity="0"/>
            <stop offset="1" stopColor="#0b1220" stopOpacity="0.35"/>
          </linearGradient>
          {/* 시네마틱 라디얼 라이팅 */}
          <radialGradient id={`spotlight-${uid}`} cx="70%" cy="20%" r="80%">
            <stop offset="0%" stopColor="#1c2748" stopOpacity="0.6"/>
            <stop offset="60%" stopColor="#0a1322" stopOpacity="0"/>
          </radialGradient>
          {/* Mannequin shaders */}
          <radialGradient id={`mSphere-${uid}`} cx="35%" cy="30%" r="75%">
            <stop offset="0%" stopColor="#f1f5f9"/>
            <stop offset="45%" stopColor="#cbd5e1"/>
            <stop offset="85%" stopColor="#64748b"/>
            <stop offset="100%" stopColor="#334155"/>
          </radialGradient>
          <linearGradient id={`mLimb-${uid}`} x1="0" x2="1" y1="0" y2="1">
            <stop offset="0%" stopColor="#e2e8f0"/>
            <stop offset="50%" stopColor="#94a3b8"/>
            <stop offset="100%" stopColor="#475569"/>
          </linearGradient>
          <linearGradient id={`mLimbD-${uid}`} x1="0" x2="1" y1="0" y2="1">
            <stop offset="0%" stopColor="#94a3b8"/>
            <stop offset="55%" stopColor="#64748b"/>
            <stop offset="100%" stopColor="#1e293b"/>
          </linearGradient>
          <linearGradient id={`mTorso-${uid}`} x1="0" x2="1" y1="0" y2="1">
            <stop offset="0%" stopColor="#e2e8f0"/>
            <stop offset="40%" stopColor="#94a3b8"/>
            <stop offset="100%" stopColor="#334155"/>
          </linearGradient>
          <radialGradient id={`mJoint-${uid}`} cx="35%" cy="30%" r="70%">
            <stop offset="0%" stopColor="#f8fafc"/>
            <stop offset="60%" stopColor="#94a3b8"/>
            <stop offset="100%" stopColor="#334155"/>
          </radialGradient>
          <radialGradient id={`aoShadow-${uid}`} cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#000" stopOpacity="0.45"/>
            <stop offset="100%" stopColor="#000" stopOpacity="0"/>
          </radialGradient>
          {/* 강한 글로우 (다이나믹 강조) */}
          <filter id={`arcGlow-${uid}`} x="-40%" y="-40%" width="180%" height="180%">
            <feGaussianBlur stdDeviation="4.5" result="b"/>
            <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
          </filter>
          <filter id={`particleGlow-${uid}`} x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="2" result="b"/>
            <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
          </filter>
          {/* 호 path를 mpath용으로 등록 */}
          {arcs.map((a, i) => (
            <path key={i} id={`arcRef-${i}-${uid}`}
                  d={arcPath(a.center[0], a.center[1], a.rx, a.ry, a.startDeg, a.endDeg)}
                  fill="none"/>
          ))}
        </defs>

        {/* ground + 시네마틱 라이팅 */}
        <rect x="0" y="0" width="800" height="520" fill={`url(#spotlight-${uid})`}/>
        <line x1="40" y1="485" x2="760" y2="485" stroke="#2a3a5a" strokeWidth="1.5" strokeDasharray="3 6"/>
        <rect x="0" y="0" width="800" height="520" fill={`url(#bg-${uid})`}/>

        <ellipse cx={(K.lAnkle[0]+K.rAnkle[0])/2} cy="488" rx="180" ry="12" fill={`url(#aoShadow-${uid})`}/>

        {/* ---- Glove-side arm (behind body) ---- */}
        <g>
          <line x1={K.lShoulder[0]} y1={K.lShoulder[1]} x2={K.lElbow[0]} y2={K.lElbow[1]}
                stroke={`url(#mLimbD-${uid})`} strokeWidth="22" strokeLinecap="round"/>
          <circle cx={K.lElbow[0]} cy={K.lElbow[1]} r="12" fill={`url(#mJoint-${uid})`}/>
          <line x1={K.lElbow[0]} y1={K.lElbow[1]} x2={K.lWrist[0]} y2={K.lWrist[1]}
                stroke={`url(#mLimbD-${uid})`} strokeWidth="19" strokeLinecap="round"/>
          <circle cx={K.lWrist[0]} cy={K.lWrist[1]} r="13" fill={`url(#mSphere-${uid})`}/>
        </g>

        {/* ---- Back leg ---- */}
        <g>
          <line x1={K.pelvisR[0]-2} y1={K.pelvisR[1]} x2={K.rKnee[0]} y2={K.rKnee[1]}
                stroke={`url(#mLimb-${uid})`} strokeWidth="32" strokeLinecap="round"/>
          <circle cx={K.rKnee[0]} cy={K.rKnee[1]} r="15" fill={`url(#mJoint-${uid})`}/>
          <line x1={K.rKnee[0]} y1={K.rKnee[1]} x2={K.rAnkle[0]} y2={K.rAnkle[1]}
                stroke={`url(#mLimb-${uid})`} strokeWidth="24" strokeLinecap="round"/>
          <circle cx={K.rAnkle[0]} cy={K.rAnkle[1]} r="11" fill={`url(#mJoint-${uid})`}/>
          <path d={`
            M ${K.rAnkle[0]-8} ${K.rAnkle[1]+4}
            Q ${K.rAnkle[0]-4} ${K.rAnkle[1]+18} ${K.rToe[0]-6} ${K.rToe[1]+10}
            L ${K.rToe[0]+4} ${K.rToe[1]+2}
            Q ${K.rToe[0]-2} ${K.rAnkle[1]-2} ${K.rAnkle[0]+6} ${K.rAnkle[1]-4}
            Z
          `} fill={`url(#mLimb-${uid})`}/>
        </g>

        {/* ---- Front leg ---- */}
        <g>
          <line x1={K.pelvisL[0]+2} y1={K.pelvisL[1]} x2={K.lKnee[0]} y2={K.lKnee[1]}
                stroke={`url(#mLimb-${uid})`} strokeWidth="34" strokeLinecap="round"/>
          <circle cx={K.lKnee[0]} cy={K.lKnee[1]} r="17" fill={`url(#mJoint-${uid})`}/>
          <line x1={K.lKnee[0]} y1={K.lKnee[1]} x2={K.lAnkle[0]} y2={K.lAnkle[1]}
                stroke={`url(#mLimb-${uid})`} strokeWidth="26" strokeLinecap="round"/>
          <circle cx={K.lAnkle[0]} cy={K.lAnkle[1]} r="12" fill={`url(#mJoint-${uid})`}/>
          <path d={`
            M ${K.lAnkle[0]-12} ${K.lAnkle[1]+2}
            Q ${K.lToe[0]-4} ${K.lToe[1]-8} ${K.lToe[0]-12} ${K.lToe[1]+8}
            L ${K.lAnkle[0]-4} ${K.lAnkle[1]+14}
            Z
          `} fill={`url(#mLimb-${uid})`}/>
        </g>

        {/* ---- Torso ---- */}
        <line x1={K.lShoulder[0]+2} y1={K.lShoulder[1]+4}
              x2={K.rShoulder[0]-2} y2={K.rShoulder[1]+4}
              stroke={`url(#mLimb-${uid})`} strokeWidth="34" strokeLinecap="round"/>
        <path d={`
          M ${K.lShoulder[0]+4} ${K.lShoulder[1]+8}
          C ${K.lShoulder[0]-2} ${K.lShoulder[1]+50}, ${K.pelvisL[0]+2} ${K.pelvisL[1]-68}, ${K.pelvisL[0]+6} ${K.pelvisL[1]-20}
          L ${K.pelvisR[0]-6} ${K.pelvisR[1]-20}
          C ${K.pelvisR[0]-2} ${K.pelvisR[1]-68}, ${K.rShoulder[0]+2} ${K.rShoulder[1]+50}, ${K.rShoulder[0]-4} ${K.rShoulder[1]+8}
          Z
        `} fill={`url(#mTorso-${uid})`} stroke="#1e293b" strokeWidth="1.2"/>
        {/* Abdomen + 통합 hip silhouette (별도 pelvis 캡슐 없음 — 하단에서 자연스럽게 hip 폭으로 넓어짐) */}
        <path d={`
          M ${K.pelvisL[0]+6} ${K.pelvisL[1]-22}
          C ${K.pelvisL[0]+2} ${K.pelvisL[1]-12}, ${K.pelvisL[0]-2} ${K.pelvisL[1]-2}, ${K.pelvisL[0]-6} ${K.pelvisL[1]+10}
          L ${K.pelvisR[0]+6} ${K.pelvisR[1]+10}
          C ${K.pelvisR[0]+2} ${K.pelvisR[1]-2}, ${K.pelvisR[0]-2} ${K.pelvisR[1]-12}, ${K.pelvisR[0]-6} ${K.pelvisR[1]-22}
          Z
        `} fill={`url(#mTorso-${uid})`} stroke="#1e293b" strokeWidth="1"/>
        <path d={`M ${(K.lShoulder[0]+K.rShoulder[0])/2} ${(K.lShoulder[1]+K.rShoulder[1])/2 + 12}
                  L ${K.pelvisC[0]+2} ${K.pelvisC[1]-12}`}
              stroke="#334155" strokeWidth="1" strokeOpacity="0.35" fill="none"/>
        <circle cx={K.lShoulder[0]} cy={K.lShoulder[1]} r="15" fill={`url(#mJoint-${uid})`}/>
        <circle cx={K.rShoulder[0]} cy={K.rShoulder[1]} r="16" fill={`url(#mJoint-${uid})`}/>

        {/* ---- Neck + head ---- */}
        <line x1={K.neck[0]-2} y1={K.neck[1]-6} x2={K.neck[0]+2} y2={K.neck[1]+8}
              stroke={`url(#mLimb-${uid})`} strokeWidth="16" strokeLinecap="round"/>
        <circle cx={K.head[0]} cy={K.head[1]} r="28" fill={`url(#mSphere-${uid})`} stroke="#1e293b" strokeWidth="1"/>
        <path d={`M ${K.head[0]-28} ${K.head[1]-4} Q ${K.head[0]-10} ${K.head[1]+10} ${K.head[0]+22} ${K.head[1]+4}`}
              stroke="#475569" strokeWidth="1" strokeOpacity="0.4" fill="none"/>

        {/* ---- Throwing arm ---- */}
        <g>
          <line x1={K.rShoulder[0]} y1={K.rShoulder[1]} x2={K.rElbow[0]} y2={K.rElbow[1]}
                stroke={`url(#mLimb-${uid})`} strokeWidth="26" strokeLinecap="round"/>
          <circle cx={K.rElbow[0]} cy={K.rElbow[1]} r="13" fill={`url(#mJoint-${uid})`}/>
          <line x1={K.rElbow[0]} y1={K.rElbow[1]} x2={K.rWrist[0]} y2={K.rWrist[1]}
                stroke={`url(#mLimb-${uid})`} strokeWidth="20" strokeLinecap="round"/>
          <circle cx={K.rWrist[0]} cy={K.rWrist[1]} r="11" fill={`url(#mJoint-${uid})`}/>
        </g>

        {/* ---- Ball ---- */}
        <circle cx={K.ball[0]} cy={K.ball[1]} r="9" fill="#f8fafc" stroke="#1e293b" strokeWidth="1.2"/>
        <path d={`M ${K.ball[0]-6} ${K.ball[1]-3} Q ${K.ball[0]} ${K.ball[1]-8} ${K.ball[0]+6} ${K.ball[1]-3}`} stroke="#ef4444" strokeWidth="1.2" fill="none"/>
        <path d={`M ${K.ball[0]-6} ${K.ball[1]+3} Q ${K.ball[0]} ${K.ball[1]+8} ${K.ball[0]+6} ${K.ball[1]+3}`} stroke="#ef4444" strokeWidth="1.2" fill="none"/>

        {/* -------- Rotation arcs (다이나믹: 흐르는 빛 + 입자 + 펄스) -------- */}
        {arcs.map((a, i) => {
          const sw = arcStroke(a.val, a.max);
          const dur = animDur(a.val, a.max);
          const durNum = parseFloat(dur);
          const arcRef = `#arcRef-${i}-${uid}`;
          const pathD = arcPath(a.center[0], a.center[1], a.rx, a.ry, a.startDeg, a.endDeg);
          return (
            <g key={i}>
              {/* 외광 헤일로 */}
              <path d={pathD}
                    stroke={a.color} strokeOpacity="0.16" strokeWidth={sw + 14}
                    fill="none" strokeLinecap="round"
                    style={{ filter: `url(#arcGlow-${uid})` }}/>
              {/* 베이스 underlay */}
              <path d={pathD}
                    stroke={a.color} strokeOpacity="0.32" strokeWidth={sw + 4}
                    fill="none" strokeLinecap="round"/>
              {/* 메인 호 (펄스 효과) */}
              <path d={pathD}
                    stroke={a.color} strokeWidth={sw}
                    fill="none" strokeLinecap="round"
                    style={{ filter: `url(#arcGlow-${uid})` }}>
                <animate attributeName="stroke-opacity" values="0.85;1;0.85" dur={`${(durNum*1.5).toFixed(2)}s`} repeatCount="indefinite"/>
              </path>
              {/* 흐르는 빛 (dasharray 애니메이션) - 반시계방향이므로 offset 반대로 */}
              <path d={pathD}
                    stroke="#ffffff" strokeOpacity="0.55" strokeWidth={Math.max(2, sw * 0.35)}
                    fill="none" strokeLinecap="round"
                    strokeDasharray="18 26">
                <animate attributeName="stroke-dashoffset" values="0;44" dur={dur} repeatCount="indefinite"/>
              </path>
              {/* 흐르는 입자 3개 */}
              {[0, 0.33, 0.66].map((offset, j) => (
                <circle key={j} r={2.8} fill="#ffffff" opacity="0.95"
                        style={{ filter: `url(#particleGlow-${uid})` }}>
                  <animateMotion dur={dur} repeatCount="indefinite"
                                 begin={`-${(offset * durNum).toFixed(2)}s`}>
                    <mpath href={arcRef}/>
                  </animateMotion>
                </circle>
              ))}
              {/* 화살표 머리 (반대 방향) - 펄스 */}
              <g style={{ filter: `url(#arcGlow-${uid})` }}>
                {arrowHead(a.center[0], a.center[1], a.rx, a.ry, a.endDeg, sw + 8, a.color)}
                <circle cx={a.center[0] + a.rx * Math.cos(a.endDeg * Math.PI/180)}
                        cy={a.center[1] + a.ry * Math.sin(a.endDeg * Math.PI/180)}
                        r={sw * 0.55} fill={a.color} opacity="0.5">
                  <animate attributeName="r" values={`${sw*0.45};${sw*0.85};${sw*0.45}`} dur={dur} repeatCount="indefinite"/>
                  <animate attributeName="opacity" values="0.5;0.0;0.5" dur={dur} repeatCount="indefinite"/>
                </circle>
              </g>
              {/* 회전 축 점 */}
              <circle cx={a.center[0]} cy={a.center[1]} r="3.5" fill={a.color} opacity="0.9"/>
              <circle cx={a.center[0]} cy={a.center[1]} r="6" fill="none" stroke={a.color} strokeOpacity="0.4" strokeWidth="1"/>
            </g>
          );
        })}

        {/* -------- Left side label panels with leader lines -------- */}
        {segs.map((s, i) => {
          const a = arcs[i];
          const lx = 36, ly = 56 + i * 132, lw = 200, lh = 102;
          // leader: 호의 새 endDeg 근처에서 라벨로
          const lr = (a.endDeg - 25) * Math.PI / 180;
          const px = a.center[0] + a.rx * Math.cos(lr);
          const py = a.center[1] + a.ry * Math.sin(lr);
          const pct = Math.min(1, s.val / s.max);
          const loPct = s.lo / s.max;
          const hiPct = s.hi / s.max;
          const gx0 = lx + 14, gx1 = lx + lw - 14, gw = gx1 - gx0;
          const gy = ly + 64;
          return (
            <g key={i}>
              <line x1={px} y1={py} x2={lx + lw} y2={ly + lh / 2}
                    stroke={s.color} strokeWidth="1.2" strokeOpacity="0.6" strokeDasharray="2 3"/>
              <rect x={lx} y={ly} width={lw} height={lh} rx="8" fill="#0b1220" stroke={s.color} strokeOpacity="0.7"/>
              <text x={lx + 14} y={ly + 22} fontSize="10" fill={s.color} fontFamily="Inter" fontWeight="700" letterSpacing="2">{s.en.toUpperCase()}</text>
              <text x={lx + 14} y={ly + 44} fontSize="17" fill="#e2e8f0" fontWeight="700">{s.ko}</text>
              <text x={lx + lw - 14} y={ly + 44} textAnchor="end" fontSize="22" fill={s.color} fontWeight="800" fontFamily="Inter">
                {s.val}<tspan fontSize="11" fill="#94a3b8" fontWeight="500"> °/s</tspan>
              </text>
              <line x1={gx0} y1={gy} x2={gx1} y2={gy} stroke="#1e293b" strokeWidth="3" strokeLinecap="round"/>
              <line x1={gx0 + loPct * gw} y1={gy} x2={gx0 + hiPct * gw} y2={gy}
                    stroke="rgba(148,163,184,0.5)" strokeWidth="3" strokeLinecap="round"/>
              <circle cx={gx0 + pct * gw} cy={gy} r="5" fill={s.color} stroke="#0b1220" strokeWidth="1.5"/>
              <rect x={lx + 14} y={ly + 76} width="68" height="18" rx="3"
                    fill="rgba(8,8,12,0.6)" stroke={bandClr(s.band)} strokeWidth="1"/>
              <text x={lx + 48} y={ly + 89} textAnchor="middle" fontSize="11" fill={bandClr(s.band)} fontWeight="700">{bandLabel(s.band)}</text>
              <text x={lx + lw - 14} y={ly + 89} textAnchor="end" fontSize="10" fill="#94a3b8" fontFamily="Inter">기준 {s.lo}–{s.hi}</text>
            </g>
          );
        })}
      </svg>

      <div className="silhouette-legend">
        <div className="leg-item"><span className="dot" style={{ background: '#4a90c2' }}/>골반 회전 — 하체 회전 시작점</div>
        <div className="leg-item"><span className="dot" style={{ background: '#5db885' }}/>몸통 회전 — 골반 → 몸통 가속 (이상 ×1.3+)</div>
        <div className="leg-item"><span className="dot" style={{ background: '#e8965a' }}/>상완 회전 — 채찍 끝 가속 (이상 ×1.7+)</div>
        <div className="leg-item note">호의 두께 = 회전 속도 비례 · 흐르는 입자 속도 = 분절 회전 속도 비례 · 화살표 = 회전 방향</div>
      </div>
    </div>
  );
}

// ----------------- Energy flow (pitcher silhouette overlay) -----------------
function EnergyFlow({ energy }) {
  const { etiPT, etiTA, leakPct } = energy;
  const ptLeak = false;
  const taLeak = etiTA < 0.85;
  const uid = React.useMemo(() => Math.random().toString(36).slice(2, 8), []);

  // Silhouette keypoints — 3D mannequin, release-just-before pose
  // RHP viewed from 1루 side. Front foot planted with DEEP knee flexion (~95°).
  const K = {
    head:     [470, 100],
    neck:     [478, 138],
    rShoulder:[520, 162],
    lShoulder:[438, 158],
    rElbow:   [572, 108],
    rWrist:   [612, 72],
    ball:     [634, 60],
    lElbow:   [376, 176],
    lWrist:   [424, 220],
    pelvisR:  [506, 280],
    pelvisL:  [446, 280],
    pelvisC:  [476, 280],
    rKnee:    [556, 358],   // back leg driving
    rAnkle:   [620, 412],
    lKnee:    [370, 384],   // FRONT knee bent more (forward + down)
    lAnkle:   [332, 472],   // front foot planted
    lToe:     [290, 474],
    rToe:     [658, 420],
  };

  const L = (a, b, w=14, stroke='#1b2740') => (
    <line x1={K[a][0]} y1={K[a][1]} x2={K[b][0]} y2={K[b][1]} stroke={stroke} strokeWidth={w} strokeLinecap="round"/>
  );

  // Energy path: FRONT ankle (braced) → front knee → pelvis center → trunk (neck) → shoulder → elbow → wrist → ball
  const energyPath = `
    M ${K.lAnkle[0]} ${K.lAnkle[1]}
    L ${K.lKnee[0]} ${K.lKnee[1]}
    L ${K.pelvisC[0]} ${K.pelvisC[1]}
    L ${K.neck[0]} ${K.neck[1] + 5}
    L ${K.rShoulder[0]} ${K.rShoulder[1]}
    L ${K.rElbow[0]} ${K.rElbow[1]}
    L ${K.rWrist[0]} ${K.rWrist[1]}
    L ${K.ball[0]} ${K.ball[1]}
  `;

  // Approximate path lengths (for color stop placement on the gradient-along-path)
  // We'll split into 3 stages for coloring: leg→pelvis (drive), pelvis→trunk (PT), trunk→ball (TA)
  // Stage stops: ~0–28% drive, 28–55% PT, 55–100% TA

  return (
    <div className="energy-silhouette">
      <svg viewBox="0 0 800 520" className="silhouette-svg" role="img" aria-label="투구 실루엣 위의 에너지 전달 경로">
        <defs>
          {/* Background gradient subtle */}
          <linearGradient id={`bg-${uid}`} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor="#0b1220" stopOpacity="0"/>
            <stop offset="1" stopColor="#0b1220" stopOpacity="0.35"/>
          </linearGradient>
          {/* Energy pipe gradient along path */}
          <linearGradient id={`energy-${uid}`} gradientUnits="userSpaceOnUse"
            x1={K.lAnkle[0]} y1={K.lAnkle[1]} x2={K.ball[0]} y2={K.ball[1]}>
            <stop offset="0%"   stopColor="#22d3ee"/>
            <stop offset="28%"  stopColor="#60a5fa"/>
            <stop offset="55%"  stopColor={taLeak ? '#f59e0b' : '#2563EB'}/>
            <stop offset="85%"  stopColor={taLeak ? '#ef4444' : '#1d4ed8'}/>
            <stop offset="100%" stopColor={taLeak ? '#7f1d1d' : '#1e3a8a'}/>
          </linearGradient>
          {/* Glow */}
          <filter id={`glow-${uid}`} x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="3" result="b"/>
            <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
          </filter>
          {/* Leak burst */}
          <radialGradient id={`leak-${uid}`}>
            <stop offset="0%" stopColor="#fee2e2" stopOpacity="0.95"/>
            <stop offset="40%" stopColor="#ef4444" stopOpacity="0.7"/>
            <stop offset="100%" stopColor="#7f1d1d" stopOpacity="0"/>
          </radialGradient>

          {/* ---- 3D Mannequin shaders ---- */}
          {/* Head / sphere shader */}
          <radialGradient id={`mSphere-${uid}`} cx="35%" cy="30%" r="75%">
            <stop offset="0%" stopColor="#f1f5f9"/>
            <stop offset="45%" stopColor="#cbd5e1"/>
            <stop offset="85%" stopColor="#64748b"/>
            <stop offset="100%" stopColor="#334155"/>
          </radialGradient>
          {/* Limb shader — linear top-light */}
          <linearGradient id={`mLimb-${uid}`} x1="0" x2="1" y1="0" y2="1">
            <stop offset="0%" stopColor="#e2e8f0"/>
            <stop offset="50%" stopColor="#94a3b8"/>
            <stop offset="100%" stopColor="#475569"/>
          </linearGradient>
          {/* Limb shader — darker for back/shadow-side limbs */}
          <linearGradient id={`mLimbD-${uid}`} x1="0" x2="1" y1="0" y2="1">
            <stop offset="0%" stopColor="#94a3b8"/>
            <stop offset="55%" stopColor="#64748b"/>
            <stop offset="100%" stopColor="#1e293b"/>
          </linearGradient>
          {/* Torso shader */}
          <linearGradient id={`mTorso-${uid}`} x1="0" x2="1" y1="0" y2="1">
            <stop offset="0%" stopColor="#e2e8f0"/>
            <stop offset="40%" stopColor="#94a3b8"/>
            <stop offset="100%" stopColor="#334155"/>
          </linearGradient>
          {/* Joint shader */}
          <radialGradient id={`mJoint-${uid}`} cx="35%" cy="30%" r="70%">
            <stop offset="0%" stopColor="#f8fafc"/>
            <stop offset="60%" stopColor="#94a3b8"/>
            <stop offset="100%" stopColor="#334155"/>
          </radialGradient>
          {/* Soft ambient occlusion shadow under figure */}
          <radialGradient id={`aoShadow-${uid}`} cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#000" stopOpacity="0.45"/>
            <stop offset="100%" stopColor="#000" stopOpacity="0"/>
          </radialGradient>
        </defs>

        {/* ground */}
        <line x1="40" y1="485" x2="760" y2="485" stroke="#2a3a5a" strokeWidth="1.5" strokeDasharray="3 6"/>
        <rect x="0" y="0" width="800" height="520" fill={`url(#bg-${uid})`}/>

        {/* -------- 3D Mannequin figure -------- */}
        {/* Ground shadow (AO) */}
        <ellipse cx={(K.lAnkle[0]+K.rAnkle[0])/2} cy="488" rx="180" ry="12" fill={`url(#aoShadow-${uid})`}/>

        {/* ---- Glove-side arm (behind body) ---- */}
        <g>
          {/* upper arm */}
          <line x1={K.lShoulder[0]} y1={K.lShoulder[1]} x2={K.lElbow[0]} y2={K.lElbow[1]}
                stroke={`url(#mLimbD-${uid})`} strokeWidth="22" strokeLinecap="round"/>
          {/* elbow joint */}
          <circle cx={K.lElbow[0]} cy={K.lElbow[1]} r="12" fill={`url(#mJoint-${uid})`}/>
          {/* forearm */}
          <line x1={K.lElbow[0]} y1={K.lElbow[1]} x2={K.lWrist[0]} y2={K.lWrist[1]}
                stroke={`url(#mLimbD-${uid})`} strokeWidth="19" strokeLinecap="round"/>
          {/* wrist/hand sphere (glove-side fist) */}
          <circle cx={K.lWrist[0]} cy={K.lWrist[1]} r="13" fill={`url(#mSphere-${uid})`}/>
        </g>

        {/* ---- Back leg (drive leg) ---- */}
        <g>
          {/* thigh */}
          <line x1={K.pelvisR[0]-2} y1={K.pelvisR[1]} x2={K.rKnee[0]} y2={K.rKnee[1]}
                stroke={`url(#mLimb-${uid})`} strokeWidth="32" strokeLinecap="round"/>
          {/* knee */}
          <circle cx={K.rKnee[0]} cy={K.rKnee[1]} r="15" fill={`url(#mJoint-${uid})`}/>
          {/* shin */}
          <line x1={K.rKnee[0]} y1={K.rKnee[1]} x2={K.rAnkle[0]} y2={K.rAnkle[1]}
                stroke={`url(#mLimb-${uid})`} strokeWidth="24" strokeLinecap="round"/>
          {/* ankle */}
          <circle cx={K.rAnkle[0]} cy={K.rAnkle[1]} r="11" fill={`url(#mJoint-${uid})`}/>
          {/* foot */}
          <path d={`
            M ${K.rAnkle[0]-8} ${K.rAnkle[1]+4}
            Q ${K.rAnkle[0]-4} ${K.rAnkle[1]+18} ${K.rToe[0]-6} ${K.rToe[1]+10}
            L ${K.rToe[0]+4} ${K.rToe[1]+2}
            Q ${K.rToe[0]-2} ${K.rAnkle[1]-2} ${K.rAnkle[0]+6} ${K.rAnkle[1]-4}
            Z
          `} fill={`url(#mLimb-${uid})`}/>
        </g>

        {/* ---- Front leg (braced, DEEP knee flexion) ---- */}
        <g>
          {/* thigh */}
          <line x1={K.pelvisL[0]+2} y1={K.pelvisL[1]} x2={K.lKnee[0]} y2={K.lKnee[1]}
                stroke={`url(#mLimb-${uid})`} strokeWidth="34" strokeLinecap="round"/>
          {/* knee (prominent) */}
          <circle cx={K.lKnee[0]} cy={K.lKnee[1]} r="17" fill={`url(#mJoint-${uid})`}/>
          {/* shin */}
          <line x1={K.lKnee[0]} y1={K.lKnee[1]} x2={K.lAnkle[0]} y2={K.lAnkle[1]}
                stroke={`url(#mLimb-${uid})`} strokeWidth="26" strokeLinecap="round"/>
          {/* ankle */}
          <circle cx={K.lAnkle[0]} cy={K.lAnkle[1]} r="12" fill={`url(#mJoint-${uid})`}/>
          {/* planted foot */}
          <path d={`
            M ${K.lAnkle[0]-12} ${K.lAnkle[1]+2}
            Q ${K.lToe[0]-4} ${K.lToe[1]-8} ${K.lToe[0]-12} ${K.lToe[1]+8}
            L ${K.lAnkle[0]-4} ${K.lAnkle[1]+14}
            Z
          `} fill={`url(#mLimb-${uid})`}/>
        </g>

        {/* ---- Torso (3D mannequin — smooth anatomical shape) ---- */}
        {/* Shoulder yoke: capsule between shoulders to anchor the trapezius line */}
        <line x1={K.lShoulder[0]+2} y1={K.lShoulder[1]+4}
              x2={K.rShoulder[0]-2} y2={K.rShoulder[1]+4}
              stroke={`url(#mLimb-${uid})`} strokeWidth="34" strokeLinecap="round"/>

        {/* Ribcage (chest) — inverted trapezoid, broader at shoulders */}
        <path d={`
          M ${K.lShoulder[0]+4} ${K.lShoulder[1]+8}
          C ${K.lShoulder[0]-2} ${K.lShoulder[1]+50}, ${K.pelvisL[0]+2} ${K.pelvisL[1]-68}, ${K.pelvisL[0]+6} ${K.pelvisL[1]-20}
          L ${K.pelvisR[0]-6} ${K.pelvisR[1]-20}
          C ${K.pelvisR[0]-2} ${K.pelvisR[1]-68}, ${K.rShoulder[0]+2} ${K.rShoulder[1]+50}, ${K.rShoulder[0]-4} ${K.rShoulder[1]+8}
          Z
        `} fill={`url(#mTorso-${uid})`} stroke="#1e293b" strokeWidth="1.2"/>

        {/* Abdomen / waist — narrower band connecting ribcage to pelvis */}
        {/* Abdomen + 통합 hip silhouette (별도 pelvis 캡슐 없음 — 하단에서 자연스럽게 hip 폭으로 넓어짐) */}
        <path d={`
          M ${K.pelvisL[0]+6} ${K.pelvisL[1]-22}
          C ${K.pelvisL[0]+2} ${K.pelvisL[1]-12}, ${K.pelvisL[0]-2} ${K.pelvisL[1]-2}, ${K.pelvisL[0]-6} ${K.pelvisL[1]+10}
          L ${K.pelvisR[0]+6} ${K.pelvisR[1]+10}
          C ${K.pelvisR[0]+2} ${K.pelvisR[1]-2}, ${K.pelvisR[0]-2} ${K.pelvisR[1]-12}, ${K.pelvisR[0]-6} ${K.pelvisR[1]-22}
          Z
        `} fill={`url(#mTorso-${uid})`} stroke="#1e293b" strokeWidth="1"/>

        {/* Pelvis/hip block — rounded capsule */}

        {/* Sternum center-line (subtle 3D split) */}
        <path d={`M ${(K.lShoulder[0]+K.rShoulder[0])/2} ${(K.lShoulder[1]+K.rShoulder[1])/2 + 12}
                  L ${K.pelvisC[0]+2} ${K.pelvisC[1]-12}`}
              stroke="#334155" strokeWidth="1" strokeOpacity="0.35" fill="none"/>

        {/* Shoulder joints (caps) — spheres over the yoke */}
        <circle cx={K.lShoulder[0]} cy={K.lShoulder[1]} r="15" fill={`url(#mJoint-${uid})`}/>
        <circle cx={K.rShoulder[0]} cy={K.rShoulder[1]} r="16" fill={`url(#mJoint-${uid})`}/>

        {/* ---- Neck + head (featureless mannequin sphere) ---- */}
        <line x1={K.neck[0]-2} y1={K.neck[1]-6} x2={K.neck[0]+2} y2={K.neck[1]+8}
              stroke={`url(#mLimb-${uid})`} strokeWidth="16" strokeLinecap="round"/>
        <circle cx={K.head[0]} cy={K.head[1]} r="28" fill={`url(#mSphere-${uid})`} stroke="#1e293b" strokeWidth="1"/>
        {/* subtle head facet line (shows orientation toward batter) */}
        <path d={`M ${K.head[0]-28} ${K.head[1]-4} Q ${K.head[0]-10} ${K.head[1]+10} ${K.head[0]+22} ${K.head[1]+4}`}
              stroke="#475569" strokeWidth="1" strokeOpacity="0.4" fill="none"/>

        {/* ---- Throwing arm (front) ---- */}
        <g>
          {/* upper arm */}
          <line x1={K.rShoulder[0]} y1={K.rShoulder[1]} x2={K.rElbow[0]} y2={K.rElbow[1]}
                stroke={`url(#mLimb-${uid})`} strokeWidth="26" strokeLinecap="round"/>
          {/* elbow */}
          <circle cx={K.rElbow[0]} cy={K.rElbow[1]} r="13" fill={`url(#mJoint-${uid})`}/>
          {/* forearm */}
          <line x1={K.rElbow[0]} y1={K.rElbow[1]} x2={K.rWrist[0]} y2={K.rWrist[1]}
                stroke={`url(#mLimb-${uid})`} strokeWidth="20" strokeLinecap="round"/>
          {/* wrist/hand */}
          <circle cx={K.rWrist[0]} cy={K.rWrist[1]} r="11" fill={`url(#mJoint-${uid})`}/>
        </g>

        {/* ---- Ball ---- */}
        <circle cx={K.ball[0]} cy={K.ball[1]} r="9" fill="#f8fafc" stroke="#1e293b" strokeWidth="1.2"/>
        <path d={`M ${K.ball[0]-6} ${K.ball[1]-3} Q ${K.ball[0]} ${K.ball[1]-8} ${K.ball[0]+6} ${K.ball[1]-3}`} stroke="#ef4444" strokeWidth="1.2" fill="none"/>
        <path d={`M ${K.ball[0]-6} ${K.ball[1]+3} Q ${K.ball[0]} ${K.ball[1]+8} ${K.ball[0]+6} ${K.ball[1]+3}`} stroke="#ef4444" strokeWidth="1.2" fill="none"/>

        {/* -------- Energy pipe overlay -------- */}
        {/* dim underlay */}
        <path d={energyPath} stroke="#0f1a30" strokeOpacity="0.6" strokeWidth="22" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
        {/* animated flowing pipe */}
        <path d={energyPath}
              stroke={`url(#energy-${uid})`}
              strokeWidth="14"
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
              filter={`url(#glow-${uid})`}
              strokeDasharray="24 14">
          <animate attributeName="stroke-dashoffset" from="0" to="-76" dur="1.6s" repeatCount="indefinite"/>
        </path>

        {/* Leak burst at throwing shoulder if Trunk→Arm leak */}
        {taLeak && (
          <g>
            <circle cx={(K.rShoulder[0]+K.rElbow[0])/2} cy={(K.rShoulder[1]+K.rElbow[1])/2} r="38" fill={`url(#leak-${uid})`}>
              <animate attributeName="r" values="28;44;28" dur="1.2s" repeatCount="indefinite"/>
              <animate attributeName="opacity" values="0.9;0.4;0.9" dur="1.2s" repeatCount="indefinite"/>
            </circle>
            {/* escaping sparks */}
            {[0,1,2,3].map(i => (
              <circle key={i} cx={(K.rShoulder[0]+K.rElbow[0])/2} cy={(K.rShoulder[1]+K.rElbow[1])/2} r="3" fill="#fca5a5">
                <animate attributeName="cx" values={`${(K.rShoulder[0]+K.rElbow[0])/2};${(K.rShoulder[0]+K.rElbow[0])/2 + 30 + i*8}`} dur={`${1.2+i*0.2}s`} repeatCount="indefinite"/>
                <animate attributeName="cy" values={`${(K.rShoulder[1]+K.rElbow[1])/2};${(K.rShoulder[1]+K.rElbow[1])/2 - 20 - i*6}`} dur={`${1.2+i*0.2}s`} repeatCount="indefinite"/>
                <animate attributeName="opacity" values="1;0" dur={`${1.2+i*0.2}s`} repeatCount="indefinite"/>
              </circle>
            ))}
          </g>
        )}

        {/* -------- Annotations -------- */}
        {/* Stage 1: front foot block (energy starts here) */}
        <g className="anno">
          <line x1={K.lAnkle[0]-6} y1={K.lAnkle[1]-14} x2="150" y2="430" stroke="#22d3ee" strokeWidth="1.2" strokeDasharray="2 3"/>
          <rect x="42" y="412" width="176" height="44" rx="6" fill="#0b1220" stroke="#22d3ee" strokeOpacity="0.55"/>
          <text x="130" y="428" fill="#22d3ee" fontSize="10" fontFamily="Inter" fontWeight="700" textAnchor="middle" letterSpacing="1">FRONT-FOOT BLOCK</text>
          <text x="130" y="446" fill="#e2e8f0" fontSize="11" fontFamily="Inter" fontWeight="600" textAnchor="middle">지면 반력 · 에너지 시작</text>
        </g>

        {/* Stage 2: Pelvis→Trunk */}
        <g className="anno">
          <line x1={K.pelvisC[0]-20} y1={K.pelvisC[1]-10} x2="150" y2="280" stroke={ptLeak ? '#ef4444' : '#60a5fa'} strokeWidth="1.2" strokeDasharray="2 3"/>
          <rect x="42" y="252" width="176" height="52" rx="6" fill="#0b1220" stroke={ptLeak ? '#ef4444' : '#60a5fa'} strokeOpacity="0.6"/>
          <text x="130" y="268" fill={ptLeak ? '#ef4444' : '#60a5fa'} fontSize="10" fontFamily="Inter" fontWeight="700" textAnchor="middle" letterSpacing="1">PELVIS → TRUNK</text>
          <text x="130" y="284" fill="#e2e8f0" fontSize="13" fontFamily="Inter" fontWeight="700" textAnchor="middle">ETI {etiPT.toFixed(2)}</text>
          <text x="130" y="298" fill="#94a3b8" fontSize="10" fontFamily="Inter" textAnchor="middle">{ptLeak ? '누수 감지' : '정상 전달'}</text>
        </g>

        {/* Stage 3: Trunk→Arm */}
        <g className="anno">
          <line x1={K.rShoulder[0]+12} y1={K.rShoulder[1]-4} x2="700" y2="140" stroke={taLeak ? '#ef4444' : '#2563EB'} strokeWidth="1.2" strokeDasharray="2 3"/>
          <rect x="592" y="110" width="180" height="60" rx="6" fill="#0b1220" stroke={taLeak ? '#ef4444' : '#2563EB'} strokeOpacity="0.7"/>
          <text x="682" y="126" fill={taLeak ? '#ef4444' : '#2563EB'} fontSize="10" fontFamily="Inter" fontWeight="700" textAnchor="middle" letterSpacing="1">TRUNK → ARM</text>
          <text x="682" y="144" fill="#e2e8f0" fontSize="15" fontFamily="Inter" fontWeight="800" textAnchor="middle">ETI {etiTA.toFixed(2)}</text>
          <text x="682" y="160" fill={taLeak ? '#fca5a5' : '#94a3b8'} fontSize="10" fontFamily="Inter" fontWeight={taLeak ? 700 : 400} textAnchor="middle">
            {taLeak ? `⚠ 누수 ${leakPct}% · 어깨 부하↑` : '정상 전달'}
          </text>
        </g>

      </svg>

      <div className="silhouette-legend">
        <div className="leg-item"><span className="dot" style={{ background: 'linear-gradient(90deg,#22d3ee,#2563EB)' }}/>에너지 흐름 (발 → 골반 → 몸통 → 팔 → 공)</div>
        <div className="leg-item"><span className="dot" style={{ background: '#ef4444' }}/>누수 지점 · 어깨/팔꿈치 부하 증가</div>
        <div className="leg-item note">ETI 1.0 근처 = 거의 전부 전달 · 0.85 미만 = 누수 신호</div>
      </div>
    </div>
  );
}

// ----------------- Layback meter -----------------
function LaybackMeter({ deg }) {
  // 3시 위치(오른쪽 수평) = 0°, 반시계방향 → 12시 = 90°, 9시 = 180°, 6시 = 270°
  // 상단 반원 (0° → 90° → 180°) 형태로 220°까지 표시
  const size = 300;
  const cx = size/2, cy = size * 0.78;
  const r = size * 0.38;
  const angle = Math.min(220, Math.max(0, deg));
  const toRad = (a) => (a * Math.PI) / 180;
  // 눈금 각도(degree)를 SVG 좌표 각도로. SVG 좌표에서 3시=0°, 반시계방향은 음수 방향(y축 뒤집힘)
  // 즉, 수학 좌표계 그대로 쓰되 y에 마이너스를 붙여야 반시계방향이 위쪽으로 가게 됨
  const angleToPos = (a) => {
    return [cx + Math.cos(toRad(a)) * r, cy - Math.sin(toRad(a)) * r];
  };
  const arc = (from, to, color, w = 6) => {
    const [x1,y1] = angleToPos(from), [x2,y2] = angleToPos(to);
    const large = Math.abs(to - from) > 180 ? 1 : 0;
    // 화면상 반시계방향으로 호를 그림 (SVG y축 뒤집힘 때문에 sweep=0)
    return <path d={`M ${x1} ${y1} A ${r} ${r} 0 ${large} 0 ${x2} ${y2}`} fill="none" stroke={color} strokeWidth={w} strokeLinecap="round"/>;
  };

  const [needle, setNeedle] = useState(0);
  useEffect(() => {
    const t0 = performance.now();
    const dur = 1400;
    let raf;
    const tick = (t) => {
      const k = Math.min(1, (t - t0) / dur);
      const eased = 1 - Math.pow(1 - k, 3);
      setNeedle(angle * eased);
      if (k < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [angle]);

  const [nx, ny] = angleToPos(needle);

  return (
    <svg width={size} height={size * 1.15} viewBox={`0 0 ${size} ${size * 1.15}`}>
      <defs>
        <linearGradient id="laybackG" x1="0" x2="1">
          <stop offset="0" stopColor="#2563EB"/>
          <stop offset="1" stopColor="#60a5fa"/>
        </linearGradient>
      </defs>
      {/* track */}
      {arc(0, 220, 'rgba(255,255,255,0.08)', 10)}
      {/* pro band 160-180 */}
      {arc(160, 180, 'rgba(34,197,94,0.7)', 10)}
      {/* needle arc up to current */}
      {arc(0, Math.max(1, needle), 'url(#laybackG)', 10)}
      {/* tick marks */}
      {[0,60,120,180,220].map(t => {
        const [x,y] = angleToPos(t);
        const rOut = r + 16;
        const [xo,yo] = [cx + Math.cos(toRad(t)) * rOut, cy - Math.sin(toRad(t)) * rOut];
        const [xi,yi] = [cx + Math.cos(toRad(t)) * (r-8), cy - Math.sin(toRad(t)) * (r-8)];
        return <g key={t}>
          <line x1={x} y1={y} x2={xi} y2={yi} stroke="rgba(255,255,255,0.18)"/>
          <text x={xo} y={yo + 4} textAnchor="middle" fontSize="12" fontWeight="600" fill="#cbd5e1" fontFamily="Inter">{t}°</text>
        </g>;
      })}
      {/* needle */}
      <line x1={cx} y1={cy} x2={nx} y2={ny} stroke="#fff" strokeWidth="2.5" strokeLinecap="round"/>
      <circle cx={cx} cy={cy} r="6" fill="#fff"/>
    </svg>
  );
}

window.RadarChart = RadarChart;
window.SequenceChart = SequenceChart;
window.AngularChart = AngularChart;
window.EnergyFlow = EnergyFlow;
window.LaybackMeter = LaybackMeter;
})();
