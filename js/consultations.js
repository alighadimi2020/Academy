document.addEventListener("DOMContentLoaded", async () => {
    const form = document.getElementById("consultation-request-form");
    const list = document.getElementById("consultation-consultants");
    const planRoot = document.getElementById("consultation-plan-options");
    const statusRoot = document.getElementById("consultation-request-status");
    const message = document.getElementById("consultation-message");
    const submit = document.getElementById("consultation-submit");
    const selectionCount = document.getElementById("consultation-selection-count");
    const history = document.getElementById("consultation-history");
    const fa = (number) => new Intl.NumberFormat("fa-IR").format(number);
    const price = (number) => `${new Intl.NumberFormat("fa-IR").format(number)} تومان`;
    const make = (tag, cls, text) => { const el = document.createElement(tag); if (cls) el.className = cls; if (text !== undefined) el.textContent = text; return el; };
    const plans = { standard: "معمولی", vip: "VIP", super_vip: "Super VIP" };
    let consultants = [];
    let hasActiveRequest = false;

    const setMessage = (text, failed = false) => { message.textContent = text; message.className = `consultation-message${failed ? " is-error" : ""}`; };
    const currentPlan = () => planRoot.querySelector('input[name="plan"]:checked')?.value || "standard";
    const selectedIds = () => [...list.querySelectorAll('input[name="consultant_ids"]:checked')].map((input) => Number(input.value));
    const updateSelection = () => {
        list.querySelectorAll('input[name="consultant_ids"]').forEach((checkbox) => {
            const person = consultants.find((candidate) => candidate.id === Number(checkbox.value));
            const eligible = Boolean(person && person.available_slots > 0 && person.prices?.[currentPlan()] > 0);
            checkbox.disabled = !eligible;
            if (!eligible) checkbox.checked = false;
            checkbox.closest(".consultant-choice")?.classList.toggle("is-unavailable", !eligible);
        });
        const selected = selectedIds();
        selectionCount.textContent = `${fa(selected.length)} انتخاب شده · حداقل ۲ و حداکثر ۱۰ مشاور؛ مدیر یکی را تخصیص می‌دهد.`;
        submit.disabled = hasActiveRequest || selected.length < 2 || selected.length > 10;
    };
    const renderStatus = (item) => {
        statusRoot.hidden = false;
        statusRoot.className = `consultation-request-status${item.status === "approved" ? " is-approved" : item.status === "rejected" ? " is-rejected" : ""}`;
        statusRoot.replaceChildren(make("h2", "", `وضعیت درخواست: ${item.status_label}`), make("p", "", `پلن ${item.plan_label} · ثبت ${new Date(item.created_at).toLocaleDateString("fa-IR")}`));
        const choices = make("div", "consultation-request-status__choices");
        item.preferences.forEach((choice, index) => choices.append(make("span", "", `${fa(index + 1)}. ${choice.consultant_name} · ${price(choice.quoted_price_toman)}`)));
        statusRoot.append(choices);
        if (item.status === "approved") {
            statusRoot.append(make("p", "", `مشاور شما: ${item.assigned_consultant_name} · مبلغ پلن: ${price(item.assigned_price_toman)}`));
            const chat = make("a", "", "رفتن به گفت‌وگوی مشاور"); chat.href = `consultation-chat.html?request=${encodeURIComponent(item.id)}`; statusRoot.append(chat);
        } else if (item.status === "rejected" && item.decision_note) statusRoot.append(make("p", "", `توضیح مدیر: ${item.decision_note}`));
        hasActiveRequest = item.status === "pending" || item.status === "approved";
        form.hidden = hasActiveRequest;
    };

    try {
        const meResponse = await fetch("/api/auth/me/", { credentials: "same-origin" });
        if (!meResponse.ok) { location.assign("login.html"); return; }
        const me = await meResponse.json();
        if (me.role !== "student") { location.assign(me.role === "consultant" ? "consultant.html" : "manager.html"); return; }
        const response = await fetch("/api/consultations/marketplace/", { credentials: "same-origin" });
        const data = await response.json();
        if (!response.ok) throw new Error(data.detail || "دریافت فهرست مشاوران انجام نشد.");
        consultants = data.consultants || [];
        (data.plans || []).forEach((planItem, index) => {
            const label = make("label", "consultation-plan-option");
            const radio = document.createElement("input"); radio.type = "radio"; radio.name = "plan"; radio.value = planItem.id; radio.checked = index === 0;
            radio.addEventListener("change", updateSelection);
            label.append(radio, make("span", "", planItem.label)); planRoot.append(label);
        });
        if (!consultants.length) list.replaceChildren(make("p", "consultation-message", "هنوز پروفایل مشاوری ثبت نشده است. مشاوران باید رزومه و ظرفیت خود را در پنل مشاور تکمیل کنند."));
        consultants.forEach((person) => {
            const available = Number(person.available_slots) > 0 && Number(person.prices?.standard) > 0;
            const card = make("article", `consultant-choice${available ? "" : " is-unavailable"}`);
            const top = make("div", "consultant-choice__top");
            const checkbox = document.createElement("input"); checkbox.type = "checkbox"; checkbox.name = "consultant_ids"; checkbox.value = String(person.id); checkbox.disabled = !available; checkbox.addEventListener("change", () => { if (checkbox.checked && selectedIds().length > 10) { checkbox.checked = false; setMessage("حداکثر ۱۰ مشاور می‌توانید انتخاب کنید.", true); } updateSelection(); });
            top.append(checkbox, make("h3", "", person.full_name), make("span", "consultant-choice__experience", `${fa(person.experience_years)} سال سابقه`)); card.append(top);
            card.append(make("p", "consultant-choice__bio", person.bio || "این مشاور هنوز توضیح رزومه‌ای اضافه نکرده است."));
            const meta = make("div", "consultant-choice__meta");
            meta.append(make("span", "", `رشته دانشگاهی: ${person.university_major || "ثبت نشده"}`), make("span", "", `دانشگاه فعلی: ${person.current_university || "ثبت نشده"}`), make("span", `consultant-choice__availability${available ? "" : " is-full"}`, available ? `${fa(person.available_slots)} ظرفیت آزاد` : "ظرفیت تکمیل است")); card.append(meta);
            const prices = make("div", "consultant-choice__prices"); prices.append(make("strong", "", "قیمت هر پلن"));
            Object.entries(plans).forEach(([key, label]) => prices.append(make("span", "", `${label}: ${person.prices?.[key] ? price(person.prices[key]) : "قیمت تعیین نشده"}`)));
            card.append(prices); list.append(card);
        });
        const current = data.active_request || data.latest_request;
        if (current) renderStatus(current); else { statusRoot.hidden = true; form.hidden = false; }
        if (data.latest_request?.status === "rejected" && !data.active_request) {
            const old = make("article", "consultation-history-item"); old.append(make("strong", "", `آخرین درخواست: ${data.latest_request.status_label}`));
            if (data.latest_request.decision_note) old.append(make("p", "", `توضیح مدیر: ${data.latest_request.decision_note}`)); history.append(old);
            statusRoot.hidden = true;
        }
    } catch (error) { list.replaceChildren(make("p", "consultation-message is-error", error.message || "ارتباط با سرور برقرار نشد.")); }

    planRoot.addEventListener("change", updateSelection);
    form.addEventListener("submit", async (event) => {
        event.preventDefault();
        const ids = selectedIds();
        if (ids.length < 2) { setMessage("برای ثبت درخواست، حداقل دو مشاور انتخاب کنید.", true); return; }
        submit.disabled = true; submit.textContent = "در حال ثبت درخواست…"; setMessage("");
        try {
            const csrf = await fetch("/api/auth/csrf/", { credentials: "same-origin" }).then((r) => r.json());
            const response = await fetch("/api/consultations/requests/create/", { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json", "X-CSRFToken": csrf.csrfToken }, body: JSON.stringify({ plan: currentPlan(), consultant_ids: ids }) });
            const result = await response.json(); if (!response.ok) throw new Error(result.detail || "ثبت درخواست انجام نشد.");
            hasActiveRequest = true; renderStatus(result); setMessage("درخواست برای بررسی مدیر مجموعه ثبت شد.");
        } catch (error) { setMessage(error.message || "ثبت درخواست انجام نشد.", true); }
        finally { submit.textContent = "ثبت درخواست برای مدیر"; updateSelection(); }
    });
    updateSelection();
});
