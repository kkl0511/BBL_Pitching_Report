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

// ----------------- Integrated Kinetic Diagram (files v8 통합 마네킹) -----------------
// 한 마네킹에 전신 키네틱 체인 에너지 흐름 + 5편 논문 기반 정밀 지표(elbow load eff, cocking arm power,
// transfer KE T→A, leg asymmetry, peak hip vel)를 모두 표시. dashboard에서 EnergyFlow 대체용으로 사용 가능.
// IIFE 닫기 직전에서 window.IntegratedKineticDiagram 으로 export됨.
function IntegratedKineticDiagram({ energy, precision }) {
  if (!energy && !precision) return null;
  const E = energy || {};
  const P = precision || {};
  const { etiPT, etiTA, leakPct } = E;

  // ─── v8 — 파란색(좋음) ↔ 빨간색(나쁨) 그라데이션 ───
  // 사용자 요청: "에너지 흐름이 좋으면 파란색, 안 좋으면 빨간색"
  function stageStatus(eti, eliteThr, midThr) {
    if (eti == null) return { tier: 'none', color: '#475569', dark: '#1e293b', label: '미측정' };
    if (eti >= eliteThr) return { tier: 'elite',  color: '#3b82f6', dark: '#1e40af', label: '우수' };  // 파랑
    if (eti >= midThr)   return { tier: 'mid',    color: '#a78bfa', dark: '#6d28d9', label: '보통' };  // 보라(중간)
    return                       { tier: 'leak',  color: '#ef4444', dark: '#7f1d1d', label: '누수' };  // 빨강
  }
  const ptC = stageStatus(etiPT, 1.5, 1.3);
  const taC = stageStatus(etiTA, 1.7, 1.4);
  const ptLeak = ptC.tier === 'leak';
  const taLeak = taC.tier === 'leak';
  const uid = useMemo(() => Math.random().toString(36).slice(2, 8), []);

  // Precision metrics
  const {
    elbowEff,
    cockPowerWPerKg,
    transferTA_KE,
    legAsymmetry,
    peakPivotHipVel,
    peakStrideHipVel,
    // ⭐ v8 신규 — 사용자 요청 변인 (이전 로직에서 가져옴)
    kneeCollapseDeg,    // 무릎 무너짐 (FC→BR 굴곡 변화량, 양수=무너짐)
    kneeSscMs,          // 무릎 SSC stretch→shortening 전환 시간 (ms)
    flyingOpenDeg,      // 플라잉오픈 (FC 시점 trunk rotation)
    trunkFlexAtBRDeg,   // 릴리즈 시 몸통 전방 굴곡 (°)
    trunkFlexAtFCDeg    // ⭐ v10 — FC 시점 몸통 전방 굴곡 (음수=뒤로 젖힘=좋음, 양수=앞으로 굽힘=나쁨)
  } = P;

  // 파랑 ↔ 빨강 그라데이션 (사용자 요청)
  const toneLowerBetter = (val, [eliteT, normalT, midT]) =>
    val == null ? 'none' : val < eliteT ? 'elite' : val < normalT ? 'good' : val < midT ? 'mid' : 'bad';
  const toneHigherBetter = (val, [eliteT, normalT, midT]) =>
    val == null ? 'none' : val >= eliteT ? 'elite' : val >= normalT ? 'good' : val >= midT ? 'mid' : 'bad';
  // 범위 변인 — 적정 범위 내 = elite, 가까이 = good, 멀리 = mid/bad
  const toneRange = (val, eliteRange, goodRange) => {
    if (val == null) return 'none';
    const [eLo, eHi] = eliteRange;
    if (val >= eLo && val <= eHi) return 'elite';
    const [gLo, gHi] = goodRange;
    if (val >= gLo && val <= gHi) return 'good';
    const off = Math.min(Math.abs(val - gLo), Math.abs(val - gHi));
    return off < (gHi - gLo) ? 'mid' : 'bad';
  };
  const TONES = {
    elite: { color: '#3b82f6', text: '우수' },     // 파랑 — 흐름 좋음
    good:  { color: '#60a5fa', text: '양호' },     // 옅은 파랑
    mid:   { color: '#a78bfa', text: '보통' },     // 보라
    bad:   { color: '#ef4444', text: '부족' },     // 빨강 — 흐름 나쁨
    none:  { color: '#475569', text: '미측정' }
  };
  const elbowTone    = toneLowerBetter(elbowEff,        [2.5, 3.5, 4.0]);
  const shoulderTone = toneHigherBetter(cockPowerWPerKg, [30, 22, 15]);
  const trunkTone    = toneHigherBetter(transferTA_KE,   [2.5, 1.7, 1.0]);
  const asymTone     = legAsymmetry == null ? 'none'
                     : (legAsymmetry >= 1.0 && legAsymmetry <= 2.5) ? 'good'
                     : 'mid';
  // ⭐ v8 신규 변인 톤
  // 무릎 무너짐: -15~-5° = elite(블록), -5~+5° = good, +5~+15° = mid, > +15° = bad
  const kneeCollapseTone = kneeCollapseDeg == null ? 'none'
                         : (kneeCollapseDeg >= -15 && kneeCollapseDeg <= -5) ? 'elite'
                         : (kneeCollapseDeg >= -5 && kneeCollapseDeg <= 5) ? 'good'
                         : (kneeCollapseDeg > 5 && kneeCollapseDeg <= 15) ? 'mid'
                         : 'bad';
  // SSC: < 150ms = elite, 150-200 = good, 200-250 = mid, > 250 = bad
  const kneeSscTone = toneLowerBetter(kneeSscMs, [150, 200, 250]);
  // 플라잉오픈: < 5° = elite, 5-10° = good, 10-15° = mid, > 15° = bad
  const flyingOpenTone = toneLowerBetter(flyingOpenDeg, [5, 10, 15]);
  // 몸통 전방 굴곡 (범위 변인): 35-45° = elite, 25-55° = good
  const trunkFlexTone = toneRange(trunkFlexAtBRDeg, [35, 45], [25, 55]);
  // ⭐ v10 — FC 시점 몸통 전방 굴곡: 직립 또는 약간 뒤로 젖힘이 좋음
  //   ≤ -5° (5°+ 뒤로 젖힘) = elite — 가속거리 충분히 확보
  //   -5° ~ +5° (직립) = good — 정상 자세
  //   +5° ~ +15° (살짝 앞으로) = mid — 가속거리 손실 시작
  //   > +15° (이미 앞으로 무너짐) = bad — FC 시점에 이미 굽혀짐
  const trunkFlexAtFCTone = trunkFlexAtFCDeg == null ? 'none'
    : trunkFlexAtFCDeg <= -5 ? 'elite'
    : trunkFlexAtFCDeg <= 5  ? 'good'
    : trunkFlexAtFCDeg <= 15 ? 'mid'
    : 'bad';

  // Keypoints — EnergyFlow base pose with throwing arm in late-cocking/MER
  // (matches Cornell #22 reference photo): elbow at head height, forearm
  // pointing UP, hand/ball above head with laid-back wrist.
  const K = {
    head:     [470, 115],
    neck:     [478, 153],
    trunkC:   [482, 224],   // v78 — trunk center (mid-spine, between pelvis and shoulders) for energy path
    rShoulder:[520, 177],
    lShoulder:[438, 173],
    rElbow:   [580, 177],   // horizontal upper arm (level with shoulder)
    rWrist:   [565, 100],   // forearm UP from elbow (laid back)
    ball:     [540, 80],    // ball just past wrist, above head
    lElbow:   [410, 215],   // glove arm bent, elbow tucked
    lWrist:   [455, 195],   // glove hand UP near chest level
    pelvisR:  [506, 295],
    pelvisL:  [446, 295],
    pelvisC:  [476, 295],
    rKnee:    [556, 373],
    rAnkle:   [620, 427],
    lKnee:    [370, 399],
    lAnkle:   [310, 487],   // stride foot landed forward (extended)
    lToe:     [268, 489],
    rToe:     [658, 435]
  };

  // v77 — Full kinetic chain energy path with BOTH legs:
  //   Pivot leg (back/push-off foot): rAnkle → rKnee → pelvisC
  //   Stride leg (front/landing foot): lAnkle → lKnee → pelvisC
  //   Both legs contribute to ground reaction force → pelvis rotation.
  //   From pelvis, single path: pelvis → trunk → shoulder → elbow → wrist → ball
  //
  // Biomechanical rationale (Aguinaldo 2007, Howenstein 2019):
  //   - Pivot leg drives initial pelvis rotation via push-off + ground reaction
  //   - Stride leg blocks at FC, decelerating pelvis to drive trunk rotation
  //   - Both feet act as the kinetic chain's primary energy source
  const energyPathPivotLeg = `
    M ${K.rAnkle[0]} ${K.rAnkle[1]}
    L ${K.rKnee[0]} ${K.rKnee[1]}
    L ${K.pelvisC[0]} ${K.pelvisC[1]}
  `;
  const energyPathStrideLeg = `
    M ${K.lAnkle[0]} ${K.lAnkle[1]}
    L ${K.lKnee[0]} ${K.lKnee[1]}
    L ${K.pelvisC[0]} ${K.pelvisC[1]}
  `;
  const energyPathUpperChain = `
    M ${K.pelvisC[0]} ${K.pelvisC[1]}
    L ${K.trunkC[0]} ${K.trunkC[1]}
    L ${K.rShoulder[0]} ${K.rShoulder[1]}
    L ${K.rElbow[0]} ${K.rElbow[1]}
    L ${K.rWrist[0]} ${K.rWrist[1]}
    L ${K.ball[0]} ${K.ball[1]}
  `;

  return (
    <div className="energy-silhouette">
      <svg viewBox="-140 0 1080 560" className="silhouette-svg" role="img" aria-label="키네틱 체인 통합 마네킹">
        <defs>
          <linearGradient id={`ik-bg-${uid}`} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor="#0b1220" stopOpacity="0"/>
            <stop offset="1" stopColor="#0b1220" stopOpacity="0.35"/>
          </linearGradient>
          <linearGradient id={`ik-energy-${uid}`} gradientUnits="userSpaceOnUse"
            x1={K.lAnkle[0]} y1={K.lAnkle[1]} x2={K.ball[0]} y2={K.ball[1]}>
            <stop offset="0%"   stopColor="#22d3ee"/>
            <stop offset="28%"  stopColor={ptC.color}/>
            <stop offset="55%"  stopColor={taC.color}/>
            <stop offset="85%"  stopColor={taC.color}/>
            <stop offset="100%" stopColor={taC.dark}/>
          </linearGradient>
          {/* v77 — Pivot leg gradient (back foot → pelvis): cyan ground reaction → ptC color at pelvis */}
          <linearGradient id={`ik-energy-pivot-${uid}`} gradientUnits="userSpaceOnUse"
            x1={K.rAnkle[0]} y1={K.rAnkle[1]} x2={K.pelvisC[0]} y2={K.pelvisC[1]}>
            <stop offset="0%"   stopColor="#22d3ee"/>
            <stop offset="100%" stopColor={ptC.color}/>
          </linearGradient>
          {/* v77 — Stride leg gradient (front foot → pelvis): cyan ground reaction → ptC color */}
          <linearGradient id={`ik-energy-stride-${uid}`} gradientUnits="userSpaceOnUse"
            x1={K.lAnkle[0]} y1={K.lAnkle[1]} x2={K.pelvisC[0]} y2={K.pelvisC[1]}>
            <stop offset="0%"   stopColor="#22d3ee"/>
            <stop offset="100%" stopColor={ptC.color}/>
          </linearGradient>
          {/* v77 — Upper chain gradient (pelvis → ball): ptC at pelvis through taC at arm */}
          <linearGradient id={`ik-energy-upper-${uid}`} gradientUnits="userSpaceOnUse"
            x1={K.pelvisC[0]} y1={K.pelvisC[1]} x2={K.ball[0]} y2={K.ball[1]}>
            <stop offset="0%"   stopColor={ptC.color}/>
            <stop offset="40%"  stopColor={taC.color}/>
            <stop offset="85%"  stopColor={taC.color}/>
            <stop offset="100%" stopColor={taC.dark}/>
          </linearGradient>
          <filter id={`ik-glow-${uid}`} x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="3" result="b"/>
            <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
          </filter>
          <radialGradient id={`ik-leak-${uid}`}>
            <stop offset="0%" stopColor="#fee2e2" stopOpacity="0.95"/>
            <stop offset="40%" stopColor="#ef4444" stopOpacity="0.7"/>
            <stop offset="100%" stopColor="#7f1d1d" stopOpacity="0"/>
          </radialGradient>
          <radialGradient id={`ik-mSphere-${uid}`} cx="35%" cy="30%" r="75%">
            <stop offset="0%" stopColor="#f1f5f9"/>
            <stop offset="45%" stopColor="#cbd5e1"/>
            <stop offset="85%" stopColor="#64748b"/>
            <stop offset="100%" stopColor="#334155"/>
          </radialGradient>
          <linearGradient id={`ik-mLimb-${uid}`} x1="0" x2="1" y1="0" y2="1">
            <stop offset="0%" stopColor="#e2e8f0"/>
            <stop offset="50%" stopColor="#94a3b8"/>
            <stop offset="100%" stopColor="#475569"/>
          </linearGradient>
          <linearGradient id={`ik-mLimbD-${uid}`} x1="0" x2="1" y1="0" y2="1">
            <stop offset="0%" stopColor="#94a3b8"/>
            <stop offset="55%" stopColor="#64748b"/>
            <stop offset="100%" stopColor="#1e293b"/>
          </linearGradient>
          <linearGradient id={`ik-mTorso-${uid}`} x1="0" x2="1" y1="0" y2="1">
            <stop offset="0%" stopColor="#e2e8f0"/>
            <stop offset="40%" stopColor="#94a3b8"/>
            <stop offset="100%" stopColor="#334155"/>
          </linearGradient>
          <radialGradient id={`ik-mJoint-${uid}`} cx="35%" cy="30%" r="70%">
            <stop offset="0%" stopColor="#f8fafc"/>
            <stop offset="60%" stopColor="#94a3b8"/>
            <stop offset="100%" stopColor="#334155"/>
          </radialGradient>
          <radialGradient id={`ik-aoShadow-${uid}`} cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#000" stopOpacity="0.45"/>
            <stop offset="100%" stopColor="#000" stopOpacity="0"/>
          </radialGradient>
          <marker id={`ik-arrow-${uid}`} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
            <path d="M 0 0 L 10 5 L 0 10 Z" fill="currentColor"/>
          </marker>
          <path id={`ik-armPath-${uid}`}
                d={`M ${K.rShoulder[0]} ${K.rShoulder[1]} L ${K.rElbow[0]} ${K.rElbow[1]} L ${K.rWrist[0]} ${K.rWrist[1]} L ${K.ball[0]} ${K.ball[1]}`}/>
        </defs>

        {/* Background + ground + foot shadow */}
        <rect x="0" y="0" width="800" height="560" fill={`url(#ik-bg-${uid})`}/>
        <line x1="40" y1="498" x2="760" y2="498" stroke="#2a3a5a" strokeWidth="1.5" strokeDasharray="3 6"/>
        <ellipse cx={(K.lAnkle[0] + K.rAnkle[0]) / 2} cy="508" rx="180" ry="12" fill={`url(#ik-aoShadow-${uid})`}/>

        {/* === BODY SILHOUETTE === */}
        {/* Glove-side arm (left, dark) */}
        <g>
          <line x1={K.lShoulder[0]} y1={K.lShoulder[1]} x2={K.lElbow[0]} y2={K.lElbow[1]}
                stroke={`url(#ik-mLimbD-${uid})`} strokeWidth="22" strokeLinecap="round"/>
          <circle cx={K.lElbow[0]} cy={K.lElbow[1]} r="12" fill={`url(#ik-mJoint-${uid})`}/>
          <line x1={K.lElbow[0]} y1={K.lElbow[1]} x2={K.lWrist[0]} y2={K.lWrist[1]}
                stroke={`url(#ik-mLimbD-${uid})`} strokeWidth="19" strokeLinecap="round"/>
          <circle cx={K.lWrist[0]} cy={K.lWrist[1]} r="13" fill={`url(#ik-mSphere-${uid})`}/>
        </g>

        {/* Pivot leg (right, back, dark) */}
        <g>
          <line x1={K.pelvisR[0] - 2} y1={K.pelvisR[1]} x2={K.rKnee[0]} y2={K.rKnee[1]}
                stroke={`url(#ik-mLimbD-${uid})`} strokeWidth="34" strokeLinecap="round"/>
          <circle cx={K.rKnee[0]} cy={K.rKnee[1]} r="17" fill={`url(#ik-mJoint-${uid})`}/>
          <line x1={K.rKnee[0]} y1={K.rKnee[1]} x2={K.rAnkle[0]} y2={K.rAnkle[1]}
                stroke={`url(#ik-mLimbD-${uid})`} strokeWidth="26" strokeLinecap="round"/>
          <circle cx={K.rAnkle[0]} cy={K.rAnkle[1]} r="12" fill={`url(#ik-mJoint-${uid})`}/>
        </g>

        {/* Stride leg (left, front, light) */}
        <g>
          <line x1={K.pelvisL[0] + 2} y1={K.pelvisL[1]} x2={K.lKnee[0]} y2={K.lKnee[1]}
                stroke={`url(#ik-mLimb-${uid})`} strokeWidth="34" strokeLinecap="round"/>
          <circle cx={K.lKnee[0]} cy={K.lKnee[1]} r="17" fill={`url(#ik-mJoint-${uid})`}/>
          <line x1={K.lKnee[0]} y1={K.lKnee[1]} x2={K.lAnkle[0]} y2={K.lAnkle[1]}
                stroke={`url(#ik-mLimb-${uid})`} strokeWidth="26" strokeLinecap="round"/>
          <circle cx={K.lAnkle[0]} cy={K.lAnkle[1]} r="12" fill={`url(#ik-mJoint-${uid})`}/>
        </g>

        {/* Torso */}
        <line x1={K.lShoulder[0] + 2} y1={K.lShoulder[1] + 4}
              x2={K.rShoulder[0] - 2} y2={K.rShoulder[1] + 4}
              stroke={`url(#ik-mLimb-${uid})`} strokeWidth="34" strokeLinecap="round"/>
        <path d={`
          M ${K.lShoulder[0] + 4} ${K.lShoulder[1] + 8}
          C ${K.lShoulder[0] - 2} ${K.lShoulder[1] + 50}, ${K.pelvisL[0] + 2} ${K.pelvisL[1] - 68}, ${K.pelvisL[0] + 6} ${K.pelvisL[1] - 20}
          L ${K.pelvisR[0] - 6} ${K.pelvisR[1] - 20}
          C ${K.pelvisR[0] - 2} ${K.pelvisR[1] - 68}, ${K.rShoulder[0] + 2} ${K.rShoulder[1] + 50}, ${K.rShoulder[0] - 4} ${K.rShoulder[1] + 8}
          Z
        `} fill={`url(#ik-mTorso-${uid})`} stroke="#1e293b" strokeWidth="1.2"/>
        <path d={`
          M ${K.pelvisL[0] + 6} ${K.pelvisL[1] - 22}
          C ${K.pelvisL[0] + 2} ${K.pelvisL[1] - 12}, ${K.pelvisL[0] - 2} ${K.pelvisL[1] - 2}, ${K.pelvisL[0] - 6} ${K.pelvisL[1] + 10}
          L ${K.pelvisR[0] + 6} ${K.pelvisR[1] + 10}
          C ${K.pelvisR[0] + 2} ${K.pelvisR[1] - 2}, ${K.pelvisR[0] - 2} ${K.pelvisR[1] - 12}, ${K.pelvisR[0] - 6} ${K.pelvisR[1] - 22}
          Z
        `} fill={`url(#ik-mTorso-${uid})`} stroke="#1e293b" strokeWidth="1"/>
        <circle cx={K.lShoulder[0]} cy={K.lShoulder[1]} r="15" fill={`url(#ik-mJoint-${uid})`}/>
        <circle cx={K.rShoulder[0]} cy={K.rShoulder[1]} r="16" fill={`url(#ik-mJoint-${uid})`}/>

        {/* Neck + head */}
        <line x1={K.neck[0] - 2} y1={K.neck[1] - 6} x2={K.neck[0] + 2} y2={K.neck[1] + 8}
              stroke={`url(#ik-mLimb-${uid})`} strokeWidth="16" strokeLinecap="round"/>
        <circle cx={K.head[0]} cy={K.head[1]} r="28" fill={`url(#ik-mSphere-${uid})`} stroke="#1e293b" strokeWidth="1"/>
        <path d={`M ${K.head[0] - 28} ${K.head[1] - 4} Q ${K.head[0] - 10} ${K.head[1] + 10} ${K.head[0] + 22} ${K.head[1] + 4}`}
              stroke="#475569" strokeWidth="1" strokeOpacity="0.4" fill="none"/>

        {/* Throwing arm (right) — Cornell late-cocking pose */}
        <g>
          <line x1={K.rShoulder[0]} y1={K.rShoulder[1]} x2={K.rElbow[0]} y2={K.rElbow[1]}
                stroke={`url(#ik-mLimb-${uid})`} strokeWidth="26" strokeLinecap="round"/>
          <circle cx={K.rElbow[0]} cy={K.rElbow[1]} r="13" fill={`url(#ik-mJoint-${uid})`}/>
          <line x1={K.rElbow[0]} y1={K.rElbow[1]} x2={K.rWrist[0]} y2={K.rWrist[1]}
                stroke={`url(#ik-mLimb-${uid})`} strokeWidth="20" strokeLinecap="round"/>
          <circle cx={K.rWrist[0]} cy={K.rWrist[1]} r="11" fill={`url(#ik-mJoint-${uid})`}/>
        </g>

        {/* === FULL KINETIC CHAIN ENERGY PATH === */}
        {/* v77 — Both legs + upper chain */}
        {/*   Pivot leg (back/push-off): rAnkle → rKnee → pelvis */}
        {/*   Stride leg (front/landing): lAnkle → lKnee → pelvis */}
        {/*   Upper chain: pelvis → trunk → shoulder → elbow → wrist → ball */}
        {energy && (
          <>
            {/* Underlay shadows for all three paths */}
            <path d={energyPathPivotLeg} stroke="#0f1a30" strokeOpacity="0.55" strokeWidth="14"
                  fill="none" strokeLinecap="round" strokeLinejoin="round"/>
            <path d={energyPathStrideLeg} stroke="#0f1a30" strokeOpacity="0.55" strokeWidth="14"
                  fill="none" strokeLinecap="round" strokeLinejoin="round"/>
            <path d={energyPathUpperChain} stroke="#0f1a30" strokeOpacity="0.55" strokeWidth="14"
                  fill="none" strokeLinecap="round" strokeLinejoin="round"/>

            {/* Pivot leg energy stream (back foot pushes off → drives pelvis rotation) */}
            <path d={energyPathPivotLeg} stroke={`url(#ik-energy-pivot-${uid})`} strokeWidth="9"
                  fill="none" strokeLinecap="round" strokeLinejoin="round"
                  strokeDasharray="20 12" opacity="0.95"
                  filter={`url(#ik-glow-${uid})`}>
              <animate attributeName="stroke-dashoffset" from="32" to="0" dur="1.4s" repeatCount="indefinite"/>
            </path>

            {/* Stride leg energy stream (front foot blocks → pelvis decelerates → trunk accelerates) */}
            <path d={energyPathStrideLeg} stroke={`url(#ik-energy-stride-${uid})`} strokeWidth="9"
                  fill="none" strokeLinecap="round" strokeLinejoin="round"
                  strokeDasharray="20 12" opacity="0.95"
                  filter={`url(#ik-glow-${uid})`}>
              <animate attributeName="stroke-dashoffset" from="32" to="0" dur="1.4s" repeatCount="indefinite"/>
            </path>

            {/* Upper chain energy stream (pelvis → trunk → arm → ball) */}
            <path d={energyPathUpperChain} stroke={`url(#ik-energy-upper-${uid})`} strokeWidth="9"
                  fill="none" strokeLinecap="round" strokeLinejoin="round"
                  strokeDasharray="20 12" opacity="0.95"
                  filter={`url(#ik-glow-${uid})`}>
              <animate attributeName="stroke-dashoffset" from="32" to="0" dur="1.4s" repeatCount="indefinite"/>
            </path>

            {/* Pelvis convergence point — visualize where both legs' energy combines */}
            <circle cx={K.pelvisC[0]} cy={K.pelvisC[1]} r="11" fill={ptC.color} opacity="0.4"
                    filter={`url(#ik-glow-${uid})`}>
              <animate attributeName="r" values="9;13;9" dur="1.4s" repeatCount="indefinite"/>
              <animate attributeName="opacity" values="0.3;0.6;0.3" dur="1.4s" repeatCount="indefinite"/>
            </circle>

            {/* Leak indicators on stages with weak transfer */}
            {ptLeak && (
              <g>
                <circle cx={(K.pelvisC[0] + K.trunkC[0]) / 2} cy={(K.pelvisC[1] + K.trunkC[1]) / 2} r="38" fill={`url(#ik-leak-${uid})`}>
                  <animate attributeName="r" values="32;42;32" dur="1.4s" repeatCount="indefinite"/>
                  <animate attributeName="opacity" values="0.85;0.45;0.85" dur="1.4s" repeatCount="indefinite"/>
                </circle>
                <text x={(K.pelvisC[0] + K.trunkC[0]) / 2}
                      y={(K.pelvisC[1] + K.trunkC[1]) / 2 + 4}
                      fill="#fef2f2" fontSize="10" fontWeight="700" textAnchor="middle">⚠ 누수</text>
              </g>
            )}
            {taLeak && (
              <g>
                <circle cx={(K.rShoulder[0] + K.rElbow[0]) / 2} cy={(K.rShoulder[1] + K.rElbow[1]) / 2} r="38" fill={`url(#ik-leak-${uid})`}>
                  <animate attributeName="r" values="32;42;32" dur="1.4s" repeatCount="indefinite"/>
                  <animate attributeName="opacity" values="0.85;0.45;0.85" dur="1.4s" repeatCount="indefinite"/>
                </circle>
              </g>
            )}
          </>
        )}

        {/* === ④ de Swart leg-asymmetry rings (drawn under indicators) === */}
        {legAsymmetry != null && (() => {
          const pivotR  = Math.min(28, 10 + (peakPivotHipVel  || 0) / 35);
          const strideR = Math.min(28, 10 + (peakStrideHipVel || 0) / 35);
          return (
            <g>
              <circle cx={K.rKnee[0]} cy={K.rKnee[1]} r={pivotR + 4} fill="none" stroke="#3b82f6" strokeWidth="2.5" opacity="0.85"/>
              <circle cx={K.rKnee[0]} cy={K.rKnee[1]} r={pivotR} fill="#3b82f6" opacity="0.4"/>
              <circle cx={K.lKnee[0]} cy={K.lKnee[1]} r={strideR + 4} fill="none" stroke="#a855f7" strokeWidth="2.5" opacity="0.85"/>
              <circle cx={K.lKnee[0]} cy={K.lKnee[1]} r={strideR} fill="#a855f7" opacity="0.4"/>
            </g>
          );
        })()}

        {/* === ③ Aguinaldo trunk → arm amplification arrow === */}
        {transferTA_KE != null && (() => {
          const arrowWidth = Math.min(14, 4 + transferTA_KE * 2.5);
          const startX = K.pelvisC[0] + 10, startY = K.pelvisC[1] - 30;
          const endX   = K.rShoulder[0] - 10, endY = K.rShoulder[1] + 12;
          return (
            <g style={{ color: TONES[trunkTone].color }}>
              <line x1={startX} y1={startY} x2={endX} y2={endY}
                    stroke="currentColor" strokeWidth={arrowWidth} strokeLinecap="round" opacity="0.55"
                    markerEnd={`url(#ik-arrow-${uid})`}/>
            </g>
          );
        })()}

        {/* === ② Wasserberger cocking-phase shoulder power (pulse ring) === */}
        {cockPowerWPerKg != null && (
          <g style={{ color: TONES[shoulderTone].color }}>
            <circle cx={K.rShoulder[0]} cy={K.rShoulder[1]} r="36" fill="none" stroke="currentColor" strokeWidth="2.5" opacity="0.55">
              <animate attributeName="r" values="28;48;28" dur="1.6s" repeatCount="indefinite"/>
              <animate attributeName="opacity" values="0.7;0;0.7" dur="1.6s" repeatCount="indefinite"/>
            </circle>
            <circle cx={K.rShoulder[0]} cy={K.rShoulder[1]} r="28" fill="none" stroke="currentColor" strokeWidth="3.5" opacity="0.9"/>
          </g>
        )}

        {/* === ① Howenstein elbow load (pulse) === */}
        {elbowEff != null && (
          <g style={{ color: TONES[elbowTone].color }}>
            <circle cx={K.rElbow[0]} cy={K.rElbow[1]} r="30" fill="none" stroke="currentColor" strokeWidth="2.5" opacity="0.6">
              <animate attributeName="r" values="22;36;22" dur="1.8s" repeatCount="indefinite"/>
              <animate attributeName="opacity" values="0.85;0.15;0.85" dur="1.8s" repeatCount="indefinite"/>
            </circle>
            <circle cx={K.rElbow[0]} cy={K.rElbow[1]} r="13" fill="currentColor" opacity="0.95"/>
          </g>
        )}

        {/* Ball at release point */}
        <circle cx={K.ball[0]} cy={K.ball[1]} r="9" fill="#f8fafc" stroke="#1e293b" strokeWidth="1.2"/>
        <path d={`M ${K.ball[0] - 6} ${K.ball[1] - 3} Q ${K.ball[0]} ${K.ball[1] - 8} ${K.ball[0] + 6} ${K.ball[1] - 3}`} stroke="#ef4444" strokeWidth="1.2" fill="none"/>
        <path d={`M ${K.ball[0] - 6} ${K.ball[1] + 3} Q ${K.ball[0]} ${K.ball[1] + 8} ${K.ball[0] + 6} ${K.ball[1] + 3}`} stroke="#ef4444" strokeWidth="1.2" fill="none"/>

        {/* === ANNOTATIONS / LABEL CARDS === */}
        {/* ① 팔꿈치 부담 — top right */}
        {elbowEff != null && (
          <g>
            <line x1={K.rElbow[0] + 14} y1={K.rElbow[1] - 4} x2="612" y2="78" stroke={TONES[elbowTone].color} strokeWidth="1.2" strokeDasharray="2 3" opacity="0.7"/>
            <rect x="588" y="44" width="184" height="62" rx="6" fill="#0b1220" stroke={TONES[elbowTone].color} strokeOpacity="0.7"/>
            <text x="680" y="60" fill={TONES[elbowTone].color} fontSize="11" fontWeight="700" textAnchor="middle" letterSpacing="0.4">① 팔꿈치 부담</text>
            <text x="680" y="80" fill="#e2e8f0" fontSize="15" fontWeight="800" textAnchor="middle">{elbowEff.toFixed(2)} N·m/(m/s)</text>
            <text x="680" y="98" fill={TONES[elbowTone].color} fontSize="10" textAnchor="middle">{TONES[elbowTone].text} · 낮을수록 좋음</text>
          </g>
        )}

        {/* ② 어깨 폭발력 — top left (사용자 요청: 위로) */}
        {cockPowerWPerKg != null && (
          <g>
            <line x1={K.rShoulder[0] - 22} y1={K.rShoulder[1] - 4} x2="226" y2="78" stroke={TONES[shoulderTone].color} strokeWidth="1.2" strokeDasharray="2 3" opacity="0.7"/>
            <rect x="40" y="44" width="184" height="62" rx="6" fill="#0b1220" stroke={TONES[shoulderTone].color} strokeOpacity="0.7"/>
            <text x="132" y="60" fill={TONES[shoulderTone].color} fontSize="11" fontWeight="700" textAnchor="middle" letterSpacing="0.4">② 어깨 폭발력</text>
            <text x="132" y="80" fill="#e2e8f0" fontSize="15" fontWeight="800" textAnchor="middle">{cockPowerWPerKg.toFixed(1)} W/kg</text>
            <text x="132" y="98" fill={TONES[shoulderTone].color} fontSize="10" textAnchor="middle">{TONES[shoulderTone].text} · 높을수록 좋음</text>
          </g>
        )}

        {/* ETI(T→A) — Trunk→Arm energy transfer (right of shoulder, between shoulder and elbow card) */}
        {etiTA != null && (
          <g>
            <line x1={K.rShoulder[0] + 22} y1={K.rShoulder[1] + 6} x2="612" y2="178" stroke={taC.color} strokeWidth="1.2" strokeDasharray="2 3" opacity="0.7"/>
            <rect x="588" y="144" width="184" height="62" rx="6" fill="#0b1220" stroke={taC.color} strokeOpacity="0.7"/>
            <text x="680" y="160" fill={taC.color} fontSize="11" fontWeight="700" textAnchor="middle" letterSpacing="0.4">몸통→팔 전달 (T→A)</text>
            <text x="680" y="180" fill="#e2e8f0" fontSize="15" fontWeight="800" textAnchor="middle">ETI {etiTA.toFixed(2)}</text>
            <text x="680" y="198" fill={taC.color} fontSize="10" fontWeight={taLeak ? 700 : 500} textAnchor="middle">
              {taC.label}
            </text>
          </g>
        )}

        {/* ③ 몸통→팔 힘 배율 — middle right (Aguinaldo) */}
        {transferTA_KE != null && (
          <g>
            <line x1={K.pelvisC[0] + 60} y1={K.pelvisC[1] - 60} x2="612" y2="266" stroke={TONES[trunkTone].color} strokeWidth="1.2" strokeDasharray="2 3" opacity="0.7"/>
            <rect x="588" y="232" width="184" height="62" rx="6" fill="#0b1220" stroke={TONES[trunkTone].color} strokeOpacity="0.7"/>
            <text x="680" y="248" fill={TONES[trunkTone].color} fontSize="11" fontWeight="700" textAnchor="middle" letterSpacing="0.4">③ 몸통→팔 힘 배율</text>
            <text x="680" y="268" fill="#e2e8f0" fontSize="15" fontWeight="800" textAnchor="middle">{transferTA_KE.toFixed(2)} 배</text>
            <text x="680" y="286" fill={TONES[trunkTone].color} fontSize="10" textAnchor="middle">{TONES[trunkTone].text} · 클수록 좋음</text>
          </g>
        )}

        {/* ETI(P→T) — Pelvis→Trunk transfer (사용자 요청: 위로 - 어깨 폭발력 바로 아래) */}
        {etiPT != null && (
          <g>
            <line x1={K.pelvisC[0] - 30} y1={K.pelvisC[1] - 30} x2="226" y2="158" stroke={ptC.color} strokeWidth="1.2" strokeDasharray="2 3" opacity="0.7"/>
            <rect x="40" y="124" width="184" height="62" rx="6" fill="#0b1220" stroke={ptC.color} strokeOpacity="0.7"/>
            <text x="132" y="140" fill={ptC.color} fontSize="11" fontWeight="700" textAnchor="middle" letterSpacing="0.4">골반→몸통 전달 (P→T)</text>
            <text x="132" y="160" fill="#e2e8f0" fontSize="15" fontWeight="800" textAnchor="middle">ETI {etiPT.toFixed(2)}</text>
            <text x="132" y="178" fill={ptC.color} fontSize="10" fontWeight={ptLeak ? 700 : 500} textAnchor="middle">
              {ptC.label}
            </text>
          </g>
        )}

        {/* v79 — REMOVED: ④ 두 다리 균형 (legAsymmetry) box was here.
            The asymmetry is still rendered as the colored rings around feet via de Swart visualization below. */}

        {/* v80 — STRIDE FOOT BLOCK — 회전 에너지 시작점 (with braking-GRF subtitle)
            Stride foot uses BRAKING ground reaction force to amplify rotational energy:
            the front foot decelerates the pelvis at FC, transferring momentum to trunk rotation. */}
        <g>
          <line x1={K.lAnkle[0] - 8} y1={K.lAnkle[1] + 4} x2="240" y2="500" stroke="#a78bfa" strokeWidth="1.2" strokeDasharray="2 3" opacity="0.7"/>
          <rect x="40" y="480" width="218" height="68" rx="6" fill="#0b1220" stroke="#a78bfa" strokeOpacity="0.7"/>
          <text x="149" y="498" fill="#a78bfa" fontSize="10.5" fontWeight="700" textAnchor="middle" letterSpacing="0.4">디딤발 블록</text>
          <text x="149" y="516" fill="#e2e8f0" fontSize="11.5" fontWeight="700" textAnchor="middle">회전 에너지 시작점</text>
          <text x="149" y="535" fill="#94a3b8" fontSize="9.5" textAnchor="middle">제동 지면반력 이용 회전 에너지 증폭</text>
        </g>

        {/* v80 — PIVOT FOOT BLOCK — 전진 에너지 시작점 (with propulsive-GRF subtitle)
            Pivot foot uses PROPULSIVE ground reaction force to generate linear stride energy:
            push-off from rubber drives forward translation toward the plate. */}
        <g>
          <line x1={K.rAnkle[0] + 14} y1={K.rAnkle[1] + 6} x2="660" y2="472" stroke="#3b82f6" strokeWidth="1.2" strokeDasharray="2 3" opacity="0.7"/>
          <rect x="540" y="472" width="232" height="68" rx="6" fill="#0b1220" stroke="#3b82f6" strokeOpacity="0.7"/>
          <text x="656" y="490" fill="#3b82f6" fontSize="10.5" fontWeight="700" textAnchor="middle" letterSpacing="0.4">축발 추진</text>
          <text x="656" y="508" fill="#e2e8f0" fontSize="11.5" fontWeight="700" textAnchor="middle">전진 에너지 시작점</text>
          <text x="656" y="527" fill="#94a3b8" fontSize="9.5" textAnchor="middle">추진 지면반력으로 스트라이드 에너지 생성</text>
        </g>

        {/* ⭐ v9 — 무릎 무너짐 카드 (디딤발 블록 위 · 사용자 요청) */}
        {kneeCollapseDeg != null && (
          <g>
            <line x1={K.lKnee[0] - 8} y1={K.lKnee[1] - 4} x2="240" y2="350" stroke={TONES[kneeCollapseTone].color} strokeWidth="1.2" strokeDasharray="2 3" opacity="0.7"/>
            <rect x="40" y="320" width="218" height="62" rx="6" fill="#0b1220" stroke={TONES[kneeCollapseTone].color} strokeOpacity="0.7"/>
            <text x="149" y="336" fill={TONES[kneeCollapseTone].color} fontSize="11" fontWeight="700" textAnchor="middle" letterSpacing="0.4">무릎 무너짐</text>
            <text x="149" y="356" fill="#e2e8f0" fontSize="15" fontWeight="800" textAnchor="middle">
              {kneeCollapseDeg > 0 ? '+' : ''}{kneeCollapseDeg.toFixed(1)}°
            </text>
            <text x="149" y="374" fill={TONES[kneeCollapseTone].color} fontSize="10" textAnchor="middle">
              {kneeCollapseDeg > 5 ? '주저앉음 · 보강 필요'
                : kneeCollapseDeg > -5 ? '뻣뻣 · 흡수 부족'
                : kneeCollapseDeg >= -20 ? '정상 블록'
                : '과도한 신전'}
            </text>
          </g>
        )}

        {/* ⭐ v9 — 무릎 SSC 활용 카드 (디딤발 블록 위 · 무릎 무너짐 카드 아래) */}
        {kneeSscMs != null && (
          <g>
            <line x1={K.lKnee[0] - 4} y1={K.lKnee[1] + 4} x2="258" y2="430" stroke={TONES[kneeSscTone].color} strokeWidth="1.2" strokeDasharray="2 3" opacity="0.7"/>
            <rect x="40" y="398" width="218" height="62" rx="6" fill="#0b1220" stroke={TONES[kneeSscTone].color} strokeOpacity="0.7"/>
            <text x="149" y="414" fill={TONES[kneeSscTone].color} fontSize="11" fontWeight="700" textAnchor="middle" letterSpacing="0.4">무릎 SSC 활용</text>
            <text x="149" y="434" fill="#e2e8f0" fontSize="15" fontWeight="800" textAnchor="middle">
              {kneeSscMs.toFixed(0)} ms
            </text>
            <text x="149" y="452" fill={TONES[kneeSscTone].color} fontSize="10" textAnchor="middle">
              {TONES[kneeSscTone].text} · 짧을수록 좋음 (탄성 회수)
            </text>
          </g>
        )}

        {/* SSC 측정 불가 시 안내 카드 (RSI-mod로 추정 가능) */}
        {kneeSscMs == null && kneeCollapseDeg != null && (
          <g>
            <rect x="40" y="398" width="218" height="62" rx="6" fill="#0b1220" stroke="#475569" strokeOpacity="0.7" strokeDasharray="3 3"/>
            <text x="149" y="414" fill="#94a3b8" fontSize="11" fontWeight="700" textAnchor="middle" letterSpacing="0.4">무릎 SSC 활용</text>
            <text x="149" y="434" fill="#94a3b8" fontSize="13" fontWeight="700" textAnchor="middle">측정 불가</text>
            <text x="149" y="452" fill="#64748b" fontSize="9" textAnchor="middle">CMJ RSI-mod로 간접 평가</text>
          </g>
        )}

        {/* ⭐ v8 — LEFT-MID: 플라잉오픈 (골반-몸통 전달 근처) */}
        {flyingOpenDeg != null && (
          <g>
            <line x1={K.pelvisC[0] - 30} y1={K.pelvisC[1] - 10} x2="40" y2="240" stroke={TONES[flyingOpenTone].color} strokeWidth="1.2" strokeDasharray="2 3" opacity="0.7"/>
            <rect x="-130" y="220" width="200" height="64" rx="6" fill="#0b1220" stroke={TONES[flyingOpenTone].color} strokeOpacity="0.7"/>
            <text x="-30" y="238" fill={TONES[flyingOpenTone].color} fontSize="10.5" fontWeight="700" textAnchor="middle" letterSpacing="0.4">플라잉오픈 (FC)</text>
            <text x="-30" y="258" fill="#e2e8f0" fontSize="14" fontWeight="800" textAnchor="middle">
              {flyingOpenDeg.toFixed(1)}°
            </text>
            <text x="-30" y="276" fill={TONES[flyingOpenTone].color} fontSize="9.5" textAnchor="middle">
              {TONES[flyingOpenTone].text} · 작을수록 ↑
            </text>
          </g>
        )}

        {/* ⭐ v10 — RIGHT-TOP: FC 시점 몸통 자세 (상체 근처, 사용자 요청)
            직립 또는 약간 뒤로 젖힌 상태(음수)가 좋음
            연결선: 어깨 → 카드 (상체 영역) */}
        {trunkFlexAtFCDeg != null && (
          <g>
            <line x1={K.rShoulder[0] + 24} y1={K.rShoulder[1] - 6} x2="822" y2="120" stroke={TONES[trunkFlexAtFCTone].color} strokeWidth="1.2" strokeDasharray="2 3" opacity="0.7"/>
            <rect x="788" y="92" width="200" height="76" rx="6" fill="#0b1220" stroke={TONES[trunkFlexAtFCTone].color} strokeOpacity="0.7"/>
            <text x="888" y="110" fill={TONES[trunkFlexAtFCTone].color} fontSize="10.5" fontWeight="700" textAnchor="middle" letterSpacing="0.4">FC 몸통 자세</text>
            <text x="888" y="131" fill="#e2e8f0" fontSize="15" fontWeight="800" textAnchor="middle">
              {trunkFlexAtFCDeg > 0 ? '+' : ''}{trunkFlexAtFCDeg.toFixed(1)}°
            </text>
            <text x="888" y="148" fill={TONES[trunkFlexAtFCTone].color} fontSize="9.5" textAnchor="middle">
              {trunkFlexAtFCDeg <= -5 ? '뒤로 젖힘 · 우수'
                : trunkFlexAtFCDeg <= 5  ? '직립 · 양호'
                : trunkFlexAtFCDeg <= 15 ? '약간 앞으로'
                : '이미 앞으로 무너짐'}
            </text>
            <text x="888" y="161" fill="#64748b" fontSize="8.5" textAnchor="middle">앞발 착지 시점 · 직립~음수 이상적</text>
          </g>
        )}

        {/* ⭐ v8 — RIGHT-MID: 릴리즈 시 몸통 전방 굴곡 (몸통-팔 전달 근처) */}
        {trunkFlexAtBRDeg != null && (
          <g>
            <line x1={K.trunkC[0] + 12} y1={K.trunkC[1] + 14} x2="822" y2="220" stroke={TONES[trunkFlexTone].color} strokeWidth="1.2" strokeDasharray="2 3" opacity="0.7"/>
            <rect x="788" y="200" width="200" height="64" rx="6" fill="#0b1220" stroke={TONES[trunkFlexTone].color} strokeOpacity="0.7"/>
            <text x="888" y="218" fill={TONES[trunkFlexTone].color} fontSize="10.5" fontWeight="700" textAnchor="middle" letterSpacing="0.4">릴리즈 몸통 굴곡</text>
            <text x="888" y="238" fill="#e2e8f0" fontSize="14" fontWeight="800" textAnchor="middle">
              {trunkFlexAtBRDeg.toFixed(1)}°
            </text>
            <text x="888" y="256" fill={TONES[trunkFlexTone].color} fontSize="9.5" textAnchor="middle">
              {TONES[trunkFlexTone].text} · 35-45° 정상
            </text>
          </g>
        )}

        {/* === Joint markers (key kinematic points) === */}
        <g style={{ pointerEvents: 'none' }}>
          {[
            { p: K.rShoulder, c: '#fbbf24', big: true },
            { p: K.rElbow,    c: '#fbbf24', big: true },
            { p: K.rWrist,    c: '#fbbf24', big: true },
            { p: K.lShoulder, c: '#22d3ee' },
            { p: K.lElbow,    c: '#22d3ee' },
            { p: K.lWrist,    c: '#22d3ee' },
            { p: K.pelvisC,   c: '#a78bfa', big: true },
            { p: K.rKnee,     c: '#22d3ee' },
            { p: K.rAnkle,    c: '#22d3ee' },
            { p: K.lKnee,     c: '#22d3ee' },
            { p: K.lAnkle,    c: '#22d3ee' }
          ].map((j, i) => (
            <g key={`jm-${i}`}>
              <circle cx={j.p[0]} cy={j.p[1]} r={j.big ? 6.5 : 6} fill="#0b1220" stroke="#ffffff" strokeWidth={j.big ? 2 : 1.6} opacity={j.big ? 0.95 : 0.9}/>
              <circle cx={j.p[0]} cy={j.p[1]} r={j.big ? 3.5 : 3} fill={j.c}/>
            </g>
          ))}
        </g>
      </svg>
      <div className="silhouette-legend">
        <div className="leg-item">
          <span style={{ display:'inline-block', width:14, height:14, borderRadius:3, background:'linear-gradient(90deg,#3b82f6,#a78bfa,#ef4444)', marginRight:6 }}/>
          <b>에너지 흐름:</b> <span style={{color:'#3b82f6'}}>파랑=좋음</span> · <span style={{color:'#a78bfa'}}>보라=보통</span> · <span style={{color:'#ef4444'}}>빨강=나쁨</span>
        </div>
        <div className="leg-item"><span className="dot" style={{ background: ptC.color }}/>골반→몸통 ({ptC.label})</div>
        <div className="leg-item"><span className="dot" style={{ background: taC.color }}/>몸통→팔 ({taC.label})</div>
        <div className="leg-item"><span className="dot" style={{ background: TONES[elbowTone].color }}/>① 팔꿈치 부담</div>
        <div className="leg-item"><span className="dot" style={{ background: TONES[shoulderTone].color }}/>② 어깨 폭발력</div>
        <div className="leg-item"><span className="dot" style={{ background: '#3b82f6' }}/>축발 · <span className="dot" style={{ background: '#a855f7', marginLeft: 6 }}/>디딤발</div>
        <div className="leg-item">
          <span style={{ display:'inline-block', width:9, height:9, borderRadius:'50%', background:'#fbbf24', border:'1.5px solid #fff', marginRight:4 }}/>던지는 팔 관절
          <span style={{ display:'inline-block', width:9, height:9, borderRadius:'50%', background:'#22d3ee', border:'1.5px solid #fff', marginLeft:8, marginRight:4 }}/>그 외 관절
          <span style={{ display:'inline-block', width:9, height:9, borderRadius:'50%', background:'#a78bfa', border:'1.5px solid #fff', marginLeft:8, marginRight:4 }}/>골반
        </div>
        <div className="leg-item note">색띠 두께·진하기 = 에너지 흐름 강도 · 카드 색 = 해당 변인의 평가 결과</div>
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
window.IntegratedKineticDiagram = IntegratedKineticDiagram;
})();
