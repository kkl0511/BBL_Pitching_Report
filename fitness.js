/* BBL Fitness CSV Parser
 * VALD ForceDecks / 포스덱 CSV 파일을 파싱하여 5대 체력 변수 추출
 * - Exposes: window.BBLFitness = { parseFitnessCSV, computeBands }
 *
 * 입력 형식 (유연한 매칭):
 *   - "Test Type" / "TestType" / "Test" 컬럼: CMJ, SJ, IMTP, Grip 등을 식별
 *   - 측정값 컬럼: Peak Power, Peak Force, Jump Height, RSI, ...
 *   - 단위: W, N, cm, kg, m/s 자동 인식
 *
 * 출력 형식 (Report 7 data.js 호환):
 *   {
 *     weightKg, heightCm,
 *     cmjPower:    { cmj, sj, cmjAbs, sjAbs, band },
 *     maxStrength: { abs, perKg, band },
 *     reactive:    { cmj, sj, band },
 *     ssc:         { value, band },
 *     release:     { value, band }
 *   }
 */
(function () {
  'use strict';

  // ─────────────────────────────────────────────────────────────────
  // 컬럼명 매칭 헬퍼 — 대소문자/공백/한글 무시하고 키워드 포함 여부 확인
  // ─────────────────────────────────────────────────────────────────
  function normalizeKey(s) {
    if (s == null) return '';
    return String(s).toLowerCase().replace(/[\s_\-()]/g, '');
  }
  function matchesAny(colName, keywords) {
    const n = normalizeKey(colName);
    return keywords.some(k => n.includes(normalizeKey(k)));
  }
  function findColumn(columns, keywordsList) {
    // keywordsList = [["peak", "power"], ...] — 모든 키워드를 포함하는 컬럼
    for (const col of columns) {
      const n = normalizeKey(col);
      for (const keywords of keywordsList) {
        if (keywords.every(k => n.includes(normalizeKey(k)))) return col;
      }
    }
    return null;
  }

  // ─────────────────────────────────────────────────────────────────
  // 테스트 타입 감지 — 행의 "Test" 또는 "Test Type" 컬럼에서 추출
  // ─────────────────────────────────────────────────────────────────
  function detectTestType(row, testCol) {
    const raw = row[testCol];
    if (raw == null) return null;
    const s = String(raw).toLowerCase();
    if (/cmj|countermovement/.test(s)) return 'CMJ';
    if (/(^|[^a-z])sj([^a-z]|$)|squat\s*jump/.test(s)) return 'SJ';
    if (/imtp|isometric.*mid.*thigh|midthigh/.test(s)) return 'IMTP';
    if (/grip|악력/.test(s)) return 'GRIP';
    return null;
  }

  // ─────────────────────────────────────────────────────────────────
  // 숫자 파싱 — 단위 문자, 콤마 제거
  // ─────────────────────────────────────────────────────────────────
  function num(v) {
    if (v == null || v === '') return null;
    if (typeof v === 'number') return isFinite(v) ? v : null;
    const cleaned = String(v).replace(/,/g, '').match(/-?[\d.]+/);
    if (!cleaned) return null;
    const n = parseFloat(cleaned[0]);
    return isFinite(n) ? n : null;
  }

  // ─────────────────────────────────────────────────────────────────
  // 평균 함수
  // ─────────────────────────────────────────────────────────────────
  function avg(arr) {
    const a = arr.filter(v => v != null && isFinite(v));
    return a.length ? a.reduce((x,y)=>x+y,0) / a.length : null;
  }

  // ═════════════════════════════════════════════════════════════════
  // 메인 파서
  // ═════════════════════════════════════════════════════════════════
  function parseFitnessCSV(rows, columns, opts) {
    opts = opts || {};
    const massInput = num(opts.weightKg);  // 사용자 입력 체중 (fallback용)

    if (!Array.isArray(rows) || rows.length === 0) {
      return { error: 'CSV에 데이터가 없습니다', raw: { rows: 0 } };
    }
    if (!Array.isArray(columns) || columns.length === 0) {
      columns = Object.keys(rows[0] || {});
    }

    // ── 핵심 컬럼 찾기 ──────────────────────────────────────────
    const testCol = findColumn(columns, [['test','type'], ['test'], ['exercise'], ['movement']]);
    const peakPowerCol = findColumn(columns, [
      ['concentric','peak','power'], ['peak','power','w'], ['peak','power'], ['power','w']
    ]);
    const peakPowerKgCol = findColumn(columns, [
      ['power','kg'], ['relative','power'], ['power','perkg']
    ]);
    const peakForceCol = findColumn(columns, [
      ['concentric','peak','force'], ['peak','force','n'], ['peak','force'], ['force','n']
    ]);
    const peakForceKgCol = findColumn(columns, [
      ['force','kg'], ['relative','force'], ['force','perkg']
    ]);
    const jumpHeightCol = findColumn(columns, [
      ['jump','height','imp'], ['jump','height','cm'], ['jump','height'], ['height','cm']
    ]);
    const rsiModCol = findColumn(columns, [
      ['rsi','modified'], ['rsi','mod'], ['mrsi'], ['rsi']
    ]);
    const massCol = findColumn(columns, [
      ['body','mass'], ['body','weight'], ['mass','kg']
    ]);
    const gripCol = findColumn(columns, [
      ['grip','strength'], ['grip','force','kg'], ['grip','kg'], ['grip']
    ]);

    // 측정 체중 (있으면 활용)
    let detectedMass = null;
    if (massCol) {
      const masses = rows.map(r => num(r[massCol])).filter(v => v != null && v > 30 && v < 200);
      if (masses.length) detectedMass = avg(masses);
    }
    const mass = detectedMass != null ? detectedMass : massInput;

    // ── 테스트별로 행 분류 ──────────────────────────────────────
    const byType = { CMJ: [], SJ: [], IMTP: [], GRIP: [] };
    if (testCol) {
      rows.forEach(r => {
        const t = detectTestType(r, testCol);
        if (t) byType[t].push(r);
      });
    }

    // ── 컬럼명에서 테스트 타입을 추론할 수 있는 경우 (wide 형식) ──
    // 예: "CMJ Peak Power", "SJ Peak Power", "IMTP Peak Force", "Grip"
    const wideCMJPower = findColumn(columns, [['cmj','peak','power'], ['cmj','power']]);
    const wideSJPower  = findColumn(columns, [['sj','peak','power'],  ['sj','power']]);
    const wideCMJHt    = findColumn(columns, [['cmj','jump','height'], ['cmj','height']]);
    const wideSJHt     = findColumn(columns, [['sj','jump','height'],  ['sj','height']]);
    const wideCMJRsi   = findColumn(columns, [['cmj','rsi'], ['cmj','rsi','mod']]);
    const wideSJRsi    = findColumn(columns, [['sj','rsi']]);
    const wideIMTPF    = findColumn(columns, [['imtp','peak','force'], ['imtp','force']]);

    function avgFromTypeOrCol(typeArr, col, wideCol) {
      // 1) Long format: byType의 해당 row들에서 col 평균
      if (typeArr.length && col) {
        const vals = typeArr.map(r => num(r[col])).filter(v => v != null);
        if (vals.length) return avg(vals);
      }
      // 2) Wide format: 모든 row의 wideCol 평균
      if (wideCol) {
        const vals = rows.map(r => num(r[wideCol])).filter(v => v != null);
        if (vals.length) return avg(vals);
      }
      return null;
    }

    // ── CMJ / SJ 측정값 추출 ────────────────────────────────────
    const cmjPowerKg = avgFromTypeOrCol(byType.CMJ, peakPowerKgCol, null);
    const cmjPowerAbs = avgFromTypeOrCol(byType.CMJ, peakPowerCol, wideCMJPower);
    const sjPowerKg  = avgFromTypeOrCol(byType.SJ,  peakPowerKgCol, null);
    const sjPowerAbs = avgFromTypeOrCol(byType.SJ,  peakPowerCol, wideSJPower);

    const cmjJumpHt = avgFromTypeOrCol(byType.CMJ, jumpHeightCol, wideCMJHt);
    const sjJumpHt  = avgFromTypeOrCol(byType.SJ,  jumpHeightCol, wideSJHt);

    const cmjRsiMod = avgFromTypeOrCol(byType.CMJ, rsiModCol, wideCMJRsi);
    const sjRsiMod  = avgFromTypeOrCol(byType.SJ,  rsiModCol, wideSJRsi);

    // ── IMTP ────────────────────────────────────────────────────
    const imtpAbs = avgFromTypeOrCol(byType.IMTP, peakForceCol, wideIMTPF);
    const imtpPerKg = avgFromTypeOrCol(byType.IMTP, peakForceKgCol, null);

    // ── Grip ────────────────────────────────────────────────────
    let grip = null;
    if (byType.GRIP.length) {
      // grip CSV는 row에 grip force 값이 있을 수 있음
      const colCandidates = [peakForceCol, gripCol, peakForceKgCol].filter(Boolean);
      for (const c of colCandidates) {
        const vals = byType.GRIP.map(r => num(r[c])).filter(v => v != null);
        if (vals.length) { grip = avg(vals); break; }
      }
    }
    if (grip == null && gripCol) {
      const vals = rows.map(r => num(r[gripCol])).filter(v => v != null);
      if (vals.length) grip = avg(vals);
    }
    // ForceDecks가 N으로 측정한 경우 kg으로 변환 (1 kg ≈ 9.81 N)
    if (grip != null && grip > 100) grip = grip / 9.81;

    // ── 단위파워 / 절대파워 계산 ────────────────────────────────
    let cmjW_kg = cmjPowerKg;
    let sjW_kg  = sjPowerKg;
    let cmjW    = cmjPowerAbs;
    let sjW     = sjPowerAbs;

    // 단위파워가 없으면 절대값/체중으로 계산
    if (cmjW_kg == null && cmjW != null && mass) cmjW_kg = cmjW / mass;
    if (sjW_kg  == null && sjW  != null && mass) sjW_kg  = sjW  / mass;
    // 절대값이 없으면 단위파워*체중으로 계산
    if (cmjW == null && cmjW_kg != null && mass) cmjW = cmjW_kg * mass;
    if (sjW  == null && sjW_kg  != null && mass) sjW  = sjW_kg  * mass;

    // ── 절대 IMTP / 단위 IMTP 계산 ──────────────────────────────
    let imtpAbsN = imtpAbs;
    let imtpN_kg = imtpPerKg;
    if (imtpAbsN == null && imtpN_kg != null && mass) imtpAbsN = imtpN_kg * mass;
    if (imtpN_kg == null && imtpAbsN != null && mass) imtpN_kg = imtpAbsN / mass;

    // ── EUR (Eccentric Utilization Ratio) = CMJ height / SJ height ──
    let eur = null;
    if (cmjJumpHt != null && sjJumpHt != null && sjJumpHt > 0) {
      eur = cmjJumpHt / sjJumpHt;
    }
    // 점프 높이가 없으면 단위파워 비로 fallback
    if (eur == null && cmjW_kg != null && sjW_kg != null && sjW_kg > 0) {
      eur = cmjW_kg / sjW_kg;
    }

    // ── RSI-mod (CMJ / SJ) ─────────────────────────────────────
    // ForceDecks RSI-mod는 jumpHeight(m) / contactTime(s)
    let cmjRSI = cmjRsiMod;
    let sjRSI  = sjRsiMod;

    // ── 측정 결측치 점검 + raw 디버그 정보 ─────────────────────
    const debug = {
      detectedColumns: {
        testCol, peakPowerCol, peakPowerKgCol, peakForceCol, peakForceKgCol,
        jumpHeightCol, rsiModCol, massCol, gripCol,
        wideCMJPower, wideSJPower, wideIMTPF
      },
      counts: {
        cmjRows: byType.CMJ.length,
        sjRows: byType.SJ.length,
        imtpRows: byType.IMTP.length,
        gripRows: byType.GRIP.length,
        totalRows: rows.length
      },
      detectedMass,
      usedMass: mass
    };

    return {
      raw: {
        cmjW, sjW, cmjW_kg, sjW_kg, cmjJumpHt, sjJumpHt,
        cmjRSI, sjRSI, eur, imtpAbsN, imtpN_kg, grip, mass
      },
      physical: buildPhysical({ cmjW, sjW, cmjW_kg, sjW_kg, cmjRSI, sjRSI, eur, imtpAbsN, imtpN_kg, grip, mass }),
      debug
    };
  }

  // ═════════════════════════════════════════════════════════════════
  // Band 계산 (Report 7 기준값 — 한국 대학생 투수 baseline)
  // ═════════════════════════════════════════════════════════════════
  function bandFromValue(value, mid_lo, mid_hi) {
    if (value == null || isNaN(value)) return 'na';
    if (value >= mid_hi) return 'high';
    if (value >= mid_lo) return 'mid';
    return 'low';
  }

  function buildPhysical(raw) {
    const { cmjW, sjW, cmjW_kg, sjW_kg, cmjRSI, sjRSI, eur, imtpAbsN, imtpN_kg, grip, mass } = raw;

    // 점프 파워 band — CMJ 단위파워 50 W/kg가 평균 baseline
    const cmjBand = bandFromValue(cmjW_kg, 40, 50);
    const sjBand  = bandFromValue(sjW_kg, 38, 50);
    // 두 점프의 종합 band
    let powerBand = 'na';
    if (cmjBand !== 'na' || sjBand !== 'na') {
      const score = (cmjBand === 'high' ? 2 : cmjBand === 'mid' ? 1 : cmjBand === 'low' ? 0 : null);
      const sscore= (sjBand  === 'high' ? 2 : sjBand  === 'mid' ? 1 : sjBand  === 'low' ? 0 : null);
      const valid = [score, sscore].filter(v => v != null);
      if (valid.length) {
        const avg = valid.reduce((a,b)=>a+b,0) / valid.length;
        powerBand = avg >= 1.5 ? 'high' : avg >= 0.5 ? 'mid' : 'low';
      }
    }

    // 절대 근력 band
    const strBand = imtpN_kg != null
      ? bandFromValue(imtpN_kg, 25, 35)
      : 'na';

    // 반응성 RSI band (CMJ RSI-mod 기준)
    let rsiBand = 'na';
    if (cmjRSI != null || sjRSI != null) {
      const candidates = [cmjRSI, sjRSI].filter(v => v != null);
      const m = candidates.reduce((a,b)=>a+b,0) / candidates.length;
      rsiBand = bandFromValue(m, 0.30, 0.55);
    }

    // SSC (EUR) band — 1.0 = SSC 활용 없음, 1.10 이상 우수
    const sscBand = eur != null ? bandFromValue(eur, 0.95, 1.10) : 'na';

    // 악력 band (kg)
    const gripBand = grip != null ? bandFromValue(grip, 50, 65) : 'na';

    // 반올림
    const r1 = v => v == null ? null : Math.round(v * 10) / 10;
    const r2 = v => v == null ? null : Math.round(v * 100) / 100;
    const r0 = v => v == null ? null : Math.round(v);

    return {
      weightKg: mass ? r1(mass) : null,
      cmjPower: {
        cmj: r1(cmjW_kg),
        sj:  r1(sjW_kg),
        cmjAbs: r0(cmjW),
        sjAbs:  r0(sjW),
        band: powerBand
      },
      maxStrength: {
        abs:   r0(imtpAbsN),
        perKg: r1(imtpN_kg),
        band:  strBand
      },
      reactive: {
        cmj: r2(cmjRSI),
        sj:  r2(sjRSI),
        band: rsiBand
      },
      ssc: {
        value: r2(eur),
        band:  sscBand
      },
      release: {
        value: r1(grip),
        band:  gripBand
      }
    };
  }

  // ═════════════════════════════════════════════════════════════════
  // 사용자 수동 입력 폴백 — fitness CSV 파싱 실패 시 직접 입력값 사용
  // ═════════════════════════════════════════════════════════════════
  function buildPhysicalFromManual(input) {
    const raw = {
      cmjW: num(input.cmjAbs),
      sjW:  num(input.sjAbs),
      cmjW_kg: num(input.cmjPerKg),
      sjW_kg:  num(input.sjPerKg),
      cmjRSI:  num(input.cmjRSI),
      sjRSI:   num(input.sjRSI),
      eur:     num(input.eur),
      imtpAbsN: num(input.imtpAbs),
      imtpN_kg: num(input.imtpPerKg),
      grip:     num(input.grip),
      mass:     num(input.weightKg)
    };
    // 자동 계산 보강
    if (raw.cmjW_kg == null && raw.cmjW != null && raw.mass) raw.cmjW_kg = raw.cmjW / raw.mass;
    if (raw.sjW_kg  == null && raw.sjW  != null && raw.mass) raw.sjW_kg  = raw.sjW  / raw.mass;
    if (raw.imtpN_kg == null && raw.imtpAbsN != null && raw.mass) raw.imtpN_kg = raw.imtpAbsN / raw.mass;
    if (raw.imtpAbsN == null && raw.imtpN_kg != null && raw.mass) raw.imtpAbsN = raw.imtpN_kg * raw.mass;
    return buildPhysical(raw);
  }

  // ═════════════════════════════════════════════════════════════════
  window.BBLFitness = { parseFitnessCSV, buildPhysicalFromManual, buildPhysical };
})();
