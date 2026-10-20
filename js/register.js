document.addEventListener("DOMContentLoaded", () => {
    const form = document.getElementById("signup-form");
    if (!form) return;

    const API = `${window.location.origin}/api/auth/register/`;
    const steps = [...document.querySelectorAll(".payeh-signup__step")];
    const message = document.getElementById("signup-message");
    const progress = document.getElementById("signup-progress");
    const title = document.getElementById("signup-title");
    const description = document.getElementById("signup-description");
    const stepLabel = document.getElementById("signup-step-label");
    const phoneBadge = document.getElementById("signup-phone-badge");
    const editPhoneBtn = document.getElementById("signup-edit-phone");
    const backBtn = document.getElementById("signup-back");
    const nextBtn = document.getElementById("signup-next");
    const submitBtn = document.getElementById("signup-submit");

    let currentStep = 1;
    let registeredPhone = "";
    let registeredFullName = "";

    // If already logged in, redirect immediately to dashboard
    fetch(`${window.location.origin}/api/auth/me/?_t=${Date.now()}`, { credentials: "include", cache: "no-store" })
        .then(r => r.ok ? r.json() : null)
        .then(user => {
            if (user && user.role) {
                const destinations = {
                    student: "student.html",
                    consultant: "consultant.html",
                    instructor: "student.html",
                    admin: "manager.html",
                    manager: "manager.html",
                    applicant: "consultant-register.html#status",
                };
                window.location.assign(destinations[user.role] || "student.html");
            }
        }).catch(() => {});

    const digits = (value) => String(value || "")
        .replace(/[۰-۹]/g, (digit) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(digit)))
        .replace(/[٠-٩]/g, (digit) => String("٠١٢٣٤٥٦٧٨٩".indexOf(digit)));

    const attachNumericConverter = (input, maxLength = null) => {
        if (!input) return;
        const normalize = () => {
            const start = input.selectionStart;
            const raw = input.value;
            let converted = digits(raw).replace(/[^0-9]/g, "");
            if (maxLength && converted.length > maxLength) {
                converted = converted.slice(0, maxLength);
            }
            if (raw !== converted) {
                let newCursor = converted.length;
                if (start !== null) {
                    const before = digits(raw.slice(0, start)).replace(/[^0-9]/g, "");
                    newCursor = Math.min(before.length, converted.length);
                }
                input.value = converted;
                if (start !== null) {
                    input.setSelectionRange(newCursor, newCursor);
                }
            }
        };
        input.addEventListener("input", normalize);
        input.addEventListener("paste", () => setTimeout(normalize, 0));
    };

    document.querySelectorAll('input[type="tel"], input[inputmode="numeric"], .en-digits').forEach((input) => {
        const max = input.getAttribute("maxlength") ? parseInt(input.getAttribute("maxlength"), 10) : null;
        attachNumericConverter(input, max);
    });

    const setMessage = (text = "", kind = "") => {
        message.textContent = text;
        message.className = `payeh-login__message${kind ? ` is-${kind}` : ""}`;
    };

    const clearErrors = () => {
        document.querySelectorAll("[data-error]").forEach((error) => { error.textContent = ""; });
        document.querySelectorAll(".payeh-login__field.is-error").forEach((field) => field.classList.remove("is-error"));
        setMessage();
    };

    const error = (name, text) => {
        const target = document.querySelector(`[data-error="${name}"]`);
        if (target) {
            target.textContent = text;
            target.closest(".payeh-login__field")?.classList.add("is-error");
        }
    };

    const showStep = (step) => {
        currentStep = step;
        steps.forEach((section) => { section.hidden = Number(section.dataset.step) !== step; });
        if (progress) progress.style.width = step === 1 ? "50%" : "100%";
        if (stepLabel) stepLabel.textContent = `مرحله ${step} از ۲`;
        if (title) title.textContent = step === 1 ? "ثبت‌نام دانش‌آموز" : "احراز هویت و تایید شماره";
        if (description) description.textContent = step === 1 ? "نام و شماره موبایل خود را برای ورود به آکادمی پایه وارد کنید." : `کد تایید به شماره ${registeredPhone} پیامک شد.`;
        clearErrors();
        window.scrollTo({ top: 0, behavior: "smooth" });
    };

    const setLoading = (button, loading, text) => {
        if (!button) return;
        button.disabled = loading;
        button.classList.toggle("is-loading", loading);
        if (loading) button.dataset.originalText = button.textContent;
        button.textContent = loading ? text : (button.dataset.originalText || text);
    };

    const post = async (url, body) => {
        const csrfRes = await fetch(`/api/auth/csrf/?_t=${Date.now()}`, { credentials: "include", cache: "no-store" }).catch(() => null);
        const csrfData = csrfRes && csrfRes.ok ? await csrfRes.json().catch(() => ({})) : {};
        const response = await fetch(url, {
            method: "POST",
            credentials: "include",
            headers: {
                "Content-Type": "application/json",
                "X-CSRFToken": csrfData.csrfToken || "",
            },
            body: JSON.stringify(body),
        });
        const text = await response.text();
        let data = {};
        try { data = JSON.parse(text); } catch {}
        if (!response.ok) throw new Error(data.detail || "ارتباط با سرور انجام نشد.");
        return data;
    };

    const handleStep1Submit = async () => {
        clearErrors();
        const fullNameInput = document.getElementById("signup-full-name");
        const phoneInput = document.getElementById("signup-phone");
        const fullName = fullNameInput ? fullNameInput.value.trim() : "";
        const phone = phoneInput ? digits(phoneInput.value.trim()) : "";

        let valid = true;
        if (!fullName) { error("full_name", "نام و نام خانوادگی را وارد کنید."); valid = false; }
        else if (fullName.length > 100) { error("full_name", "حداکثر ۱۰۰ کاراکتر وارد کنید."); valid = false; }

        if (!phone) { error("phone", "شماره موبایل را وارد کنید."); valid = false; }
        else if (!/^09\d{9}$/.test(phone)) { error("phone", "شماره موبایل باید ۱۱ رقم و با ۰۹ شروع شود."); valid = false; }

        if (!valid) return;

        setLoading(nextBtn, true, "در حال بررسی و ارسال کد...");
        try {
            registeredPhone = phone;
            registeredFullName = fullName;

            await post(API, { full_name: fullName, phone });

            if (phoneBadge) phoneBadge.textContent = phone;
            showStep(2);
            setMessage("کد تایید با موفقیت صادر شد. جهت ورود دکمه تایید را کلیک کنید.", "success");
            const codeInput = document.getElementById("signup-code");
            if (codeInput) {
                codeInput.focus();
            }
        } catch (reqError) {
            setMessage(reqError.message, "error");
        } finally {
            setLoading(nextBtn, false, "دریافت کد تایید و احراز هویت");
        }
    };

    if (nextBtn) {
        nextBtn.addEventListener("click", handleStep1Submit);
    }

    if (editPhoneBtn) {
        editPhoneBtn.addEventListener("click", () => showStep(1));
    }

    if (backBtn) {
        backBtn.addEventListener("click", () => showStep(1));
    }

    form.addEventListener("submit", async (event) => {
        event.preventDefault();
        clearErrors();

        if (currentStep === 1) {
            await handleStep1Submit();
            return;
        }

        if (currentStep === 2) {
            const codeInput = document.getElementById("signup-code");
            const rawCode = codeInput ? digits(codeInput.value.trim()) : "";
            const code = rawCode || "123456"; // Default / bypass code as SMS gateway is pending

            setLoading(submitBtn, true, "در حال تایید و ورود به پنل...");
            try {
                const resData = await post(`${API}verify/`, { phone: registeredPhone, code });
                setMessage(resData.detail || "احراز هویت موفق بود. در حال انتقال به پنل کاربری...", "success");
                submitBtn.disabled = true;
                setTimeout(() => {
                    window.location.assign(resData.redirect_url || "student.html#profile");
                }, 700);
            } catch (reqError) {
                setMessage(reqError.message, "error");
                setLoading(submitBtn, false, "تایید و ورود به پنل دانش‌آموز");
            }
        }
    });
});
