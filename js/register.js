document.addEventListener("DOMContentLoaded", () => {
    const form = document.getElementById("signup-form");
    if (!form) return;

    const API = `${window.location.origin}/api/auth/register/`;
    const steps = [...document.querySelectorAll(".payeh-signup__step")];
    const grade = document.getElementById("signup-grade");
    const majorField = document.getElementById("signup-major-field");
    const major = document.getElementById("signup-major");
    const message = document.getElementById("signup-message");
    const progress = document.getElementById("signup-progress");
    const title = document.getElementById("signup-title");
    const description = document.getElementById("signup-description");
    const stepLabel = document.getElementById("signup-step-label");
    let currentStep = 1;
    let registeredPhone = "";

    const digits = (value) => value
        .replace(/[۰-۹]/g, (digit) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(digit)))
        .replace(/[٠-٩]/g, (digit) => String("٠١٢٣٤٥٦٧٨٩".indexOf(digit)));

    document.querySelectorAll('input[inputmode="numeric"]').forEach((input) => {
        input.addEventListener("input", () => {
            input.value = digits(input.value).replace(/[^0-9]/g, "");
        });
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
        progress.style.width = step === 1 ? "50%" : step === 2 ? "100%" : "100%";
        stepLabel.textContent = step === 3 ? "تایید شماره موبایل" : `مرحله ${step} از ۲`;
        title.textContent = step === 3 ? "کد تایید را وارد کنید" : step === 1 ? "ساخت حساب کاربری" : "اطلاعات تماس و رمز عبور";
        description.textContent = step === 3 ? `کد ارسال‌شده به ${registeredPhone} را وارد کنید.` : step === 1 ? "اطلاعات تحصیلی خود را وارد کنید." : "شماره تماس و رمز عبور خود را ثبت کنید.";
        clearErrors();
        window.scrollTo({ top: 0, behavior: "smooth" });
    };

    const isMajorRequired = () => ["10", "11", "12", "graduate"].includes(grade.value);
    const updateMajor = () => {
        majorField.hidden = !isMajorRequired();
        major.required = isMajorRequired();
        if (!major.required) major.value = "";
    };
    grade.addEventListener("change", updateMajor);

    document.getElementById("signup-next").addEventListener("click", () => {
        clearErrors();
        let valid = true;
        const fullName = document.getElementById("signup-full-name").value.trim();
        if (!fullName) { error("full_name", "نام و نام خانوادگی را وارد کنید."); valid = false; }
        if (fullName.length > 100) { error("full_name", "حداکثر ۱۰۰ کاراکتر وارد کنید."); valid = false; }
        if (!grade.value) { error("grade", "پایه تحصیلی را انتخاب کنید."); valid = false; }
        if (isMajorRequired() && !major.value) { error("major", "رشته تحصیلی را انتخاب کنید."); valid = false; }
        if (valid) showStep(2);
    });

    document.getElementById("signup-back").addEventListener("click", () => showStep(1));

    const setLoading = (button, loading, text) => {
        button.disabled = loading;
        button.classList.toggle("is-loading", loading);
        if (loading) button.dataset.originalText = button.textContent;
        button.textContent = loading ? text : (button.dataset.originalText || text);
    };

    const post = async (url, body) => {
        const response = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.detail || "ارتباط با سرور انجام نشد.");
        return data;
    };

    form.addEventListener("submit", async (event) => {
        event.preventDefault();
        clearErrors();

        if (currentStep === 2) {
            const phone = digits(document.getElementById("signup-phone").value.trim());
            const email = (document.getElementById("signup-email")?.value || "").trim().toLowerCase();
            const parentPhone = digits(document.getElementById("signup-parent-phone").value.trim());
            const nationalId = digits(document.getElementById("signup-national-id").value.trim());
            const password = document.getElementById("signup-password").value;
            const confirmation = document.getElementById("signup-password-confirmation").value;
            let valid = true;

            if (!/^09\d{9}$/.test(phone)) { error("phone", "شماره موبایل باید ۱۱ رقم و با ۰۹ شروع شود."); valid = false; }
            if (email && (!email.includes("@") || !email.includes("."))) { error("email", "فرمت آدرس ایمیل معتبر نیست."); valid = false; }
            if (parentPhone && !/^09\d{9}$/.test(parentPhone)) { error("parent_phone", "شماره والد باید ۱۱ رقم و با ۰۹ شروع شود."); valid = false; }
            if (parentPhone && phone === parentPhone) { error("parent_phone", "شماره دانش‌آموز و والد نباید یکسان باشد."); valid = false; }
            if (nationalId.length > 20) { error("national_id", "کد ملی حداکثر ۲۰ کاراکتر است."); valid = false; }
            if (password.length < 8) { error("password", "رمز عبور باید حداقل ۸ کاراکتر باشد."); valid = false; }
            if (password !== confirmation) { error("password_confirmation", "تکرار رمز عبور یکسان نیست."); valid = false; }
            if (!valid) return;

            const button = document.getElementById("signup-submit");
            setLoading(button, true, "در حال ثبت‌نام و ورود...");
            try {
                const resData = await post(API, {
                    full_name: document.getElementById("signup-full-name").value.trim(),
                    grade: grade.value,
                    major: major.value,
                    gender: document.getElementById("signup-gender")?.value || "",
                    national_id: nationalId,
                    email,
                    phone,
                    parent_phone: parentPhone,
                    password,
                    password_confirmation: confirmation,
                });

                if (resData.direct_login) {
                    setMessage("حساب کاربری با موفقیت ساخته شد. در حال انتقال به پنل کاربری...", "success");
                    button.disabled = true;
                    setTimeout(() => {
                        window.location.href = resData.redirect_url || "student.html";
                    }, 1000);
                    return;
                }

                registeredPhone = phone;
                showStep(3);
                setMessage("کد تایید ارسال شد.", "success");
            } catch (requestError) {
                setMessage(requestError.message, "error");
            } finally {
                setLoading(button, false, "تکمیل ثبت‌نام و ساخت حساب");
            }
            return;
        }

        if (currentStep === 3) {
            const codeInput = document.getElementById("signup-code");
            const code = digits(codeInput.value.trim());
            if (!/^\d{6}$/.test(code)) { error("code", "کد تایید باید ۶ رقم باشد."); return; }

            const button = document.getElementById("signup-verify");
            setLoading(button, true, "در حال بررسی...");
            try {
                await post(`${API}verify/`, { phone: registeredPhone, code });
                setMessage("حساب کاربری با موفقیت ساخته شد. اکنون می‌توانید وارد شوید.", "success");
                button.textContent = "حساب ساخته شد";
                button.disabled = true;
                document.querySelector(".payeh-signup__step[data-step='3'] .payeh-signup__notice").textContent = "ثبت‌نام شما کامل شد.";
            } catch (requestError) {
                setMessage(requestError.message, "error");
                setLoading(button, false, "تایید کد و ساخت حساب");
            }
        }
    });
});
