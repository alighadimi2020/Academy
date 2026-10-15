document.addEventListener("DOMContentLoaded", async () => {
    const form = document.getElementById("consultant-reg-form");
    const step1 = document.getElementById("reg-step-1");
    const step2 = document.getElementById("reg-step-2");
    const statusSection = document.getElementById("reg-status-section");
    const progress = document.getElementById("reg-progress");
    const stepLabel = document.getElementById("reg-step-label");
    const step1Message = document.getElementById("reg-step-1-message");
    const step2Message = document.getElementById("reg-step-2-message");
    const lockoutBanner = document.getElementById("reg-lockout-banner");
    const targetPhoneSpan = document.getElementById("reg-target-phone");
    const reapplyBtn = document.getElementById("reg-reapply-btn");
    const resendBtn = document.getElementById("reg-resend-btn");
    const verifyBtn = document.getElementById("reg-verify-submit");
    const backTo1Btn = document.getElementById("reg-back-to-1");

    const numberFa = (v) => new Intl.NumberFormat("fa-IR").format(v);
    const normalizeDigits = (val) => String(val || "").replace(/[۰-۹]/g, d => "۰۱۲۳۴۵۶۷۸۹".indexOf(d)).replace(/[٠-٩]/g, d => "٠١٢٣٤٥٦٧٨٩".indexOf(d)).trim();

    let lockoutTimer = null;
    let resendCooldownTimer = null;

    // --- 1. Jalali Datepicker ---
    const monthNames = ["فروردین", "اردیبهشت", "خرداد", "تیر", "مرداد", "شهریور", "مهر", "آبان", "آذر", "دی", "بهمن", "اسفند"];
    
    function isJalaliLeapYear(jy) {
        const r = (jy - (jy > 0 ? 474 : 473)) % 2820 + 474;
        return (((r + 38) * 682) % 2816) < 682;
    }

    function jalaliMonthDays(jy, jm) {
        if (jm <= 6) return 31;
        if (jm <= 11) return 30;
        return isJalaliLeapYear(jy) ? 30 : 29;
    }

    function jalaliToGregorian(jy, jm, jd) {
        jy = Number(jy); jm = Number(jm); jd = Number(jd);
        let gy = (jy <= 979) ? 621 : 1600;
        jy -= (jy <= 979) ? 0 : 979;
        let days = (365 * jy) + Math.floor(jy / 33) * 8 + Math.floor(((jy % 33) + 3) / 4) + 78 + jd + ((jm < 7) ? (jm - 1) * 31 : ((jm - 7) * 30) + 186);
        gy += 400 * Math.floor(days / 146097);
        days %= 146097;
        if (days > 36524) {
            gy += 100 * Math.floor(--days / 36524);
            days %= 36524;
            if (days >= 365) days++;
        }
        gy += 4 * Math.floor(days / 1461);
        days %= 1461;
        gy += Math.floor((days - 1) / 365);
        if (days > 365) days = (days - 1) % 365;
        const sal_a = [0, 31, ((gy % 4 === 0 && gy % 100 !== 0) || (gy % 400 === 0)) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
        let gm = 0;
        while (gm < 13 && days > sal_a[gm]) days -= sal_a[gm++];
        return new Date(gy, gm - 1, days);
    }

    // Default start year: 1380
    let currentJalaliYear = 1380;
    let currentJalaliMonth = 1;
    let selectedJalaliDate = "";

    const birthInput = document.getElementById("reg-birth-date");
    const dpPopover = document.getElementById("reg-datepicker-popover");
    const dpYearSelect = document.getElementById("dp-year-select");
    const dpMonthSelect = document.getElementById("dp-month-select");
    const dpDaysGrid = document.getElementById("dp-days-grid");
    const dpPrevBtn = document.getElementById("dp-prev-month");
    const dpNextBtn = document.getElementById("dp-next-month");

    // Populate Year and Month dropdowns
    for (let y = 1395; y >= 1340; y--) {
        const opt = document.createElement("option");
        opt.value = y;
        opt.textContent = numberFa(y);
        dpYearSelect.appendChild(opt);
    }
    dpYearSelect.value = currentJalaliYear;

    monthNames.forEach((name, idx) => {
        const opt = document.createElement("option");
        opt.value = idx + 1;
        opt.textContent = name;
        dpMonthSelect.appendChild(opt);
    });
    dpMonthSelect.value = currentJalaliMonth;

    function renderDaysGrid() {
        dpDaysGrid.replaceChildren();
        const totalDays = jalaliMonthDays(currentJalaliYear, currentJalaliMonth);
        const firstGDate = jalaliToGregorian(currentJalaliYear, currentJalaliMonth, 1);
        // JS getDay(): Sunday=0, Monday=1, ... Saturday=6
        // Persian week: Saturday=0 (شنبه), Sunday=1 (یکشنبه), ... Friday=6 (جمعه)
        const jsDay = firstGDate.getDay();
        const startOffset = (jsDay + 1) % 7;

        for (let i = 0; i < startOffset; i++) {
            const empty = document.createElement("div");
            empty.className = "payeh-dp-day is-empty";
            dpDaysGrid.appendChild(empty);
        }

        for (let d = 1; d <= totalDays; d++) {
            const cell = document.createElement("div");
            cell.className = "payeh-dp-day";
            cell.textContent = numberFa(d);
            const dateStr = `${currentJalaliYear}/${String(currentJalaliMonth).padStart(2, "0")}/${String(d).padStart(2, "0")}`;
            if (dateStr === selectedJalaliDate) {
                cell.classList.add("is-selected");
            }
            cell.addEventListener("click", () => {
                selectedJalaliDate = dateStr;
                birthInput.value = dateStr;
                dpPopover.classList.remove("is-open");
                clearFieldError("birth_date");
            });
            dpDaysGrid.appendChild(cell);
        }
    }

    birthInput?.addEventListener("click", (e) => {
        e.stopPropagation();
        dpPopover.classList.toggle("is-open");
        renderDaysGrid();
    });

    dpYearSelect?.addEventListener("change", () => {
        currentJalaliYear = Number(dpYearSelect.value);
        renderDaysGrid();
    });

    dpMonthSelect?.addEventListener("change", () => {
        currentJalaliMonth = Number(dpMonthSelect.value);
        renderDaysGrid();
    });

    dpPrevBtn?.addEventListener("click", () => {
        currentJalaliMonth--;
        if (currentJalaliMonth < 1) {
            currentJalaliMonth = 12;
            currentJalaliYear--;
        }
        dpYearSelect.value = currentJalaliYear;
        dpMonthSelect.value = currentJalaliMonth;
        renderDaysGrid();
    });

    dpNextBtn?.addEventListener("click", () => {
        currentJalaliMonth++;
        if (currentJalaliMonth > 12) {
            currentJalaliMonth = 1;
            currentJalaliYear++;
        }
        dpYearSelect.value = currentJalaliYear;
        dpMonthSelect.value = currentJalaliMonth;
        renderDaysGrid();
    });

    document.addEventListener("click", (e) => {
        if (!dpPopover?.contains(e.target) && e.target !== birthInput) {
            dpPopover?.classList.remove("is-open");
        }
    });

    // --- 2. Resume File Dropzone ---
    const dropzone = document.getElementById("reg-dropzone");
    const fileInput = document.getElementById("reg-resume-file");
    const fileBadge = document.getElementById("reg-file-badge");

    function validateSelectedFile(file) {
        if (!file) return false;
        const name = file.name.toLowerCase();
        if (!name.endsWith(".pdf") && !name.endsWith(".docx")) {
            showFieldError("resume_file", "فقط فایل‌های PDF و DOCX مجاز هستند.");
            fileInput.value = "";
            fileBadge.style.display = "none";
            return false;
        }
        if (file.size > 10 * 1024 * 1024) {
            showFieldError("resume_file", "حجم فایل رزومه حداکثر ۱۰ مگابایت است.");
            fileInput.value = "";
            fileBadge.style.display = "none";
            return false;
        }
        clearFieldError("resume_file");
        fileBadge.textContent = `📎 ${file.name} (${numberFa((file.size / (1024 * 1024)).toFixed(2))} مگابایت)`;
        fileBadge.style.display = "block";
        return true;
    }

    fileInput?.addEventListener("change", () => {
        if (fileInput.files && fileInput.files[0]) {
            validateSelectedFile(fileInput.files[0]);
        }
    });

    ["dragenter", "dragover"].forEach(evt => {
        dropzone?.addEventListener(evt, (e) => {
            e.preventDefault();
            dropzone.classList.add("is-dragover");
        });
    });

    ["dragleave", "drop"].forEach(evt => {
        dropzone?.addEventListener(evt, (e) => {
            e.preventDefault();
            dropzone.classList.remove("is-dragover");
        });
    });

    dropzone?.addEventListener("drop", (e) => {
        if (e.dataTransfer?.files?.length) {
            fileInput.files = e.dataTransfer.files;
            validateSelectedFile(fileInput.files[0]);
        }
    });

    // --- Helper Functions for Errors & Messages ---
    function showFieldError(fieldName, msg) {
        const el = document.querySelector(`.payeh-login__error[data-error="${fieldName}"]`);
        if (el) el.textContent = msg;
    }

    function clearFieldError(fieldName) {
        const el = document.querySelector(`.payeh-login__error[data-error="${fieldName}"]`);
        if (el) el.textContent = "";
    }

    function clearAllErrors() {
        document.querySelectorAll(".payeh-login__error").forEach(el => el.textContent = "");
        if (step1Message) { step1Message.textContent = ""; step1Message.className = "payeh-login__message"; }
        if (step2Message) { step2Message.textContent = ""; step2Message.className = "payeh-login__message"; }
    }

    // --- 3. Rate Limit Countdown Timer ---
    function startLockoutTimer(seconds) {
        clearInterval(lockoutTimer);
        let rem = seconds;
        lockoutBanner.style.display = "block";
        verifyBtn.disabled = true;

        const updateBanner = () => {
            if (rem <= 0) {
                clearInterval(lockoutTimer);
                lockoutBanner.style.display = "none";
                verifyBtn.disabled = false;
                if (step2Message) step2Message.textContent = "زمان قفل به پایان رسید. اکنون می‌توانید کد تایید را وارد کنید.";
            } else {
                lockoutBanner.textContent = `⚠️ به دلیل بیش از ۴ بار ورود کد اشتباه، تا ${numberFa(rem)} ثانیه دیگر امکان ارسال درخواست وجود ندارد.`;
                rem--;
            }
        };
        updateBanner();
        lockoutTimer = setInterval(updateBanner, 1000);
    }

    function startResendCooldown(seconds) {
        clearInterval(resendCooldownTimer);
        let rem = seconds;
        resendBtn.disabled = true;

        const updateBtn = () => {
            if (rem <= 0) {
                clearInterval(resendCooldownTimer);
                resendBtn.disabled = false;
                resendBtn.textContent = "ارسال مجدد کد پیامکی";
            } else {
                resendBtn.textContent = `ارسال مجدد کد تا (${numberFa(rem)} ثانیه دیگر)`;
                rem--;
            }
        };
        updateBtn();
        resendCooldownTimer = setInterval(updateBtn, 1000);
    }

    // --- 4. Step 1 Submit (Start Registration) ---
    form?.addEventListener("submit", async (e) => {
        e.preventDefault();
        clearAllErrors();

        const fullName = document.getElementById("reg-full-name")?.value.trim();
        const phone = normalizeDigits(document.getElementById("reg-phone")?.value);
        const birthDate = document.getElementById("reg-birth-date")?.value.trim();
        const konkurYear = document.getElementById("reg-konkur-year")?.value;
        const konkurQuota = document.getElementById("reg-konkur-quota")?.value;
        const quotaRank = normalizeDigits(document.getElementById("reg-quota-rank")?.value);
        const password = document.getElementById("reg-password")?.value;
        const passwordConfirm = document.getElementById("reg-password-confirm")?.value;
        const resumeFile = fileInput?.files?.[0];

        let hasError = false;
        if (!fullName) { showFieldError("full_name", "نام و نام خانوادگی الزامی است."); hasError = true; }
        if (!phone || phone.length !== 11 || !phone.startsWith("09")) { showFieldError("phone", "شماره موبایل ۱۱ رقمی معتبر با ۰۹ وارد کنید."); hasError = true; }
        if (!birthDate) { showFieldError("birth_date", "تاریخ تولد الزامی است."); hasError = true; }
        if (!konkurYear) { showFieldError("konkur_year", "سال کنکور را انتخاب کنید."); hasError = true; }
        if (!konkurQuota) { showFieldError("konkur_quota", "سهمیه کنکور را انتخاب کنید."); hasError = true; }
        if (!quotaRank || Number(quotaRank) <= 0) { showFieldError("quota_rank", "رتبه در سهمیه باید عدد معتبر باشد."); hasError = true; }
        if (!password || password.length < 8) { showFieldError("password", "رمز عبور حداقل ۸ کاراکتر است."); hasError = true; }
        if (password !== passwordConfirm) { showFieldError("password_confirmation", "تکرار رمز عبور یکسان نیست."); hasError = true; }
        if (!resumeFile) { showFieldError("resume_file", "بارگذاری فایل رزومه الزامی است."); hasError = true; }

        if (hasError) return;

        const submitBtn = document.getElementById("reg-step-1-submit");
        submitBtn.disabled = true;
        submitBtn.textContent = "در حال ارسال و اعتبارسنجی رزومه…";

        try {
            const csrf = await fetch("/api/auth/csrf/", { credentials: "same-origin" }).then(r => r.json());
            const formData = new FormData(form);
            formData.set("phone", phone);
            formData.set("quota_rank", quotaRank);

            const response = await fetch("/api/consultations/register/start/", {
                method: "POST",
                credentials: "same-origin",
                headers: { "X-CSRFToken": csrf.csrfToken },
                body: formData
            });

            const data = await response.json();

            if (response.status === 429 && data.locked) {
                step1Message.textContent = data.detail;
                step1Message.classList.add("is-error");
                startLockoutTimer(data.remaining_seconds || 120);
                return;
            }

            if (!response.ok) {
                if (data.pending_application) {
                    step1Message.textContent = data.detail;
                    step1Message.classList.add("is-error");
                    // Show option to check status
                    setTimeout(() => showStatusView("pending", phone), 2000);
                    return;
                }
                throw new Error(data.detail || "ثبت اطلاعات انجام نشد.");
            }

            // Move to Step 2
            step1.hidden = true;
            step2.hidden = false;
            progress.style.width = "100%";
            stepLabel.textContent = "مرحله ۲ از ۲";
            targetPhoneSpan.textContent = phone;
            startResendCooldown(60);
            document.getElementById("reg-code")?.focus();

        } catch (err) {
            step1Message.textContent = err.message || "خطا در ارتباط با سرور.";
            step1Message.classList.add("is-error");
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = "ثبت مشخصات و دریافت کد تأیید";
        }
    });

    // --- 5. Back to Step 1 ---
    backTo1Btn?.addEventListener("click", () => {
        step2.hidden = true;
        step1.hidden = false;
        progress.style.width = "50%";
        stepLabel.textContent = "مرحله ۱ از ۲";
    });

    // --- 6. Step 2 Submit (Verify OTP) ---
    verifyBtn?.addEventListener("click", async () => {
        clearAllErrors();
        const phone = normalizeDigits(document.getElementById("reg-phone")?.value);
        const code = normalizeDigits(document.getElementById("reg-code")?.value);

        if (!code || code.length !== 6) {
            showFieldError("code", "کد تایید ۶ رقمی را به صورت کامل وارد کنید.");
            return;
        }

        verifyBtn.disabled = true;
        verifyBtn.textContent = "در حال بررسی کد…";

        try {
            const csrf = await fetch("/api/auth/csrf/", { credentials: "same-origin" }).then(r => r.json());
            const response = await fetch("/api/consultations/register/verify/", {
                method: "POST",
                credentials: "same-origin",
                headers: {
                    "Content-Type": "application/json",
                    "X-CSRFToken": csrf.csrfToken
                },
                body: JSON.stringify({ phone, code })
            });

            const data = await response.json();

            if (response.status === 429 && data.locked) {
                step2Message.textContent = data.detail;
                step2Message.classList.add("is-error");
                startLockoutTimer(data.remaining_seconds || 120);
                return;
            }

            if (!response.ok) {
                throw new Error(data.detail || "کد تأیید نادرست است.");
            }

            // Success! Show status card
            showStatusView("pending", phone, "ثبت‌نام و ارسال رزومه با موفقیت انجام شد.");

        } catch (err) {
            step2Message.textContent = err.message || "خطا در تأیید کد.";
            step2Message.classList.add("is-error");
        } finally {
            if (!verifyBtn.disabled) {
                verifyBtn.textContent = "تأیید نهایی و ارسال برای بررسی";
            }
        }
    });

    // --- 7. Resend Code Button ---
    resendBtn?.addEventListener("click", () => {
        document.getElementById("reg-step-1-submit")?.click();
    });

    // --- 8. Tab Switcher Logic ---
    const tabRegister = document.getElementById("tab-btn-register");
    const tabStatus = document.getElementById("tab-btn-status");

    function activateTab(tab) {
        if (tab === "register") {
            tabRegister.classList.add("is-active");
            tabRegister.style.background = "#ffffff";
            tabRegister.style.color = "#0b3dff";
            tabRegister.style.boxShadow = "0 2px 6px rgba(0,0,0,0.06)";

            tabStatus.classList.remove("is-active");
            tabStatus.style.background = "transparent";
            tabStatus.style.color = "#64748b";
            tabStatus.style.boxShadow = "none";

            form.hidden = false;
            statusSection.hidden = true;
            step1.hidden = false;
            step2.hidden = true;
            progress.style.width = "50%";
            stepLabel.textContent = "همکاری با آکادمی پایه";
            history.replaceState(null, null, window.location.pathname);
        } else {
            tabStatus.classList.add("is-active");
            tabStatus.style.background = "#ffffff";
            tabStatus.style.color = "#0b3dff";
            tabStatus.style.boxShadow = "0 2px 6px rgba(0,0,0,0.06)";

            tabRegister.classList.remove("is-active");
            tabRegister.style.background = "transparent";
            tabRegister.style.color = "#64748b";
            tabRegister.style.boxShadow = "none";

            showStatusView();
            history.replaceState(null, null, "#status");
        }
    }

    tabRegister?.addEventListener("click", () => activateTab("register"));
    tabStatus?.addEventListener("click", () => activateTab("status"));

    // --- 9. Status View Handler ---
    async function showStatusView(forcedStatus, phoneParam, alertMsg) {
        form.hidden = true;
        statusSection.hidden = false;
        progress.style.width = "100%";
        stepLabel.textContent = "پیگیری وضعیت درخواست";

        if (tabStatus) {
            tabStatus.classList.add("is-active");
            tabStatus.style.background = "#ffffff";
            tabStatus.style.color = "#0b3dff";
            tabStatus.style.boxShadow = "0 2px 6px rgba(0,0,0,0.06)";
            if (tabRegister) {
                tabRegister.classList.remove("is-active");
                tabRegister.style.background = "transparent";
                tabRegister.style.color = "#64748b";
                tabRegister.style.boxShadow = "none";
            }
        }

        const title = document.getElementById("reg-status-title");
        const msg = document.getElementById("reg-status-message");
        const icon = document.getElementById("reg-status-icon");
        const box = document.getElementById("reg-status-box");
        const noteBox = document.getElementById("reg-status-note");
        const meta = document.getElementById("reg-status-meta");

        if (alertMsg) {
            const alertEl = document.createElement("div");
            alertEl.className = "payeh-login__message is-success";
            alertEl.style.marginBottom = "16px";
            alertEl.textContent = alertMsg;
            statusSection.prepend(alertEl);
        }

        const setStatusIcon = (type) => {
            const icons = {
                lock: `<div style="width: 56px; height: 56px; border-radius: 50%; background: #eff6ff; color: #2563eb; display: flex; align-items: center; justify-content: center; margin: 0 auto 14px;"><svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg></div>`,
                pending: `<div style="width: 56px; height: 56px; border-radius: 50%; background: #fef3c7; color: #d97706; display: flex; align-items: center; justify-content: center; margin: 0 auto 14px;"><svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg></div>`,
                approved: `<div style="width: 56px; height: 56px; border-radius: 50%; background: #dcfce7; color: #16a34a; display: flex; align-items: center; justify-content: center; margin: 0 auto 14px;"><svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg></div>`,
                rejected: `<div style="width: 56px; height: 56px; border-radius: 50%; background: #fee2e2; color: #dc2626; display: flex; align-items: center; justify-content: center; margin: 0 auto 14px;"><svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg></div>`,
                empty: `<div style="width: 56px; height: 56px; border-radius: 50%; background: #f1f5f9; color: #475569; display: flex; align-items: center; justify-content: center; margin: 0 auto 14px;"><svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"></path><rect x="8" y="2" width="8" height="4" rx="1" ry="1"></rect></svg></div>`
            };
            if (icon) icon.innerHTML = icons[type] || "";
        };

        try {
            const res = await fetch("/api/consultations/register/status/", { credentials: "same-origin" });
            
            if (res.status === 401) {
                // User is not logged in
                box.className = "payeh-status-card";
                setStatusIcon("lock");
                title.textContent = "جهت پیگیری وضعیت، وارد حساب شوید";
                msg.textContent = "برای مشاهدهٔ آخرین وضعیت بررسی رزومه توسط مدیر، لطفاً با شماره موبایل و رمز عبوری که هنگام ارسال رزومه تعیین کردید وارد شوید.";
                reapplyBtn.style.display = "inline-block";
                reapplyBtn.textContent = "ورود به حساب کاربری";
                reapplyBtn.onclick = () => location.assign("login.html");
                return;
            }

            const data = await res.json();

            if (data.has_application) {
                const status = data.status;
                if (status === "pending") {
                    box.className = "payeh-status-card is-pending";
                    setStatusIcon("pending");
                    title.textContent = "درخواست شما در حال بررسی است";
                    msg.textContent = `همکار گرامی جناب/سرکار ${data.full_name}، مدارک و رزومهٔ شما با شماره تماس ${data.phone} در تاریخ ${data.created_at} ثبت شده و در صف بررسی مدیران آکادمی است. پس از تأیید نهایی، دسترسی پنل مشاور شما فعال شده و پیامک اطلاع‌رسانی ارسال خواهد شد.`;
                    reapplyBtn.style.display = "none";
                } else if (status === "rejected") {
                    box.className = "payeh-status-card is-rejected";
                    setStatusIcon("rejected");
                    title.textContent = "عدم تأیید درخواست همکاری";
                    msg.textContent = `متأسفانه درخواست همکاری شما با شماره ${data.phone} مورد تأیید قرار نگرفت.`;
                    if (data.decision_note) {
                        noteBox.style.display = "block";
                        noteBox.textContent = `توضیح مدیریت: ${data.decision_note}`;
                    }
                    meta.textContent = `تاریخ بررسی: ${data.decided_at || "—"}`;
                    reapplyBtn.style.display = "inline-block";
                    reapplyBtn.textContent = "ثبت درخواست جدید";
                    reapplyBtn.onclick = () => {
                        activateTab("register");
                    };
                } else if (status === "approved") {
                    box.className = "payeh-status-card is-approved";
                    setStatusIcon("approved");
                    title.textContent = "درخواست شما تأیید شد!";
                    msg.textContent = `تبریک! حساب مشاور شما با موفقیت تأیید و فعال گردید.`;
                    meta.textContent = `تاریخ تأیید: ${data.decided_at || "—"}`;
                    reapplyBtn.style.display = "inline-block";
                    reapplyBtn.textContent = "ورود به پنل مشاور";
                    reapplyBtn.onclick = () => location.assign("consultant.html");
                }
            } else if (forcedStatus === "pending") {
                box.className = "payeh-status-card is-pending";
                setStatusIcon("pending");
                title.textContent = "درخواست شما در حال بررسی است";
                msg.textContent = `درخواست همکاری شما برای شماره ${phoneParam || ""} ثبت گردید و در صف بررسی مدیریت است.`;
                reapplyBtn.style.display = "none";
            } else {
                box.className = "payeh-status-card";
                setStatusIcon("empty");
                title.textContent = "درخواستی یافت نشد";
                msg.textContent = "هنوز درخواست همکاری و ارسال رزومه‌ای با این حساب کاربری ثبت نشده است.";
                reapplyBtn.style.display = "inline-block";
                reapplyBtn.textContent = "ثبت درخواست همکاری";
                reapplyBtn.onclick = () => activateTab("register");
            }
        } catch {
            // fallback
        }
    }

    // Auto-check on load if user navigated to #status or has active session
    if (window.location.hash === "#status") {
        showStatusView();
    } else {
        // Check if current user is already an applicant
        try {
            const meRes = await fetch("/api/auth/me/", { credentials: "same-origin" });
            if (meRes.ok) {
                const me = await meRes.json();
                if (me.role === "applicant") {
                    showStatusView();
                } else if (me.role === "consultant") {
                    showStatusView("approved");
                }
            }
        } catch {
            // guest user
        }
    }
});
