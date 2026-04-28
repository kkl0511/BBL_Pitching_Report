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
  const REF = {
    pelvis:  { low: 580, high: 640 },
    trunk:   { low: 800, high: 900 },
    arm:     { low: 1450, high: 1600 },
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
      nTrials: bioCmd.nUsedForCommand || 10
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

    const etiTA = summary.etiTA?.mean;
    if (etiTA != null && etiTA >= 1.5) {
      out.push({ title: '몸통→상완 에너지 전달 우수', detail: `· ETI T→A ${r2(etiTA)} · 효율 전달` });
    }

    const arm = summary.peakArmVel?.mean;
    if (arm != null && arm >= REF.arm.high) {
      out.push({ title: '상완 회전 속도 우수', detail: `· ${r0(arm)}°/s · 기준 상위` });
    }

    const layback = summary.maxER?.mean;
    if (layback != null && layback >= REF.layback.high) {
      out.push({ title: '어깨 외회전 가동범위 우수', detail: `· Max Layback ${r1(layback)}° · 기준 상위` });
    }

    if (command?.overall === 'A') {
      out.push({ title: '제구 일관성 우수', detail: `· 5대 Domain 종합 A · 메카닉 일관성 안정` });
    }

    if (out.length === 0) {
      out.push({ title: '뚜렷한 우위 없음', detail: '· 모든 영역이 기준 범위 내 · 균형 보강 필요' });
    }
    return out.slice(0, 5);
  }

  function buildWeaknesses(physical, summary, energy, command) {
    const out = [];
    const etiTA = summary.etiTA?.mean;
    if (etiTA != null && etiTA < 0.85) {
      const pct = Math.round((1 - etiTA) * 100);
      out.push({ title: '몸통→상완 에너지 누수', detail: `· ETI trunk→arm ${r2(etiTA)} · 약 ${pct}% 손실 · 기준 0.85 미만` });
    }
    if (physical.cmjPower?.band === 'low') {
      out.push({ title: '하체 단위파워 기준 미만', detail: `· CMJ 단위파워 ${physical.cmjPower.cmj} W/kg · 기준 40 미만` });
    }
    if (physical.maxStrength?.band === 'low') {
      out.push({ title: '절대근력 부족', detail: `· IMTP ${physical.maxStrength.perKg} N/kg · 기준 25 미만` });
    }
    if (physical.reactive?.band === 'low') {
      out.push({ title: '반응성 부족', detail: `· CMJ RSI-mod ${physical.reactive.cmj} m/s · 기준 0.30 미만` });
    }

    const layback = summary.maxER?.mean;
    if (layback != null && layback < REF.layback.low) {
      out.push({ title: '어깨 외회전 가동범위 부족', detail: `· Max Layback ${r1(layback)}° · 가속 거리 부족` });
    }

    const arm = summary.peakArmVel?.mean;
    if (arm != null && arm < REF.arm.low) {
      out.push({ title: '상완 회전 속도 부족', detail: `· ${r0(arm)}°/s · 기준 1450 미만` });
    }

    if (command?.overall === 'D' || command?.overall === 'C') {
      out.push({ title: '제구 일관성 부족', detail: `· 5대 Domain 종합 ${command.overall} · 메카닉 일관성 보강 필요` });
    }

    if (out.length === 0) {
      out.push({ title: '전 영역 기준 충족 · 약점 없음', detail: '· 현재 수준을 유지하며 절대 근력 보강 시 추가 상승 여력' });
    }
    return out.slice(0, 5);
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
      strengths,
      weaknesses,
      flags,
      training,
      // 디버그용 raw 분석 결과
      _rawBio: bio,
      _rawPhysical: physical
    };
  }

  window.BBLDataBuilder = { build, REF };
})();
