document.addEventListener("DOMContentLoaded", async () => {
    const pricingRoot = document.getElementById("consultation-pricing-list");
    const requestRoot = document.getElementById("consultation-pending-list");
    const message = document.getElementById("consultation-manager-message");
    const fa = (value) => new Intl.NumberFormat("fa-IR").format(value);
    const toman = (value) => `${fa(value)} تومان`;
    const toPersianDateTime = (dateInput) => {
        if (!dateInput) return "";
        try {
            const d = new Date(dateInput);
            if (isNaN(d.getTime())) return String(dateInput);
            return new Intl.DateTimeFormat("fa-IR-u-ca-persian", {
                timeZone: "Asia/Tehran",
                year: "numeric",
                month: "long",
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit"
            }).format(d);
        } catch {
            return String(dateInput);
        }
    };
    const make = (tag, cls, text) => { const el = document.createElement(tag); if (cls) el.className = cls; if (text !== undefined) el.textContent = text; return el; };
    let overview;
    const status = (text, failed = false) => { message.textContent = text; message.className = `consultation-message${failed ? " is-error" : " is-success"}`; };
    const csrfToken = async () => fetch("/api/auth/csrf/", { credentials: "same-origin" }).then((r) => r.json()).then((data) => data.csrfToken);
    const headers = async () => ({ "Content-Type": "application/json", "X-CSRFToken": await csrfToken() });

    const renderPricing = () => {
        pricingRoot.replaceChildren();
        if (!overview.consultants.length) { pricingRoot.append(make("p", "consultation-message", "مشاوری ثبت نشده است.")); return; }
        overview.consultants.forEach((person) => {
            const card = make("article", "consultation-manager-card");
            card.append(make("h3", "", person.full_name));
            if (person.bio) card.append(make("p", "consultation-manager-card__meta", person.bio));
            card.append(make("div", "consultation-manager-card__meta", `${person.phone} · ${fa(person.experience_years)} سال سابقه · ${person.university_major || "رشته دانشگاهی ثبت نشده"} · ${person.current_university || "دانشگاه ثبت نشده"}`));
            card.append(make("div", "consultation-manager-card__meta", `دانش‌آموزان تخصیص‌یافته: ${fa(person.assigned_count)} · ظرفیت آزادی که مشاور اعلام کرده: ${fa(person.available_slots)}${person.is_active ? "" : " · حساب غیرفعال"}`));
            const form = document.createElement("form"); form.className = "consultation-prices-form"; form.dataset.consultantId = String(person.id);
            [["standard", "معمولی"], ["vip", "VIP"], ["super_vip", "Super VIP"]].forEach(([key, label]) => {
                const field = make("label", "", `${label} · تومان`); const input = document.createElement("input"); input.type = "number"; input.min = "0"; input.max = "1000000000"; input.step = "1000"; input.required = true; input.name = key; input.value = String(person.prices?.[key] || 0); field.append(input); form.append(field);
            });
            const save = make("button", "consultation-small-button", "ذخیره قیمت‌ها"); save.type = "submit"; form.append(save);
            form.addEventListener("submit", async (event) => {
                event.preventDefault(); save.disabled = true;
                const prices = Object.fromEntries(["standard", "vip", "super_vip"].map((key) => [key, Number(form.elements[key].value)]));
                try {
                    const response = await fetch("/api/consultations/manage/prices/", { method: "POST", credentials: "same-origin", headers: await headers(), body: JSON.stringify({ consultant_id: person.id, prices }) });
                    const payload = await response.json(); if (!response.ok) throw new Error(payload.detail || "ذخیره قیمت‌ها انجام نشد.");
                    person.prices = payload.prices; status(`قیمت‌های ${person.full_name} ذخیره شد.`);
                } catch (error) { status(error.message || "ذخیره قیمت‌ها انجام نشد.", true); }
                finally { save.disabled = false; }
            });
            card.append(form); pricingRoot.append(card);
        });
    };

    const decide = async (item, action, consultantId, note, buttons) => {
        buttons.forEach((button) => { button.disabled = true; });
        try {
            const response = await fetch(`/api/consultations/requests/${item.id}/decision/`, { method: "POST", credentials: "same-origin", headers: await headers(), body: JSON.stringify({ action, consultant_id: consultantId, note }) });
            const result = await response.json(); if (!response.ok) throw new Error(result.detail || "ثبت تصمیم انجام نشد.");
            status(action === "approve" ? `درخواست دانش‌آموز ${item.student_name} به ${result.assigned_consultant_name} تخصیص یافت.` : `درخواست ${item.student_name} رد شد.`);
            await loadOverview();
        } catch (error) { status(error.message || "ثبت تصمیم انجام نشد.", true); buttons.forEach((button) => { button.disabled = false; }); }
    };

    const renderRequests = () => {
        requestRoot.replaceChildren();
        if (!overview.pending_requests.length) { requestRoot.append(make("p", "consultation-message", "درخواست در انتظار بررسی وجود ندارد.")); return; }
        overview.pending_requests.forEach((item) => {
            const card = make("article", "consultation-request-card");
            card.append(make("h3", "", `${item.student_name} · ${item.student_grade}${item.student_major ? ` · ${item.student_major}` : ""}`));
            card.append(make("p", "", `شماره: ${item.student_phone} · پلن درخواستی: ${item.plan_label} · ثبت: ${toPersianDateTime(item.created_at)}`));
            const preferences = make("div", "consultation-manager-card__meta", "اولویت‌های دانش‌آموز:"); card.append(preferences);
            const select = document.createElement("select"); select.setAttribute("aria-label", "مشاور برای تخصیص");
            item.preferences.forEach((choice, index) => {
                const prof = overview.consultants.find((candidate) => candidate.id === choice.consultant_id);
                const option = new Option(`${fa(index + 1)}. ${choice.consultant_name} · ${toman(choice.quoted_price_toman)} · ظرفیت آزاد فعلی: ${fa(prof?.available_slots || 0)}`, String(choice.consultant_id));
                option.disabled = !prof || !prof.is_active || prof.available_slots < 1; select.add(option);
            });
            const note = document.createElement("textarea"); note.maxLength = 500; note.placeholder = "توضیح برای دانش‌آموز (اختیاری؛ در صورت رد درخواست)"; note.setAttribute("aria-label", "توضیح مدیر برای دانش‌آموز");
            const actionRow = make("div", "consultation-request-card__actions"); actionRow.append(select);
            const approve = make("button", "", "تأیید و تخصیص مشاور"); approve.type = "button"; approve.disabled = ![...select.options].some((option) => !option.disabled);
            const reject = make("button", "reject", "رد درخواست"); reject.type = "button";
            approve.addEventListener("click", () => { if (!select.value) { status("برای تأیید، یک مشاور دارای ظرفیت آزاد انتخاب کنید.", true); return; } decide(item, "approve", Number(select.value), "", [approve, reject]); });
            reject.addEventListener("click", () => decide(item, "reject", null, note.value.trim(), [approve, reject]));
            actionRow.append(approve, reject); card.append(note, actionRow); requestRoot.append(card);
        });
    };

    async function loadOverview() {
        const response = await fetch("/api/consultations/manage/", { credentials: "same-origin" });
        const data = await response.json(); if (!response.ok) throw new Error(data.detail || "بارگذاری مدیریت مشاوره انجام نشد.");
        overview = data; renderPricing(); renderRequests();
    }
    try {
        const me = await fetch(`/api/auth/me/?_t=${Date.now()}`, { credentials: "same-origin", cache: "no-store" });
        if (!me.ok) { location.assign("login.html"); return; }
        const user = await me.json(); if (!["manager", "admin"].includes(user.role)) { location.assign(user.role === "consultant" ? "consultant.html" : "student.html"); return; }
        await loadOverview();
    } catch (error) { status(error.message || "بارگذاری انجام نشد.", true); pricingRoot.textContent = "داده‌ها بارگذاری نشدند."; requestRoot.replaceChildren(); }
});
