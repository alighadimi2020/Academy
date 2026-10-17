document.addEventListener("DOMContentLoaded", () => {
    const form = document.getElementById("payeh-login-form");
    if (!form) return;

    const phoneInput = document.getElementById("payeh-login-phone");
    const passwordInput = document.getElementById("payeh-login-password");
    const passwordToggle = document.getElementById("payeh-login-password-toggle");
    const phoneError = document.getElementById("payeh-login-phone-error");
    const passwordError = document.getElementById("payeh-login-password-error");
    const message = document.getElementById("payeh-login-message");
    const apiBase = `${window.location.origin}/api/auth/`;
    const digits = (value) => value
        .replace(/[۰-۹]/g, (digit) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(digit)))
        .replace(/[٠-٩]/g, (digit) => String("٠١٢٣٤٥٦٧٨٩".indexOf(digit)));
    phoneInput.addEventListener("input", () => {
        const input = phoneInput;
        const originalValue = input.value;
        const cursorPosition = input.selectionStart;

        const normalizedValue = digits(originalValue);

        if (originalValue !== normalizedValue) {
            input.value = normalizedValue;

            if (cursorPosition !== null) {
                const offset = originalValue
                    .slice(0, cursorPosition)
                    .length - digits(originalValue.slice(0, cursorPosition)).length;

                input.setSelectionRange(
                    Math.max(0, cursorPosition - offset),
                    Math.max(0, cursorPosition - offset)
                );
            }
        }
    });

    fetch(`${apiBase}me/?_t=${Date.now()}`, { credentials: "include", cache: "no-store" })
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
                window.location.assign(destinations[user.role] || "manager.html");
            }
        }).catch(() => {});

    passwordToggle?.addEventListener("click", () => {
        const visible = passwordInput.type === "password";
        passwordInput.type = visible ? "text" : "password";
        passwordToggle.classList.toggle("is-visible", visible);
        passwordToggle.setAttribute("aria-label", visible ? "مخفی کردن رمز عبور" : "نمایش رمز عبور");
    });

    const clearErrors = () => {
        phoneError.textContent = "";
        passwordError.textContent = "";
        phoneInput.closest(".payeh-login__field")?.classList.remove("is-error");
        passwordInput.closest(".payeh-login__field")?.classList.remove("is-error");
        message.textContent = "";
        message.className = "payeh-login__message";
    };

    form.addEventListener("submit", async (event) => {
        event.preventDefault();
        clearErrors();
        const rawIdentifier = phoneInput.value.trim();
        const isEmail = rawIdentifier.includes("@");
        const normalizedDigits = digits(rawIdentifier);
        const isPhone = /^09\d{9}$/.test(normalizedDigits);
        const identifier = isEmail ? rawIdentifier.toLowerCase() : (isPhone ? normalizedDigits : rawIdentifier);
        const password = passwordInput.value;
        let valid = true;

        if (isEmail) {
            if (!identifier.includes(".") || identifier.length < 5) {
                phoneError.textContent = "آدرس ایمیل معتبر وارد کنید.";
                phoneInput.closest(".payeh-login__field")?.classList.add("is-error");
                valid = false;
            }
        } else if (isPhone) {
            valid = true;
        } else if (identifier.length >= 3) {
            valid = true;
        } else {
            phoneError.textContent = "نام کاربری، شماره موبایل یا ایمیل معتبر وارد کنید.";
            phoneInput.closest(".payeh-login__field")?.classList.add("is-error");
            valid = false;
        }
        if (!password) {
            passwordError.textContent = "رمز عبور را وارد کنید.";
            passwordInput.closest(".payeh-login__field")?.classList.add("is-error");
            valid = false;
        }
        if (!valid) return;

        const button = form.querySelector('[type="submit"]');
        const originalText = button.textContent;
        button.disabled = true;
        button.classList.add("is-loading");
        button.textContent = "در حال ورود...";

        try {
            const csrfResponse = await fetch(`${apiBase}csrf/?_t=${Date.now()}`, { credentials: "include", cache: "no-store" });
            const csrfData = await csrfResponse.json();
            const response = await fetch(`${apiBase}login/`, {
                method: "POST",
                credentials: "include",
                headers: {
                    "Content-Type": "application/json",
                    "X-CSRFToken": csrfData.csrfToken,
                },
                body: JSON.stringify({
                    phone: identifier,
                    password,
                    remember: document.getElementById("payeh-login-remember")?.checked || false,
                }),
            });
            const text = await response.text();
            let result = {};
            try { result = JSON.parse(text); } catch {}

            if (!response.ok) {
                if (response.status === 403) {
                    throw new Error("نشست امنیتی منقضی شده بود؛ لطفاً دوباره دکمه ورود را بزنید.");
                }
                throw new Error(result.detail || "نام کاربری، شماره موبایل یا رمز عبور نادرست است.");
            }

            message.textContent = result.detail;
            message.classList.add("is-success");
            const destinations = {
                student: "student.html",
                consultant: "consultant.html",
                instructor: "student.html",
                admin: "manager.html",
                manager: "manager.html",
                applicant: "consultant-register.html#status",
            };
            window.location.assign(destinations[result.role] || "index.html");
        } catch (requestError) {
            message.textContent = requestError.message || "خطا در برقراری ارتباط؛ لطفاً دوباره تلاش کنید.";
            message.classList.add("is-error");
        } finally {
            button.disabled = false;
            button.classList.remove("is-loading");
            button.textContent = originalText;
        }
    });
});
