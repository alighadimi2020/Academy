document.addEventListener("DOMContentLoaded", async () => {
    const managerNavItems = document.querySelectorAll(".payeh-manager__nav-item");
    const managerPages = document.querySelectorAll(".manager-page");
    const managerPageTitle = document.getElementById("manager-page-title");
    const managerSidebar = document.getElementById("manager-sidebar");
    const managerMenuButton = document.getElementById("manager-menu-button");
    const pageTitles = { dashboard: "داشبورد", consultants: "مشاوران", students: "دانش‌آموزان", conversations: "گفت‌وگوها", articles: "مقالات", settings: "تنظیمات" };
    const make = (tag, className, text) => { const node = document.createElement(tag); if (className) node.className = className; if (text !== undefined) node.textContent = text; return node; };
    const numberFa = (value) => new Intl.NumberFormat("fa-IR").format(value);
    const state = { students: [], consultants: [] };

    const renderUsers = (role) => {
        const isStudent = role === "student";
        const target = document.getElementById(isStudent ? "student-user-list" : "consultant-user-list");
        const query = document.getElementById(isStudent ? "student-search" : "consultant-search").value.trim().toLocaleLowerCase();
        const filtered = state[isStudent ? "students" : "consultants"].filter((user) => `${user.full_name} ${user.phone} ${user.grade_label || ""} ${user.major_label || ""}`.toLocaleLowerCase().includes(query));
        target.replaceChildren();
        const message = document.getElementById(isStudent ? "student-list-message" : "consultant-list-message");
        message.textContent = filtered.length ? `${numberFa(filtered.length)} مورد` : (query ? "موردی با این جست‌وجو پیدا نشد." : `هنوز ${isStudent ? "دانش‌آموزی" : "مشاوری"} ثبت نشده است.`);
        filtered.forEach((user) => {
            const card = make("article", "manager-user-card");
            const header = make("div", "manager-user-card__header");
            const avatar = make("span", "manager-user-card__avatar", (user.full_name || "ک").trim().charAt(0));
            const identity = make("div", "manager-user-card__identity");
            identity.append(make("h3", "", user.full_name), make("span", user.is_active ? "manager-user-state is-active" : "manager-user-state", user.is_active ? "فعال" : "غیرفعال"));
            header.append(avatar, identity); card.append(header);
            const fields = make("dl", "manager-user-card__fields");
            const addField = (label, value, link = false) => {
                if (!value) return;
                const wrapper = document.createElement("div"); wrapper.append(make("dt", "", label));
                const dd = document.createElement("dd");
                if (link) { const anchor = make("a", "", value); anchor.href = `tel:${value}`; dd.append(anchor); } else dd.textContent = value;
                wrapper.append(dd); fields.append(wrapper);
            };
            addField("شماره موبایل", user.phone, true);
            if (isStudent) { addField("پایه تحصیلی", user.grade_label); addField("رشته", user.major_label); addField("شماره والد", user.parent_phone, true); }
            else if (user.date_joined) addField("تاریخ عضویت", new Date(user.date_joined).toLocaleDateString("fa-IR"));
            card.append(fields); target.append(card);
        });
    };

    const loadUsers = async (role) => {
        const isStudent = role === "student";
        const message = document.getElementById(isStudent ? "student-list-message" : "consultant-list-message");
        message.textContent = "در حال دریافت فهرست…";
        try {
            const response = await fetch(`/api/manager/users/?role=${role}`, { credentials: "same-origin" });
            const data = await response.json();
            if (!response.ok) throw new Error(data.detail || "دریافت فهرست انجام نشد.");
            state[isStudent ? "students" : "consultants"] = data.results || [];
            renderUsers(role);
            const count = document.getElementById(isStudent ? "manager-student-count" : "manager-consultant-count");
            if (count) count.textContent = numberFa(data.count || 0);
        } catch (error) { message.textContent = error.message || "ارتباط با سرور برقرار نشد."; }
    };
    document.getElementById("student-search")?.addEventListener("input", () => renderUsers("student"));
    document.getElementById("consultant-search")?.addEventListener("input", () => renderUsers("consultant"));

    const showPage = (pageName) => {
        const targetPage = document.getElementById(`page-${pageName}`);
        if (!targetPage) return;
        managerPages.forEach((page) => page.classList.remove("is-active"));
        managerNavItems.forEach((item) => item.classList.toggle("is-active", item.dataset.page === pageName));
        targetPage.classList.add("is-active");
        if (managerPageTitle) managerPageTitle.textContent = pageTitles[pageName] || "پنل مدیریت";
        managerSidebar?.classList.remove("is-open");
        if (pageName === "students" || pageName === "consultants") loadUsers(pageName === "students" ? "student" : "consultant");
        window.scrollTo({ top: 0, behavior: "smooth" });
    };
    managerNavItems.forEach((item) => item.addEventListener("click", (event) => {
        const pageName = item.dataset.page;
        if (!pageName) return;
        event.preventDefault(); window.location.hash = pageName; showPage(pageName);
    }));
    const loadPageFromHash = () => { const name = location.hash.slice(1); showPage(pageTitles[name] ? name : "dashboard"); };
    window.addEventListener("hashchange", loadPageFromHash);
    managerMenuButton?.addEventListener("click", () => managerSidebar?.classList.toggle("is-open"));
    document.addEventListener("click", (event) => {
        if (window.innerWidth <= 800 && managerSidebar?.classList.contains("is-open") && !managerSidebar.contains(event.target) && !managerMenuButton?.contains(event.target)) managerSidebar.classList.remove("is-open");
    });

    const meResponse = await fetch("/api/auth/me/", { credentials: "same-origin" });
    if (!meResponse.ok) { location.assign("login.html"); return; }
    const me = await meResponse.json();
    if (!["manager", "admin"].includes(me.role)) { location.assign(me.role === "student" ? "student.html" : "consultant.html"); return; }
    loadPageFromHash();
    loadUsers("student");
    loadUsers("consultant");
});
