document.addEventListener("DOMContentLoaded", () => {
    const form = document.getElementById("payeh-login-form");
    const phoneInput = document.getElementById("payeh-login-phone");
    const passwordInput = document.getElementById("payeh-login-password");
    const passwordToggle = document.getElementById("payeh-login-password-toggle");
    const phoneError = document.getElementById("payeh-login-phone-error");
    const passwordError = document.getElementById("payeh-login-password-error");
    const message = document.getElementById("payeh-login-message");

    if (!form) {
        return;
    }

    passwordToggle?.addEventListener("click", () => {
        const isPassword = passwordInput.type === "password";

        passwordInput.type = isPassword ? "text" : "password";
        passwordToggle.classList.toggle("is-visible", isPassword);

        passwordToggle.setAttribute(
            "aria-label",
            isPassword ? "مخفی کردن رمز عبور" : "نمایش رمز عبور"
        );
    });

    phoneInput?.addEventListener("input", () => {
        phoneInput.value = phoneInput.value.replace(/[^0-9۰-۹]/g, "");
    });

    const clearErrors = () => {
        phoneError.textContent = "";
        passwordError.textContent = "";

        phoneInput.closest(".payeh-login__field")?.classList.remove("is-error");
        passwordInput.closest(".payeh-login__field")?.classList.remove("is-error");

        message.textContent = "";
        message.className = "payeh-login__message";
    };

    const normalizeDigits = (value) => {
        return value
            .replace(/[۰-۹]/g, (digit) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(digit)))
            .replace(/[٠-٩]/g, (digit) => String("٠١٢٣٤٥٦٧٨٩".indexOf(digit)));
    };

    form.addEventListener("submit", (event) => {
        event.preventDefault();

        clearErrors();

        const phone = normalizeDigits(phoneInput.value.trim());
        const password = passwordInput.value.trim();

        let isValid = true;

        if (!phone) {
            phoneError.textContent = "شماره موبایل را وارد کنید.";
            phoneInput.closest(".payeh-login__field")?.classList.add("is-error");
            isValid = false;
        } else if (!/^09\d{9}$/.test(phone)) {
            phoneError.textContent = "شماره موبایل واردشده صحیح نیست.";
            phoneInput.closest(".payeh-login__field")?.classList.add("is-error");
            isValid = false;
        }

        if (!password) {
            passwordError.textContent = "رمز عبور را وارد کنید.";
            passwordInput.closest(".payeh-login__field")?.classList.add("is-error");
            isValid = false;
        }

        if (!isValid) {
            return;
        }

        message.textContent = "اطلاعات برای ارسال به سامانه آماده است.";
        message.classList.add("is-success");
    });
}); 