/* BBL Data Builder
 * BBLAnalysis 출력 + Fitness CSV 파싱 결과를 Report 7의 `BBL_PITCHERS` 형식으로 변환.
 *
 * 입력:
 *   - profile: { id, name, age, heightCm, weightKg, throwingHand }
 *   - velocity: { max, avg }
 *   - bio: BBLAnalysis.analyze() 출력
 *   - physical: BBLFitness.parseFitnessCSV().physical 또는 manual 입력 결과
 *
 * 출력: Report 7의 단일 pitcher 객체 (window.BBL_PITCHERS 배열 항목과 동일 형식)
 *
 * Exposes: window.BBLDataBuilder = { build }
 */
(function () {
  'use strict';

  // 참조값 (Report 7 data.js와 동일)
  // ─────────────────────────────────────────────────────────────
  // Reference baseline (한국 대학생/고교생 우수 투수 기준)
  // 출처: Aguinaldo 2015 (high school college level), Fleisig 1999, Naito 2014
  // 주: MLB elite는 pelvis 600+/trunk 950+/arm 1900+이지만,
  //     한국 고교/대학 우수 투수는 더 낮은 분포에 있어 baseline을 낮춤.
  //     현재 시스템은 한국 학생 투수 분석용이므로 이 기준을 사용.
  // ─────────────────────────────────────────────────────────────
  const REF = {
    pelvis:  { low: 500, high: 600 },   // 한국 우수 고1: 500-600 °/s
    trunk:   { low: 750, high: 900 },   // 한국 우수 고1: 750-900 °/s
    arm:     { low: 1350, high: 1550 }, // 한국 우수 고1: 1350-1550 °/s
    layback: { low: 160, high: 180 },
    etiTA:   { leakBelow: 0.85, ideal: 1.0 },
  };

  function bandFromRange(value, low, high) {
    if (value == null || isNaN(value)) return 'na';
    if (value >= high) return 'high';
    if (value >= low) return 'mid';
    return 'low';
  }

  function r1(v) { return v == null ? null : Math.round(v * 10) / 10; }
  function r2(v) { return v == null ? null : Math.round(v * 100) / 100; }
  function r0(v) { return v == null ? null : Math.round(v); }
  function safeFn(fn, dflt) { try { return fn(); } catch(e) { return dflt; } }

  // ═════════════════════════════════════════════════════════════════
  // 시퀀싱 코멘트 생성
  // ═════════════════════════════════════════════════════════════════
  function buildSequenceComment(ptLag, taLag, ptCv, taCv) {
    const parts = [];
    if (ptLag != null) {
      const ok = ptLag >= 25 && ptLag <= 70;
      parts.push(`P→T lag ${r0(ptLag)}ms${ok ? ' 정상' : (ptLag < 25 ? ' 짧음' : ' 김')}`);
    }
    if (taLag != null) {
      const ok = taLag >= 25 && taLag <= 70;
      parts.push(`T→A lag ${r0(taLag)}ms${ok ? ' 정상' : (taLag < 25 ? ' 짧음' : ' 김')}`);
    }
    if (ptCv != null && ptCv < 15) parts.push('일관성 우수');
    else if (ptCv != null && ptCv > 30) parts.push('타이밍 변동 큼');
    return parts.length ? '· ' + parts.join(' · ') : '— 데이터 부족';
  }

  // ═════════════════════════════════════════════════════════════════
  // 회전 속도 코멘트
  // ═════════════════════════════════════════════════════════════════
  function buildAngularComment(pelvis, trunk, arm) {
    const parts = [];
    if (pelvis != null) parts.push(`pelvis ${r0(pelvis)}`);
    if (trunk  != null) parts.push(`trunk ${r0(trunk)}`);
    if (arm    != null) parts.push(`arm ${r0(arm)} °/s`);
    return parts.length ? '· ' + parts.join(' → ') : '— 데이터 부족';
  }

  // ═════════════════════════════════════════════════════════════════
  // 에너지 코멘트
  // ═════════════════════════════════════════════════════════════════
  function buildEnergyComment(etiPT, etiTA, leakPct) {
    const parts = [];
    if (etiTA != null) parts.push(`ETI T→A ${r2(etiTA)}`);
    if (etiPT != null) parts.push(`ETI P→T ${r2(etiPT)}`);
    if (leakPct != null) {
      if (leakPct === 0) parts.push('누수 0%');
      else if (leakPct > 0) parts.push(`약 ${r0(leakPct)}% 손실`);
    }
    return parts.length ? '· ' + parts.join(' · ') : '— 데이터 부족';
  }

  // ═════════════════════════════════════════════════════════════════
  // Layback 코멘트
  // ═════════════════════════════════════════════════════════════════
  function buildLaybackComment(deg, band, sd) {
    if (deg == null) return '— 측정 불가';
    const parts = [`${r1(deg)}°`];
    if (band === 'high') parts.push('가속 거리 충분');
    else if (band === 'low') parts.push('가속 거리 부족');
    if (sd != null) parts.push(`SD ±${r1(sd)}°`);
    return '· ' + parts.join(' · ');
  }

  // ═════════════════════════════════════════════════════════════════
  // Archetype + Severity + CoreIssue 자동 분류
  // ═════════════════════════════════════════════════════════════════
  function classifyArchetype(physical, summary, energy) {
    const cmjBand = physical.cmjPower?.band;
    const strBand = physical.maxStrength?.band;
    const rsiBand = physical.reactive?.band;
    const mass    = physical.weightKg;
    const etiTA   = summary.etiTA?.mean;
    const armPeak = summary.peakArmVel?.mean;

    // 1) 절대 근력 충분 + 단위파워 높음 → 파워 주도형
    if (cmjBand === 'high' && (strBand === 'mid' || strBand === 'high')) {
      return { archetype: '하체 파워 주도형', archetypeEn: 'Power-dominant (mid strength)' };
    }
    // 2) 단위파워 높지만 체격/근력 작음 → 탄력 중심형
    if ((cmjBand === 'high' || rsiBand === 'high') && (strBand === 'low' || (mass && mass < 70))) {
      return { archetype: '탄력 중심형', archetypeEn: 'Lightweight / Elastic' };
    }
    // 3) 절대 근력은 있지만 폭발력 부족 → 파워 변환 필요형
    if ((cmjBand === 'mid' || cmjBand === 'low') && strBand === 'high') {
      return { archetype: '파워 변환 필요형', archetypeEn: 'Strength-rich · power-deficit' };
    }
    // 4) 둘 다 부족 → 파워 개발 필요형
    if (cmjBand === 'low' && (strBand === 'low' || strBand === 'na')) {
      return { archetype: '파워 개발 필요형', archetypeEn: 'Power-deficit (untested or low)' };
    }
    // 5) 기본
    return { archetype: '균형형', archetypeEn: 'Balanced profile' };
  }

  function classifyCoreIssue(physical, summary, energy, command) {
    const issues = [];
    let severity = 'NONE';

    const etiTA = summary.etiTA?.mean;
    const leakPct = energy?.leakRate;
    const cmjBand = physical.cmjPower?.band;
    const strBand = physical.maxStrength?.band;
    const mass = physical.weightKg;

    // ETI T→A 누수
    if (etiTA != null && etiTA < 0.85) {
      issues.push({ type: 'mech', severity: 'HIGH', label: '몸통→상완 에너지 누수' });
      severity = 'HIGH';
    }

    // 단위파워 부족
    if (cmjBand === 'low') {
      issues.push({ type: 'phys', severity: 'MEDIUM', label: '하체 단위파워 부족' });
      if (severity !== 'HIGH') severity = 'MEDIUM';
    }

    // 절대 근력 부족 + 작은 체격
    if (strBand === 'low' && mass != null && mass < 70) {
      issues.push({ type: 'phys', severity: 'MEDIUM', label: '엔진 총량 부족' });
      if (severity !== 'HIGH') severity = 'MEDIUM';
    }

    // 제구 등급 D
    if (command?.overall === 'D') {
      issues.push({ type: 'cmd', severity: 'MEDIUM', label: '제구 일관성 부족' });
      if (severity !== 'HIGH') severity = 'MEDIUM';
    }

    if (issues.length === 0) {
      return {
        coreIssue: '· 모든 구간 기준 충족 · 뚜렷한 약점 없음',
        coreIssueEn: 'No bottleneck — maintain current balance',
        severity: 'NONE'
      };
    }

    return {
      coreIssue: '· ' + issues.map(i => i.label).join(' · '),
      coreIssueEn: issues.map(i => i.label).join(' + '),
      severity
    };
  }

  // ═════════════════════════════════════════════════════════════════
  // Tags (reactive+ / reactive- 등)
  // ═════════════════════════════════════════════════════════════════
  function buildTags(physical) {
    const tags = [];
    if (physical.reactive?.band === 'high') tags.push('reactive+');
    else if (physical.reactive?.band === 'low') tags.push('reactive-');
    if (physical.cmjPower?.band === 'high') tags.push('power+');
    else if (physical.cmjPower?.band === 'low') tags.push('power-');
    return tags;
  }

  // ═════════════════════════════════════════════════════════════════
  // Radar 데이터 (5+1 = 6개 축) — Report 7의 6개 축과 호환
  // ═════════════════════════════════════════════════════════════════
  function buildRadar(physical) {
    return [
      { key: 'cmj',   label: '폭발력',     sub: '하체 폭발력',
        value: physical.cmjPower?.cmj, display: physical.cmjPower?.cmj != null ? `${physical.cmjPower.cmj}` : 'N/A',
        lo: 40, hi: 50 },
      { key: 'sj',    label: '순수파워',   sub: '정지→폭발',
        value: physical.cmjPower?.sj, display: physical.cmjPower?.sj != null ? `${physical.cmjPower.sj}` : 'N/A',
        lo: 38, hi: 50 },
      { key: 'str',   label: '버티는 힘',  sub: '최대 근력',
        value: physical.maxStrength?.perKg, display: physical.maxStrength?.perKg != null ? `${physical.maxStrength.perKg}` : 'N/A',
        lo: 25, hi: 35 },
      { key: 'rsi',   label: '빠른 반동',  sub: '순간 반응',
        value: physical.reactive?.cmj, display: physical.reactive?.cmj != null ? `${physical.reactive.cmj}` : 'N/A',
        lo: 0.30, hi: 0.55 },
      { key: 'eur',   label: '반동 활용',  sub: '탄성 에너지',
        value: physical.ssc?.value, display: physical.ssc?.value != null ? `${physical.ssc.value}` : 'N/A',
        lo: 0.95, hi: 1.10 },
      { key: 'grip',  label: '손목 힘',    sub: '릴리스 안정',
        value: physical.release?.value, display: physical.release?.value != null ? `${physical.release.value}` : 'N/A',
        lo: 50, hi: 65 }
    ];
  }

  // ═════════════════════════════════════════════════════════════════
  // 7대 요인 (BBLAnalysis.factors → Report 7 factors 형식)
  // ═════════════════════════════════════════════════════════════════
  function buildFactors(bioFactors, summary, faultRates) {
    if (!Array.isArray(bioFactors)) return [];

    const sm = summary || {};
    const fr = faultRates || {};

    const lookup = {
      F1: {
        id: 'F1_landing', name: '① 앞발 착지',
        measured: {
          stride_m: r2(sm.strideLength?.mean),
          stride_cv: r1(sm.strideLength?.cv),
          knee_flex_deg: r1(sm.frontKneeFlex?.mean),
          knee_sd: r1(sm.frontKneeFlex?.sd)
        },
        elite: 'stride CV 2-3% · knee 25-40° · SD 3-5°'
      },
      F2: {
        id: 'F2_separation', name: '② 골반-몸통 분리',
        measured: {
          max_sep_deg: r1(sm.maxXFactor?.mean),
          sep_sd: r1(sm.maxXFactor?.sd),
          sep_lag_ms: r0(sm.ptLagMs?.mean),
          lag_sd: r1(sm.ptLagMs?.sd)
        },
        elite: '40-60° · lag ~50ms · SD <10ms'
      },
      F3: {
        id: 'F3_arm_timing', name: '③ 어깨-팔 타이밍',
        measured: {
          mer_deg: r1(sm.maxER?.mean),
          mer_sd: r1(sm.maxER?.sd),
          fc_to_br_ms: r0(sm.fcBrMs?.mean),
          fcbr_sd: r1(sm.fcBrMs?.sd)
        },
        elite: 'MER ~180° · FC→BR ~150ms · SD <10ms'
      },
      F4: {
        id: 'F4_knee', name: '④ 앞 무릎 안정성',
        measured: {
          knee_fc_deg: r1(sm.frontKneeFlex?.mean),
          knee_sd: r1(sm.frontKneeFlex?.sd),
          blocking_deg: r1(sm.leadKneeExtAtBR?.mean),
          block_sd: r1(sm.leadKneeExtAtBR?.sd)
        },
        elite: '25-40° · blocking + (펴짐) · SD <5°'
      },
      F5: {
        id: 'F5_tilt', name: '⑤ 몸통 기울기',
        measured: {
          forward_deg: r1(sm.trunkForwardTilt?.mean),
          forward_sd: r1(sm.trunkForwardTilt?.sd),
          lateral_deg: r1(sm.trunkLateralTilt?.mean),
          lateral_sd: r1(sm.trunkLateralTilt?.sd)
        },
        elite: 'forward 30-40° · lateral 20-30° · SD 3-5°'
      },
      F6: {
        id: 'F6_head', name: '⑥ 머리·시선 안정성',
        measured: {
          head_disp_cm: '—',
          head_sd: '—',
          sway_pct: r1(fr.sway?.rate),
          getting_out_pct: r1(fr.gettingOut?.rate)
        },
        elite: 'sway 0% · 시선 고정'
      },
      F7: {
        id: 'F7_wrist', name: '⑦ 그립·손목 정렬',
        measured: {
          arm_slot_deg: r1(sm.armSlotAngle?.mean),
          arm_sd: r2(sm.armSlotAngle?.sd)
        },
        elite: 'arm_slot SD <3°'
      }
    };

    return bioFactors.map(f => {
      const meta = lookup[f.id] || { id: f.id, name: f.name, measured: {}, elite: '' };
      const m = meta.measured;
      // 코멘트 자동 생성
      const valStrs = [];
      Object.entries(m).forEach(([k, v]) => {
        if (v != null && v !== '—') {
          const niceKey = k.replace(/_(deg|m|ms|cv|sd|pct|cm)/g, '').replace(/_/g, ' ');
          if (k.includes('cv') || k.includes('pct')) valStrs.push(`${niceKey} ${v}%`);
          else if (k.includes('deg')) valStrs.push(`${niceKey} ${v}°`);
          else if (k.includes('ms')) valStrs.push(`${niceKey} ${v}ms`);
          else if (k.includes('sd')) valStrs.push(`SD ±${v}`);
          else valStrs.push(`${niceKey} ${v}`);
        }
      });
      return {
        id: meta.id,
        name: meta.name,
        grade: f.grade || 'N/A',
        measured: m,
        elite: meta.elite,
        comment: valStrs.length ? '· ' + valStrs.join(' · ') : '· 측정값 부족'
      };
    });
  }

  // ═════════════════════════════════════════════════════════════════
  // Command 데이터 변환 (BBLAnalysis.command → Report 7 command)
  // ═════════════════════════════════════════════════════════════════
  function buildCommand(bioCmd, sm) {
    if (!bioCmd) return null;
    const overall = bioCmd.overall || 'N/A';
    const domains = bioCmd.domains || [];

    // ─── Sequencing domain N/A fallback ───
    // ptLagMs/taLagMs의 CV가 산출 안 되면 (trial 1개 또는 분모 문제) sequencing이 N/A로 떨어짐.
    // 이때 raw mean 기반으로 등급을 부여 — files Howenstein 2019 / Naito 2014 timing window 사용.
    // P→T lag elite 25-65ms, T→A lag elite 15-45ms.
    function rawSequencingGrade(ptMean, taMean) {
      function gradeOne(v, lo, hi) {
        if (v == null || isNaN(v)) return null;
        if (v >= lo && v <= hi) return 4;     // A (elite range)
        const mid = (lo + hi) / 2;
        const range = (hi - lo) / 2;
        const off = Math.abs(v - mid);
        if (off <= range * 1.5) return 3;     // B
        if (off <= range * 2.5) return 2;     // C
        return 1;                              // D
      }
      const ptScore = gradeOne(ptMean, 25, 65);
      const taScore = gradeOne(taMean, 15, 45);
      const valid = [ptScore, taScore].filter(s => s != null);
      if (valid.length === 0) return null;
      const avg = valid.reduce((a, b) => a + b, 0) / valid.length;
      const grade = avg >= 3.5 ? 'A' : avg >= 2.5 ? 'B' : avg >= 1.5 ? 'C' : 'D';
      return { grade, score: avg, ptScore, taScore };
    }

    // 도메인 중 sequencing이 N/A이면 raw mean으로 fallback
    const sequencingIdx = domains.findIndex(d => d.key === 'sequencing');
    if (sequencingIdx >= 0 && (domains[sequencingIdx].grade === 'N/A' || domains[sequencingIdx].grade == null)) {
      const fb = rawSequencingGrade(sm.ptLagMs?.mean, sm.taLagMs?.mean);
      if (fb) {
        domains[sequencingIdx] = {
          ...domains[sequencingIdx],
          grade: fb.grade,
          score: fb.score,
          fallback: true  // 표시용 플래그
        };
      }
    }

    // breakdown — 각 domain의 score를 음수로 (낮을수록 좋음)
    // Report 7은 wrist, armslot, trunkTilt, layback, stride, fcRelease 키 사용
    const domainByKey = Object.fromEntries(domains.map(d => [d.key, d]));
    const releasePos = domainByKey.releasePos;
    const sequencing = domainByKey.sequencing;
    const releaseTiming = domainByKey.releaseTiming;
    const footContact = domainByKey.footContact;
    const powerOutput = domainByKey.powerOutput;

    function neg(score) { return score == null ? 0 : -(5 - score); } // 4점→-1, 1점→-4

    const breakdown = {
      wrist: neg(releasePos?.subs?.find(s => s.name?.includes('손목'))?.score),
      armslot: neg(releasePos?.subs?.find(s => s.name?.includes('Arm slot') || s.name?.includes('arm slot'))?.score),
      trunkTilt: neg(releasePos?.subs?.find(s => s.name?.includes('몸통'))?.score),
      layback: neg(powerOutput?.subs?.find(s => s.name?.includes('Max ER'))?.score),
      stride: neg(footContact?.subs?.find(s => s.name?.includes('Stride'))?.score),
      fcRelease: neg(releaseTiming?.subs?.find(s => s.name?.includes('FC'))?.score)
    };

    // measured — 핵심 일관성 지표 raw 값
    const measured = {
      wristHeightSdCm: sm.wristHeight?.sd != null ? r2(sm.wristHeight.sd * 100) : null,
      armSlotSdDeg: r2(sm.armSlotAngle?.sd),
      trunkTiltSdDeg: r2(sm.trunkForwardTilt?.sd),
      laybackCvPct: r2(sm.maxER?.cv),
      strideCvPct: r2(sm.strideLength?.cv),
      fcReleaseMs: r0(sm.fcBrMs?.mean),
      fcReleaseCvPct: r1(sm.fcBrMs?.cv)
    };

    // strikePct, plateSdCm은 직접 측정 불가 — 추정값으로 대체 (Domain 등급 기반)
    const gradeToScore = { A: 4, B: 3, C: 2, D: 1 };
    const overallScore = gradeToScore[overall] || 0;
    const estStrikePct = overallScore === 4 ? 75 : overallScore === 3 ? 65 : overallScore === 2 ? 58 : overallScore === 1 ? 50 : null;
    const estPlateSd = overallScore === 4 ? 14 : overallScore === 3 ? 18 : overallScore === 2 ? 22 : overallScore === 1 ? 28 : null;

    // ─── 5 Domain Radar Data (files report.jsx toCommandRadarData 포팅) ───
    // 각 도메인 score(0~4)를 inverted 값(5-score)으로 변환 후 RadarChart에 전달
    // RadarChart는 lo=50, hi=80 기준, value < lo = 미흡, value > hi = 우수
    // domains의 grade를 0-100 점수로 변환: A→90, B→70, C→50, D→30, N/A→null
    const gradeRadarValue = { A: 90, B: 70, C: 50, D: 30, 'N/A': null };
    const radarData = domains.map(d => {
      // score 기반으로 더 정밀한 점수 계산
      let radarVal;
      if (d.score == null || d.score === 0) {
        radarVal = gradeRadarValue[d.grade] ?? null;
      } else {
        // score 0~4 범위를 30~95 점수로 매핑 (0→30, 4→95)
        radarVal = 30 + (d.score / 4) * 65;
      }
      return {
        label: d.name,
        sub: d.icon ? `${d.icon} ${d.grade || '—'}` : (d.desc || ''),
        value: radarVal,
        lo: 50, hi: 80,
        display: d.grade === 'N/A' ? '—' : d.grade
      };
    });

    // note — domain별 등급 요약
    const domainGrades = domains.map(d => d.grade).join('/');
    const validCount = domains.filter(d => d.grade && d.grade !== 'N/A' && d.grade !== 'D').length;
    const totalCount = domains.length;
    const note = `· 5개 Domain 종합: ${domainGrades} · ${validCount}/${totalCount} 양호`;

    return {
      strikePct: estStrikePct,
      plateSdCm: estPlateSd,
      grade: overall,
      breakdown,
      measured,
      note,
      isDemo: true,  // 추정값임을 표시
      nTrials: bioCmd.nUsedForCommand || 10,
      radarData,     // 5 Domain RadarChart용
      domains        // 원본 도메인 정보 (subs 포함)
    };
  }

  // ═════════════════════════════════════════════════════════════════
  // Sequence 데이터 (P→T→A 타이밍)
  // ═════════════════════════════════════════════════════════════════
  function buildSequence(sm, sequencing) {
    const ptLag = sm.ptLagMs?.mean;
    const taLag = sm.taLagMs?.mean;
    const ptCv = sm.ptLagMs?.cv;
    const taCv = sm.taLagMs?.cv;

    return {
      pelvisMs: 0,
      trunkMs: ptLag != null ? r0(ptLag) : null,
      armMs:   (ptLag != null && taLag != null) ? r0(ptLag + taLag) : null,
      g1: ptLag != null ? r0(ptLag) : null,
      g2: taLag != null ? r0(taLag) : null,
      comment: buildSequenceComment(ptLag, taLag, ptCv, taCv)
    };
  }

  // ═════════════════════════════════════════════════════════════════
  // Angular 데이터
  // ═════════════════════════════════════════════════════════════════
  function buildAngular(sm) {
    const pelvis = sm.peakPelvisVel?.mean;
    const trunk  = sm.peakTrunkVel?.mean;
    const arm    = sm.peakArmVel?.mean;
    const gainPT = (pelvis != null && trunk != null && pelvis > 0) ? trunk / pelvis : null;
    const gainTA = (trunk != null && arm != null && trunk > 0) ? arm / trunk : null;

    return {
      pelvis: r0(pelvis),
      trunk:  r0(trunk),
      arm:    r0(arm),
      pelvisBand: bandFromRange(pelvis, REF.pelvis.low, REF.pelvis.high),
      trunkBand:  bandFromRange(trunk,  REF.trunk.low,  REF.trunk.high),
      armBand:    bandFromRange(arm,    REF.arm.low,    REF.arm.high),
      gainPT: r2(gainPT) != null ? gainPT : 0,
      gainTA: r2(gainTA) != null ? gainTA : 0,
      comment: buildAngularComment(pelvis, trunk, arm)
    };
  }

  // ═════════════════════════════════════════════════════════════════
  // Energy 데이터
  // ═════════════════════════════════════════════════════════════════
  function buildEnergy(sm, energy) {
    const etiPT = sm.etiPT?.mean;
    const etiTA = sm.etiTA?.mean;
    const leakRate = energy?.leakRate;
    let leakPct = 0;
    if (etiTA != null && etiTA < 0.85) {
      leakPct = Math.round((1 - etiTA) * 100);
    }
    return {
      etiPT: r2(etiPT) != null ? etiPT : 0,
      etiTA: r2(etiTA) != null ? etiTA : 0,
      leakPct: leakPct,
      comment: buildEnergyComment(etiPT, etiTA, leakPct)
    };
  }

  // ═════════════════════════════════════════════════════════════════
  // Precision 데이터 (5편 논문 정밀 지표 — IntegratedKineticDiagram용)
  //   - elbowEff:        Sabick 2004 elbow load efficiency
  //   - cockPowerWPerKg: Naito 2014 cocking phase arm power
  //   - transferTA_KE:   Aguinaldo & Escamilla 2019 trunk → arm KE transfer
  //   - legAsymmetry:    Crotin et al. 2014 stride/pivot leg symmetry
  //   - peakPivotHipVel / peakStrideHipVel:  pivot vs stride hip joint vel
  // ═════════════════════════════════════════════════════════════════
  function buildPrecision(sm) {
    // 무릎 무너짐 = FC→BR 굴곡 변화량
    const kneeCollapse = (sm.kneeFlexionAtFC?.mean != null && sm.kneeFlexionAtBR?.mean != null)
      ? r1(sm.kneeFlexionAtFC.mean - sm.kneeFlexionAtBR.mean)  // 양수=무너짐
      : null;
    // SSC: 우리 시스템에서 직접 계산되지 않으면 null (RSI-mod 등으로 추정 가능)
    return {
      elbowEff:         sm.elbowLoadEfficiency?.mean ?? null,
      cockPowerWPerKg:  sm.cockingPhaseArmPowerWPerKg?.mean ?? null,
      transferTA_KE:    sm.transferTA_KE?.mean ?? null,
      legAsymmetry:     sm.legAsymmetryRatio?.mean ?? null,
      peakPivotHipVel:  sm.peakPivotHipVel?.mean ?? null,
      peakStrideHipVel: sm.peakStrideHipVel?.mean ?? null,
      // ⭐ v8 — 신규 (마네킹 카드 표시용)
      kneeCollapseDeg:  kneeCollapse,                              // 무릎 무너짐 (양수=무너짐)
      kneeSscMs:        sm.kneeSscDurationMs?.mean ?? null,        // SSC 전환 시간
      flyingOpenDeg:    sm.trunkRotAtFP?.mean ?? null,             // 플라잉오픈 (FC 시점 trunk 회전)
      trunkFlexAtBRDeg: sm.trunkForwardTilt?.mean != null
                          ? Math.abs(sm.trunkForwardTilt.mean)
                          : null,                                   // 릴리즈 시 몸통 굴곡
      // ⭐ v10 — FC 시점 몸통 전방 굴곡 (부호 보존: 앞=+, 뒤=−)
      // 직립(0°) 또는 약간 뒤로 젖힌 상태(음수)가 이상적
      trunkFlexAtFCDeg: sm.trunkForwardTiltAtFC?.mean ?? null
    };
  }

  // ═════════════════════════════════════════════════════════════════
  // Kinetic Chain 데이터 (Section 05 — 분절 KE/Power/Transfer/Elbow)
  // files report.jsx Section 5 데이터 매핑
  // ═════════════════════════════════════════════════════════════════
  function buildKineticChain(sm) {
    function statusKE_PT(v) {
      if (v == null) return { tone: 'na', text: '—' };
      if (v >= 5)   return { tone: 'good', text: '강한 증폭' };
      if (v >= 3)   return { tone: 'mid',  text: '정상 증폭' };
      if (v >= 1.5) return { tone: 'low',  text: '약한 증폭' };
      return { tone: 'bad', text: '미약' };
    }
    function statusKE_TA(v) {
      if (v == null) return { tone: 'na', text: '—' };
      if (v >= 2.5) return { tone: 'good', text: '강한 증폭' };
      if (v >= 1.7) return { tone: 'mid',  text: '정상 증폭' };
      if (v >= 1.0) return { tone: 'low',  text: '약한 증폭' };
      return { tone: 'bad', text: '에너지 손실' };
    }
    const pt_KE = sm.transferPT_KE?.mean;
    const ta_KE = sm.transferTA_KE?.mean;
    return {
      // 분절 회전 KE (Naito 2011, Ae 1992 — ½·I·ω²)
      KE_pelvis: { val: r1(sm.KE_pelvis?.mean), sd: r1(sm.KE_pelvis?.sd), total: r1(sm.KE_pelvis_total?.mean) },
      KE_trunk:  { val: r1(sm.KE_trunk?.mean),  sd: r1(sm.KE_trunk?.sd),  total: r1(sm.KE_trunk_total?.mean) },
      KE_arm:    { val: r1(sm.KE_arm?.mean),    sd: r1(sm.KE_arm?.sd),    total: r1(sm.KE_arm_total?.mean) },
      // Transfer ratios (회전 KE 비율 — 키네틱 체인 amplification)
      transferPT_KE: { val: r1(pt_KE), ...statusKE_PT(pt_KE) },
      transferTA_KE: { val: r1(ta_KE), ...statusKE_TA(ta_KE) },
      // Peak instantaneous power (dE/dt)
      peakPowerTrunk: r0(sm.peakPowerTrunk?.mean),
      peakPowerArm:   r0(sm.peakPowerArm?.mean),
      // Elbow inverse dynamics (Yanai 2023)
      elbowPeakTorqueNm: { val: r1(sm.elbowPeakTorqueNm?.mean), sd: r1(sm.elbowPeakTorqueNm?.sd) }
    };
  }

  // ═════════════════════════════════════════════════════════════════
  // Velocity Radar 데이터 (Section 06 — 5영역 종합)
  //   files report.jsx toVelocityRadarData 포팅
  //   5 axes: 팔 동작 / 하체 블록 / 자세 안정성 / 회전 동력 / ⭐ 키네틱 체인 효율
  //   각 축 0-100 점수 (50=엘리트 평균, 80=엘리트 상위)
  // ═════════════════════════════════════════════════════════════════
  function varToScore(value, eliteMedian, higherBetter, eliteLow, eliteHigh) {
    if (value == null || isNaN(value)) return null;
    if (eliteLow != null && eliteHigh != null) {
      const inRange = value >= eliteLow && value <= eliteHigh;
      if (inRange) {
        const distFromMedian = Math.abs(value - eliteMedian);
        const halfRange = Math.max(eliteMedian - eliteLow, eliteHigh - eliteMedian);
        return Math.min(80, 50 + (1 - distFromMedian / halfRange) * 30);
      }
      const overshoot = value < eliteLow ? (eliteLow - value) / Math.max(eliteLow, 1)
                                          : (value - eliteHigh) / Math.max(eliteHigh, 1);
      return Math.max(10, 50 - overshoot * 40);
    }
    if (higherBetter) {
      if (value <= 0) return 10;
      if (value <= eliteMedian) return Math.min(50, (value / eliteMedian) * 50);
      return Math.min(95, 50 + ((value - eliteMedian) / eliteMedian) * 60);
    }
    if (value <= 0) return 80;
    return Math.max(10, 80 - (value / eliteMedian) * 60);
  }
  function avgScores(scores) {
    const valid = scores.filter(s => s != null);
    if (valid.length === 0) return null;
    return valid.reduce((a, b) => a + b, 0) / valid.length;
  }
  function buildVelocityRadar(sm, energy) {
    // 1. 팔 동작 (Arm Mechanics) — MER · 팔 회전 속도 · Arm slot
    const armMechanics = avgScores([
      varToScore(sm.maxER?.mean,        178, false, 165, 195),
      varToScore(sm.peakArmVel?.mean,   1500, true),  // 한국 고교 우수 baseline
      varToScore(sm.armSlotAngle?.mean, 84, false, 50, 110)
    ]);
    // 2. 하체 블록 — 앞다리 신전 · 스트라이드 + 실제 전진 속도(peakCogVel) · 감속(cogDecel)
    const lowerBlock = avgScores([
      varToScore(sm.leadKneeExtAtBR?.mean, 11, true),
      varToScore(sm.strideRatio?.mean, 1.0, false, 0.85, 1.15),
      // peakCogVel — 한국 고교 ~ 2.4 m/s baseline (Driveline elite 2.84 m/s)
      sm.peakCogVel?.mean != null ? varToScore(sm.peakCogVel.mean, 2.4, true) : null,
      // cogDecel — 1.2 m/s baseline (elite 1.6 m/s)
      sm.cogDecel?.mean != null ? varToScore(sm.cogDecel.mean, 1.2, true) : null
    ]);
    // 3. ⭐ 변경 — "자세 안정성" → "로딩 능력": X-factor + Counter Rotation만 사용
    //    Loading capacity = 골반-몸통 분리 + 반대방향 회전(elastic 에너지 저장)
    const loadingCapacity = avgScores([
      // X-factor — 골반-몸통 분리각 (한국 고1 우수 35-50°)
      varToScore(sm.maxXFactor?.mean, 40, false, 30, 55),
      // Counter Rotation — 음수일수록 좋음 (반대방향 깊은 회전 = elastic 저장)
      sm.peakTorsoCounterRot?.mean != null
        ? varToScore(Math.abs(sm.peakTorsoCounterRot.mean), 30, true)
        : null
    ]);
    // 4. ⭐ 변경 — "회전 동력" → "회전 파워": 몸통 회전 속도만 사용
    //    구속과 가장 직접 상관 있는 단일 변인 (Stodden 2005, Aguinaldo 2007)
    //    baseline: 700°/s = 50점, 850°/s = 70점 (mid 중앙), 1000°/s = 90점
    const rotationPower = sm.peakTrunkVel?.mean != null
      ? Math.max(0, Math.min(100, (sm.peakTrunkVel.mean - 600) / 5))
      : null;
    // 5. ⭐ 키네틱 체인 효율 — 시퀀싱 + ETI + 누수율 통합
    const kineticChainScore = avgScores([
      sm.ptLagMs?.mean != null  ? varToScore(sm.ptLagMs.mean,  45, false, 25, 65) : null,
      sm.taLagMs?.mean != null  ? varToScore(sm.taLagMs.mean,  30, false, 15, 45) : null,
      sm.fcBrMs?.mean != null   ? varToScore(sm.fcBrMs.mean,   150, false, 130, 180) : null,
      sm.etiPT?.mean != null    ? Math.max(0, Math.min(100, (sm.etiPT.mean - 1.0) * 200)) : null,
      sm.etiTA?.mean != null    ? Math.max(0, Math.min(100, (sm.etiTA.mean - 1.0) * 143)) : null,
      energy?.leakRate != null  ? Math.max(0, Math.min(100, 100 - energy.leakRate * 2)) : null
    ]);

    function disp(v) { return v == null ? '—' : Math.round(v).toString(); }
    return [
      { label: '팔 동작',       sub: 'MER · 팔속도 · Arm slot',         dlMapping: 'Driveline: Arm Action',
        value: armMechanics, lo: 50, hi: 80, display: disp(armMechanics), isOurOwn: false },
      { label: '하체 블록',     sub: '앞다리 · 스트라이드 · CoG 속도/감속', dlMapping: 'Driveline: Block + CoG',
        value: lowerBlock, lo: 50, hi: 80, display: disp(lowerBlock), isOurOwn: false },
      { label: '로딩 능력',     sub: 'X-factor · Counter Rotation',     dlMapping: 'Elastic loading',
        value: loadingCapacity, lo: 50, hi: 80, display: disp(loadingCapacity), isOurOwn: false },
      { label: '회전 파워',     sub: '몸통 회전 속도 (구속 핵심)',         dlMapping: 'Driveline: Trunk Rotation',
        value: rotationPower, lo: 50, hi: 80, display: disp(rotationPower), isOurOwn: false },
      { label: '키네틱 체인 효율', sub: '시퀀싱(lag) + ETI(증폭) + 누수율',  dlMapping: '⭐ 우리 시스템 고유',
        value: kineticChainScore, lo: 50, hi: 80, display: disp(kineticChainScore), isOurOwn: true }
    ];
  }

  // ═════════════════════════════════════════════════════════════════
  // Consistency 데이터 (Section D — 제구 일관성, 5 영역별 카드)
  // files report.jsx Section 7 ConsistencyCard 데이터 포팅
  // ═════════════════════════════════════════════════════════════════
  function consistencyTone(value, threshold, lowerBetter) {
    if (value == null) return { tone: 'na', text: '—' };
    if (lowerBetter) {
      if (value <= threshold.elite) return { tone: 'good', text: '엘리트' };
      if (value <= threshold.good)  return { tone: 'mid',  text: '양호' };
      if (value <= threshold.ok)    return { tone: 'low',  text: '주의' };
      return { tone: 'bad', text: '부족' };
    }
    if (value >= threshold.elite) return { tone: 'good', text: '엘리트' };
    return { tone: 'mid', text: '—' };
  }
  function buildConsistency(sm, command) {
    const dByKey = command?.domains
      ? Object.fromEntries(command.domains.map(d => [d.key, d]))
      : {};
    function gradeOf(key) { return dByKey[key]?.grade || null; }

    // wrist height SD (m → cm 변환)
    const wristSdCm = sm.wristHeight?.sd != null ? sm.wristHeight.sd * 100 : null;

    return {
      // 1. Foot Contact — 키네틱 체인 시작점
      footContact: {
        grade: gradeOf('footContact'),
        cards: [
          { label: 'Stride 길이', value: r1(sm.strideLength?.cv), unit: 'CV%',
            threshold: { elite: 1.5, good: 3, ok: 5 }, lowerBetter: true,
            description: '디딤발 위치 일관성',
            ...consistencyTone(sm.strideLength?.cv, { elite: 1.5, good: 3, ok: 5 }, true) },
          { label: 'FC 무릎 굴곡', value: r1(sm.frontKneeFlex?.cv), unit: 'CV%',
            threshold: { elite: 5, good: 8, ok: 12 }, lowerBetter: true,
            description: '앞다리 무릎 굴곡 각도 일관성',
            ...consistencyTone(sm.frontKneeFlex?.cv, { elite: 5, good: 8, ok: 12 }, true) },
          { label: 'FC 시점 몸통 회전', value: r1(sm.trunkRotAtFP?.sd), unit: '° SD',
            threshold: { elite: 3, good: 5, ok: 8 }, lowerBetter: true,
            description: 'FC에서 몸통 회전 각 일관성',
            ...consistencyTone(sm.trunkRotAtFP?.sd, { elite: 3, good: 5, ok: 8 }, true) }
        ].filter(c => c.value != null)
      },
      // 2. Sequencing
      sequencing: {
        grade: gradeOf('sequencing'),
        cards: [
          { label: 'P→T 시퀀싱 (lag CV)', value: r1(sm.ptLagMs?.cv), unit: 'CV%',
            threshold: { elite: 8, good: 12, ok: 18 }, lowerBetter: true,
            description: '골반-몸통 가속 간격 일관성',
            ...consistencyTone(sm.ptLagMs?.cv, { elite: 8, good: 12, ok: 18 }, true) },
          { label: 'T→A 시퀀싱 (lag CV)', value: r1(sm.taLagMs?.cv), unit: 'CV%',
            threshold: { elite: 8, good: 12, ok: 18 }, lowerBetter: true,
            description: '몸통-팔 가속 간격 일관성',
            ...consistencyTone(sm.taLagMs?.cv, { elite: 8, good: 12, ok: 18 }, true) }
        ].filter(c => c.value != null)
      },
      // 3. Power Output
      powerOutput: {
        grade: gradeOf('powerOutput'),
        cards: [
          { label: 'Max ER 일관성', value: r1(sm.maxER?.cv), unit: 'CV%',
            threshold: { elite: 1.5, good: 3, ok: 5 }, lowerBetter: true,
            description: '최대 외회전 각도 일관성',
            ...consistencyTone(sm.maxER?.cv, { elite: 1.5, good: 3, ok: 5 }, true) },
          { label: '팔 각속도 일관성', value: r1(sm.peakArmVel?.cv), unit: 'CV%',
            threshold: { elite: 2, good: 4, ok: 7 }, lowerBetter: true,
            description: '상완 회전 속도의 시기 간 변동',
            ...consistencyTone(sm.peakArmVel?.cv, { elite: 2, good: 4, ok: 7 }, true) },
          { label: '몸통 각속도 일관성', value: r1(sm.peakTrunkVel?.cv), unit: 'CV%',
            threshold: { elite: 2, good: 4, ok: 7 }, lowerBetter: true,
            description: '몸통 회전 속도 일관성',
            ...consistencyTone(sm.peakTrunkVel?.cv, { elite: 2, good: 4, ok: 7 }, true) },
          { label: 'X-factor 일관성', value: r1(sm.maxXFactor?.cv), unit: 'CV%',
            threshold: { elite: 4, good: 7, ok: 12 }, lowerBetter: true,
            description: '골반-몸통 분리각 일관성',
            ...consistencyTone(sm.maxXFactor?.cv, { elite: 4, good: 7, ok: 12 }, true) }
        ].filter(c => c.value != null)
      },
      // 4. Release Position
      releasePos: {
        grade: gradeOf('releasePos'),
        cards: [
          { label: '손목 높이', value: r2(wristSdCm), unit: 'cm SD',
            threshold: { elite: 2, good: 4, ok: 6 }, lowerBetter: true,
            description: '릴리스 포인트의 수직 일관성',
            ...consistencyTone(wristSdCm, { elite: 2, good: 4, ok: 6 }, true) },
          { label: 'Arm slot 각도', value: r2(sm.armSlotAngle?.sd), unit: '° SD',
            threshold: { elite: 2, good: 3, ok: 5 }, lowerBetter: true,
            description: '팔 각도(슬롯)의 시기 간 변동',
            ...consistencyTone(sm.armSlotAngle?.sd, { elite: 2, good: 3, ok: 5 }, true) },
          { label: '몸통 전방 기울기', value: r2(sm.trunkForwardTilt?.sd), unit: '° SD',
            threshold: { elite: 2, good: 4, ok: 6 }, lowerBetter: true,
            description: '릴리스 시 몸통 자세 일관성',
            ...consistencyTone(sm.trunkForwardTilt?.sd, { elite: 2, good: 4, ok: 6 }, true) }
        ].filter(c => c.value != null)
      },
      // 5. Release Timing
      releaseTiming: {
        grade: gradeOf('releaseTiming'),
        cards: [
          { label: 'FC → 릴리스 시간 (CV)', value: r1(sm.fcBrMs?.cv), unit: 'CV%',
            threshold: { elite: 2, good: 5, ok: 10 }, lowerBetter: true,
            description: '앞발 착지 ~ 공 놓기까지 소요시간 변동 (제구 핵심)',
            ...consistencyTone(sm.fcBrMs?.cv, { elite: 2, good: 5, ok: 10 }, true) },
          { label: 'FC → 릴리스 시간 (절대)', value: r0(sm.fcBrMs?.mean), unit: 'ms',
            threshold: null, lowerBetter: false,
            description: '평균 소요시간. 일관성과 별개로 절대 시간',
            tone: 'na', text: '—' }
        ].filter(c => c.value != null)
      }
    };
  }

  // ═════════════════════════════════════════════════════════════════
  // Summary Scores (Section E — 종합 평가)
  //   ① 구속 점수 (메카닉 기반, files calcVelocityScore)
  //   ② 제구 점수 (일관성 기반, files calcCommandScore)
  //   ③ 체력 점수 (NEW! BBL 메타 CSV 기반)
  //   ④ 종합 점수 (가중 평균)
  //   ⑤ 우선순위 개선점 (구속·제구·체력 약점 통합)
  // ═════════════════════════════════════════════════════════════════
  function scoreToGrade(score) {
    if (score == null || isNaN(score)) return '—';
    if (score >= 92) return 'A+';
    if (score >= 85) return 'A';
    if (score >= 78) return 'A-';
    if (score >= 72) return 'B+';
    if (score >= 65) return 'B';
    if (score >= 58) return 'B-';
    if (score >= 52) return 'C+';
    if (score >= 45) return 'C';
    if (score >= 38) return 'C-';
    if (score >= 30) return 'D+';
    if (score >= 22) return 'D';
    return 'F';
  }
  function calcVelocityScore(sm, energy) {
    // ─── 한국 고교 우수 투수 기준 (band 평가와 점수 평가의 일관성 확보) ───
    // band low/mid/high 경계가 점수 30/60/85에 매핑되도록 piecewise 함수 사용
    // 평균 구속 130(고1평균)→60점, 145(우수)→80점, 155(엘리트)→95점
    function pwLinear(val, anchors) {
      // anchors: [[x0,y0],[x1,y1],...] 정렬된 배열
      if (val == null || isNaN(val)) return null;
      if (val <= anchors[0][0]) return Math.max(0, anchors[0][1] * (val / anchors[0][0]));
      for (let i = 1; i < anchors.length; i++) {
        if (val <= anchors[i][0]) {
          const [x0, y0] = anchors[i-1], [x1, y1] = anchors[i];
          return y0 + (val - x0) / (x1 - x0) * (y1 - y0);
        }
      }
      const last = anchors[anchors.length - 1];
      return Math.min(100, last[1] + (val - last[0]) * 0.05);
    }
    const parts = [];
    const sources = [];  // 점수 산출 근거
    function push(name, w, val, anchors, unit) {
      const score = pwLinear(val, anchors);
      if (Number.isFinite(score)) {
        parts.push({ w, v: score });
        sources.push({ name, weight: w, value: val, unit, score: Math.round(score) });
      }
    }
    // 평균 구속 (35%)
    if (sm.velocity?.mean != null) {
      push('평균 구속', 0.35, sm.velocity.mean, [[100,0],[130,60],[145,80],[155,95]], 'km/h');
    }
    // 몸통 각속도 (20%) — band 평가와 일관: 750=mid 시작=60점, 900=mid 끝=85점
    if (sm.peakTrunkVel?.mean != null) {
      push('몸통 각속도', 0.20, sm.peakTrunkVel.mean, [[600,30],[750,60],[900,85],[1050,100]], '°/s');
    }
    // MER (13%) — 130=low, 165-180=mid, 180+=high
    if (sm.maxER?.mean != null) {
      push('MER (어깨 외회전)', 0.13, sm.maxER.mean, [[130,30],[165,65],[180,85],[195,98]], '°');
    }
    // CoG 감속 (10%) — 1.0=mid 시작, 1.6=elite
    if (sm.cogDecel?.mean != null) {
      push('CoG 감속능력', 0.10, sm.cogDecel.mean, [[0.5,20],[1.0,55],[1.4,75],[1.8,95]], 'm/s');
    }
    // Lead knee BR (8%)
    if (sm.leadKneeExtAtBR?.mean != null) {
      push('앞다리 신전 (BR)', 0.08, sm.leadKneeExtAtBR.mean, [[-15,15],[0,50],[10,75],[20,95]], '°');
    }
    // Stride ratio (5%)
    if (sm.strideRatio?.mean != null && Number.isFinite(sm.strideRatio.mean)) {
      push('스트라이드 비율', 0.05, sm.strideRatio.mean, [[0.5,15],[0.8,55],[1.0,80],[1.2,95]], '×height');
    }
    // 팔 각속도 (5%) — 한국 고1 우수 1350-1550 mid 범위
    if (sm.peakArmVel?.mean != null) {
      push('팔 각속도', 0.05, sm.peakArmVel.mean, [[1100,30],[1350,60],[1550,85],[1800,100]], '°/s');
    }
    // ETI 합산 (4%)
    if (sm.etiPT?.mean != null && sm.etiTA?.mean != null) {
      const e = (Math.min(100, (sm.etiPT.mean - 0.7) * 80) + Math.min(100, (sm.etiTA.mean - 0.8) * 75)) / 2;
      const score = Math.max(0, e);
      parts.push({ w: 0.04, v: score });
      sources.push({ name: 'ETI 평균 (P→T·T→A)', weight: 0.04, value: ((sm.etiPT.mean + sm.etiTA.mean)/2).toFixed(2), unit: '×', score: Math.round(score) });
    }
    if (parts.length === 0) return { score: null, sources: [] };
    const totalW = parts.reduce((s, p) => s + p.w, 0);
    if (totalW === 0) return { score: null, sources: [] };
    const score = parts.reduce((s, p) => s + p.v * p.w, 0) / totalW;
    return Number.isFinite(score) ? { score, sources } : { score: null, sources };
  }
  function calcCommandScore(sm) {
    const parts = [];
    const sources = [];
    function pushCV(name, w, cvVal, multiplier, unit) {
      if (cvVal == null) return;
      const score = Math.max(0, Math.min(100, 100 - cvVal * multiplier));
      parts.push({ w, v: score });
      sources.push({ name, weight: w, value: cvVal.toFixed(1), unit, score: Math.round(score) });
    }
    function pushSD(name, w, sdVal, multiplier, unit) {
      if (sdVal == null) return;
      const score = Math.max(0, Math.min(100, 100 - sdVal * multiplier));
      parts.push({ w, v: score });
      sources.push({ name, weight: w, value: sdVal.toFixed(2), unit, score: Math.round(score) });
    }
    pushCV('FC→릴리스 시간 일관성', 0.30, sm.fcBrMs?.cv, 10, 'CV%');
    pushCV('스트라이드 길이 일관성', 0.20, sm.strideLength?.cv, 12, 'CV%');
    pushCV('Max ER 일관성',         0.20, sm.maxER?.cv, 6, 'CV%');
    pushSD('몸통 전방기울기 SD',    0.15, sm.trunkForwardTilt?.sd, 12, '°');
    pushSD('Arm slot 각도 SD',      0.15, sm.armSlotAngle?.sd, 15, '°');
    if (parts.length === 0) return { score: null, sources: [] };
    const totalW = parts.reduce((s, p) => s + p.w, 0);
    const score = parts.reduce((s, p) => s + p.v * p.w, 0) / totalW;
    return { score, sources };
  }
  // 체력 점수 — BBL 메타 CSV 기반 (band → 점수 변환)
  function calcFitnessScore(physical) {
    if (!physical) return { score: null, sources: [] };
    const bandToScore = { high: 95, mid: 70, low: 40, na: null };
    const bandLabel = { high: '상위', mid: '범위', low: '미만', na: '—' };
    const components = [
      { w: 0.25, v: bandToScore[physical.cmjPower?.band] ?? null,    name: '폭발력 (CMJ 단위파워)',
        rawValue: physical.cmjPower?.cmj, rawBand: physical.cmjPower?.band, unit: 'W/kg' },
      { w: 0.20, v: bandToScore[physical.maxStrength?.band] ?? null, name: '최대근력 (IMTP 단위근력)',
        rawValue: physical.maxStrength?.perKg, rawBand: physical.maxStrength?.band, unit: 'N/kg' },
      { w: 0.20, v: bandToScore[physical.reactive?.band] ?? null,    name: '반응성 (RSI-mod)',
        rawValue: physical.reactive?.cmj, rawBand: physical.reactive?.band, unit: 'm/s' },
      { w: 0.15, v: bandToScore[physical.ssc?.band] ?? null,         name: '탄성 활용 (EUR)',
        rawValue: physical.ssc?.value, rawBand: physical.ssc?.band, unit: '' },
      { w: 0.10, v: bandToScore[physical.release?.band] ?? null,     name: '악력 (Release Power)',
        rawValue: physical.release?.value, rawBand: physical.release?.band, unit: '' },
      { w: 0.10,
        v: physical.cmjPower?.sj != null ? Math.max(0, Math.min(100, (physical.cmjPower.sj - 25) * 3.8)) : null,
        name: '정지폭발 (SJ 단위파워)',
        rawValue: physical.cmjPower?.sj, rawBand: null, unit: 'W/kg' }
    ];
    const valid = components.filter(c => c.v != null);
    if (valid.length === 0) return { score: null, sources: [] };
    const totalW = valid.reduce((s, c) => s + c.w, 0);
    const score = valid.reduce((s, c) => s + c.v * c.w, 0) / totalW;
    const sources = valid.map(c => ({
      name: c.name,
      weight: c.w,
      value: c.rawValue != null ? c.rawValue : '—',
      unit: c.unit,
      band: c.rawBand,
      bandLabel: c.rawBand ? bandLabel[c.rawBand] : null,
      score: Math.round(c.v)
    }));
    return { score, sources };
  }
  // 우선순위 개선점 (체력 + 메카닉 + 일관성 통합)
  // ※ 임계값은 한국 고교 우수 baseline 기준으로 조정 — band 평가와 일관성 확보
  function generatePriorities(scores, sm, energy, physical) {
    const candidates = [];
    const { velocity, command, fitness } = scores;
    // 체력 약점 (low band만 — 진짜 약점만 표시)
    if (physical) {
      if (physical.cmjPower?.band === 'low') {
        candidates.push({ kind: 'fitness',
          weight: 90,
          title: '하체 폭발력 보강',
          detail: `CMJ 단위파워 ${physical.cmjPower.cmj ?? '—'} W/kg · 한국 고교 우수 기준 미만`,
          action: '스쿼트 점프, 반동 점프, 박스 점프, 데드리프트 → 발달자극'
        });
      }
      if (physical.maxStrength?.band === 'low') {
        candidates.push({ kind: 'fitness',
          weight: 85,
          title: '최대근력 보강',
          detail: `IMTP 단위근력 ${physical.maxStrength.perKg ?? '—'} N/kg · 한국 고교 우수 기준 미만`,
          action: '스쿼트, 데드리프트, 벤치프레스 4주 maximal strength block (3RM, 2-3세트)'
        });
      }
      if (physical.reactive?.band === 'low') {
        candidates.push({ kind: 'fitness',
          weight: 80,
          title: '반응성·SSC 보강',
          detail: `RSI-mod ${physical.reactive.cmj ?? '—'} m/s · 빠른 반동 부족`,
          action: '드롭 점프, 알트 점프, 짧은 접지시간 plyometric (CT < 200ms)'
        });
      }
    }
    // 구속 메카닉 약점 — 한국 고교 기준 미만일 때만 약점으로 인식
    if (velocity != null && velocity < 60) {
      if (energy?.leakRate > 20) {
        candidates.push({ kind: 'velocity',
          weight: 100 - velocity + (energy.leakRate - 20),
          title: '에너지 누수 줄이기',
          detail: `종합 누수율 ${energy.leakRate.toFixed(1)}% · 골반→몸통 전이 효율 점검`,
          action: '메디신볼 회전 던지기, 몸통 분리 드릴, 골반-몸통 분리각도 강화'
        });
      }
      // 한국 고교 우수 baseline은 1350-1550 (band low/mid 경계). low일 때만 약점 표시
      if (sm.peakArmVel?.mean != null && sm.peakArmVel.mean < 1350) {
        candidates.push({ kind: 'velocity',
          weight: 100 - velocity + (1350 - sm.peakArmVel.mean) / 30,
          title: '팔 회전 속도 향상',
          detail: `팔 peak 각속도 ${sm.peakArmVel.mean.toFixed(0)}°/s · 한국 고교 우수 1350+°/s`,
          action: '플라이오 볼 던지기 (200g·100g), 어깨 외회전 강화, J-band 루틴'
        });
      }
      // MER < 165 = 외회전 가동성 부족
      if (sm.maxER?.mean != null && sm.maxER.mean < 160) {
        candidates.push({ kind: 'velocity',
          weight: 100 - velocity + (160 - sm.maxER.mean),
          title: 'MER (어깨 외회전) 부족',
          detail: `${sm.maxER.mean.toFixed(0)}° (엘리트 170-185°)`,
          action: '슬리퍼 스트레치, 어깨 외회전 가동성 향상, sleeper stretch'
        });
      }
    }
    // 제구 일관성 약점 — files 임계값 그대로
    if (command != null && command < 65) {
      if (sm.fcBrMs?.cv != null && sm.fcBrMs.cv > 8) {
        candidates.push({ kind: 'command',
          weight: 90 - command + sm.fcBrMs.cv,
          title: '릴리스 타이밍 일관성',
          detail: `FC→릴리스 CV ${sm.fcBrMs.cv.toFixed(1)}% (엘리트 <2%)`,
          action: '메트로놈 투구 드릴, 동일 카운트로 릴리스 반복 훈련'
        });
      }
      if (sm.strideLength?.cv != null && sm.strideLength.cv > 5) {
        candidates.push({ kind: 'command',
          weight: 85 - command + sm.strideLength.cv,
          title: '디딤발 위치 일관성',
          detail: `스트라이드 CV ${sm.strideLength.cv.toFixed(1)}% (엘리트 <3%)`,
          action: '바닥 마커 배치 후 스트라이드 정확성 훈련, 체인 드릴'
        });
      }
      if (sm.armSlotAngle?.sd != null && sm.armSlotAngle.sd > 4) {
        candidates.push({ kind: 'command',
          weight: 80 - command + sm.armSlotAngle.sd * 2,
          title: '팔 슬롯 일관성',
          detail: `Arm slot SD ±${sm.armSlotAngle.sd.toFixed(2)}° (엘리트 <2°)`,
          action: '거울 보고 동일 슬롯 반복, T-드릴, 와인드업 일관성'
        });
      }
    }
    return candidates.sort((a, b) => b.weight - a.weight).slice(0, 5);
  }
  // Mechanical Ceiling — 메카닉 점수 100 도달 시 잠재 구속
  function calcMechanicalCeiling(sm, velocityScore) {
    if (sm.velocity?.mean == null || velocityScore == null) return null;
    const currentKmh = sm.velocity.mean;
    const currentMph = currentKmh / 1.609;
    const scoreGap = Math.max(0, 100 - velocityScore);
    const potentialMphGain = Math.min(8, scoreGap / 6);
    const ceilingMph = currentMph + potentialMphGain;
    return {
      ceilingMph: r1(ceilingMph),
      ceilingKmh: r1(ceilingMph * 1.609),
      potentialMphGain: r1(potentialMphGain),
      potentialKmhGain: r1(potentialMphGain * 1.609),
      currentKmh: r1(currentKmh),
      currentMph: r1(currentMph),
      velocityScore: r0(velocityScore)
    };
  }
  function buildSummaryScores(sm, energy, physical) {
    const velObj = calcVelocityScore(sm, energy);
    const cmdObj = calcCommandScore(sm);
    const fitObj = calcFitnessScore(physical);
    const velocity = velObj.score;
    const command  = cmdObj.score;
    const fitness  = fitObj.score;
    // 종합 — 3축 가중 평균 (구속 40%, 제구 30%, 체력 30%)
    let overall = null;
    const validParts = [];
    if (velocity != null) validParts.push({ w: 0.40, v: velocity });
    if (command  != null) validParts.push({ w: 0.30, v: command });
    if (fitness  != null) validParts.push({ w: 0.30, v: fitness });
    if (validParts.length > 0) {
      const tw = validParts.reduce((s, p) => s + p.w, 0);
      overall = validParts.reduce((s, p) => s + p.v * p.w, 0) / tw;
    }
    const ceiling = calcMechanicalCeiling(sm, velocity);
    const priorities = generatePriorities({ velocity, command, fitness }, sm, energy, physical);
    return {
      velocity:    { score: r0(velocity), grade: scoreToGrade(velocity), sources: velObj.sources },
      command:     { score: r0(command),  grade: scoreToGrade(command),  sources: cmdObj.sources },
      fitness:     { score: r0(fitness),  grade: scoreToGrade(fitness),  sources: fitObj.sources },
      overall:     { score: r0(overall),  grade: scoreToGrade(overall) },
      ceiling,
      priorities
    };
  }

  // ═════════════════════════════════════════════════════════════════
  // Layback 데이터
  // ═════════════════════════════════════════════════════════════════
  function buildLayback(sm) {
    const deg = sm.maxER?.mean;
    const sd  = sm.maxER?.sd;
    const band = bandFromRange(deg, REF.layback.low, REF.layback.high);
    return {
      deg: deg != null ? r1(deg) : 0,
      band,
      note: buildLaybackComment(deg, band, sd)
    };
  }

  // ═════════════════════════════════════════════════════════════════
  // 강점 / 약점 자동 생성
  // ═════════════════════════════════════════════════════════════════
  function buildStrengths(physical, summary, energy, command) {
    const out = [];
    // ─── 체력 강점 (band=high인 항목) ───
    if (physical.cmjPower?.band === 'high') {
      out.push({ title: '하체 단위파워 우수', detail: `· CMJ 단위파워 ${physical.cmjPower.cmj} W/kg · 기준 상위` });
    }
    if (physical.maxStrength?.band === 'high') {
      out.push({ title: '절대근력 우수', detail: `· IMTP ${physical.maxStrength.perKg} N/kg · 기준 상위` });
    }
    if (physical.reactive?.band === 'high') {
      out.push({ title: '반응·폭발성 (RSI) 우수', detail: `· CMJ RSI-mod ${physical.reactive.cmj} m/s · 기준 상위` });
    }
    if (physical.ssc?.band === 'high') {
      out.push({ title: '신장성 활용 (SSC) 우수', detail: `· EUR ${physical.ssc.value} · 탄성 회수 강함` });
    }
    if (physical.release?.band === 'high') {
      out.push({ title: '악력 우수', detail: `· 악력 ${physical.release.value} kg · 전완·손목 용량 충분` });
    }

    // ─── 메카닉 강점 (한국 고1 우수 기준 상회만 표시) ───
    const etiTA = summary.etiTA?.mean;
    if (etiTA != null && etiTA >= 1.7) {
      out.push({ title: '몸통→상완 에너지 전달 우수', detail: `· ETI T→A ${r2(etiTA)} · 효율적 amplification` });
    }
    const etiPT = summary.etiPT?.mean;
    if (etiPT != null && etiPT >= 1.5) {
      out.push({ title: '골반→몸통 에너지 전달 우수', detail: `· ETI P→T ${r2(etiPT)} · 키네틱 체인 시작 효율` });
    }
    const arm = summary.peakArmVel?.mean;
    if (arm != null && arm >= REF.arm.high) {
      out.push({ title: '상완 회전 속도 우수', detail: `· ${r0(arm)}°/s · 한국 고1 우수 기준 상회` });
    }
    const trunk = summary.peakTrunkVel?.mean;
    if (trunk != null && trunk >= REF.trunk.high) {
      out.push({ title: '몸통 회전 속도 우수', detail: `· ${r0(trunk)}°/s · 한국 고1 우수 기준 상회` });
    }
    const layback = summary.maxER?.mean;
    if (layback != null && layback >= REF.layback.high) {
      out.push({ title: '어깨 외회전 가동범위 우수', detail: `· Max Layback ${r1(layback)}° · 기준 상위` });
    }
    // ⭐ 신규 — 어깨 폭발력 (cocking arm power)
    const cock = summary.cockingPhaseArmPowerWPerKg?.mean;
    if (cock != null && cock >= 22) {
      out.push({ title: '어깨 폭발력 우수', detail: `· 코킹 arm power ${r1(cock)} W/kg · 폭발적 가속력` });
    }
    // ⭐ 신규 — 플라잉오픈 적정
    const flyingOpen = summary.trunkRotAtFP?.mean;
    if (flyingOpen != null && Math.abs(flyingOpen) < 5) {
      out.push({ title: '몸통 닫힘 유지 (플라잉오픈 안정)', detail: `· FC 시점 trunk rot ${r1(flyingOpen)}° · X-factor 보존` });
    }
    // ⭐ 신규 — 무릎 블록 (collapse -15~-5°)
    const kneeFC = summary.kneeFlexionAtFC?.mean;
    const kneeBR = summary.kneeFlexionAtBR?.mean;
    if (kneeFC != null && kneeBR != null) {
      const collapse = kneeFC - kneeBR;
      if (collapse >= -20 && collapse <= -5) {
        out.push({ title: '앞다리 블록 강함', detail: `· 무릎 ${r1(collapse)}° 신전 · 안정적 회전축 제공` });
      }
    }

    if (command?.overall === 'A') {
      out.push({ title: '제구 일관성 우수', detail: `· 5대 Domain 종합 A · 메카닉 일관성 안정` });
    }

    if (out.length === 0) {
      out.push({ title: '뚜렷한 우위 없음', detail: '· 모든 영역이 기준 범위 내 · 균형 보강 필요' });
    }
    return out.slice(0, 6);  // 최대 6개로 확장
  }

  function buildWeaknesses(physical, summary, energy, command) {
    const out = [];
    // ─── 메카닉 약점 ───
    const etiTA = summary.etiTA?.mean;
    if (etiTA != null && etiTA < 0.85) {
      const pct = Math.round((1 - etiTA) * 100);
      out.push({ title: '몸통→상완 에너지 누수', detail: `· ETI trunk→arm ${r2(etiTA)} · 약 ${pct}% 손실 · 기준 0.85 미만` });
    }
    const etiPT = summary.etiPT?.mean;
    if (etiPT != null && etiPT < 1.0) {
      out.push({ title: '골반→몸통 전달 부족', detail: `· ETI P→T ${r2(etiPT)} · X-factor 또는 시퀀싱 점검 필요` });
    }
    // ─── 체력 약점 (band=low) ───
    if (physical.cmjPower?.band === 'low') {
      out.push({ title: '하체 단위파워 기준 미만', detail: `· CMJ 단위파워 ${physical.cmjPower.cmj} W/kg · 기준 미만` });
    }
    if (physical.maxStrength?.band === 'low') {
      out.push({ title: '절대근력 부족', detail: `· IMTP ${physical.maxStrength.perKg} N/kg · 기준 미만` });
    }
    if (physical.reactive?.band === 'low') {
      out.push({ title: '반응성 부족', detail: `· CMJ RSI-mod ${physical.reactive.cmj} m/s · 기준 미만` });
    }
    // ─── 메카닉 약점 추가 ───
    const layback = summary.maxER?.mean;
    if (layback != null && layback < REF.layback.low) {
      out.push({ title: '어깨 외회전 가동범위 부족', detail: `· Max Layback ${r1(layback)}° · 가속 거리 부족` });
    }
    const arm = summary.peakArmVel?.mean;
    if (arm != null && arm < REF.arm.low) {
      out.push({ title: '상완 회전 속도 부족', detail: `· ${r0(arm)}°/s · 기준 ${REF.arm.low} 미만` });
    }
    const trunk = summary.peakTrunkVel?.mean;
    if (trunk != null && trunk < REF.trunk.low) {
      out.push({ title: '몸통 회전 속도 부족', detail: `· ${r0(trunk)}°/s · 기준 ${REF.trunk.low} 미만` });
    }
    // ⭐ 신규 — 플라잉오픈 (15° 이상)
    const flyingOpen = summary.trunkRotAtFP?.mean;
    if (flyingOpen != null && flyingOpen > 15) {
      out.push({ title: '플라잉오픈 (몸통 일찍 열림)', detail: `· FC 시점 trunk rot ${r1(flyingOpen)}° · X-factor 손실` });
    }
    // ⭐ 신규 — 무릎 무너짐 (collapse > +5°)
    const kneeFC = summary.kneeFlexionAtFC?.mean;
    const kneeBR = summary.kneeFlexionAtBR?.mean;
    if (kneeFC != null && kneeBR != null) {
      const collapse = kneeFC - kneeBR;
      if (collapse > 10) {
        out.push({ title: '앞다리 무릎 주저앉음', detail: `· 무릎 ${r1(collapse)}° 굴곡 증가 · 회전축 흔들림` });
      }
    }
    // ⭐ 신규 — 어깨 폭발력 부족
    const cock = summary.cockingPhaseArmPowerWPerKg?.mean;
    if (cock != null && cock < 15) {
      out.push({ title: '어깨 폭발력 부족', detail: `· 코킹 arm power ${r1(cock)} W/kg · 가속 부족` });
    }

    if (command?.overall === 'D' || command?.overall === 'C') {
      out.push({ title: '제구 일관성 부족', detail: `· 5대 Domain 종합 ${command.overall} · 메카닉 일관성 보강 필요` });
    }

    if (out.length === 0) {
      out.push({ title: '전 영역 기준 충족 · 뚜렷한 약점 없음', detail: '· 현재 수준을 유지하며 절대 근력 보강 시 추가 상승 여력' });
    }
    return out.slice(0, 6);
  }

  // ═════════════════════════════════════════════════════════════════
  // Flags 생성 (HIGH/MEDIUM/LOW severity)
  // ═════════════════════════════════════════════════════════════════
  function buildFlags(physical, summary, energy, command) {
    const flags = [];
    const etiTA = summary.etiTA?.mean;
    if (etiTA != null && etiTA < 0.85) {
      flags.push({
        severity: 'HIGH',
        title: '몸통→상완 에너지 누수',
        evidence: [`ETI trunk→arm ${r2(etiTA)} · 기준 0.85 미만`],
        implication: '· 몸통→상완 전달 손실 · lag drill 필요 · 흉추 회전 가동성 확보 · 분절 간 타이밍 재조정'
      });
    }

    const mass = physical.weightKg;
    if (physical.maxStrength?.band === 'low' && mass != null && mass < 70) {
      flags.push({
        severity: 'MEDIUM',
        title: '엔진 총량 부족 · 단위파워 양호 · 절대 용량 작음',
        evidence: [
          physical.maxStrength.abs ? `절대 근력 ${physical.maxStrength.abs} N (IMTP_F) · Low 범위` : '절대 근력 Low 범위',
          `체중 ${mass} kg`,
          physical.cmjPower?.cmj ? `CMJ 단위파워 ${physical.cmjPower.cmj} W/kg` : ''
        ].filter(Boolean),
        implication: '· 탄력·반응성 양호한 경우라도 근력·체중 총량 작으면 구속 천장 제한 · 중량 복합운동 중심 절대 근력·체중 증가 블록 우선'
      });
    }

    if (physical.cmjPower?.band === 'low' && physical.reactive?.band === 'low') {
      flags.push({
        severity: 'MEDIUM',
        title: '하체 폭발력·반응성 동반 부족',
        evidence: [
          `CMJ 단위파워 ${physical.cmjPower.cmj} W/kg`,
          physical.reactive?.cmj ? `RSI-mod ${physical.reactive.cmj} m/s` : ''
        ].filter(Boolean),
        implication: '· 점프·플라이오 + 절대 근력 동시 보강 블록 권장'
      });
    }

    if (command?.overall === 'D') {
      flags.push({
        severity: 'MEDIUM',
        title: '제구 일관성 D등급 · 메카닉 변동 큼',
        evidence: ['5개 Domain 종합 D · 시행간 변동 과다'],
        implication: '· 메카닉 일관성 회복이 최우선 · 시퀀스/타이밍 drill 위주 4-6주 블록'
      });
    }

    // ⭐ 신규 — 플라잉오픈 (15° 이상): 어깨 부담↑, 구속·제구 동시 저하
    const flyingOpen = summary.trunkRotAtFP?.mean;
    if (flyingOpen != null && flyingOpen > 15) {
      flags.push({
        severity: 'HIGH',
        title: '플라잉오픈 (몸통 일찍 열림)',
        evidence: [`FC 시점 trunk rot ${r1(flyingOpen)}° · 기준 < 5°`],
        implication: '· X-factor 손실로 회전 동력 약화 · 어깨 anterior force 증가 · open shoulder drill, mound 정렬 점검 필요'
      });
    }

    // ⭐ 신규 — 무릎 무너짐 (15° 이상): 디딤발 근력 부족
    const kneeFC = summary.kneeFlexionAtFC?.mean;
    const kneeBR = summary.kneeFlexionAtBR?.mean;
    if (kneeFC != null && kneeBR != null) {
      const collapse = kneeFC - kneeBR;
      if (collapse > 15) {
        flags.push({
          severity: 'HIGH',
          title: '앞다리 무릎 주저앉음 (knee collapse)',
          evidence: [`FC→BR 무릎 굴곡 +${r1(collapse)}° 증가 (정상: -15~-5°)`],
          implication: '· 회전축 흔들림으로 구속·제구 동시 저하 · 디딤발 근력 보강 (단발/오버헤드 스쿼트, RFE 스플릿 스쿼트) 필요'
        });
      }
    }

    // ⭐ 신규 — 어깨 폭발력 부족 (15 W/kg 미만)
    const cock = summary.cockingPhaseArmPowerWPerKg?.mean;
    if (cock != null && cock < 15) {
      flags.push({
        severity: 'MEDIUM',
        title: '어깨 폭발력 부족',
        evidence: [`코킹 arm power ${r1(cock)} W/kg · 기준 15 미만`],
        implication: '· 가속 단계 폭발력 부족 · 메디신볼 회전 던지기, 플라이오 볼 던지기, 어깨 외회전 강화 권장'
      });
    }

    // ⭐ 신규 — 팔꿈치 모멘트 위험 (130 N·m 이상): 부상 위험 신호
    const elbowTorque = summary.elbowPeakTorqueNm?.mean;
    if (elbowTorque != null && elbowTorque > 130) {
      flags.push({
        severity: 'HIGH',
        title: '팔꿈치 부하 위험 영역',
        evidence: [`Peak elbow moment ${r0(elbowTorque)} N·m · 위험 임계값 130 초과`],
        implication: '· UCL 부상 위험 ↑ · 즉시 동작 점검 필요 · 어깨 폭발력 증가 + 키네틱 체인 효율 개선으로 팔꿈치 부담 분산'
      });
    }

    return flags;
  }

  // ═════════════════════════════════════════════════════════════════
  // Training 추천 생성
  // ═════════════════════════════════════════════════════════════════
  function buildTraining(physical, summary, energy, command, factors) {
    const training = [];
    const etiTA = summary.etiTA?.mean;

    // 1) ETI 누수 → 메카닉 교정 우선
    if (etiTA != null && etiTA < 0.85) {
      training.push({
        cat: '메카닉', title: '몸통→상완 에너지 전달 개선 (셀프)', weeks: '4–6주',
        rationale: '· ETI trunk→arm 기준(0.85) 미만 · 분절 타이밍·흉추 가동성 핵심 축 · 매일 10분 수행',
        drills: [
          '수건 말아 겨드랑이 끼기 + 쉐도우 투구 30회 · 팔-몸통 분리 감각 형성',
          'Lag 드릴: 수건 끝 잡고 투구 20회 · 수건이 늦게 따라오는 느낌',
          'Open Book 흉추 모빌리티: 옆으로 누워 팔 여닫기 좌우 각 10회 × 2세트',
          '폼롤러 흉추 신전: 10회 × 2세트 (폼롤러 없으면 수건 말아서 대체)',
          '셀프 체크: 측면 셀카로 골반-어깨 분리각 유지(30–45°, 0.05초 이상) 확인'
        ]
      });
    }

    // 2) 단위파워 + 반응성 동반 부족 → 점프/플라이오
    if (physical.cmjPower?.band === 'low' || physical.reactive?.band === 'low') {
      training.push({
        cat: '파워', title: '파워 변환 (점프·플라이오 중심)', weeks: '6–8주',
        rationale: '· 절대 근력 양호한 편이나 폭발적 발현력 부족 · 점프·탄성 드릴로 RSI 개선',
        drills: [
          '뎁스 점프 (낮은 계단 30cm) 3세트 × 5회 · 땅 닿자마자 바로 점프',
          '회전 메디볼 던지기 (3–5kg) 좌우 각 4세트 × 6회 · 벽 대고 가능',
          '스플릿 점프 스쿼트 (자중·덤벨 선택) 3세트 × 6회 좌우 · 파워 변환 훈련',
          '브로드 점프 3세트 × 5회 · 매주 거리 기록',
          '셀프 체크: 점프 높이/거리가 4주 내 5–10% 증가하면 파워 변환 진행 중'
        ]
      });
    }

    // 3) 절대 근력 부족 → 근력·체중 증가 블록
    const mass = physical.weightKg;
    if (physical.maxStrength?.band === 'low' || (mass != null && mass < 70)) {
      training.push({
        cat: '근력', title: '근력·체중 증가 블록', weeks: '8–12주',
        rationale: '· 절대 근력/체중 작음 · 식단과 자중·덤벨 훈련 병행',
        drills: [
          '고블릿 스쿼트 (덤벨·배낭에 짐 넣어 대체 가능) 4세트 × 8–10회 · 주 2회',
          '불가리안 스플릿 스쿼트 3세트 × 8회 좌우 · 하체 근비대',
          '푸시업 (가중 옵션: 배낭) 4세트 × 최대 반복',
          '풀업/로우: 철봉 풀업 or 인버티드 로우',
          '식단: 하루 단백질 체중 1kg당 1.6–2.0g · 0.25–0.5 kg/주 체중 증가 목표',
          '셀프 체크: 매주 같은 요일·시간 체중 측정 · 사진 기록'
        ]
      });
    }

    // 4) 단위파워 우수 + 근력 보통 → 근력 보강 (단위파워 유지)
    if (physical.cmjPower?.band === 'high' && physical.maxStrength?.band !== 'high' && physical.maxStrength?.band !== 'na') {
      training.push({
        cat: '근력', title: '근력 보강 (단위파워 유지)', weeks: '6–8주',
        rationale: '· 단위파워 이미 우수 · 절대 근력 증가 시 파워 총량 동반 상승',
        drills: [
          '고블릿 스쿼트 (덤벨 1개) 4세트 × 6–8회 · 주 2회',
          '싱글 레그 루마니안 데드리프트 (덤벨) 3세트 × 8회',
          '스텝업 (의자·벤치) 3세트 × 10회 좌우 교대',
          '푸시업 변형 4세트 × 15회',
          '셀프 체크: 각 세트 후 자세 확인 · 무릎 안쪽 무너짐 없는지'
        ]
      });
    }

    // 5) 7대 요인 D등급 → 동작 교정 드릴
    if (Array.isArray(factors)) {
      const dFactors = factors.filter(f => f.grade === 'D');
      if (dFactors.length > 0) {
        const drillMap = {
          'F1_landing': { what: '앞발 착지 위치 일정화', how: '거울 앞 미러링 + foot strike marker로 매 투구 같은 위치에 착지하도록 반복' },
          'F2_separation': { what: '골반-몸통 분리 일관성', how: 'Hip Hinge Drill + Late Trunk Rotation cue (의식적으로 몸통 회전 늦추기)' },
          'F3_arm_timing': { what: '어깨-팔 타이밍 일관화', how: 'Connection Ball drill + Plyo Ball으로 팔 동작 패턴 자동화 (주 3회)' },
          'F4_knee': { what: '앞 무릎 안정성 (blocking) 회복', how: 'Single-Leg RDL + Single-Leg Squat + 앞다리 등척성 홀드 (주 2-3회)' },
          'F5_tilt': { what: '몸통 기울기 일관성', how: '코어 안정성 강화 + Side Plank, Rotational Core 운동 (주 3회)' },
          'F6_head': { what: '머리·시선 안정성 회복', how: 'Mirror Drill + 시선 고정 투구 + 호흡 통제' },
          'F7_wrist': { what: '손목 정렬 일관성', how: 'Towel Drill + 슬로우 모션 릴리스 반복 + 그립 일정화' }
        };
        dFactors.slice(0, 2).forEach(f => {
          const d = drillMap[f.id];
          if (d) {
            training.push({
              cat: '제구', title: d.what, weeks: '4–6주',
              rationale: `· ${f.name} D등급 · 시행간 변동 큼 · 메카닉 일관성 회복 우선`,
              drills: [
                d.how,
                '비디오 셀프 피드백 (측면 + 후면) 매 세션 기록',
                '주 3회 · 30분 · 무게 가벼운 공으로 반복',
                '셀프 체크: 4주 내 SD 50% 감소 목표'
              ]
            });
          }
        });
      }
    }

    // 6) 약점 없음 → 유지/발전 처방
    if (training.length === 0) {
      training.push({
        cat: '유지', title: '현재 수준 유지 + 균형 발전', weeks: '8–12주',
        rationale: '· 모든 영역 기준 충족 · 약점 없음 · 절대 근력 보강 시 추가 상승 여력',
        drills: [
          '주 2회 근력 운동 (스쿼트·데드리프트·벤치)',
          '주 3회 플라이오메트릭 + 메디볼',
          '주 1회 모빌리티/리커버리 세션',
          '체중 유지 (단백질 1.6g/kg)',
          '월 1회 영상 분석으로 일관성 모니터링'
        ]
      });
    }

    return training.slice(0, 4);
  }

  // ═════════════════════════════════════════════════════════════════
  // 메인 빌더
  // ═════════════════════════════════════════════════════════════════
  function build({ profile, velocity, bio, physical }) {
    if (!bio) {
      return { error: 'BBLAnalysis 결과가 없습니다' };
    }
    const sm = bio.summary || {};
    const fallbackDate = new Date().toISOString().slice(0, 10);

    // 기본 정보
    const base = {
      id: profile.id || `pitcher_${Date.now()}`,
      name: profile.name || '선수',
      nameEn: profile.nameEn || '',
      age: profile.age,
      bmi: profile.bmi,
      videoUrl: profile.videoUrl || null,
      velocity: velocity.max != null ? parseFloat(velocity.max) : (sm.velocity?.max || 0),
      velocityAvg: velocity.avg != null ? parseFloat(velocity.avg) : (sm.velocity?.mean || 0),
      spinRate: velocity.spinRate != null ? parseFloat(velocity.spinRate) : null,
      date: profile.date || fallbackDate
    };

    // 체력 데이터 통합 (heightCm, weightKg는 profile 우선)
    const phys = {
      ...physical,
      weightKg: profile.weightKg ? parseFloat(profile.weightKg) : physical.weightKg,
      heightCm: profile.heightCm ? parseFloat(profile.heightCm) : null
    };

    // Archetype/CoreIssue/Severity
    const archetypeInfo = classifyArchetype(phys, sm, bio.energy);
    const coreInfo = classifyCoreIssue(phys, sm, bio.energy, bio.command);
    const tags = buildTags(phys);

    // 5개 컴포넌트 구성
    const radar = buildRadar(phys);
    const sequence = buildSequence(sm, bio.sequencing);
    const angular  = buildAngular(sm);
    const energy   = buildEnergy(sm, bio.energy);
    const layback  = buildLayback(sm);
    const command  = buildCommand(bio.command, sm);
    const factors  = buildFactors(bio.factors, sm, bio.faultRates);
    const precision = buildPrecision(sm);

    // 신규 — Section 05/06/D/E 데이터
    const kineticChain  = buildKineticChain(sm);
    const velocityRadar = buildVelocityRadar(sm, bio.energy);
    const consistency   = buildConsistency(sm, bio.command);
    const summaryScores = buildSummaryScores(sm, bio.energy, phys);

    // 강점/약점/플래그 (트레이닝/드릴은 비활성화 — 빈 배열)
    const strengths  = buildStrengths(phys, sm, bio.energy, bio.command);
    const weaknesses = buildWeaknesses(phys, sm, bio.energy, bio.command);
    const flags      = buildFlags(phys, sm, bio.energy, bio.command);
    const training   = [];  // 사용자 요청에 따라 트레이닝 섹션 제거

    return {
      ...base,
      archetype: archetypeInfo.archetype,
      archetypeEn: archetypeInfo.archetypeEn,
      tags,
      coreIssue: coreInfo.coreIssue,
      coreIssueEn: coreInfo.coreIssueEn,
      severity: coreInfo.severity,
      physical: phys,
      radar,
      sequence,
      angular,
      energy,
      layback,
      command,
      factors,
      precision,
      kineticChain,    // Section 05 — KE/Power/Transfer/Elbow
      velocityRadar,   // Section 06 — 5축 구속 종합 레이더
      consistency,     // Section D  — 5영역 일관성 카드
      summaryScores,   // Section E  — 종합 점수 + 우선순위
      strengths,
      weaknesses,
      flags,
      training,
      _rawBio: bio,
      _rawPhysical: physical
    };
  }

  window.BBLDataBuilder = { build, REF };
})();
