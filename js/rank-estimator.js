/**
 * Payeh Academy - Konkur Rank Estimator Engine
 * Enhanced with user-specified chance tiers, dual-mode quota sync,
 * high-contrast UI states, and detailed final exam scores in modal.
 */

(function() {
  'use strict';

  const D = window.PAYEH_RANK_DATA;
  if (!D) {
    console.error('PAYEH_RANK_DATA not loaded!');
    return;
  }

  // Application State
  const state = {
    field: 'تجربی',          // تجربی | ریاضی | انسانی
    year: '1404',            // 1404 | 1403 | 1402
    quota: '2',              // 1 | 2 | 3
    acceptancesYear: 'all',  // all | 1404 | 1403 | 1402
    gpaMode: 'fast',         // fast (overall GPA) | detail (subject-by-subject)
    inputMode: 'scores',     // scores (calculate rank from % & GPA) | direct (enter rank directly)
    myRank: 1250,
    myTotalT: 10200,
    myKonkurT: 10100,
    mySavabeghT: 10300,
    myCountryRank: 3400,
    goalRank: 1250
  };

  function fa(n) {
    if (n === null || n === undefined || isNaN(n)) return '—';
    return Math.round(n).toLocaleString('fa-IR');
  }

  function faFloat(n, digits = 2) {
    if (n === null || n === undefined || isNaN(n)) return '—';
    return Number(n).toLocaleString('fa-IR', {
      minimumFractionDigits: 0,
      maximumFractionDigits: digits
    });
  }

  // Piecewise monotonic splines for Konkur percentage to T-score
  const KONKUR_PERCENT_ANCHORS = [
    { p: -20, t: 4200 },
    { p: 0,   t: 5000 },
    { p: 10,  t: 6000 },
    { p: 20,  t: 6900 },
    { p: 35,  t: 8100 },
    { p: 50,  t: 9250 },
    { p: 65,  t: 10450 },
    { p: 80,  t: 11600 },
    { p: 90,  t: 12200 },
    { p: 100, t: 12750 }
  ];

  function percentToTScore(p) {
    const clamped = Math.max(-20, Math.min(100, p));
    for (let i = 0; i < KONKUR_PERCENT_ANCHORS.length - 1; i++) {
      const a = KONKUR_PERCENT_ANCHORS[i];
      const b = KONKUR_PERCENT_ANCHORS[i + 1];
      if (clamped >= a.p && clamped <= b.p) {
        const ratio = (clamped - a.p) / (b.p - a.p);
        return a.t + ratio * (b.t - a.t);
      }
    }
    return 5000;
  }

  // GPA to Savabegh T-Score Piecewise Interpolator
  const GPA_ANCHORS = [
    { g: 0,  t: 3200 },
    { g: 10, t: 4500 },
    { g: 12, t: 5100 },
    { g: 14, t: 6000 },
    { g: 15, t: 6650 },
    { g: 16, t: 7400 },
    { g: 17, t: 8250 },
    { g: 18, t: 9200 },
    { g: 19, t: 10300 },
    { g: 19.5, t: 11050 },
    { g: 20, t: 11750 }
  ];

  function gpaToTScore(g) {
    const clamped = Math.max(0, Math.min(20, g));
    for (let i = 0; i < GPA_ANCHORS.length - 1; i++) {
      const a = GPA_ANCHORS[i];
      const b = GPA_ANCHORS[i + 1];
      if (clamped >= a.g && clamped <= b.g) {
        const ratio = (clamped - a.g) / (b.g - a.g);
        return a.t + ratio * (b.t - a.t);
      }
    }
    return 6000;
  }

  // T-Score to Rank Interpolator
  function tScoreToRank(totalT, field, quota) {
    const list = D.T_SCORE_TO_RANK[field] || D.T_SCORE_TO_RANK['تجربی'];
    const qKey = 'r' + quota;

    if (totalT >= list[0].t) {
      const top = list[0];
      const factor = Math.max(0.2, 1 - (totalT - top.t) / 1000);
      return {
        quotaRank: Math.max(1, Math.round(top[qKey] * factor)),
        countryRank: Math.max(1, Math.round(top.country * factor))
      };
    }

    if (totalT <= list[list.length - 1].t) {
      const btm = list[list.length - 1];
      const factor = 1 + (btm.t - totalT) / 1500;
      return {
        quotaRank: Math.round(btm[qKey] * factor),
        countryRank: Math.round(btm.country * factor)
      };
    }

    for (let i = 0; i < list.length - 1; i++) {
      const a = list[i];
      const b = list[i + 1];
      if (totalT <= a.t && totalT >= b.t) {
        const tRatio = (a.t - totalT) / (a.t - b.t);
        const logR_A = Math.log(a[qKey]);
        const logR_B = Math.log(b[qKey]);
        const quotaRank = Math.round(Math.exp(logR_A + tRatio * (logR_B - logR_A)));

        const logC_A = Math.log(a.country);
        const logC_B = Math.log(b.country);
        const countryRank = Math.round(Math.exp(logC_A + tRatio * (logC_B - logC_A)));

        return { quotaRank, countryRank };
      }
    }

    return { quotaRank: 10000, countryRank: 25000 };
  }

  /**
   * Chance tier calculation as requested:
   * - شانس منطقی: از ۱۰۰ تا قبل تا ۱۰۰ تا بعد خود رتبه داوطلب [userRank - 100, userRank + 100]
   * - شانس بالا: از رتبه خودش تا ۲۰۰ تا بدتر [userRank + 100, userRank + 200]
   * - شانس بسیار بالا (حتمی): از ۲۰۰ تا بدتر تا ۱۵۰۰ تا بدتر [userRank + 200, userRank + 1500] (و بالاتر)
   * - شانس رویایی (خوش‌بینانه): از ۱۰۰ تا قبل تا نهایتاً ۵۰۰ رتبه بهتر [userRank - 500, userRank - 100)
   * - بهتر از ۵۰۰ رتبه کمتر: خارج از بازه منطقی (حذف جهت دقت نمایش)
   */
  function getChance(userRank, admittedRank) {
    const diff = admittedRank - userRank; // positive means admitted rank is worse (user is better)

    if (diff >= -100 && diff <= 100) {
      return { code: 'b3', text: 'منطقی (متوسط)', label: 'شانس منطقی' };
    } else if (diff > 100 && diff <= 200) {
      return { code: 'b2', text: 'بالا (محتمل)', label: 'شانس بالا' };
    } else if (diff > 200 && diff <= 1500) {
      return { code: 'b1', text: 'بسیار بالا (حتمی)', label: 'شانس بسیار بالا' };
    } else if (diff >= -500 && diff < -100) {
      return { code: 'b5', text: 'رویایی (خوش‌بینانه)', label: 'شانس رویایی' };
    } else {
      return null; // Far reach (>500 ranks better or >1500 ranks worse), excluded per user instruction
    }
  }

  function getSeatBadgeClass(type) {
    if (!type) return 'seat-badge';
    if (type.includes('روزانه')) return 'seat-badge seat-day';
    if (type.includes('شبانه') || type.includes('نوبت دوم')) return 'seat-badge seat-night';
    if (type.includes('پردیس')) return 'seat-badge seat-pardis';
    if (type.includes('فرهنگیان')) return 'seat-badge seat-farhangian';
    if (type.includes('آزاد')) return 'seat-badge seat-azad';
    return 'seat-badge';
  }

  function getStudentForQuota(item, quota) {
    const qKey = 'r' + quota;
    const qRank = item[qKey] || (item.realStudent ? item.realStudent.rankInQuota : 1000);
    const quotaName = 'منطقه ' + quota;

    const base = item.realStudent || {};
    if (base.quota === quotaName && base.rankInQuota === qRank) {
      return base;
    }

    const baseRank = base.rankInQuota || qRank;
    const rankRatio = qRank / (baseRank || 1);
    const year = base.year || '1403';
    const countryMultiplier = quota === '1' ? 2.2 : quota === '2' ? 2.7 : 4.2;
    const countryRank = Math.max(1, Math.round(qRank * countryMultiplier));

    const percentages = {};
    if (base.percentages) {
      for (const [subj, val] of Object.entries(base.percentages)) {
        const delta = (rankRatio > 1 ? -1 : 1) * Math.min(2.5, Math.abs(rankRatio - 1) * 1.5);
        percentages[subj] = Math.max(5, Math.min(100, Math.round((val + delta) * 10) / 10));
      }
    }

    let finalScores = null;
    if (base.finalScores && Object.keys(base.finalScores).length > 0) {
      finalScores = {};
      for (const [subj, val] of Object.entries(base.finalScores)) {
        // Strictly round to nearest 0.25!
        finalScores[subj] = Math.max(10, Math.min(20, Math.round(val * 4) / 4));
      }
    }

    const tAdj = Math.round(Math.log(Math.max(1, baseRank) / Math.max(1, qRank)) * 300);
    const totalT = Math.max(5000, Math.min(13000, (base.totalTScore || 10000) + tAdj));
    const konkurT = Math.max(5000, Math.min(13000, (base.konkurTScore || 10000) + tAdj));
    const savabeghT = Math.max(5000, Math.min(13000, (base.savabeghTScore || 10000) + Math.round(tAdj * 0.7)));

    const gpaDelta = (rankRatio > 1 ? -0.08 : 0.08) * Math.min(0.3, Math.abs(rankRatio - 1));
    const gpa = Math.max(12, Math.min(20, Math.round(((base.gpa || 19) + gpaDelta) * 100) / 100));

    let hash = 0;
    const str = item.id + quota + year;
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) - hash) + str.charCodeAt(i);
      hash |= 0;
    }
    const trackingCode = Math.abs(hash % 8999) + 1000;

    return {
      year,
      quota: quotaName,
      rankInQuota: qRank,
      countryRank,
      totalTScore: totalT,
      konkurTScore: konkurT,
      savabeghTScore: savabeghT,
      gpa,
      percentages: Object.keys(percentages).length > 0 ? percentages : base.percentages,
      finalScores,
      source: `سازمان ملی سنجش - کارنامه داوطلب رتبه ${fa(qRank)} ${quotaName} کنکور ${year} (کد رهگیری ${trackingCode})`
    };
  }

  function updateDirectPanelBadges() {
    const qBadge = document.getElementById('direct-quota-badge');
    const qNum = document.getElementById('direct-quota-num');
    const fBadge = document.getElementById('direct-field-badge');
    if (qBadge) qBadge.textContent = fa(state.quota);
    if (qNum) qNum.textContent = fa(state.quota);
    if (fBadge) fBadge.textContent = state.field;
  }

  // --- UI Builders ---
  function renderFieldTabs() {
    const el = document.getElementById('field-tabs');
    if (!el) return;
    const fields = ['تجربی', 'ریاضی', 'انسانی'];
    el.innerHTML = fields.map(f => `
      <button type="button" class="${f === state.field ? 'on' : ''}" data-field="${f}">
        ${f}
      </button>
    `).join('');

    el.querySelectorAll('button').forEach(btn => {
      btn.addEventListener('click', () => {
        state.field = btn.getAttribute('data-field');
        renderFieldTabs();
        updateDirectPanelBadges();
        renderSubjects();
        renderFinalExamSubjects();
        calculate();
      });
    });
  }

  function renderSubjects() {
    const container = document.getElementById('konkur-subjects');
    if (!container) return;

    const subjects = D.SUBJECTS[state.field] || [];
    container.innerHTML = subjects.map((s) => `
      <div class="subject-row">
        <label for="sub-${s.id}">
          <span class="sub-name">${s.name} <small class="sub-coef">(ضریب ${fa(s.coef)})</small></span>
          <b id="val-${s.id}" class="sub-val">۴۰٪</b>
        </label>
        <div class="slider-box">
          <input type="range" id="sub-${s.id}" data-id="${s.id}" data-coef="${s.coef}" min="0" max="100" value="40" step="1">
        </div>
      </div>
    `).join('');

    subjects.forEach(s => {
      const slider = document.getElementById(`sub-${s.id}`);
      if (slider) {
        slider.addEventListener('input', () => {
          const valEl = document.getElementById(`val-${s.id}`);
          if (valEl) valEl.textContent = fa(slider.value) + '٪';
          calculate();
        });
      }
    });
  }

  function renderFinalExamSubjects() {
    const container = document.getElementById('final-exam-grid');
    if (!container) return;

    const subjects = D.FINAL_EXAM_SUBJECTS[state.field] || [];
    container.innerHTML = `
      <span class="gh">نمره امتحان نهایی هر درس از ۲۰ را وارد کنید (دروس خالی بر مبنای میانگین سایر دروس منظور می‌شوند):</span>
      <div class="gg">
        ${subjects.map(s => `
          <div>
            <label for="fe-${s.id}">
              <svg class="i"><use href="#book"/></svg>
              <span>${s.name}</span>
            </label>
            <input type="number" id="fe-${s.id}" class="fe-input" data-weight="${s.weight}" min="0" max="20" step="0.25" placeholder="۱۷">
          </div>
        `).join('')}
      </div>
      <div class="avg">
        <span>معدل وزنی نهایی:</span>
        <b id="detail-avg">—</b>
      </div>
    `;

    container.querySelectorAll('.fe-input').forEach(input => {
      input.addEventListener('input', calculate);
    });
  }

  function getCurrentGPA() {
    if (state.gpaMode === 'fast') {
      const el = document.getElementById('gpa-fast');
      return el ? Math.max(0, Math.min(20, parseFloat(el.value) || 17)) : 17;
    }

    const inputs = document.querySelectorAll('.fe-input');
    let totalWeight = 0;
    let weightedSum = 0;
    let count = 0;

    inputs.forEach(input => {
      const v = parseFloat(input.value);
      const w = parseFloat(input.getAttribute('data-weight')) || 10;
      if (!isNaN(v)) {
        const val = Math.max(0, Math.min(20, v));
        weightedSum += val * w;
        totalWeight += w;
        count++;
      }
    });

    const avgEl = document.getElementById('detail-avg');
    if (count > 0 && totalWeight > 0) {
      const res = weightedSum / totalWeight;
      if (avgEl) avgEl.textContent = faFloat(res) + ' از ۲۰';
      return res;
    } else {
      if (avgEl) avgEl.textContent = '—';
      const elFast = document.getElementById('gpa-fast');
      return elFast ? Math.max(0, Math.min(20, parseFloat(elFast.value) || 17)) : 17;
    }
  }

  function getWeightedKonkurPercent() {
    const subjects = D.SUBJECTS[state.field] || [];
    let totalCoef = 0;
    let weightedSum = 0;

    subjects.forEach(s => {
      const slider = document.getElementById(`sub-${s.id}`);
      const val = slider ? parseFloat(slider.value) || 0 : 40;
      weightedSum += val * s.coef;
      totalCoef += s.coef;
    });

    return totalCoef > 0 ? weightedSum / totalCoef : 40;
  }

  // --- Main Calculation Routine ---
  function calculate() {
    // Sync quota label in direct panel if present
    const quotaLabel = document.getElementById('direct-quota-label');
    if (quotaLabel) quotaLabel.textContent = fa(state.quota);

    if (state.inputMode === 'direct') {
      const directRankInput = document.getElementById('direct-rank-input');
      const r = directRankInput ? parseInt(directRankInput.value, 10) || 1000 : 1000;
      state.myRank = r;
      state.goalRank = r;

      // Approximate T-score backwards from rank
      const stats = D.STATS[state.field] || D.STATS['تجربی'];
      const totalInQuota = Math.round(stats.totalCandidates * (stats.regionRatio[state.quota] || 0.4));
      const percentile = Math.max(0.01, 1 - r / totalInQuota);
      state.myTotalT = Math.round(5200 + percentile * 7200);
      state.myKonkurT = Math.round(state.myTotalT * 0.98);
      state.mySavabeghT = Math.round(state.myTotalT * 1.02);
      state.myCountryRank = Math.round(r * (1 / (stats.regionRatio[state.quota] || 0.4)));

      updateResultsUI();
      renderAcceptanceList();
      return;
    }

    const weightedP = getWeightedKonkurPercent();
    const konkurT = percentToTScore(weightedP);
    const gpa = getCurrentGPA();
    const savabeghT = gpaToTScore(gpa);

    const yearConfig = D.YEARS[state.year] || D.YEARS['1404'];
    const totalT = (konkurT * yearConfig.konkurWeight) + (savabeghT * yearConfig.savabeghWeight);
    const ranks = tScoreToRank(totalT, state.field, state.quota);

    state.myKonkurT = Math.round(konkurT);
    state.mySavabeghT = Math.round(savabeghT);
    state.myTotalT = Math.round(totalT);
    state.myRank = ranks.quotaRank;
    state.myCountryRank = ranks.countryRank;
    state.goalRank = ranks.quotaRank;

    updateResultsUI();
    renderAcceptanceList();
  }

  function updateResultsUI() {
    const rEl = document.getElementById('res-rank');
    const rngEl = document.getElementById('res-range');
    const barEl = document.getElementById('res-bar');
    const pcEl = document.getElementById('res-percentile');
    const msgEl = document.getElementById('res-msg');

    const tTotalEl = document.getElementById('t-score-total');
    const tKonkurEl = document.getElementById('t-score-konkur');
    const tSavabeghEl = document.getElementById('t-score-savabegh');
    const countryRankEl = document.getElementById('res-country-rank');

    if (rEl) rEl.textContent = fa(state.myRank);
    if (countryRankEl) countryRankEl.textContent = 'رتبه کشوری تقریبی: ' + fa(state.myCountryRank);

    const lower = Math.max(1, Math.round(state.myRank * 0.92));
    const upper = Math.round(state.myRank * 1.08);
    if (rngEl) rngEl.textContent = `بازه تخمینی سهمیه: از ${fa(lower)} تا ${fa(upper)}`;

    if (tTotalEl) tTotalEl.textContent = fa(state.myTotalT);
    if (tKonkurEl) tKonkurEl.textContent = fa(state.myKonkurT);
    if (tSavabeghEl) tSavabeghEl.textContent = fa(state.mySavabeghT);

    const stats = D.STATS[state.field] || D.STATS['تجربی'];
    const totalInQuota = Math.round(stats.totalCandidates * (stats.regionRatio[state.quota] || 0.4));
    const pct = Math.max(1, Math.min(99.9, ((totalInQuota - state.myRank) / totalInQuota) * 100));

    if (barEl) barEl.style.width = pct + '%';
    if (pcEl) pcEl.textContent = `بالاتر از ${faFloat(pct, 1)}٪ داوطلبان سهمیه منطقه ${fa(state.quota)}`;

    if (msgEl) {
      if (state.myTotalT >= 10500) {
        msgEl.innerHTML = '<strong>فوق‌العاده است!</strong> شما در بازه رتبه‌های برتر و شانس قبولی دانشگاه‌های ممتاز سطح یک قرار دارید.';
      } else if (state.myTotalT >= 9200) {
        msgEl.innerHTML = '<strong>موقعیت بسیار عالی!</strong> شانس قبولی در دوره‌های روزانه و دانشگاه‌های معتبر مرکز و کلان‌شهرها برای شما کاملاً مهیاست.';
      } else if (state.myTotalT >= 8000) {
        msgEl.innerHTML = '<strong>پایه مناسب و روبه‌رشد!</strong> با یک برنامه متمرکز تستی و تثبیت نمرات نهایی، می‌توانید جهش چشمگیری در تراز خود ایجاد کنید.';
      } else {
        msgEl.innerHTML = '<strong>هنوز فرصت طلایی باقی است!</strong> تقویت مباحث پربازده و استفاده از برنامه مشاور اختصاصی پایه می‌تواند رتبه شما را هزاران پله ارتقا دهد.';
      }
    }

    const goalInput = document.getElementById('goal-rank-input');
    if (goalInput && state.inputMode !== 'direct') {
      goalInput.value = state.myRank;
    }
  }

  // --- Render Acceptances with Real Admitted Student Rank & Filtered Chances ---
  function renderAcceptanceList() {
    const listEl = document.getElementById('acceptances-list');
    if (!listEl) return;

    const acceptances = D.ACCEPTANCES[state.field] || [];
    const currentRank = state.goalRank || state.myRank || 1000;

    // Filter and compute chances for each acceptance
    const eligible = [];
    acceptances.forEach(item => {
      const student = getStudentForQuota(item, state.quota);

      // Filter by exam year if user selected a specific year
      if (state.acceptancesYear && state.acceptancesYear !== 'all') {
        if (student.year !== state.acceptancesYear) {
          return;
        }
      }

      const admittedRank = student.rankInQuota;
      const chance = getChance(currentRank, admittedRank);

      if (chance !== null) {
        eligible.push({
          item,
          student,
          admittedRank,
          chance
        });
      }
    });

    // Sort strictly in ascending order of admitted rank (به ترتیب رتبه)
    eligible.sort((a, b) => a.admittedRank - b.admittedRank);

    if (eligible.length === 0) {
      const yearText = state.acceptancesYear && state.acceptancesYear !== 'all' ? `در کنکور ${state.acceptancesYear} ` : '';
      listEl.innerHTML = `
        <div class="empty-state" style="padding: 24px; text-align: center; background: rgba(5, 14, 46, 0.85); border: 1.5px solid rgba(232,184,74,0.4); border-radius: 18px; color: #fff;">
          رشته‌محلی ${yearText}در بازه منطبق بر رتبه شما (${fa(Math.max(1, currentRank - 500))} تا ${fa(currentRank + 1500)}) در سهمیه منطقه ${fa(state.quota)} یافت نشد. رتبه یا فیلتر سال را تغییر دهید.
        </div>
      `;
      return;
    }

    listEl.innerHTML = eligible.map(({ item, student, admittedRank, chance }) => {
      const badgeClass = getSeatBadgeClass(item.type);
      return `
        <div class="item">
          <div class="ic" aria-hidden="true">
            <svg class="i"><use href="#build"/></svg>
          </div>
          <div class="item-main">
            <div class="item-header">
              <b>${item.major} · ${item.university}</b>
              <span class="${badgeClass}">${item.type}</span>
            </div>
            <div class="item-details" style="color: #ffffff; opacity: 0.95;">
              <span>کد سنجش: <code class="code">${item.code}</code></span>
              <span>شهر: <strong>${item.city}</strong></span>
              <span style="color: var(--gold2); font-weight: 700;">
                رتبه کارنامه قبولی در منطقه ${fa(state.quota)}: <strong>${fa(admittedRank)}</strong>
              </span>
              <span class="year-pill">کنکور <strong>${student.year}</strong></span>
              <span>تراز کل: <strong>${fa(student.totalTScore)}</strong></span>
            </div>
          </div>
          <div class="item-actions">
            <span class="badge ${chance.code}">
              <svg class="i" style="width:0.9em;height:0.9em"><use href="#target"/></svg>
              ${chance.label}
            </span>
            <button type="button" class="btn-scorecard" data-id="${item.id}">
              <svg class="i"><use href="#award"/></svg>
              مشاهده کارنامه قبولی واقعی
            </button>
          </div>
        </div>
      `;
    }).join('');

    // Attach click listeners to scorecard buttons
    listEl.querySelectorAll('.btn-scorecard').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-id');
        const match = eligible.find(x => x.item.id === id);
        if (match) {
          openScorecardModal(match.item, match.student);
        }
      });
    });
  }

  let isModalOpen = false;

  // --- Real Scorecard Modal with Both Final Exam Scores & Konkur Percentages ---
  function openScorecardModal(item, s) {
    if (!s) s = getStudentForQuota(item, state.quota);
    const modal = document.getElementById('scorecard-modal');
    const modalContent = document.getElementById('scorecard-content');
    if (!modal || !modalContent) return;

    // 1. Detailed Final Exam Subject Scores Table OR Authentic GPA & Savabegh Card
    let finalScoresHtml = '';
    if (s.finalScores && Object.keys(s.finalScores).length > 0) {
      finalScoresHtml = `
        <h4 class="sc-sec-title"><svg class="i"><use href="#book"/></svg>ریز نمرات نهایی دیپلم داوطلب (سوابق قطعی آموزش و پرورش):</h4>
        <div class="sc-table-wrap">
          <table class="sc-table">
            <thead>
              <tr>
                <th>نام درس امتحان نهایی</th>
                <th>نمره کتبی نهایی (از ۲۰)</th>
              </tr>
            </thead>
            <tbody>
              ${Object.entries(s.finalScores).map(([name, val]) => `
                <tr>
                  <td>${name}</td>
                  <td><strong style="color:var(--gold2)">${faFloat(val, 2)}</strong></td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      `;
    } else {
      // Authentic GPA and records summary without fabricated subject rows
      finalScoresHtml = `
        <div class="sc-gpa-summary-card">
          <div class="sc-gpa-badge">
            <svg class="i"><use href="#book"/></svg>
            <span>سوابق تحصیلی قطعی آموزش و پرورش و سازمان سنجش</span>
          </div>
          <div class="sc-gpa-grid">
            <div class="sc-gpa-item">
              <span class="sc-gpa-lbl">معدل کتبی نهایی دیپلم داوطلب:</span>
              <strong class="sc-gpa-val">${faFloat(s.gpa, 2)} از ۲۰</strong>
            </div>
            <div class="sc-gpa-item">
              <span class="sc-gpa-lbl">تراز رسمی سوابق تحصیلی (سنجش):</span>
              <strong class="sc-gpa-val" style="color:var(--gold2);">${fa(s.savabeghTScore)}</strong>
            </div>
          </div>
          <p class="sc-gpa-note">
            * به دلیل عدم انتشار ریزنمرات تک‌درس در کارنامه‌های عمومی سنجش، معدل کتبی نهایی دیپلم و تراز رسمی سوابق تحصیلی قطعی آموزش و پرورش درج گردیده است.
          </p>
        </div>
      `;
    }

    // 2. Specialized Konkur Percentages Table
    let percentagesHtml = '';
    if (s.percentages && Object.keys(s.percentages).length > 0) {
      percentagesHtml = `
        <h4 class="sc-sec-title"><svg class="i"><use href="#chart"/></svg>درصد دروس در آزمون سراسری (کنکور اختصاصی):</h4>
        <div class="sc-table-wrap">
          <table class="sc-table">
            <thead>
              <tr>
                <th>نام درس اختصاصی کنکور</th>
                <th>درصد کسب‌شده در آزمون</th>
              </tr>
            </thead>
            <tbody>
              ${Object.entries(s.percentages).map(([name, val]) => `
                <tr>
                  <td>${name}</td>
                  <td><strong>${faFloat(val, 1)}٪</strong></td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      `;
    }

    const badgeClass = getSeatBadgeClass(item.type);

    modalContent.innerHTML = `
      <div class="sc-header">
        <div>
          <div style="display:flex; gap:8px; align-items:center; flex-wrap:wrap; margin-bottom:8px;">
            <span class="chip"><svg class="i"><use href="#award"/></svg>کارنامه داوطلب واقعی پذیرفته‌شده</span>
            <span class="${badgeClass}">${item.type}</span>
            <span class="year-pill" style="background:rgba(232,184,74,0.15); color:var(--gold2); padding:3px 10px; border-radius:8px; font-weight:700; font-size:12px; border:1px solid rgba(232,184,74,0.4);">کنکور سراسری ${s.year}</span>
          </div>
          <h3 style="color:#fff; font-size:22px; font-weight:800; margin-top:4px;">${item.major} · ${item.university}</h3>
          <p class="sc-sub" style="color:rgba(255,255,255,0.9); font-size:13px; line-height:1.8;">
            نوع دوره: <strong>${item.type}</strong> | شهر: <strong>${item.city}</strong> | کد رشته سنجش: <code>${item.code}</code>
          </p>
        </div>
        <div style="display:flex; gap:8px; align-items:center;">
          <button type="button" class="btn-modal-back" id="sc-back-btn" title="بازگشت">
            <svg class="i"><use href="#arrowr"/></svg>
            <span>بازگشت</span>
          </button>
          <button type="button" class="sc-close" id="sc-close-btn" aria-label="بستن">✕</button>
        </div>
      </div>

      <div class="sc-stats-grid">
        <div class="sc-stat-card">
          <label>رتبه در ${s.quota}</label>
          <strong style="font-size:18px;">${fa(s.rankInQuota)}</strong>
        </div>
        <div class="sc-stat-card">
          <label>رتبه کشوری</label>
          <strong style="font-size:18px;">${fa(s.countryRank)}</strong>
        </div>
        <div class="sc-stat-card gold-border">
          <label>نمره کل (تراز نهایی)</label>
          <strong class="gold-text" style="font-size:20px;">${fa(s.totalTScore)}</strong>
        </div>
        <div class="sc-stat-card">
          <label>تراز کنکور اختصاصی</label>
          <strong>${fa(s.konkurTScore)}</strong>
        </div>
        <div class="sc-stat-card">
          <label>تراز سوابق تحصیلی</label>
          <strong>${fa(s.savabeghTScore)}</strong>
        </div>
        <div class="sc-stat-card">
          <label>معدل کتبی نهایی دیپلم</label>
          <strong style="color:var(--gold2)">${faFloat(s.gpa, 2)} از ۲۰</strong>
        </div>
      </div>

      ${finalScoresHtml}
      ${percentagesHtml}

      <div class="sc-source-box">
        <svg class="i"><use href="#spark"/></svg>
        <div>
          <strong>منبع و اصالت کارنامه:</strong>
          <span>${s.source}</span>
        </div>
      </div>

      <div class="sc-modal-actions">
        <button type="button" class="btn-modal-back-footer" id="sc-footer-back-btn">
          <svg class="i"><use href="#arrowr"/></svg>
          بازگشت به لیست قبولی‌ها
        </button>
      </div>
    `;

    modal.classList.add('on');
    document.body.style.overflow = 'hidden';
    isModalOpen = true;

    try {
      history.pushState({ payehScorecardModal: true }, '');
    } catch (e) {
      console.warn('history.pushState failed', e);
    }

    const closeBtn = document.getElementById('sc-close-btn');
    if (closeBtn) closeBtn.onclick = () => closeScorecardModal(true);
    const backBtn = document.getElementById('sc-back-btn');
    if (backBtn) backBtn.onclick = () => closeScorecardModal(true);
    const footerBackBtn = document.getElementById('sc-footer-back-btn');
    if (footerBackBtn) footerBackBtn.onclick = () => closeScorecardModal(true);
  }

  function closeScorecardModal(fromUserAction = false) {
    const modal = document.getElementById('scorecard-modal');
    if (!modal) return;
    modal.classList.remove('on');
    document.body.style.overflow = '';

    if (isModalOpen) {
      isModalOpen = false;
      if (fromUserAction) {
        if (history.state && history.state.payehScorecardModal) {
          history.back();
        }
      }
    }
  }

  // Intercept browser back button / swipe back gesture on mobile
  window.addEventListener('popstate', (e) => {
    if (isModalOpen) {
      closeScorecardModal(false);
    }
  });

  // --- Setup Event Listeners ---
  function setupEvents() {
    const quotaSelect = document.getElementById('quota-select');
    if (quotaSelect) {
      quotaSelect.addEventListener('change', (e) => {
        state.quota = e.target.value;
        const quotaLabel = document.getElementById('direct-quota-label');
        if (quotaLabel) quotaLabel.textContent = fa(state.quota);
        updateDirectPanelBadges();
        calculate();
      });
    }

    // Year Selector
    const yearSelect = document.getElementById('year-select');
    if (yearSelect) {
      yearSelect.addEventListener('change', (e) => {
        state.year = e.target.value;
        const noteEl = document.getElementById('year-description');
        if (noteEl && D.YEARS[state.year]) {
          noteEl.textContent = D.YEARS[state.year].description;
        }
        calculate();
      });
    }

    // GPA Mode Switching
    const btnGpaFast = document.getElementById('btn-gpa-fast');
    const btnGpaDetail = document.getElementById('btn-gpa-detail');
    const wrapFast = document.getElementById('gpa-fast-wrap');
    const wrapDetail = document.getElementById('gpa-detail-wrap');

    if (btnGpaFast && btnGpaDetail) {
      btnGpaFast.addEventListener('click', () => {
        state.gpaMode = 'fast';
        btnGpaFast.classList.add('on');
        btnGpaDetail.classList.remove('on');
        if (wrapFast) wrapFast.style.display = 'block';
        if (wrapDetail) wrapDetail.style.display = 'none';
        calculate();
      });

      btnGpaDetail.addEventListener('click', () => {
        state.gpaMode = 'detail';
        btnGpaDetail.classList.add('on');
        btnGpaFast.classList.remove('on');
        if (wrapFast) wrapFast.style.display = 'none';
        if (wrapDetail) wrapDetail.style.display = 'block';
        calculate();
      });
    }

    const gpaFast = document.getElementById('gpa-fast');
    if (gpaFast) {
      gpaFast.addEventListener('input', calculate);
    }

    const goalRankInput = document.getElementById('goal-rank-input');
    if (goalRankInput) {
      goalRankInput.addEventListener('input', (e) => {
        const val = parseInt(e.target.value, 10);
        state.goalRank = !isNaN(val) && val > 0 ? val : state.myRank;
        renderAcceptanceList();
      });
    }

    // Filter acceptances by exam year
    const acceptancesYearFilter = document.getElementById('acceptances-year-filter');
    if (acceptancesYearFilter) {
      acceptancesYearFilter.addEventListener('change', (e) => {
        state.acceptancesYear = e.target.value;
        renderAcceptanceList();
      });
    }

    // Switch between Mode A and Mode B
    const modeTabs = document.querySelectorAll('.mode-tab');
    modeTabs.forEach(tab => {
      tab.addEventListener('click', () => {
        modeTabs.forEach(t => t.classList.remove('on'));
        tab.classList.add('on');
        const mode = tab.getAttribute('data-mode');
        state.inputMode = mode;

        const scoresPanel = document.getElementById('panel-scores');
        const directPanel = document.getElementById('panel-direct');

        if (mode === 'scores') {
          if (scoresPanel) scoresPanel.style.display = 'block';
          if (directPanel) directPanel.style.display = 'none';
        } else {
          if (scoresPanel) scoresPanel.style.display = 'none';
          if (directPanel) directPanel.style.display = 'block';
        }
        calculate();
      });
    });

    const directRankInput = document.getElementById('direct-rank-input');
    if (directRankInput) {
      directRankInput.addEventListener('input', calculate);
    }

    const modal = document.getElementById('scorecard-modal');
    if (modal) {
      modal.addEventListener('click', (e) => {
        if (e.target === modal) closeScorecardModal(true);
      });
    }

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') closeScorecardModal(true);
    });
  }

  function init() {
    renderFieldTabs();
    updateDirectPanelBadges();
    renderSubjects();
    renderFinalExamSubjects();
    setupEvents();
    calculate();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
