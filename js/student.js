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

    try {
        const meResponse = await fetch("/api/auth/me/", { credentials: "same-origin" });
        if (!meResponse.ok) { location.assign("login.html"); return; }
        const me = await meResponse.json();
        if (me.role !== "student") { location.assign(me.role === "consultant" ? "consultant.html" : "manager.html"); return; }
        const name = me.full_name || "دانش‌آموز";
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
