/* BBL Player Meta CSV Parser
 * 선수 메타데이터 CSV 1개에서 프로필 + 구속 + 체력 정보를 한 번에 추출.
 *
 * 입력 CSV 형식 (1행 데이터, 첫 행만 사용):
 *   Name, Date, Height [M], BW [KG], BMI, Handedness,
 *   Max Velocity, Average Velocity, Average Spin Rate,
 *   CMJ Jump Height [cm], CMJ Peak Power [W], CMJ Peak Power / BM [W/kg], CMJ RSI-modified [m/s],
 *   SJ Jump Height [cm], SJ Peak Power [W], SJ Peak Power / BM [W/kg], SJ RSI-modified [m/s],
 *   EUR,
 *   IMTP Peak Vertical Force [N], IMTP Peak Vertical Force / BM [N/kg],
 *   Grip Strength
 *   * Shoulder ROM, Hip ROM, Sprint, Agility는 무시
 *
 * 출력:
 *   {
 *     profile: { name, date, heightCm, weightKg, bmi, throwingHand },
 *     velocity: { max, avg, spinRate },
 *     physical: { cmjPower, maxStrength, reactive, ssc, release } (Report 7 형식)
 *   }
 *
 * Exposes: window.BBLPlayerMeta = { parseMetaCSV }
 */
(function () {
  'use strict';

  // ─────────────────────────────────────────────────────────────
  // 컬럼명 매칭 — 공백/괄호/단위/슬래시 무시 부분 일치
  // ─────────────────────────────────────────────────────────────
  function normKey(s) {
    return String(s == null ? '' : s).toLowerCase().replace(/[\s_\-()\/[\]]/g, '');
  }
  function findCol(columns, keywords, excludeKeywords) {
    for (const col of columns) {
      const n = normKey(col);
      const ok = keywords.every(k => n.includes(normKey(k)));
      if (!ok) continue;
      if (excludeKeywords && excludeKeywords.some(e => n.includes(normKey(e)))) continue;
      return col;
    }
    return null;
  }
  function num(v) {
    if (v == null || v === '') return null;
    if (typeof v === 'number') return isFinite(v) ? v : null;
    const cleaned = String(v).replace(/,/g, '').match(/-?[\d.]+/);
    if (!cleaned) return null;
    const n = parseFloat(cleaned[0]);
    return isFinite(n) ? n : null;
  }

  // ─────────────────────────────────────────────────────────────
  // 핸드니스 정규화
  // ─────────────────────────────────────────────────────────────
  function normHand(v) {
    if (v == null) return 'R';
    const s = String(v).trim().toUpperCase();
    if (s.startsWith('L') || s === '좌투' || s === '왼손') return 'L';
    return 'R';
  }

  // ─────────────────────────────────────────────────────────────
  // 날짜 정규화 (DD/MM/YYYY → YYYY-MM-DD)
  // ─────────────────────────────────────────────────────────────
  function normDate(v) {
    if (v == null) return null;
    const s = String(v).trim();
    if (!s) return null;
    // ISO 형식이면 그대로
    if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
    // DD/MM/YYYY 또는 D/M/YYYY
    const m = s.match(/^(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{4})/);
    if (m) {
      const dd = m[1].padStart(2, '0');
      const mm = m[2].padStart(2, '0');
      const yyyy = m[3];
      return `${yyyy}-${mm}-${dd}`;
    }
    return s; // 알 수 없는 형식 그대로
  }

  // ─────────────────────────────────────────────────────────────
  // Band 분류 (Report 7 baseline 기준)
  // ─────────────────────────────────────────────────────────────
  function bandFromValue(value, mid_lo, mid_hi) {
    if (value == null || isNaN(value)) return 'na';
    if (value >= mid_hi) return 'high';
    if (value >= mid_lo) return 'mid';
    return 'low';
  }

  // ─────────────────────────────────────────────────────────────
  // Physical band 종합
  // ─────────────────────────────────────────────────────────────
  function buildPhysical(raw) {
    const { cmjW, sjW, cmjW_kg, sjW_kg, cmjRSI, sjRSI, eur,
            imtpAbsN, imtpN_kg, grip, mass } = raw;

    // CMJ/SJ 단위파워 종합
    const cmjBand = bandFromValue(cmjW_kg, 40, 50);
    const sjBand  = bandFromValue(sjW_kg,  38, 50);
    let powerBand = 'na';
    const scoreMap = { high: 2, mid: 1, low: 0 };
    const valid = [cmjBand, sjBand].filter(b => b !== 'na').map(b => scoreMap[b]);
    if (valid.length) {
      const avg = valid.reduce((a, b) => a + b, 0) / valid.length;
      powerBand = avg >= 1.5 ? 'high' : avg >= 0.5 ? 'mid' : 'low';
    }

    const strBand = imtpN_kg != null ? bandFromValue(imtpN_kg, 25, 35) : 'na';

    let rsiBand = 'na';
    if (cmjRSI != null || sjRSI != null) {
      const candidates = [cmjRSI, sjRSI].filter(v => v != null);
      const m = candidates.reduce((a, b) => a + b, 0) / candidates.length;
      rsiBand = bandFromValue(m, 0.30, 0.55);
    }

    const sscBand = eur != null ? bandFromValue(eur, 0.95, 1.10) : 'na';
    const gripBand = grip != null ? bandFromValue(grip, 50, 65) : 'na';

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

  // ═════════════════════════════════════════════════════════════
  // 메인 파서
  // ═════════════════════════════════════════════════════════════
  function parseMetaCSV(rows, columns) {
    if (!Array.isArray(rows) || rows.length === 0) {
      return { error: '데이터 행이 없습니다' };
    }
    if (!Array.isArray(columns) || columns.length === 0) {
      columns = Object.keys(rows[0] || {});
    }
    const r = rows[0];  // 1행만 사용

    // ─── 선수 정보 컬럼 매칭 ──────────────────────────────────
    const nameCol  = findCol(columns, ['name']);
    const dateCol  = findCol(columns, ['date']);
    // Height — "Height [M]" (대부분의 경우 미터)
    const heightCol = findCol(columns, ['height']);
    // BW [KG]
    const bwCol    = findCol(columns, ['bw'])
                  || findCol(columns, ['body', 'weight'])
                  || findCol(columns, ['weight', 'kg']);
    const bmiCol   = findCol(columns, ['bmi']);
    const handCol  = findCol(columns, ['handed'])
                  || findCol(columns, ['throw']);

    // ─── 구속 컬럼 매칭 ──────────────────────────────────────
    // "Max Velocity" — Avg와 충돌하지 않도록 "average" 제외
    const maxVelCol = findCol(columns, ['max', 'velocity'], ['avg', 'average']);
    const avgVelCol = findCol(columns, ['average', 'velocity'])
                   || findCol(columns, ['avg', 'velocity']);
    const spinCol   = findCol(columns, ['spin']);

    // ─── 체력 컬럼 매칭 ──────────────────────────────────────
    // CMJ — BM 있는 것을 먼저 찾고, 절대값은 BM 제외
    const cmjPowerBmCol = findCol(columns, ['cmj', 'peak', 'power', 'bm']);
    const cmjPowerAbsCol = findCol(columns, ['cmj', 'peak', 'power'], ['bm', 'kg']);
    const cmjHtCol = findCol(columns, ['cmj', 'jump', 'height'])
                  || findCol(columns, ['cmj', 'height']);
    const cmjRsiCol = findCol(columns, ['cmj', 'rsi']);

    // SJ — 동일 패턴
    const sjPowerBmCol = findCol(columns, ['sj', 'peak', 'power', 'bm']);
    const sjPowerAbsCol = findCol(columns, ['sj', 'peak', 'power'], ['bm', 'kg']);
    const sjHtCol = findCol(columns, ['sj', 'jump', 'height'])
                 || findCol(columns, ['sj', 'height']);
    const sjRsiCol = findCol(columns, ['sj', 'rsi']);

    // EUR — 단일 컬럼
    const eurCol = findCol(columns, ['eur']);

    // IMTP
    const imtpForceBmCol = findCol(columns, ['imtp', 'force', 'bm']);
    const imtpForceAbsCol = findCol(columns, ['imtp', 'force'], ['bm', 'kg']);

    // Grip
    const gripCol = findCol(columns, ['grip']);

    // ─── 값 추출 ──────────────────────────────────────────────
    const profile = {
      name: nameCol ? String(r[nameCol] || '').trim() : '',
      date: dateCol ? normDate(r[dateCol]) : null,
      heightCm: null,  // 아래에서 단위 처리
      weightKg: num(bwCol ? r[bwCol] : null),
      bmi: num(bmiCol ? r[bmiCol] : null),
      throwingHand: handCol ? normHand(r[handCol]) : 'R'
    };

    // Height: 미터로 들어왔는지 cm으로 들어왔는지 확인
    const heightRaw = num(heightCol ? r[heightCol] : null);
    if (heightRaw != null) {
      // 1.5~2.2 사이면 미터, 100 이상이면 cm
      if (heightRaw < 3) profile.heightCm = Math.round(heightRaw * 100 * 10) / 10;
      else profile.heightCm = heightRaw;
    }

    const velocity = {
      max:      num(maxVelCol ? r[maxVelCol] : null),
      avg:      num(avgVelCol ? r[avgVelCol] : null),
      spinRate: num(spinCol   ? r[spinCol]   : null)
    };

    // ─── 체력 raw 값 추출 ────────────────────────────────────
    const cmjW    = num(cmjPowerAbsCol ? r[cmjPowerAbsCol] : null);
    const cmjW_kg = num(cmjPowerBmCol  ? r[cmjPowerBmCol]  : null);
    const sjW     = num(sjPowerAbsCol  ? r[sjPowerAbsCol]  : null);
    const sjW_kg  = num(sjPowerBmCol   ? r[sjPowerBmCol]   : null);
    const cmjHt   = num(cmjHtCol       ? r[cmjHtCol]       : null);
    const sjHt    = num(sjHtCol        ? r[sjHtCol]        : null);
    const cmjRSI  = num(cmjRsiCol      ? r[cmjRsiCol]      : null);
    const sjRSI   = num(sjRsiCol       ? r[sjRsiCol]       : null);
    let eur       = num(eurCol         ? r[eurCol]         : null);

    // EUR이 없으면 점프 높이 비로 계산
    if (eur == null && cmjHt != null && sjHt != null && sjHt > 0) {
      eur = cmjHt / sjHt;
    }
    // 그래도 없으면 단위파워 비로
    if (eur == null && cmjW_kg != null && sjW_kg != null && sjW_kg > 0) {
      eur = cmjW_kg / sjW_kg;
    }

    const imtpAbsN = num(imtpForceAbsCol ? r[imtpForceAbsCol] : null);
    const imtpN_kg = num(imtpForceBmCol  ? r[imtpForceBmCol]  : null);

    let grip = num(gripCol ? r[gripCol] : null);
    // 단위 보정: 100 이상이면 N으로 측정된 것 → kg으로 변환
    if (grip != null && grip > 100) grip = grip / 9.81;

    // 체력 raw 보강 (체중이 있으면 단위 ↔ 절대값 자동 변환)
    const mass = profile.weightKg;
    let cmjW_resolved = cmjW;
    let sjW_resolved  = sjW;
    let cmjW_kg_resolved = cmjW_kg;
    let sjW_kg_resolved  = sjW_kg;
    let imtpAbs_resolved = imtpAbsN;
    let imtpKg_resolved  = imtpN_kg;
    if (cmjW_resolved == null && cmjW_kg_resolved != null && mass) cmjW_resolved = cmjW_kg_resolved * mass;
    if (cmjW_kg_resolved == null && cmjW_resolved != null && mass) cmjW_kg_resolved = cmjW_resolved / mass;
    if (sjW_resolved == null  && sjW_kg_resolved != null  && mass) sjW_resolved = sjW_kg_resolved * mass;
    if (sjW_kg_resolved == null  && sjW_resolved != null  && mass) sjW_kg_resolved = sjW_resolved / mass;
    if (imtpAbs_resolved == null && imtpKg_resolved != null && mass) imtpAbs_resolved = imtpKg_resolved * mass;
    if (imtpKg_resolved == null  && imtpAbs_resolved != null && mass) imtpKg_resolved = imtpAbs_resolved / mass;

    const physical = buildPhysical({
      cmjW: cmjW_resolved, sjW: sjW_resolved,
      cmjW_kg: cmjW_kg_resolved, sjW_kg: sjW_kg_resolved,
      cmjRSI, sjRSI, eur,
      imtpAbsN: imtpAbs_resolved, imtpN_kg: imtpKg_resolved,
      grip, mass
    });

    return {
      profile,
      velocity,
      physical,
      raw: {
        cmjHt, sjHt,
        cmjW: cmjW_resolved, sjW: sjW_resolved,
        cmjW_kg: cmjW_kg_resolved, sjW_kg: sjW_kg_resolved,
        cmjRSI, sjRSI, eur,
        imtpAbsN: imtpAbs_resolved, imtpN_kg: imtpKg_resolved,
        grip
      },
      debug: {
        detectedColumns: {
          nameCol, dateCol, heightCol, bwCol, bmiCol, handCol,
          maxVelCol, avgVelCol, spinCol,
          cmjPowerAbsCol, cmjPowerBmCol, cmjHtCol, cmjRsiCol,
          sjPowerAbsCol, sjPowerBmCol, sjHtCol, sjRsiCol,
          eurCol, imtpForceAbsCol, imtpForceBmCol, gripCol
        },
        unusedColumns: columns.filter(c => {
          const used = new Set([
            nameCol, dateCol, heightCol, bwCol, bmiCol, handCol,
            maxVelCol, avgVelCol, spinCol,
            cmjPowerAbsCol, cmjPowerBmCol, cmjHtCol, cmjRsiCol,
            sjPowerAbsCol, sjPowerBmCol, sjHtCol, sjRsiCol,
            eurCol, imtpForceAbsCol, imtpForceBmCol, gripCol
          ].filter(Boolean));
          return !used.has(c);
        })
      }
    };
  }

  window.BBLPlayerMeta = { parseMetaCSV };
})();
