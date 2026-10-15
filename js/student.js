document.addEventListener("DOMContentLoaded", async () => {
    const sidebar = document.getElementById("studentSidebar");
    const menuButton = document.getElementById("studentMenu");
    const pageTitle = document.getElementById("studentPageTitle");
    const titles = { dashboard: "داشبورد", activities: "فعالیت‌های من", performance: "عملکرد من", consultant: "مشاور من", tasks: "برنامه و وظایف", profile: "پروفایل" };

    const selectPage = (name) => {
        document.querySelectorAll(".payeh-student__nav-item[data-page]").forEach((item) => item.classList.toggle("active", item.dataset.page === name));
        if (pageTitle) pageTitle.textContent = titles[name] || titles.dashboard;
        if (name === "consultant") document.getElementById("student-consultant-panel")?.scrollIntoView({ behavior: "smooth", block: "center" });
        else window.scrollTo({ top: 0, behavior: "smooth" });
        sidebar?.classList.remove("is-open");
    };
    document.querySelectorAll('[data-page="consultant"]').forEach((item) => item.addEventListener("click", (event) => {
        event.preventDefault();
        history.replaceState(null, "", "#consultant");
        selectPage("consultant");
    }));
    document.querySelectorAll(".payeh-student__nav-item[data-page]:not([data-page=consultant])").forEach((item) => item.addEventListener("click", (event) => {
        event.preventDefault(); const name = item.dataset.page; history.replaceState(null, "", `#${name}`); selectPage(name);
    }));
    menuButton?.addEventListener("click", () => sidebar?.classList.toggle("is-open"));
    window.addEventListener("hashchange", () => selectPage(location.hash.slice(1) || "dashboard"));
    document.querySelector(".payeh-student__logout")?.addEventListener("click", async () => {
        try { const csrf = await fetch("/api/auth/csrf/", { credentials: "same-origin" }).then((response) => response.json()); await fetch("/api/auth/logout/", { method: "POST", credentials: "same-origin", headers: { "X-CSRFToken": csrf.csrfToken } }); }
        finally { location.assign("login.html"); }
    });
    document.getElementById("student-gender-form")?.addEventListener("submit", async event => {
        event.preventDefault();const message=document.getElementById("student-gender-message"),button=event.currentTarget.querySelector("button");button.disabled=true;message.textContent="در حال ذخیره…";
        try{const csrf=await fetch("/api/auth/csrf/",{credentials:"same-origin"}).then(r=>r.json());const response=await fetch("/api/auth/profile/gender/",{method:"POST",credentials:"same-origin",headers:{"Content-Type":"application/json","X-CSRFToken":csrf.csrfToken},body:JSON.stringify({gender:document.getElementById("student-gender").value})});const data=await response.json();if(!response.ok)throw new Error(data.detail||"ذخیره انجام نشد.");message.textContent="اطلاعات ذخیره شد.";}catch(error){message.textContent=error.message;}finally{button.disabled=false;}
    });

    async function loadStudyPlan() {
        const week = document.getElementById("study-week"), box = document.getElementById("study-now"), dateLabel = document.getElementById("study-date");
        if (!week || !box) return;
        const names = ["شنبه", "یکشنبه", "دوشنبه", "سه‌شنبه", "چهارشنبه", "پنجشنبه", "جمعه"], dayIndexes = { "شنبه": 0, "یکشنبه": 1, "دوشنبه": 2, "سه‌شنبه": 3, "چهارشنبه": 4, "پنجشنبه": 5, "جمعه": 6 };
        const fa = new Intl.NumberFormat("fa-IR");
        const weekday = new Intl.DateTimeFormat("fa-IR", { weekday: "long", timeZone: "Asia/Tehran" }).format(new Date());
        const today = dayIndexes[weekday] ?? 0;
        dateLabel.textContent = new Intl.DateTimeFormat("fa-IR-u-ca-persian", { weekday: "long", year: "numeric", month: "long", day: "numeric", timeZone: "Asia/Tehran" }).format(new Date());

        try {
            const [response, timerResponse] = await Promise.all([
                fetch("/api/consultations/study-sessions/", { credentials: "same-origin" }),
                fetch("/api/consultations/study-timers/today/", { credentials: "same-origin" })
            ]);
            const payload = await response.json(), timerData = await timerResponse.json();
            if (!response.ok) throw new Error(payload.detail || "برنامه دریافت نشد.");

            const sessions = payload.results || [];
            let timersList = (timerData.results || []).map(x => ({
                ...x,
                clientSince: x.running ? Date.now() : null
            }));

            // Collect all defined subjects across the student's weekly study plan
            const planSubjects = Array.from(new Set(sessions.map(s => (s.subject || "").trim()).filter(Boolean)));
            const curriculumSubjects = [
                "زیست‌شناسی", "شیمی", "فیزیک", "ریاضی", "ادبیات فارسی", "عربی",
                "زبان انگلیسی", "دین و زندگی", "حسابان", "هندسه", "گسسته و آمار",
                "زمین‌شناسی", "علوم و فنون ادبی", "عربی اختصاصی", "جامعه‌شناسی",
                "روان‌شناسی", "فلسفه و منطق", "اقتصاد", "تاریخ", "جغرافیا"
            ];
            const allAvailableSubjects = Array.from(new Set([...planSubjects, ...curriculumSubjects]));

            // Render weekly calendar
            week.replaceChildren();
            if (!sessions.length) {
                const empty = document.createElement("p");
                empty.className = "study-empty";
                empty.textContent = "هنوز برنامه‌ای از طرف مشاورت ثبت نشده است.";
                week.replaceChildren(empty);
            } else {
                const grid = document.createElement("div");
                grid.className = "study-week-grid";
                const palette = { mint: "#dff2e6", blue: "#e2efff", peach: "#ffeadc", lavender: "#efe8ff", rose: "#ffe5eb", yellow: "#fff3c9" };
                names.forEach((day, index) => {
                    const col = document.createElement("section");
                    col.className = `study-day${index === today ? " is-today" : ""}`;
                    const h = document.createElement("h4");
                    h.textContent = `${day}${index === today ? " · امروز" : ""}`;
                    col.append(h);
                    const rows = sessions.filter(x => x.weekday === index);
                    if (!rows.length) {
                        const empty = document.createElement("span");
                        empty.className = "study-day-empty";
                        empty.textContent = "برنامه‌ای ثبت نشده";
                        col.append(empty);
                    }
                    rows.forEach(item => {
                        const card = document.createElement("article");
                        card.className = "study-session";
                        card.style.setProperty("--session-color", palette[item.color] || palette.mint);
                        const title = document.createElement("strong");
                        title.textContent = item.subject;
                        const duration = document.createElement("span");
                        duration.textContent = `سهمیه: ${fa.format(Math.floor(item.planned_minutes / 60))} ساعت و ${fa.format(item.planned_minutes % 60)} دقیقه`;
                        const task = document.createElement("span");
                        task.textContent = item.mode === "test" ? `حل تست · ${fa.format(item.test_count)} تست` : item.mode === "written" ? "حل تشریحی" : "مطالعهٔ درس‌نامه";
                        card.append(title, duration, task);
                        if (item.instructions) {
                            const note = document.createElement("small");
                            note.textContent = item.instructions;
                            card.append(note);
                        }
                        col.append(card);
                    });
                    grid.append(col);
                });
                week.append(grid);
            }

            const csrf = async () => (await fetch("/api/auth/csrf/", { credentials: "same-origin" })).json().then(x => x.csrfToken);

            let isAddingBox = false;

            function renderTodayBoxes() {
                box.hidden = false;
                box.className = "study-today-section";
                box.replaceChildren();

                // Topbar
                const topbar = document.createElement("div");
                topbar.className = "study-today-topbar";

                const titleWrap = document.createElement("div");
                titleWrap.className = "study-today-title-wrap";
                const h3 = document.createElement("h3");
                h3.className = "study-today-title";
                h3.textContent = "گزارش مطالعهٔ امروز";
                const desc = document.createElement("p");
                desc.className = "study-today-desc";
                desc.textContent = "هر درس باکس مجزا دارد. زمان ثبت و در ساعت ۱۲ شب به‌صورت خودکار روانه پنل مشاور می‌شود.";
                titleWrap.append(h3, desc);

                const actions = document.createElement("div");
                actions.className = "study-today-actions";

                const badge = document.createElement("span");
                badge.className = "study-boxes-badge";
                badge.textContent = `${fa.format(timersList.length)} از ۳۰ باکس استفاده‌شده`;

                const addBtn = document.createElement("button");
                addBtn.type = "button";
                addBtn.className = "study-add-box-btn";
                addBtn.textContent = "+ افزودن باکس درس جدید";
                addBtn.disabled = timersList.length >= 30;
                addBtn.addEventListener("click", () => {
                    isAddingBox = !isAddingBox;
                    renderTodayBoxes();
                });

                actions.append(badge, addBtn);
                topbar.append(titleWrap, actions);
                box.append(topbar);

                // Add Box Panel
                if (isAddingBox && timersList.length < 30) {
                    const addPanel = document.createElement("div");
                    addPanel.className = "study-add-panel";

                    const select = document.createElement("select");
                    allAvailableSubjects.forEach(s => {
                        const opt = document.createElement("option");
                        opt.value = s;
                        opt.textContent = s;
                        select.append(opt);
                    });
                    const customOpt = document.createElement("option");
                    customOpt.value = "__custom__";
                    customOpt.textContent = "سایر دروس (تایپ دستی)...";
                    select.append(customOpt);

                    const customInput = document.createElement("input");
                    customInput.type = "text";
                    customInput.maxLength = 80;
                    customInput.placeholder = "نام درس دلخواه را بنویسید";
                    customInput.style.display = "none";

                    select.addEventListener("change", () => {
                        customInput.style.display = select.value === "__custom__" ? "inline-block" : "none";
                        if (select.value === "__custom__") customInput.focus();
                    });

                    const submitBtn = document.createElement("button");
                    submitBtn.type = "button";
                    submitBtn.textContent = "ایجاد باکس مطالعه";

                    const cancelBtn = document.createElement("button");
                    cancelBtn.type = "button";
                    cancelBtn.className = "btn-cancel";
                    cancelBtn.textContent = "انصراف";
                    cancelBtn.addEventListener("click", () => {
                        isAddingBox = false;
                        renderTodayBoxes();
                    });

                    const msg = document.createElement("span");
                    msg.style.fontSize = "12px";
                    msg.style.color = "#c0392b";

                    submitBtn.addEventListener("click", async () => {
                        let finalSubject = select.value === "__custom__" ? customInput.value.trim() : select.value.trim();
                        if (!finalSubject) {
                            msg.textContent = "نام درس را وارد کنید.";
                            return;
                        }
                        if (finalSubject.length > 80) {
                            msg.textContent = "نام درس حداکثر ۸۰ کاراکتر است.";
                            return;
                        }
                        submitBtn.disabled = true;
                        msg.textContent = "در حال ایجاد باکس...";
                        try {
                            const token = await csrf();
                            const r = await fetch("/api/consultations/study-timers/create-box/", {
                                method: "POST",
                                credentials: "same-origin",
                                headers: { "Content-Type": "application/json", "X-CSRFToken": token },
                                body: JSON.stringify({ subject: finalSubject })
                            });
                            const d = await r.json();
                            if (!r.ok) throw new Error(d.detail || "ایجاد باکس انجام نشد.");
                            timersList.push({
                                ...d,
                                clientSince: null
                            });
                            isAddingBox = false;
                            renderTodayBoxes();
                        } catch (err) {
                            msg.textContent = err.message || "خطا در ایجاد باکس.";
                            submitBtn.disabled = false;
                        }
                    });

                    addPanel.append(select, customInput, submitBtn, cancelBtn, msg);
                    box.append(addPanel);
                }

                // Grid of Boxes
                const grid = document.createElement("div");
                grid.className = "study-boxes-grid";

                if (!timersList.length) {
                    const emptyCard = document.createElement("div");
                    emptyCard.style.padding = "24px";
                    emptyCard.style.textAlign = "center";
                    emptyCard.style.color = "#627367";
                    emptyCard.style.gridColumn = "1/-1";
                    emptyCard.textContent = "امروز هنوز باکسی برای مطالعه ثبت نشده است. با دکمه بالا اولین باکس را اضافه کن!";
                    grid.append(emptyCard);
                }

                timersList.forEach(timer => {
                    const card = document.createElement("article");
                    card.className = `study-box-card${timer.running ? " is-running" : ""}${timer.finished ? " is-finished" : ""}${timer.delivered ? " is-delivered" : ""}`;
                    card.id = `study-box-card-${timer.id}`;

                    // Header
                    const header = document.createElement("div");
                    header.className = "study-box-header";

                    const subjStrong = document.createElement("strong");
                    subjStrong.className = "study-box-subject";
                    subjStrong.textContent = timer.subject;

                    const tag = document.createElement("span");
                    tag.className = `study-box-tag ${timer.is_planned ? "study-box-tag--planned" : "study-box-tag--extra"}`;
                    tag.textContent = timer.is_planned ? "برنامهٔ امروز" : "مطالعهٔ آزاد";

                    header.append(subjStrong, tag);
                    card.append(header);

                    if (timer.is_planned && timer.planned_minutes) {
                        const quotaHint = document.createElement("div");
                        quotaHint.className = "study-box-quota-hint";
                        quotaHint.textContent = `سهمیه امروز: ${fa.format(Math.floor(timer.planned_minutes / 60))} ساعت و ${fa.format(timer.planned_minutes % 60)} دقیقه`;
                        card.append(quotaHint);
                    }

                    // Timer display & Status badge
                    const timerWrap = document.createElement("div");
                    timerWrap.className = "study-box-timer-wrap";

                    const digitsRow = document.createElement("div");
                    digitsRow.className = "study-timer-digits-row";

                    const dot = document.createElement("span");
                    dot.className = "study-pulsing-dot";
                    dot.style.display = timer.running ? "inline-block" : "none";

                    const timeDisplay = document.createElement("span");
                    timeDisplay.className = "study-box-time";
                    timeDisplay.id = `study-time-${timer.id}`;
                    const secs = timer.elapsed_seconds + (timer.running && timer.clientSince ? Math.floor((Date.now() - timer.clientSince) / 1000) : 0);
                    timeDisplay.textContent = `${fa.format(Math.floor(secs / 3600))}:${fa.format(Math.floor((secs % 3600) / 60)).padStart(2, "۰")}:${fa.format(secs % 60).padStart(2, "۰")}`;

                    digitsRow.append(dot, timeDisplay);

                    const timeLabel = document.createElement("span");
                    timeLabel.className = "study-time-label";
                    timeLabel.textContent = "زمان مطالعه‌شده";

                    const stateBadge = document.createElement("span");
                    stateBadge.className = "study-state-badge";
                    if (timer.delivered) {
                        stateBadge.className += " badge--delivered";
                        stateBadge.textContent = "ارسال‌شده به مشاور";
                    } else if (timer.running) {
                        stateBadge.className += " badge--running";
                        stateBadge.textContent = "در حال مطالعه";
                    } else if (timer.finished) {
                        stateBadge.className += " badge--finished";
                        stateBadge.textContent = "ثبت‌شده (ارسال ۱۲ شب)";
                    } else if (timer.elapsed_seconds > 0) {
                        stateBadge.className += " badge--paused";
                        stateBadge.textContent = "استپ / توقف موقت";
                    } else {
                        stateBadge.className += " badge--idle";
                        stateBadge.textContent = "شروع‌نشده";
                    }

                    timerWrap.append(digitsRow, timeLabel, stateBadge);
                    card.append(timerWrap);

                    // Actions
                    const actionGroup = document.createElement("div");
                    actionGroup.className = "study-box-actions";

                    // Button 1: Start / Resume / Pause toggle
                    const startBtn = document.createElement("button");
                    startBtn.type = "button";
                    startBtn.className = "study-box-btn study-btn--start";
                    if (timer.running) {
                        startBtn.textContent = "⏸ استپ (توقف موقت)";
                        startBtn.className += " is-pause-mode";
                    } else if (timer.finished) {
                        startBtn.textContent = "▶ ادامهٔ مطالعه";
                    } else if (timer.elapsed_seconds > 0) {
                        startBtn.textContent = "▶ ادامهٔ مطالعه";
                    } else {
                        startBtn.textContent = "▶ شروع مطالعه";
                    }
                    startBtn.disabled = Boolean(timer.delivered);

                    // Button 2: Pause / Stop (ALWAYS VISIBLE!)
                    const pauseBtn = document.createElement("button");
                    pauseBtn.type = "button";
                    pauseBtn.className = `study-box-btn study-btn--pause${timer.running ? " is-active" : ""}`;
                    pauseBtn.textContent = "⏸ استپ و توقف موقت";
                    pauseBtn.disabled = !timer.running || Boolean(timer.delivered);

                    // Button 3: Finish & Submit
                    const finishBtn = document.createElement("button");
                    finishBtn.type = "button";
                    finishBtn.className = `study-box-btn study-btn--finish${timer.finished ? " is-registered" : ""}`;
                    finishBtn.textContent = timer.finished ? "✔ ثبت شد (ارسال ۱۲ شب)" : "⏹ اتمام و ثبت گزارش";
                    finishBtn.disabled = Boolean(timer.delivered);

                    actionGroup.append(startBtn, pauseBtn, finishBtn);
                    card.append(actionGroup);

                    // Notes
                    const notesArea = document.createElement("textarea");
                    notesArea.className = "study-box-notes";
                    notesArea.maxLength = 1000;
                    notesArea.placeholder = "توضیحات و گزارش کار (مباحث، تعداد تست‌ها یا صفحات مطالعه‌شده)...";
                    notesArea.value = timer.notes || "";
                    notesArea.disabled = Boolean(timer.delivered);
                    notesArea.addEventListener("input", () => {
                        timer.notes = notesArea.value;
                    });
                    card.append(notesArea);

                    // Quick Note Save Row
                    const noteSaveRow = document.createElement("div");
                    noteSaveRow.className = "study-notes-save-row";
                    const noteSaveBtn = document.createElement("button");
                    noteSaveBtn.type = "button";
                    noteSaveBtn.className = "study-notes-save-btn";
                    noteSaveBtn.textContent = "💾 ذخیره توضیحات گزارش";
                    noteSaveBtn.disabled = Boolean(timer.delivered);
                    noteSaveBtn.addEventListener("click", () => {
                        performAction(timer.id, "edit", null, notesArea.value);
                    });
                    noteSaveRow.append(noteSaveBtn);
                    card.append(noteSaveRow);

                    // Manual Time Correction Section
                    const manualSection = document.createElement("div");
                    manualSection.className = "study-box-manual-section";

                    const manualHeader = document.createElement("div");
                    manualHeader.className = "study-manual-header";

                    const manualTitle = document.createElement("span");
                    manualTitle.className = "study-manual-title";
                    manualTitle.textContent = "اصلاح دستی زمان مطالعه‌شده:";

                    const quotaSpan = document.createElement("span");
                    quotaSpan.className = "study-manual-quota";
                    quotaSpan.textContent = `(سهمیه: ${fa.format(timer.edits_remaining ?? 5)} از ۵ بار)`;

                    manualHeader.append(manualTitle, quotaSpan);
                    manualSection.append(manualHeader);

                    const manualHint = document.createElement("p");
                    manualHint.className = "study-manual-hint";
                    manualHint.textContent = "چنانچه مقدار تایمر اشتباه است، می‌توانید زمان مطالعه‌شده را از این طریق به صورت دستی اصلاح کنید.";
                    manualSection.append(manualHint);

                    const manualControls = document.createElement("div");
                    manualControls.className = "study-manual-controls";

                    const hLabel = document.createElement("label");
                    hLabel.className = "study-manual-field";
                    hLabel.append("ساعت: ");
                    const hoursInput = document.createElement("input");
                    hoursInput.type = "number";
                    hoursInput.min = "0";
                    hoursInput.max = "24";
                    hoursInput.className = "study-manual-num";
                    hoursInput.value = "";
                    hoursInput.placeholder = "۰";
                    hoursInput.disabled = Boolean(timer.delivered) || Number(timer.edits_remaining ?? 5) <= 0;
                    hLabel.append(hoursInput);

                    const mLabel = document.createElement("label");
                    mLabel.className = "study-manual-field";
                    mLabel.append("دقیقه: ");
                    const minutesInput = document.createElement("input");
                    minutesInput.type = "number";
                    minutesInput.min = "0";
                    minutesInput.max = "59";
                    minutesInput.className = "study-manual-num";
                    minutesInput.value = "";
                    minutesInput.placeholder = "۰";
                    minutesInput.disabled = Boolean(timer.delivered) || Number(timer.edits_remaining ?? 5) <= 0;
                    mLabel.append(minutesInput);

                    const manualSaveBtn = document.createElement("button");
                    manualSaveBtn.type = "button";
                    manualSaveBtn.className = "study-manual-btn";
                    manualSaveBtn.textContent = "ثبت اصلاح دستی زمان مطالعه‌شده";
                    manualSaveBtn.disabled = Boolean(timer.delivered) || Number(timer.edits_remaining ?? 5) <= 0;

                    manualControls.append(hLabel, mLabel, manualSaveBtn);
                    manualSection.append(manualControls);
                    card.append(manualSection);

                    // Status Message
                    const statusMsg = document.createElement("div");
                    statusMsg.className = "study-box-status";
                    if (timer.delivered) {
                        statusMsg.textContent = "📤 گزارش این درس ساعت ۱۲ شب برای مشاور ارسال شد.";
                    } else if (timer.finished) {
                        statusMsg.textContent = "✅ گزارش این درس ثبت شده و ساعت ۱۲ شب ارسال خواهد شد. تا قبل از ۱۲ شب می‌توانید با «ادامهٔ مطالعه» زمان بیشتری بیفزایید یا زمان مطالعه‌شده و توضیحات را ویرایش کنید.";
                    } else if (timer.running) {
                        statusMsg.textContent = "⏱ در حال مطالعه… برای وقفه «استپ و توقف موقت» را بزنید.";
                    } else if (timer.elapsed_seconds > 0) {
                        statusMsg.textContent = "⏸ زمان متوقف است (استپ). می‌توانید «ادامهٔ مطالعه» را بزنید یا با «اتمام و ثبت گزارش» آن را ثبت کنید.";
                    } else {
                        statusMsg.textContent = "آماده برای شروع مطالعهٔ این درس.";
                    }
                    card.append(statusMsg);

                    // Event Listeners
                    startBtn.addEventListener("click", () => {
                        if (timer.running) {
                            performAction(timer.id, "pause", null, notesArea.value);
                        } else {
                            performAction(timer.id, "start", null, notesArea.value);
                        }
                    });
                    pauseBtn.addEventListener("click", () => {
                        performAction(timer.id, "pause", null, notesArea.value);
                    });
                    finishBtn.addEventListener("click", () => {
                        const confirmMsg = timer.finished
                            ? "می‌خواهی تغییرات گزارش را برای ارسال ساعت ۱۲ شب به‌روزرسانی کنی؟"
                            : "مطمئنی مطالعهٔ این درس را به پایان رساندی؟ گزارش نهایی ساعت ۱۲ شب برای مشاور ارسال می‌شود و تا قبل از ۱۲ شب هم قابل ویرایش است.";
                        if (window.confirm(confirmMsg)) {
                            performAction(timer.id, "finish", null, notesArea.value);
                        }
                    });
                    manualSaveBtn.addEventListener("click", () => {
                        const hVal = hoursInput.value.trim();
                        const mVal = minutesInput.value.trim();
                        if (hVal === "" && mVal === "") {
                            alert("لطفاً برای اصلاح دستی، مقدار ساعت یا دقیقه را وارد کنید.");
                            return;
                        }
                        const h = hVal === "" ? 0 : parseInt(hVal, 10);
                        const m = mVal === "" ? 0 : parseInt(mVal, 10);
                        if (isNaN(h) || h < 0 || h > 24 || isNaN(m) || m < 0 || m > 59) {
                            alert("لطفاً ساعت (بین ۰ تا ۲۴) و دقیقه (بین ۰ تا ۵۹) معتبر وارد کنید.");
                            return;
                        }
                        const totalMinutes = h * 60 + m;
                        if (totalMinutes > 1440) {
                            alert("مجموع زمان نمی‌تواند بیشتر از ۲۴ ساعت (۱۴۴۰ دقیقه) باشد.");
                            return;
                        }
                        performAction(timer.id, "edit", totalMinutes, notesArea.value);
                    });

                    grid.append(card);
                });

                box.append(grid);
            }

            // Central action handler
            async function performAction(timerId, actionName, minutes = null, notesVal = "") {
                const card = document.getElementById(`study-box-card-${timerId}`);
                if (card) {
                    card.style.opacity = "0.7";
                    card.style.pointerEvents = "none";
                }
                try {
                    const token = await csrf();
                    if (!token) throw new Error("توکن امنیتی دریافت نشد؛ صفحه را تازه کنید.");
                    const payload = { timer_id: timerId, action: actionName, notes: notesVal };
                    if (minutes !== null) payload.minutes = minutes;
                    const r = await fetch("/api/consultations/study-timers/action/", {
                        method: "POST",
                        credentials: "same-origin",
                        headers: { "Content-Type": "application/json", "X-CSRFToken": token },
                        body: JSON.stringify(payload)
                    });
                    const d = await r.json();
                    if (!r.ok) throw new Error(d.detail || `خطا در ثبت (${r.status})`);

                    // If starting, pause any other running timer locally
                    if (actionName === "start") {
                        timersList.forEach(t => {
                            if (t.id !== timerId && t.running) {
                                t.elapsed_seconds += t.clientSince ? Math.floor((Date.now() - t.clientSince) / 1000) : 0;
                                t.running = false;
                                t.clientSince = null;
                            }
                        });
                    }

                    const idx = timersList.findIndex(t => t.id === timerId);
                    if (idx !== -1) {
                        timersList[idx] = {
                            ...timersList[idx],
                            ...d,
                            clientSince: d.running ? Date.now() : null
                        };
                    }
                    renderTodayBoxes();
                    return true;
                } catch (err) {
                    alert(err.message || "خطا در عملیات زمان‌سنج.");
                    if (card) {
                        card.style.opacity = "1";
                        card.style.pointerEvents = "auto";
                    }
                    return false;
                }
            }

            // Global 1-second ticker for running timer
            if (window.studyTimerTicker) clearInterval(window.studyTimerTicker);
            window.studyTimerTicker = setInterval(() => {
                const active = timersList.find(t => t.running);
                if (!active || !active.clientSince) return;
                const secs = active.elapsed_seconds + Math.floor((Date.now() - active.clientSince) / 1000);
                const node = document.getElementById(`study-time-${active.id}`);
                if (node) {
                    node.textContent = `${fa.format(Math.floor(secs / 3600))}:${fa.format(Math.floor((secs % 3600) / 60)).padStart(2, "۰")}:${fa.format(secs % 60).padStart(2, "۰")}`;
                }
            }, 1000);

            renderTodayBoxes();

            // Load delivered study report history
            const reports = await fetch("/api/consultations/study-reports/", { credentials: "same-origin" }).then(r => r.json());
            if (reports.results?.length) {
                const recent = document.createElement("div");
                recent.className = "study-report-history";
                const label = document.createElement("strong");
                label.textContent = "گزارش‌های ثبت‌شدهٔ اخیر";
                recent.append(label);
                reports.results.forEach(x => {
                    const row = document.createElement("div");
                    row.className = "study-report-row";
                    const line = document.createElement("p");
                    line.textContent = `${x.study_date} · ${x.subject}`;
                    const minutesInput = document.createElement("input");
                    minutesInput.type = "number";
                    minutesInput.min = "0";
                    minutesInput.max = "1440";
                    minutesInput.value = x.minutes;
                    minutesInput.setAttribute("aria-label", "مدت مطالعه به دقیقه");
                    const notesInput = document.createElement("textarea");
                    notesInput.value = x.notes || "";
                    notesInput.maxLength = 1000;
                    notesInput.placeholder = "توضیحات گزارش";
                    notesInput.setAttribute("aria-label", "توضیحات گزارش");
                    const edit = document.createElement("button");
                    edit.type = "button";
                    edit.className = "study-start";
                    edit.textContent = "ویرایش گزارش ارسال‌شده";
                    const message = document.createElement("span");
                    message.setAttribute("role", "status");
                    let remainingEdits = Number(x.edits_remaining ?? 5);
                    const quota = document.createElement("small");
                    quota.textContent = `ویرایش باقی‌مانده: ${fa.format(remainingEdits)} بار`;
                    if (remainingEdits <= 0) edit.disabled = true;
                    edit.addEventListener("click", async () => {
                        edit.disabled = true;
                        try {
                            const token = await csrf(), r = await fetch(`/api/consultations/study-reports/${x.id}/edit/`, {
                                method: "POST",
                                credentials: "same-origin",
                                headers: { "Content-Type": "application/json", "X-CSRFToken": token },
                                body: JSON.stringify({ minutes: Number(minutesInput.value), notes: notesInput.value })
                            }), d = await r.json();
                            if (!r.ok) throw new Error(d.detail || "ویرایش گزارش انجام نشد.");
                            message.textContent = "گزارش ارسال‌شده ویرایش شد.";
                            remainingEdits = d.edits_remaining;
                            quota.textContent = `ویرایش باقی‌مانده: ${fa.format(remainingEdits)} بار`;
                            if (remainingEdits <= 0) edit.disabled = true;
                        } catch (e) {
                            message.textContent = e.message;
                        } finally {
                            edit.disabled = remainingEdits <= 0;
                        }
                    });
                    row.append(line, minutesInput, notesInput, quota, edit, message);
                    recent.append(row);
                });
                week.append(recent);
            }
        } catch (error) {
            week.textContent = error.message || "برنامه دریافت نشد.";
        }
    }

    async function loadStudyFeedbacks() {
        const target = document.getElementById("student-feedbacks-list");
        if (!target) return;

        try {
            const response = await fetch("/api/consultations/study-feedbacks/", { credentials: "same-origin" });
            const data = await response.json();
            if (!response.ok) throw new Error(data.detail || "دریافت بازخوردها انجام نشد.");

            target.replaceChildren();
            const list = data.results || [];
            if (!list.length) {
                const empty = document.createElement("p");
                empty.className = "student-feedbacks-empty";
                empty.textContent = "هنوز بازخوردی از طرف مشاور برای گزارش‌های مطالعه شما ثبت نشده است.";
                target.append(empty);
                return;
            }

            list.forEach(item => {
                const card = document.createElement("article");
                card.className = "student-feedback-card";

                const header = document.createElement("div");
                header.className = "student-feedback-header";

                const author = document.createElement("span");
                author.className = "student-feedback-author";
                author.textContent = `مشاور: ${item.consultant_name}`;

                const meta = document.createElement("span");
                meta.className = "student-feedback-meta";
                meta.textContent = `مربوط به گزارش مطالعه ${item.study_date} · ${item.created_at}`;

                header.append(author, meta);

                const body = document.createElement("p");
                body.className = "student-feedback-text";
                body.textContent = item.feedback_text;

                card.append(header, body);
                target.append(card);
            });
        } catch (error) {
            target.replaceChildren();
            const err = document.createElement("p");
            err.className = "student-feedbacks-empty";
            err.textContent = error.message || "خطا در دریافت بازخوردها.";
            target.append(err);
        }
    }

    try {
        const meResponse = await fetch("/api/auth/me/", { credentials: "same-origin" });
        if (!meResponse.ok) { location.assign("login.html"); return; }
        const me = await meResponse.json();
        if (me.role !== "student") { location.assign(me.role === "consultant" ? "consultant.html" : "manager.html"); return; }
        const name = me.full_name || "دانش‌آموز";
        const genderSelect=document.getElementById("student-gender");if(genderSelect)genderSelect.value=me.gender||"";
        loadStudyPlan();
        loadStudyFeedbacks();
        ["student-sidebar-name", "student-account-name"].forEach((id) => { const node = document.getElementById(id); if (node) node.textContent = name; });
        const subtitle = document.getElementById("student-header-subtitle"); if (subtitle) subtitle.textContent = `پنل شخصی ${name}`;
        const greeting = document.getElementById("student-greeting"); if (greeting) greeting.textContent = `سلام ${name} 👋`;
        try {
            const response = await fetch("/api/consultations/requests/", { credentials: "same-origin" });
            const data = await response.json(); if (!response.ok) throw new Error(data.detail || "وضعیت درخواست مشاوره دریافت نشد.");
            const summary = document.getElementById("student-consultation-summary");
            const link = document.getElementById("student-consultation-link");
            const active = data.results.find((item) => item.status === "approved" || item.status === "pending");
            const latest = active || data.results[0];
            if (latest?.status === "approved") {
                const line = document.createElement("p"); line.textContent = `مشاور اختصاصی شما: ${latest.assigned_consultant_name} · پلن ${latest.plan_label} · ${new Intl.NumberFormat("fa-IR").format(latest.assigned_price_toman)} تومان`; summary.append(line);
                const chat = document.createElement("a"); chat.href = `consultation-chat.html?request=${encodeURIComponent(latest.id)}`; chat.textContent = "گفت‌وگو با مشاور"; chat.className = "student-assigned-chat"; summary.append(chat);
                link.textContent = "مشاهده درخواست و جزئیات مشاور";
            } else if (latest?.status === "pending") {
                const line = document.createElement("p"); line.textContent = `درخواست پلن ${latest.plan_label} ثبت شده و منتظر بررسی مدیر مجموعه است.`; summary.append(line);
                link.textContent = "مشاهده وضعیت درخواست";
            } else if (latest?.status === "rejected") {
                const line = document.createElement("p"); line.textContent = `آخرین درخواست مشاوره رد شده است.${latest.decision_note ? ` توضیح مدیر: ${latest.decision_note}` : " می‌توانید درخواست جدید ثبت کنید."}`; summary.append(line);
            }
        } catch (error) {
            const summary = document.getElementById("student-consultation-summary");
            const line = document.createElement("p"); line.textContent = error.message || "وضعیت درخواست مشاوره دریافت نشد."; summary.append(line);
        }
    } catch (error) {
        const greeting = document.getElementById("student-greeting");
        if (greeting) greeting.textContent = error.message || "اطلاعات حساب دریافت نشد.";
    }
    selectPage(location.hash.slice(1) || "dashboard");
});
