/* global React, ReactDOM, Papa, BBLAnalysis, BBLFitness, BBLPlayerMeta, BBLDataBuilder */
/* BBL Pitcher Integrated Report — 통합 입력+분석+대시보드 앱 (v2)
 *
 * 흐름:
 *   1) InputPage:
 *      - 선수 메타 CSV 1개 업로드 (드래그앤드롭) → 폼 자동 채움
 *      - Uplift CSV 10개 일괄 업로드 (드래그앤드롭) → 바이오메카닉스
 *   2) "분석 시작" → BBLAnalysis 실행 → 데이터 빌더 실행
 *   3) window.BBL_PITCHERS = [pitcher] 설정 후 dashboard 렌더
 */
(function () {
  'use strict';
  const { useState, useEffect, useRef, useCallback } = React;

  // ═════════════════════════════════════════════════════════════════
  // CSV 파싱
  // ═════════════════════════════════════════════════════════════════
  function parseCSV(file) {
    return new Promise((resolve, reject) => {
      Papa.parse(file, {
        header: true,
        dynamicTyping: true,
        skipEmptyLines: true,
        complete: (result) => {
          if (result.errors?.length) {
            const msg = result.errors[0].message || 'CSV 파싱 오류';
            if (result.data && result.data.length > 0) {
              resolve({ data: result.data, columns: result.meta.fields || [], warning: msg });
            } else {
              reject(new Error(msg));
            }
          } else {
            resolve({ data: result.data, columns: result.meta.fields || [] });
          }
        },
        error: (err) => reject(err)
      });
    });
  }

  // ═════════════════════════════════════════════════════════════════
  // 드래그앤드롭 훅
  // ═════════════════════════════════════════════════════════════════
  function useDropzone(onFiles, opts) {
    const { multiple = true, accept = '.csv' } = opts || {};
    const [isDragging, setIsDragging] = useState(false);
    const counterRef = useRef(0);
    const fileInputRef = useRef(null);

    // accept 문자열 파싱 — 확장자(.csv, .mp4) 또는 MIME prefix(video/*)
    const acceptsFile = useCallback((file) => {
      const name = file.name.toLowerCase();
      const type = (file.type || '').toLowerCase();
      const tokens = accept.split(',').map(s => s.trim().toLowerCase());
      return tokens.some(tok => {
        if (tok === '*' || tok === '*/*') return true;
        if (tok.startsWith('.')) return name.endsWith(tok);
        if (tok.endsWith('/*')) {
          const prefix = tok.slice(0, tok.length - 2);
          return type.startsWith(prefix + '/');
        }
        if (tok.includes('/')) return type === tok;
        return name.endsWith('.' + tok);
      });
    }, [accept]);

    const onDragEnter = useCallback((e) => {
      e.preventDefault(); e.stopPropagation();
      counterRef.current++;
      if (e.dataTransfer && Array.from(e.dataTransfer.types || []).includes('Files')) {
        setIsDragging(true);
      }
    }, []);
    const onDragLeave = useCallback((e) => {
      e.preventDefault(); e.stopPropagation();
      counterRef.current = Math.max(0, counterRef.current - 1);
      if (counterRef.current === 0) setIsDragging(false);
    }, []);
    const onDragOver = useCallback((e) => {
      e.preventDefault(); e.stopPropagation();
    }, []);
    const onDrop = useCallback((e) => {
      e.preventDefault(); e.stopPropagation();
      counterRef.current = 0;
      setIsDragging(false);
      const files = Array.from(e.dataTransfer?.files || []).filter(acceptsFile);
      if (files.length) {
        if (!multiple && files.length > 1) onFiles([files[0]]);
        else onFiles(files);
      }
    }, [onFiles, multiple, acceptsFile]);
    const onClick = useCallback(() => fileInputRef.current?.click(), []);
    const onInputChange = useCallback((e) => {
      const files = Array.from(e.target.files || []).filter(acceptsFile);
      if (files.length) onFiles(files);
      e.target.value = '';
    }, [onFiles, acceptsFile]);

    const dropzoneProps = {
      onDragEnter, onDragLeave, onDragOver, onDrop, onClick,
      className: `input-dropzone ${isDragging ? 'active' : ''}`
    };
    const inputProps = {
      ref: fileInputRef, type: 'file', multiple, accept,
      style: { display: 'none' }, onChange: onInputChange
    };
    return { isDragging, dropzoneProps, inputProps };
  }

  function bandLabel(band) {
    return { high: '상위', mid: '범위', low: '미만', na: '미측정' }[band] || '—';
  }

  // ═════════════════════════════════════════════════════════════════
  // 입력 폼
  // ═════════════════════════════════════════════════════════════════
  function InputPage({ onAnalyze }) {
    // 선수 프로필
    const [name, setName] = useState('');
    const [nameEn, setNameEn] = useState('');
    const [age, setAge] = useState('');
    const [heightCm, setHeightCm] = useState('');
    const [weightKg, setWeightKg] = useState('');
    const [bmi, setBmi] = useState('');
    const [throwingHand, setThrowingHand] = useState('R');
    const [date, setDate] = useState(new Date().toISOString().slice(0, 10));

    // 구속
    const [velocityMax, setVelocityMax] = useState('');
    const [velocityAvg, setVelocityAvg] = useState('');
    const [spinRate, setSpinRate] = useState('');

    // 영상
    const [videoMode, setVideoMode] = useState('file');  // 'file' | 'url'
    const [videoUrl, setVideoUrl] = useState('');
    const [videoFile, setVideoFile] = useState(null);          // File 객체
    const [videoObjectUrl, setVideoObjectUrl] = useState(null); // blob URL

    // 파일
    const [metaFile, setMetaFile] = useState(null);
    const [bioFiles, setBioFiles] = useState([]);

    // 처리 상태
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const [progress, setProgress] = useState('');
    const [autofilledFields, setAutofilledFields] = useState(new Set());

    // 메타 CSV 처리
    const handleMetaFile = useCallback(async (files) => {
      const file = files[0];
      if (!file) return;
      setError('');
      try {
        const r = await parseCSV(file);
        const parsed = window.BBLPlayerMeta.parseMetaCSV(r.data, r.columns);
        if (parsed.error) {
          setMetaFile({ name: file.name, error: parsed.error });
          return;
        }
        setMetaFile({ name: file.name, data: r.data, columns: r.columns, parsed });

        const filled = new Set();
        const p = parsed.profile;
        const v = parsed.velocity;
        if (p.name) { setName(p.name); filled.add('name'); }
        if (p.date) { setDate(p.date); filled.add('date'); }
        if (p.heightCm != null) { setHeightCm(String(p.heightCm)); filled.add('heightCm'); }
        if (p.weightKg != null) { setWeightKg(String(p.weightKg)); filled.add('weightKg'); }
        if (p.bmi != null) { setBmi(String(p.bmi)); filled.add('bmi'); }
        if (p.throwingHand) { setThrowingHand(p.throwingHand); filled.add('throwingHand'); }
        if (v.max != null) { setVelocityMax(String(v.max)); filled.add('velocityMax'); }
        if (v.avg != null) { setVelocityAvg(String(v.avg)); filled.add('velocityAvg'); }
        if (v.spinRate != null) { setSpinRate(String(v.spinRate)); filled.add('spinRate'); }
        setAutofilledFields(filled);
      } catch (e) {
        setMetaFile({ name: file.name, error: e.message || String(e) });
      }
    }, []);

    // Uplift 다중 처리
    const handleBioFiles = useCallback(async (files) => {
      if (!files.length) return;
      setError('');
      const parsed = await Promise.all(files.map(async (f) => {
        try {
          const r = await parseCSV(f);
          return {
            id: `bio_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
            name: f.name, data: r.data, columns: r.columns, size: f.size
          };
        } catch (e) {
          return {
            id: `err_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
            name: f.name, error: e.message || String(e)
          };
        }
      }));
      setBioFiles(prev => [...prev, ...parsed]);
    }, []);

    const removeBioFile = (id) => setBioFiles(fs => fs.filter(f => f.id !== id));
    const clearBioFiles = () => setBioFiles([]);
    const removeMetaFile = () => {
      setMetaFile(null);
      setAutofilledFields(new Set());
    };

    // 영상 파일 처리
    const handleVideoFile = useCallback((files) => {
      const file = files[0];
      if (!file) return;
      if (!file.type.startsWith('video/') &&
          !/\.(mp4|mov|webm|m4v|avi)$/i.test(file.name)) {
        setError('영상 파일이 아닙니다 (mp4 · mov · webm 권장)');
        return;
      }
      setError('');
      setVideoFile(file);
    }, []);
    const removeVideoFile = () => {
      setVideoFile(null);
    };

    // videoFile이 바뀌면 Object URL 생성/해제 (메모리 누수 방지)
    useEffect(() => {
      if (!videoFile) {
        setVideoObjectUrl(null);
        return;
      }
      const url = URL.createObjectURL(videoFile);
      setVideoObjectUrl(url);
      return () => URL.revokeObjectURL(url);
    }, [videoFile]);

    const metaDrop = useDropzone(handleMetaFile, { multiple: false });
    const bioDrop = useDropzone(handleBioFiles, { multiple: true });
    const videoDrop = useDropzone(handleVideoFile, {
      multiple: false,
      accept: 'video/*,.mp4,.mov,.webm,.m4v,.avi'
    });

    // 분석 실행
    const runAnalysis = async () => {
      setError('');
      setBusy(true);
      try {
        if (!name.trim()) throw new Error('선수 이름을 입력하거나 메타 CSV를 업로드해주세요');
        const validBio = bioFiles.filter(f => !f.error && f.data && f.data.length);
        if (validBio.length === 0) throw new Error('Uplift CSV를 1개 이상 업로드해주세요');

        // 체력 데이터: 메타 CSV 우선, 없으면 빈 데이터
        let physical;
        if (metaFile && metaFile.parsed && metaFile.parsed.physical) {
          physical = metaFile.parsed.physical;
        } else {
          physical = window.BBLFitness.buildPhysicalFromManual({ weightKg });
        }

        setProgress('① 바이오메카닉스 분석 중...');
        await new Promise(r => setTimeout(r, 50));

        const bioPitcher = {
          name: name.trim(),
          throwingHand,
          heightCm: heightCm ? parseFloat(heightCm) : '',
          weightKg: weightKg ? parseFloat(weightKg) : '',
          velocityMax: velocityMax ? parseFloat(velocityMax) : '',
          velocityAvg: velocityAvg ? parseFloat(velocityAvg) : '',
          measurementDate: date
        };
        const trials = validBio.map((f, i) => ({
          id: f.id, label: `T${i + 1}`, filename: f.name,
          velocity: '', columnNames: f.columns, rowCount: f.data.length,
          data: f.data, excludeFromAnalysis: false
        }));

        const bio = window.BBLAnalysis.analyze({
          pitcher: bioPitcher, trials, allTrials: trials
        });
        if (!bio || bio.error) {
          throw new Error('바이오메카닉스 분석 실패: ' + (bio?.error || '알 수 없는 오류'));
        }

        setProgress('② 종합 리포트 빌드 중...');
        await new Promise(r => setTimeout(r, 50));

        const profile = {
          id: 'subject',
          name: name.trim(),
          nameEn: nameEn.trim(),
          age: age ? parseInt(age) : null,
          heightCm: heightCm ? parseFloat(heightCm) : null,
          weightKg: weightKg ? parseFloat(weightKg) : null,
          bmi: bmi ? parseFloat(bmi) : null,
          throwingHand,
          date,
          videoUrl: (videoMode === 'file' && videoObjectUrl)
            ? videoObjectUrl
            : (videoUrl.trim() || null)
        };
        const velocityObj = {
          max: velocityMax ? parseFloat(velocityMax) : null,
          avg: velocityAvg ? parseFloat(velocityAvg) : null,
          spinRate: spinRate ? parseFloat(spinRate) : null
        };

        const pitcher = window.BBLDataBuilder.build({
          profile, velocity: velocityObj, bio, physical
        });
        if (pitcher.error) throw new Error(pitcher.error);

        setProgress('완료!');
        setTimeout(() => onAnalyze(pitcher), 200);

      } catch (e) {
        setError(e.message || String(e));
        setBusy(false);
        setProgress('');
      }
    };

    const validBioCount = bioFiles.filter(f => !f.error && f.data && f.data.length).length;
    const isAutofilled = (f) => autofilledFields.has(f);
    const fieldClass = (f) => isAutofilled(f) ? 'autofilled' : '';

    return (
      <div className="input-page">
        <div className="input-bg" aria-hidden="true"></div>

        <div className="input-container">
          {/* 헤더 */}
          <div className="input-header">
            <div className="input-brand">
              <div className="input-brand-icon">
                <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
                  <polygon points="16,4 27,10 27,22 16,28 5,22 5,10" stroke="#60a5fa" strokeWidth="1.5" fill="none"/>
                  <polygon points="16,9 23,12.5 23,19.5 16,23 9,19.5 9,12.5" stroke="#60a5fa" strokeWidth="1.2" fill="none" opacity="0.6"/>
                  <circle cx="16" cy="16" r="2" fill="#60a5fa"/>
                </svg>
              </div>
              <div>
                <div className="input-brand-name">BioMotion Baseball Lab</div>
                <div className="input-brand-sub">Pitcher Integrated Report · Builder</div>
              </div>
            </div>
            <div className="input-header-meta">
              <div>측정일</div>
              <b>{date || new Date().toISOString().slice(0, 10)}</b>
            </div>
          </div>

          <div className="input-intro">
            <h1>투수 통합 분석 리포트 생성</h1>
            <p>선수 메타 CSV 1개 + Uplift CSV 10개를 드래그앤드롭하면 자동 분석됩니다.</p>
          </div>

          {/* SECTION 1 */}
          <div className="input-card">
            <div className="input-card-head">
              <span className="input-card-num">01</span>
              <div>
                <h3>선수 정보 + 구속 + 체력 (메타 CSV)</h3>
                <p>· 이름·날짜·체격·구속·CMJ·SJ·IMTP·악력 등이 모두 담긴 1개 파일</p>
              </div>
            </div>
            <div className="input-card-body">
              {!metaFile ? (
                <div {...metaDrop.dropzoneProps}>
                  <input {...metaDrop.inputProps}/>
                  <div className="input-drop-icon">📋</div>
                  <div className="input-drop-title">메타 CSV 드래그앤드롭 또는 클릭</div>
                  <div className="input-drop-sub">선수 정보 · 구속 · 체력 변인 1개 파일</div>
                </div>
              ) : metaFile.error ? (
                <div className="input-file-item err">
                  <span className="input-file-num">META</span>
                  <span className="input-file-name">{metaFile.name}</span>
                  <span className="input-file-meta err">· {metaFile.error}</span>
                  <button onClick={removeMetaFile} className="input-file-x">×</button>
                </div>
              ) : (
                <div className="input-meta-loaded">
                  <div className="input-meta-status">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#4ade80" strokeWidth="2.5">
                      <path d="M9 12l2 2 4-4" strokeLinecap="round" strokeLinejoin="round"/>
                      <circle cx="12" cy="12" r="10"/>
                    </svg>
                    <div className="input-meta-info">
                      <div className="input-meta-name">{metaFile.name}</div>
                      <div className="input-meta-detail">
                        {autofilledFields.size}개 필드 자동 입력 · 체력 데이터 추출 완료
                      </div>
                    </div>
                    <button onClick={removeMetaFile} className="input-meta-x">파일 변경</button>
                  </div>
                  {metaFile.parsed?.physical && (
                    <div className="input-physical-summary">
                      <div className="input-ps-row">
                        <span className="input-ps-key">점프 단위파워</span>
                        <span className="input-ps-val">CMJ {metaFile.parsed.physical.cmjPower.cmj ?? '—'} · SJ {metaFile.parsed.physical.cmjPower.sj ?? '—'} W/kg</span>
                        <span className={`input-ps-band band-${metaFile.parsed.physical.cmjPower.band}`}>
                          {bandLabel(metaFile.parsed.physical.cmjPower.band)}
                        </span>
                      </div>
                      <div className="input-ps-row">
                        <span className="input-ps-key">최대근력 (IMTP)</span>
                        <span className="input-ps-val">{metaFile.parsed.physical.maxStrength.perKg ?? '—'} N/kg</span>
                        <span className={`input-ps-band band-${metaFile.parsed.physical.maxStrength.band}`}>
                          {bandLabel(metaFile.parsed.physical.maxStrength.band)}
                        </span>
                      </div>
                      <div className="input-ps-row">
                        <span className="input-ps-key">반응성 (RSI-mod)</span>
                        <span className="input-ps-val">CMJ {metaFile.parsed.physical.reactive.cmj ?? '—'} · SJ {metaFile.parsed.physical.reactive.sj ?? '—'} m/s</span>
                        <span className={`input-ps-band band-${metaFile.parsed.physical.reactive.band}`}>
                          {bandLabel(metaFile.parsed.physical.reactive.band)}
                        </span>
                      </div>
                      <div className="input-ps-row">
                        <span className="input-ps-key">탄성 활용 (EUR)</span>
                        <span className="input-ps-val">{metaFile.parsed.physical.ssc.value ?? '—'}</span>
                        <span className={`input-ps-band band-${metaFile.parsed.physical.ssc.band}`}>
                          {bandLabel(metaFile.parsed.physical.ssc.band)}
                        </span>
                      </div>
                      <div className="input-ps-row">
                        <span className="input-ps-key">악력</span>
                        <span className="input-ps-val">{metaFile.parsed.physical.release.value ?? '—'} kg</span>
                        <span className={`input-ps-band band-${metaFile.parsed.physical.release.band}`}>
                          {bandLabel(metaFile.parsed.physical.release.band)}
                        </span>
                      </div>
                    </div>
                  )}
                  <div className="input-hint" style={{ marginTop: 12 }}>
                    <b>자동 입력된 필드는 아래에서 수정할 수 있습니다.</b> Shoulder/Hip ROM·Sprint·Agility는 사용하지 않습니다.
                  </div>
                </div>
              )}

              {/* 폼 */}
              <div className="input-grid" style={{ marginTop: metaFile && !metaFile.error ? 16 : 0 }}>
                <div className="input-field span-2">
                  <label>이름 <span className="req">*</span></label>
                  <input className={fieldClass('name')} type="text" value={name}
                    onChange={e => setName(e.target.value)} placeholder="홍길동"/>
                </div>
                <div className="input-field span-2">
                  <label>이름 (영문)</label>
                  <input type="text" value={nameEn}
                    onChange={e => setNameEn(e.target.value)} placeholder="Hong Gil-dong"/>
                </div>
                <div className="input-field">
                  <label>나이</label>
                  <input type="number" value={age}
                    onChange={e => setAge(e.target.value)} placeholder="22"/>
                </div>
                <div className="input-field">
                  <label>측정일</label>
                  <input className={fieldClass('date')} type="date" value={date}
                    onChange={e => setDate(e.target.value)}/>
                </div>
                <div className="input-field">
                  <label>신장 (cm)</label>
                  <input className={fieldClass('heightCm')} type="number" step="0.1" value={heightCm}
                    onChange={e => setHeightCm(e.target.value)} placeholder="178"/>
                </div>
                <div className="input-field">
                  <label>투구 손</label>
                  <select className={fieldClass('throwingHand')} value={throwingHand}
                    onChange={e => setThrowingHand(e.target.value)}>
                    <option value="R">우투</option>
                    <option value="L">좌투</option>
                  </select>
                </div>
                <div className="input-field">
                  <label>체중 (kg)</label>
                  <input className={fieldClass('weightKg')} type="number" step="0.1" value={weightKg}
                    onChange={e => setWeightKg(e.target.value)} placeholder="78"/>
                </div>
                <div className="input-field">
                  <label>BMI</label>
                  <input className={fieldClass('bmi')} type="number" step="0.1" value={bmi}
                    onChange={e => setBmi(e.target.value)} placeholder="자동 계산"/>
                </div>
                <div className="input-field span-2">
                  <label>최고 구속 (km/h) <span className="req">*</span></label>
                  <input className={fieldClass('velocityMax')} type="number" step="0.1" value={velocityMax}
                    onChange={e => setVelocityMax(e.target.value)} placeholder="142.4"/>
                </div>
                <div className="input-field span-2">
                  <label>평균 구속 (km/h) <span className="req">*</span></label>
                  <input className={fieldClass('velocityAvg')} type="number" step="0.1" value={velocityAvg}
                    onChange={e => setVelocityAvg(e.target.value)} placeholder="135.2"/>
                </div>
                <div className="input-field span-2">
                  <label>평균 회전수 (RPM)</label>
                  <input className={fieldClass('spinRate')} type="number" step="1" value={spinRate}
                    onChange={e => setSpinRate(e.target.value)} placeholder="2312"/>
                </div>
              </div>
            </div>
          </div>

          {/* SECTION 2 */}
          <div className="input-card">
            <div className="input-card-head">
              <span className="input-card-num">02</span>
              <div>
                <h3>바이오메카닉스 데이터 (Uplift CSV)</h3>
                <p>· Uplift Labs export · 10개 권장 (1 시행당 1 파일) · 한 번에 다중 드래그 가능</p>
              </div>
            </div>
            <div className="input-card-body">
              <div {...bioDrop.dropzoneProps}>
                <input {...bioDrop.inputProps}/>
                <div className="input-drop-icon">📂</div>
                <div className="input-drop-title">
                  Uplift CSV 일괄 드래그앤드롭 또는 클릭
                </div>
                <div className="input-drop-sub">10개 한 번에 가능 · 추가 업로드도 가능</div>
              </div>

              {bioFiles.length > 0 && (
                <div className="input-file-list">
                  <div className="input-file-list-head">
                    <span>업로드된 CSV ({validBioCount}/{bioFiles.length})</span>
                    <button onClick={clearBioFiles} className="input-clear-btn">모두 지우기</button>
                  </div>
                  {bioFiles.map((f, i) => (
                    <div key={f.id} className={`input-file-item ${f.error ? 'err' : ''}`}>
                      <span className="input-file-num">T{i + 1}</span>
                      <span className="input-file-name">{f.name}</span>
                      {f.error
                        ? <span className="input-file-meta err">· {f.error}</span>
                        : <span className="input-file-meta">{f.data.length} 행 · {f.columns.length} 컬럼</span>
                      }
                      <button onClick={() => removeBioFile(f.id)} className="input-file-x">×</button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* SECTION 3 — 측정 영상 (추후 활성화 — 코드 보존) */}
          {false && (
          <div className="input-card">
            <div className="input-card-head">
              <span className="input-card-num">03</span>
              <div>
                <h3>측정 영상 <span style={{ fontSize: 11, fontWeight: 500, color: '#64748b', marginLeft: 6 }}>(선택)</span></h3>
                <p>· 파일 업로드 또는 외부 URL · mp4 권장 · 프레임 단위 재생 가능</p>
              </div>
            </div>
            <div className="input-card-body">
              <div className="input-mode-toggle">
                <button
                  className={videoMode === 'file' ? 'active' : ''}
                  onClick={() => setVideoMode('file')}>파일 업로드</button>
                <button
                  className={videoMode === 'url' ? 'active' : ''}
                  onClick={() => setVideoMode('url')}>URL 입력</button>
              </div>

              {videoMode === 'file' && (
                <>
                  {!videoFile ? (
                    <div {...videoDrop.dropzoneProps}>
                      <input {...videoDrop.inputProps}/>
                      <div className="input-drop-icon">🎥</div>
                      <div className="input-drop-title">영상 파일 드래그앤드롭 또는 클릭</div>
                      <div className="input-drop-sub">mp4 · mov · webm · 권장 50 MB 이하</div>
                    </div>
                  ) : (
                    <div className="input-video-preview">
                      <video
                        src={videoObjectUrl}
                        controls
                        playsInline
                        style={{ width: '100%', maxHeight: 280, borderRadius: 8, background: '#000' }}/>
                      <div className="input-video-meta">
                        <span className="input-file-num">VID</span>
                        <span className="input-file-name">{videoFile.name}</span>
                        <span className="input-file-meta">
                          {(videoFile.size / (1024 * 1024)).toFixed(1)} MB · {videoFile.type || 'video'}
                        </span>
                        <button onClick={removeVideoFile} className="input-file-x">×</button>
                      </div>
                    </div>
                  )}
                  <div className="input-hint">
                    <b>주의:</b> 업로드된 영상은 <b>현재 브라우저 메모리에만</b> 저장됩니다.
                    페이지 새로고침 시 영상이 사라지며 PDF 인쇄·링크 공유 시에도 포함되지 않습니다.
                    영구 보관·공유가 필요하면 <b>URL 입력</b> 모드를 사용하세요 (GitHub Releases · YouTube · Google Drive 등).
                  </div>
                </>
              )}

              {videoMode === 'url' && (
                <>
                  <div className="input-grid">
                    <div className="input-field span-4">
                      <label>측정 영상 URL</label>
                      <input type="url" value={videoUrl}
                        onChange={e => setVideoUrl(e.target.value)}
                        placeholder="https://youtu.be/... 또는 mp4 직접 링크"/>
                    </div>
                  </div>
                  <div className="input-hint">
                    <b>지원 형식:</b><br/>
                    · <b>mp4 직접 링크</b> (권장) — GitHub Releases, S3, 직접 호스팅 → 프레임 이동·배속 모두 가능<br/>
                    · <b>YouTube</b> (youtu.be / youtube.com/watch) → 기본 플레이어만 사용 가능 (프레임 이동 불가)
                  </div>
                </>
              )}
            </div>
          </div>
          )}

          {error && (
            <div className="input-error">
              <span>⚠</span> {error}
            </div>
          )}

          <div className="input-actions">
            <button
              className="input-go-btn"
              onClick={runAnalysis}
              disabled={busy || !name.trim() || validBioCount === 0}
            >
              {busy ? (progress || '분석 중...') : `분석 시작 → 리포트 생성 (Uplift ${validBioCount}개)`}
            </button>
          </div>

          <div className="input-foot">
            © BioMotion Baseball Lab · Kookmin University · biomotion.kr
          </div>
        </div>
      </div>
    );
  }

  // ═════════════════════════════════════════════════════════════════
  // App 라우터
  // ═════════════════════════════════════════════════════════════════
  // ═════════════════════════════════════════════════════════════════
  // 세션 영속성 — 분석 결과를 sessionStorage에 저장
  //   - 새로고침해도 리포트 페이지 유지
  //   - URL hash(#report)로 현재 페이지 표시
  //   - 탭 닫으면 자동으로 사라짐 (다음 세션에 영향 X)
  //   - "새 분석" 버튼 클릭 시 명시적으로 비움
  // ═════════════════════════════════════════════════════════════════
  const STORAGE_KEY = 'bbl_pitcher_v1';

  function saveToStorage(pitcher) {
    try {
      // _rawBio, _rawPhysical은 디버그용이고 매우 크기 때문에 저장 시 제외
      // (sessionStorage 일반 한도 5-10 MB 안에 안전하게 들어가도록)
      const { _rawBio, _rawPhysical, ...slim } = pitcher;
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(slim));
    } catch (e) {
      console.warn('sessionStorage 저장 실패 (용량 초과 가능):', e);
    }
  }
  function loadFromStorage() {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch (e) {
      console.warn('sessionStorage 로드 실패:', e);
      return null;
    }
  }
  function clearStorage() {
    try {
      sessionStorage.removeItem(STORAGE_KEY);
    } catch (e) { /* ignore */ }
  }

  function getRouteFromHash() {
    const h = (window.location.hash || '').replace(/^#/, '');
    return h === 'report' ? 'report' : 'input';
  }

  function App() {
    // 초기 라우트: URL hash에서 결정 (새로고침 시 #report면 리포트 유지)
    const [route, setRouteState] = useState(() => {
      const initial = getRouteFromHash();
      // hash가 #report인데 저장된 분석 결과가 없으면 input으로 폴백
      if (initial === 'report') {
        const saved = loadFromStorage();
        if (saved) {
          window.BBL_PITCHERS = [saved];
          window.BBL_REF = window.BBLDataBuilder?.REF;
          return 'report';
        }
        // 폴백 — hash 정리
        if (window.history && window.history.replaceState) {
          window.history.replaceState(null, '', window.location.pathname + window.location.search);
        }
        return 'input';
      }
      return 'input';
    });

    // 라우트 변경 시 URL hash도 동기화
    const setRoute = (next) => {
      setRouteState(next);
      const targetHash = next === 'report' ? '#report' : '';
      const newUrl = window.location.pathname + window.location.search + targetHash;
      if (window.location.hash !== targetHash) {
        if (window.history && window.history.pushState) {
          window.history.pushState({ route: next }, '', newUrl);
        } else {
          window.location.hash = targetHash;
        }
      }
    };

    // 브라우저 뒤/앞 버튼 처리 (popstate)
    useEffect(() => {
      const onPop = () => {
        const r = getRouteFromHash();
        if (r === 'report') {
          const saved = loadFromStorage();
          if (saved) {
            window.BBL_PITCHERS = [saved];
            window.BBL_REF = window.BBLDataBuilder?.REF;
            setRouteState('report');
            return;
          }
        }
        setRouteState('input');
      };
      window.addEventListener('popstate', onPop);
      return () => window.removeEventListener('popstate', onPop);
    }, []);

    const onAnalyze = (newPitcher) => {
      window.BBL_PITCHERS = [newPitcher];
      window.BBL_REF = window.BBLDataBuilder.REF;
      saveToStorage(newPitcher);  // 새로고침 대비 저장
      setRoute('report');
    };
    const onBack = () => {
      // "새 분석" 시 저장된 결과 비움 — 입력 폼이 깨끗하게 시작
      clearStorage();
      window.BBL_PITCHERS = [];
      setRoute('input');
    };

    if (route === 'input') return <InputPage onAnalyze={onAnalyze}/>;

    if (typeof window.BBLDashboardApp !== 'function') {
      return (
        <div style={{
          minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: '#0a1628', color: '#e2e8f0', flexDirection: 'column', gap: 16
        }}>
          <div style={{ fontSize: 20, fontWeight: 700 }}>대시보드 컴포넌트 로드 실패</div>
          <button onClick={onBack} style={{
            padding: '8px 18px', background: '#2563EB', color: '#fff', border: 'none', borderRadius: 6,
            cursor: 'pointer', fontSize: 13, fontWeight: 600
          }}>← 입력으로 돌아가기</button>
        </div>
      );
    }
    return <window.BBLDashboardApp onBack={onBack}/>;
  }

  // 마운트
  function checkDependencies() {
    const missing = [];
    if (typeof Papa === 'undefined') missing.push('PapaParse');
    if (typeof window.BBLAnalysis === 'undefined' || !window.BBLAnalysis.analyze) missing.push('BBLAnalysis');
    if (typeof window.BBLFitness === 'undefined' || !window.BBLFitness.buildPhysicalFromManual) missing.push('BBLFitness');
    if (typeof window.BBLPlayerMeta === 'undefined' || !window.BBLPlayerMeta.parseMetaCSV) missing.push('BBLPlayerMeta');
    if (typeof window.BBLDataBuilder === 'undefined' || !window.BBLDataBuilder.build) missing.push('BBLDataBuilder');
    if (typeof window.BBLDashboardApp !== 'function') missing.push('BBLDashboardApp (dashboard.jsx)');
    if (typeof window.RadarChart !== 'function') missing.push('RadarChart (charts.jsx)');
    return missing;
  }
  function attemptMount(retriesLeft) {
    const missing = checkDependencies();
    if (missing.length === 0) {
      ReactDOM.createRoot(document.getElementById('root')).render(<App/>);
      return;
    }
    if (retriesLeft > 0) {
      // Babel JSX 변환이 비동기일 수 있으므로 100ms 간격으로 최대 30회(3초) 재시도
      setTimeout(() => attemptMount(retriesLeft - 1), 100);
      return;
    }
    // 최종 실패 — 누락 라이브러리 안내
    document.getElementById('root').innerHTML =
      '<div style="padding: 40px; color: #f87171; background: #0a1628; min-height: 100vh; font-family: system-ui;">' +
      '<h2>의존성 라이브러리 로드 실패</h2>' +
      '<p>다음 라이브러리가 로드되지 않았습니다:</p>' +
      '<ul>' + missing.map(m => '<li>' + m + '</li>').join('') + '</ul>' +
      '<p style="margin-top: 20px; color: #94a3b8; font-size: 13px;">브라우저 콘솔(F12)을 확인해주세요. JSX 파일에 SyntaxError가 있을 수 있습니다.</p>' +
      '</div>';
  }
  function mount() {
    attemptMount(30);  // 최대 3초간 폴링
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mount);
  } else {
    setTimeout(mount, 100);
  }
})();
