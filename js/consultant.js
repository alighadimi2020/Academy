const initConsultantApp = async () => {
    const sidebar = document.getElementById("consultantSidebar");
    const menuButton = document.getElementById("consultantMenu");
    const articleList = document.getElementById("consultant-article-list");
    const count = document.getElementById("consultant-article-count");
    const numberFa = (value) => new Intl.NumberFormat("fa-IR").format(value);
    const normalizeDigits = (value) => String(value).replace(/[۰-۹]/g, digit => String("۰۱۲۳۴۵۶۷۸۹".indexOf(digit))).replace(/[٠-٩]/g, digit => String("٠١٢٣٤٥٦٧٨٩".indexOf(digit)));
    let plannerStudents = [];
    let currentDossierStudent = null;
    let currentWeekStartIso = "";
    let currentWeekOffset = 0;
    let studentWeeksArchive = [];

    // Articles state
    let consultantArticlesList = [];
    let consultantArticlesFilterStatus = "all";
    let consultantArticlesSearchQuery = "";

    // Study reports & Jalali range picker state
    let currentStudentReports = [];
    let reportsDateSortOrder = "desc";
    let reportsDateRange = { start: null, end: null };

    // ==========================================
    // STANDALONE JALALI CONVERSION HELPERS
    // ==========================================
    function gregorianToJalali(gy, gm, gd) {
        const g_d_m = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];
        let gy2 = (gm > 2) ? (gy + 1) : gy;
        let days = 355666 + (365 * gy) + Math.floor((gy2 + 3) / 4) - Math.floor((gy2 + 99) / 100) + Math.floor((gy2 + 399) / 400) + gd + g_d_m[gm - 1];
        let jy = -1595 + (33 * Math.floor(days / 12053));
        days %= 12053;
        jy += 4 * Math.floor(days / 1461);
        days %= 1461;
        if (days > 365) {
            jy += Math.floor((days - 1) / 365);
            days = (days - 1) % 365;
        }
        let jm = (days < 186) ? 1 + Math.floor(days / 31) : 7 + Math.floor((days - 186) / 30);
        let jd = 1 + ((days < 186) ? (days % 31) : ((days - 186) % 30));
        return { jy, jm, jd };
    }

    function jalaliToGregorian(jy, jm, jd) {
        let gy = (jy <= 979) ? 621 : 1600;
        jy -= (jy <= 979) ? 0 : 979;
        let days = (365 * jy) + (Math.floor(jy / 33) * 8) + Math.floor(((jy % 33) + 3) / 4) + 78 + jd + ((jm < 7) ? (jm - 1) * 31 : ((jm - 7) * 30) + 186);
        gy += 400 * Math.floor(days / 146097);
        days %= 146097;
        if (days > 36524) {
            gy += 100 * Math.floor(--days / 36524);
            days %= 36524;
            if (days >= 365) days++;
        }
        gy += 4 * Math.floor(days / 1461);
        days %= 1461;
        if (days > 365) {
            gy += Math.floor((days - 1) / 365);
            days = (days - 1) % 365;
        }
        let gd = days + 1;
        const sal_a = [0, 31, ((gy % 4 === 0 && gy % 100 !== 0) || (gy % 400 === 0)) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
        let gm;
        for (gm = 0; gm < 13 && gd > sal_a[gm]; gm++) gd -= sal_a[gm];
        return { gy, gm, gd };
    }

    function isJalaliLeapYear(jy) {
        const r = (jy % 33);
        return [1, 5, 9, 13, 17, 22, 26, 30].includes(r);
    }

    function jalaliMonthDays(jy, jm) {
        if (jm <= 6) return 31;
        if (jm <= 11) return 30;
        return isJalaliLeapYear(jy) ? 30 : 29;
    }

    const jalaliMonthNames = [
        "فروردین", "اردیبهشت", "خرداد",
        "تیر", "مرداد", "شهریور",
        "مهر", "آبان", "آذر",
        "دی", "بهمن", "اسفند"
    ];

    function formatJalaliDisplay(isoDateStr, format = "short") {
        if (!isoDateStr) return "";
        try {
            const raw = isoDateStr.split("T")[0].replace(/\//g, "-").trim();
            const parts = raw.split("-");
            if (parts.length !== 3) return isoDateStr;
            const gy = parseInt(parts[0], 10);
            const gm = parseInt(parts[1], 10);
            const gd = parseInt(parts[2], 10);
            const { jy, jm, jd } = gregorianToJalali(gy, gm, gd);
            if (format === "full") {
                const d = new Date(Date.UTC(gy, gm - 1, gd));
                const weekdayName = new Intl.DateTimeFormat("fa-IR-u-ca-persian", { weekday: "long" }).format(d);
                return `${weekdayName} ${numberFa(jd)} ${jalaliMonthNames[jm - 1]} ${numberFa(jy)}`;
            }
            return `${numberFa(jy)}/${String(jm).padStart(2, "0").replace(/[0-9]/g, d => "۰۱۲۳۴۵۶۷۸۹"[d])}/${String(jd).padStart(2, "0").replace(/[0-9]/g, d => "۰۱۲۳۴۵۶۷۸۹"[d])}`;
        } catch (e) {
            return isoDateStr;
        }
    }

    function toIsoDate(gy, gm, gd) {
        return `${gy}-${String(gm).padStart(2, "0")}-${String(gd).padStart(2, "0")}`;
    }

    function getFormalSvgIcon(name, extraClass = "") {
        const cls = extraClass ? `formal-svg-icon ${extraClass}` : "formal-svg-icon";
        switch (name) {
            case "book":
            case "math":
            case "biology":
            case "physics":
            case "chemistry":
            case "geology":
            case "general":
                return `<svg class="${cls}" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>`;
            case "chapter":
                return `<svg class="${cls}" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg>`;
            case "topic":
                return `<svg class="${cls}" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>`;
            case "all":
                return `<svg class="${cls}" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>`;
            case "trash":
                return `<svg class="${cls}" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>`;
            case "move":
                return `<svg class="${cls}" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><polyline points="5 9 2 12 5 15"/><polyline points="9 5 12 2 15 5"/><polyline points="15 19 12 22 9 19"/><polyline points="19 9 22 12 19 15"/><line x1="2" y1="12" x2="22" y2="12"/><line x1="12" y1="2" x2="12" y2="22"/></svg>`;
            case "drag":
                return `<svg class="${cls}" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><circle cx="9" cy="5" r="1.5"/><circle cx="9" cy="12" r="1.5"/><circle cx="9" cy="19" r="1.5"/><circle cx="15" cy="5" r="1.5"/><circle cx="15" cy="12" r="1.5"/><circle cx="15" cy="19" r="1.5"/></svg>`;
            case "badge":
                return `<svg class="${cls}" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>`;
            case "search":
                return `<svg class="${cls}" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>`;
            case "check":
                return `<svg class="${cls}" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>`;
            case "close":
                return `<svg class="${cls}" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`;
            case "edit":
                return `<svg class="${cls}" viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>`;
            case "arrowRight":
                return `<svg class="${cls}" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>`;
            case "chat":
                return `<svg class="${cls}" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 11.5a8.38 8.38 0 0 1-9 8.5 9.7 9.7 0 0 1-4-.8L3 21l1.8-4.3A8.1 8.1 0 0 1 3 11.5 8.5 8.5 0 0 1 12 3a8.5 8.5 0 0 1 9 8.5Z"/></svg>`;
            case "archive":
                return `<svg class="${cls}" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="4" rx="1"/><path d="M5 7v13a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7"/><line x1="10" y1="12" x2="14" y2="12"/></svg>`;
            case "copy":
                return `<svg class="${cls}" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>`;
            case "calendar":
                return `<svg class="${cls}" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>`;
            case "clock":
                return `<svg class="${cls}" viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`;
            case "quote":
                return `<svg class="${cls}" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 21c3 0 7-1 7-8V5c0-1.25-.756-2.017-2-2H4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2 1 0 1 0 1 1v1c0 1-1 2-2 2s-1 .008-1 1.031V20c0 1 0 1 1 1z"/><path d="M15 21c3 0 7-1 7-8V5c0-1.25-.757-2.017-2-2h-4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2 1 0 1 0 1 1v1c0 1-1 2-2 2s-1 .008-1 1.031V20c0 1 0 1 1 1z"/></svg>`;
            case "phone":
                return `<svg class="${cls}" viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>`;
            case "grade":
                return `<svg class="${cls}" viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/></svg>`;
            default:
                return `<svg class="${cls}" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/></svg>`;
        }
    }

    async function getFreshCsrfToken() {
        const match = document.cookie.match(/csrftoken=([^;]+)/);
        if (match && match[1]) return match[1];
        try {
            const res = await fetch(`/api/auth/csrf/?_t=${Date.now()}`, { credentials: "same-origin", cache: "no-store" });
            const data = await res.json();
            return data.csrfToken || "";
        } catch (e) {
            return "";
        }
    }

    const titles = {
        dashboard: "داشبورد",
        students: "دانش‌آموزان من",
        planner: "برنامه‌ریزی درسی",
        activities: "گزارش‌های مطالعه",
        conversations: "گفتگوها",
        articles: "مقالات من",
        profile: "پروفایل و تنظیمات"
    };

    const showPage = (name) => {
        let requestedTab = null;
        // Map planner and activities directly to students or active student's dossier
        if (name === "planner" || name === "activities") {
            requestedTab = (name === "activities") ? "reports" : "planner";
            if (currentDossierStudent) {
                name = `student/${currentDossierStudent.student_id}`;
            } else if (plannerStudents && plannerStudents.length === 1) {
                name = `student/${plannerStudents[0].student_id}`;
            } else {
                name = "students";
            }
        }

        const titleEl = document.getElementById("consultantPageTitle");
        const navItems = document.querySelectorAll(".payeh-consultant__nav-item[data-page]");

        // Hide all views
        const allViewIds = [
            "view-dashboard",
            "view-students",
            "view-student-dossier",
            "view-conversations",
            "view-articles",
            "view-profile"
        ];
        allViewIds.forEach(id => {
            const el = document.getElementById(id);
            if (el) el.style.display = "none";
        });

        if (name.startsWith("student/")) {
            const sId = Number(name.split("/")[1]);
            const student = plannerStudents.find(s => s.student_id === sId);
            if (student) {
                openStudentDossier(student, false, requestedTab || "planner");
                return;
            } else {
                const dossierView = document.getElementById("view-student-dossier");
                if (dossierView) dossierView.style.display = "block";
            }
            navItems.forEach(item => item.classList.toggle("active", item.dataset.page === "students"));
            if (titleEl) titleEl.textContent = "پرونده تحصیلی دانش‌آموز";
        } else {
            const targetViewId = 
                name === "students" ? "view-students" :
                name === "conversations" ? "view-conversations" :
                name === "articles" ? "view-articles" :
                name === "profile" ? "view-profile" :
                "view-dashboard";

            const targetView = document.getElementById(targetViewId);
            if (targetView) targetView.style.display = "block";

            navItems.forEach(item => item.classList.toggle("active", item.dataset.page === name || (name === "dashboard" && item.dataset.page === "dashboard")));
            if (titleEl) titleEl.textContent = titles[name] || titles.dashboard;
        }

        window.scrollTo({ top: 0, behavior: "smooth" });
        sidebar?.classList.remove("is-open", "open");
        document.getElementById("consultantSidebarOverlay")?.classList.remove("is-active", "active");
        document.body.classList.remove("payeh-sidebar-locked");
    };

    document.querySelectorAll(".payeh-consultant__nav-item[data-page], .consultant-section-link[data-page]").forEach((item) => item.addEventListener("click", (event) => {
        event.preventDefault(); const name = item.dataset.page; history.pushState(null, "", `#${name}`); showPage(name);
    }));
    window.addEventListener("hashchange", () => showPage(location.hash.slice(1) || "dashboard"));

    const consultantSidebarOverlay = document.getElementById("consultantSidebarOverlay");
    const consultantSidebarClose = document.getElementById("consultantSidebarClose");

    const toggleConsultantSidebar = (force) => {
        const isCurrentlyOpen = sidebar?.classList.contains("is-open") || sidebar?.classList.contains("open") || (sidebar && sidebar.style.right === "0px");
        const willOpen = typeof force === "boolean" ? force : !isCurrentlyOpen;
        sidebar?.classList.toggle("is-open", willOpen);
        sidebar?.classList.toggle("open", willOpen);
        consultantSidebarOverlay?.classList.toggle("is-active", willOpen);
        consultantSidebarOverlay?.classList.toggle("active", willOpen);
        document.body.classList.toggle("payeh-sidebar-locked", willOpen);
        if (sidebar) {
            if (window.innerWidth <= 1024) {
                sidebar.style.right = willOpen ? "0px" : "-320px";
                sidebar.style.transform = "none";
            } else {
                sidebar.style.right = "";
                sidebar.style.transform = "";
            }
        }
        if (consultantSidebarOverlay) {
            consultantSidebarOverlay.style.display = willOpen ? "block" : "none";
            consultantSidebarOverlay.style.opacity = willOpen ? "1" : "0";
            consultantSidebarOverlay.style.pointerEvents = willOpen ? "auto" : "none";
        }
    };
    window.toggleConsultantSidebar = toggleConsultantSidebar;

    const handleMenuToggle = (e) => {
        if (e) {
            e.stopPropagation();
            if (e.cancelable) e.preventDefault();
        }
        toggleConsultantSidebar();
    };

    menuButton?.addEventListener("click", handleMenuToggle);
    menuButton?.addEventListener("touchend", handleMenuToggle);

    const handleClose = (e) => {
        if (e) {
            e.stopPropagation();
            if (e.cancelable) e.preventDefault();
        }
        toggleConsultantSidebar(false);
    };

    consultantSidebarClose?.addEventListener("click", handleClose);
    consultantSidebarClose?.addEventListener("touchend", handleClose);

    consultantSidebarOverlay?.addEventListener("click", () => toggleConsultantSidebar(false));
    consultantSidebarOverlay?.addEventListener("touchend", (e) => {
        if (e.cancelable) e.preventDefault();
        toggleConsultantSidebar(false);
    });

    document.addEventListener("keydown", (e) => {
        if (e.key === "Escape" && (sidebar?.classList.contains("is-open") || sidebar?.classList.contains("open"))) {
            toggleConsultantSidebar(false);
        }
    });

    document.addEventListener("click", (e) => {
        if (window.innerWidth <= 1024) {
            if (sidebar && (sidebar.classList.contains("is-open") || sidebar.classList.contains("open") || sidebar.style.right === "0px")) {
                if (!sidebar.contains(e.target) && !menuButton?.contains(e.target)) {
                    toggleConsultantSidebar(false);
                }
            }
        }
    });
    document.querySelector(".payeh-consultant__logout")?.addEventListener("click", async () => {
        try { const csrf = await fetch(`/api/auth/csrf/?_t=${Date.now()}`, { credentials: "same-origin", cache: "no-store" }).then((r) => r.json()); await fetch("/api/auth/logout/", { method: "POST", credentials: "same-origin", headers: { "X-CSRFToken": csrf.csrfToken } }); }
        finally { location.replace(`login.html?_t=${Date.now()}`); }
    });
    try {
        const meResponse = await fetch(`/api/auth/me/?_t=${Date.now()}`, { credentials: "same-origin", cache: "no-store" });
        if (!meResponse.ok) { location.assign("login.html"); return; }
        const user = await meResponse.json();
        if (user.role !== "consultant") { location.assign(user.role === "student" ? "student.html" : "manager.html"); return; }
        const consultantName = user.full_name || "مشاور";
        ["consultant-account-name", "consultant-header-name"].forEach((id) => { const node = document.getElementById(id); if (node) node.textContent = consultantName; });
        loadConsultantProfile();
        initConsultantChangePassword();
        loadAssignedStudents();
        loadDailyStudyReports();
        loadTelegramStatus();
        loadManagerSupportRoom();
        initConsultantArticlesFilters();
        await loadConsultantArticles();
    } catch (error) {
        const grid = document.getElementById("consultant-article-list");
        if (grid) grid.innerHTML = `<p class="consultant-article-hint">${error.message || "خطا در بارگذاری پنل."}</p>`;
    }

    function initConsultantArticlesFilters() {
        const searchInput = document.getElementById("consultant-articles-search");
        if (searchInput) {
            searchInput.addEventListener("input", (e) => {
                consultantArticlesSearchQuery = e.target.value;
                renderConsultantArticles();
            });
        }

        const tabs = document.querySelectorAll("#consultant-article-tabs .glass-tab-btn");
        tabs.forEach(tab => {
            tab.addEventListener("click", () => {
                tabs.forEach(t => t.classList.toggle("active", t === tab));
                consultantArticlesFilterStatus = tab.dataset.status || "all";
                renderConsultantArticles();
            });
        });
    }

    function renderConsultantArticles() {
        const grid = document.getElementById("consultant-article-list");
        if (!grid) return;
        grid.replaceChildren();

        const countEl = document.getElementById("consultant-article-count");
        if (countEl) countEl.textContent = numberFa(consultantArticlesList.length);

        // Update tab counts
        const countAll = consultantArticlesList.length;
        const countPublished = consultantArticlesList.filter(p => p.status === "published").length;
        const countPending = consultantArticlesList.filter(p => p.status === "pending").length;
        const countRejected = consultantArticlesList.filter(p => p.status === "rejected").length;

        const tabAllEl = document.getElementById("article-tab-count-all");
        if (tabAllEl) tabAllEl.textContent = numberFa(countAll);
        const tabPubEl = document.getElementById("article-tab-count-published");
        if (tabPubEl) tabPubEl.textContent = numberFa(countPublished);
        const tabPendEl = document.getElementById("article-tab-count-pending");
        if (tabPendEl) tabPendEl.textContent = numberFa(countPending);
        const tabRejEl = document.getElementById("article-tab-count-rejected");
        if (tabRejEl) tabRejEl.textContent = numberFa(countRejected);

        // Filter by status
        let filtered = consultantArticlesList;
        if (consultantArticlesFilterStatus !== "all") {
            filtered = filtered.filter(p => p.status === consultantArticlesFilterStatus);
        }

        // Filter by search query
        const query = consultantArticlesSearchQuery.trim().toLocaleLowerCase("fa");
        if (query) {
            filtered = filtered.filter(p => 
                (p.title && p.title.toLocaleLowerCase("fa").includes(query)) ||
                (p.category && p.category.toLocaleLowerCase("fa").includes(query))
            );
        }

        if (!filtered.length) {
            const empty = document.createElement("div");
            empty.className = "glass-articles-empty";
            empty.innerHTML = `
                <div class="glass-articles-empty-icon">${getFormalSvgIcon("book")}</div>
                <h4>${consultantArticlesList.length === 0 ? "هنوز مقاله‌ای ثبت نکرده‌اید" : "مقاله‌ای مطابق با فیلترها یافت نشد"}</h4>
                <p>${consultantArticlesList.length === 0 ? "از دکمهٔ «نوشتن مقاله جدید» در بالا می‌توانید اولین مقالهٔ تخصصی خود را در مجله ثبت کنید." : "عبارت جستجو یا فیلتر وضعیت را تغییر دهید."}</p>
            `;
            grid.append(empty);
            return;
        }

        const labels = {
            published: "منتشرشده",
            pending: "در انتظار تأیید",
            rejected: "نیازمند اصلاح"
        };

        filtered.forEach(post => {
            const card = document.createElement("article");
            card.className = "glass-article-card";

            const topRow = document.createElement("div");
            topRow.className = "glass-article-top-row";

            const category = document.createElement("span");
            category.className = "glass-article-category";
            category.innerHTML = `${getFormalSvgIcon("topic")} <span>${post.category || "مقاله تخصصی"}</span>`;

            const readTime = document.createElement("span");
            readTime.className = "glass-article-reading-time";
            readTime.innerHTML = `${getFormalSvgIcon("clock")} <span>${numberFa(post.reading_minutes || 5)} دقیقه مطالعه</span>`;

            topRow.append(category, readTime);

            const title = document.createElement("h4");
            title.className = "glass-article-title";
            title.textContent = post.title;

            const metaRow = document.createElement("div");
            metaRow.className = "glass-article-meta-row";

            const date = document.createElement("span");
            date.className = "glass-article-date";
            const jalaliDateStr = formatJalaliDisplay(post.created_at, "short");
            date.innerHTML = `${getFormalSvgIcon("calendar")} <span>${jalaliDateStr}</span>`;

            const statusPill = document.createElement("span");
            statusPill.className = `glass-article-status-pill glass-article-status-pill--${post.status}`;
            statusPill.innerHTML = `<span class="status-indicator status-indicator--${post.status}"></span> <span>${labels[post.status] || post.status}</span>`;

            metaRow.append(date, statusPill);

            card.append(topRow, title, metaRow);

            if (post.status === "rejected" && post.review_note) {
                const note = document.createElement("p");
                note.className = "glass-article-note";
                note.textContent = `توضیح بازبینی مدیر: ${post.review_note}`;
                card.append(note);
            }

            if (post.status === "published") {
                const footer = document.createElement("div");
                footer.className = "glass-article-footer";
                const link = document.createElement("a");
                link.className = "glass-article-view-link";
                link.href = `blog-detail.html?id=${encodeURIComponent(post.id)}`;
                link.innerHTML = `<span>مشاهده در مجله</span> ${getFormalSvgIcon("arrowRight")}`;
                footer.append(link);
                card.append(footer);
            }

            grid.append(card);
        });
    }

    async function loadConsultantArticles() {
        const grid = document.getElementById("consultant-article-list");
        if (!grid) return;
        try {
            const response = await fetch("/api/blog/mine/", { credentials: "same-origin" });
            const payload = await response.json();
            if (!response.ok) throw new Error(payload.detail || "دریافت مقاله‌ها انجام نشد.");
            consultantArticlesList = payload.results || [];
            renderConsultantArticles();
        } catch (error) {
            grid.innerHTML = `<p class="consultant-article-hint">${error.message || "فهرست مقاله‌ها بارگذاری نشد."}</p>`;
        }
    }
    async function loadConsultantProfile() {
        const form = document.getElementById("consultant-profile-form");
        const message = document.getElementById("consultant-profile-message");
        if (!form) return;
        try {
            const response = await fetch("/api/consultations/profile/", { credentials: "same-origin" });
            const data = await response.json(); if (!response.ok) throw new Error(data.detail || "دریافت رزومه ممکن نشد.");
            ["full_name", "bio", "experience_years", "available_slots", "university_major", "current_university"].forEach((key) => { form.elements[key].value = data[key] ?? ""; });
            document.getElementById("consultant-assigned-count").textContent = numberFa(data.assigned_count);
            const prices = document.getElementById("consultant-plan-prices");
            prices.textContent = `معمولی: ${data.prices.standard ? numberFa(data.prices.standard) + " تومان" : "تعیین نشده"} · VIP: ${data.prices.vip ? numberFa(data.prices.vip) + " تومان" : "تعیین نشده"} · Super VIP: ${data.prices.super_vip ? numberFa(data.prices.super_vip) + " تومان" : "تعیین نشده"}`;
        } catch (error) { message.textContent = error.message || "دریافت رزومه انجام نشد."; }
        form.addEventListener("submit", async (event) => {
            event.preventDefault(); const button = form.querySelector('button[type="submit"]'); button.disabled = true; message.textContent = "در حال ذخیره…";
            const payload = Object.fromEntries(new FormData(form)); payload.experience_years = Number(payload.experience_years); payload.available_slots = Number(payload.available_slots);
            try {
                const csrf = await fetch("/api/auth/csrf/", { credentials: "same-origin" }).then((r) => r.json());
                const response = await fetch("/api/consultations/profile/", { method: "PATCH", credentials: "same-origin", headers: { "Content-Type": "application/json", "X-CSRFToken": csrf.csrfToken }, body: JSON.stringify(payload) });
                const data = await response.json(); if (!response.ok) throw new Error(data.detail || "ذخیره رزومه انجام نشد.");
                document.getElementById("consultant-assigned-count").textContent = numberFa(data.assigned_count);
                ["consultant-account-name", "consultant-header-name"].forEach((id) => { const node = document.getElementById(id); if (node) node.textContent = data.full_name; });
                message.textContent = "رزومه و ظرفیت ذخیره شد و در فهرست مشاوران نمایش داده می‌شود.";
            } catch (error) { message.textContent = error.message || "ذخیره رزومه انجام نشد."; }
            finally { button.disabled = false; }
        }, { once: true });
    }

    function initConsultantChangePassword() {
        const form = document.getElementById("consultant-change-password-form");
        const msg = document.getElementById("consultant-pwd-message");
        const btn = document.getElementById("consultant-pwd-btn");
        if (!form) return;

        form.addEventListener("submit", async (e) => {
            e.preventDefault();
            const oldPassword = document.getElementById("c-old-pwd")?.value || "";
            const newPassword = document.getElementById("c-new-pwd")?.value || "";
            const confirmPassword = document.getElementById("c-confirm-pwd")?.value || "";

            if (newPassword !== confirmPassword) {
                msg.style.display = "block";
                msg.style.color = "#dc2626";
                msg.textContent = "تکرار رمز عبور جدید یکسان نیست.";
                return;
            }
            if (newPassword.length < 8) {
                msg.style.display = "block";
                msg.style.color = "#dc2626";
                msg.textContent = "رمز عبور جدید باید حداقل ۸ کاراکتر باشد.";
                return;
            }

            btn.disabled = true;
            msg.style.display = "block";
            msg.style.color = "#2563eb";
            msg.textContent = "در حال تغییر رمز عبور…";

            try {
                const csrf = await fetch("/api/auth/csrf/", { credentials: "same-origin" }).then(r => r.json());
                const res = await fetch("/api/auth/password/change/", {
                    method: "POST",
                    credentials: "same-origin",
                    headers: { "Content-Type": "application/json", "X-CSRFToken": csrf.csrfToken },
                    body: JSON.stringify({
                        old_password: oldPassword,
                        new_password: newPassword,
                        new_password_confirm: confirmPassword
                    })
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data.detail || "تغییر رمز عبور انجام نشد.");
                msg.style.color = "#16a34a";
                msg.textContent = data.detail || "رمز عبور با موفقیت تغییر کرد.";
                form.reset();
            } catch (err) {
                msg.style.color = "#dc2626";
                msg.textContent = err.message;
            } finally {
                btn.disabled = false;
            }
        });
    }

    async function loadManagerSupportRoom() {
        const status=document.getElementById("consultant-manager-chat-status");
        const createButton=document.getElementById("consultant-manager-chat-create");
        const openLink=document.getElementById("consultant-manager-chat-open");
        if(!status||!createButton||!openLink)return;
        const showRoom=(conversation)=>{status.textContent="گفت‌وگوی خصوصی با مدیر مجموعه";openLink.href=`consultation-chat.html?staff=${encodeURIComponent(conversation.id)}`;openLink.hidden=false;createButton.hidden=true;};
        try {
            const response=await fetch("/api/consultations/staff-conversations/",{credentials:"same-origin"});const data=await response.json();if(!response.ok)throw new Error(data.detail||"اتاق مدیر دریافت نشد.");
            if(data.conversation)showRoom(data.conversation);else{status.textContent="هنوز گفت‌وگویی با مدیر شروع نشده است.";createButton.hidden=false;}
        }catch(error){status.textContent=error.message||"دریافت اتاق مدیر ممکن نشد.";}
        createButton.addEventListener("click",async()=>{createButton.disabled=true;status.textContent="در حال ایجاد اتاق…";try{const csrf=await fetch("/api/auth/csrf/",{credentials:"same-origin"}).then(r=>r.json());const response=await fetch("/api/consultations/staff-conversations/",{method:"POST",credentials:"same-origin",headers:{"X-CSRFToken":csrf.csrfToken}});const data=await response.json();if(!response.ok)throw new Error(data.detail||"ساخت اتاق گفتگو انجام نشد.");showRoom(data.conversation);}catch(error){status.textContent=error.message;createButton.disabled=false;}});
    }

    const plannerPicker = document.getElementById("planner-student");
    const plannerWeek = document.getElementById("consultant-study-week");
    const plannerForm = document.getElementById("planner-session-form");
    let assignedFilterTimeout;
    ["consultant-student-search","consultant-student-grade","consultant-student-major","consultant-student-gender"].forEach(id=>document.getElementById(id)?.addEventListener("input",()=>{clearTimeout(assignedFilterTimeout);assignedFilterTimeout=setTimeout(loadAssignedStudents,220);}));
    const plannerColors = {mint:"#dff2e6",blue:"#e2efff",peach:"#ffeadc",lavender:"#efe8ff",rose:"#ffe5eb",yellow:"#fff3c9"};
    async function loadPlannerWeek() {
        if (!plannerPicker?.value || !plannerWeek) return;
        const loading = document.createElement("p");
        loading.className = "consultant-article-hint";
        loading.textContent = "در حال بارگذاری برنامه…";
        plannerWeek.replaceChildren(loading);

        try {
            const url = `/api/consultations/study-sessions/?student=${encodeURIComponent(plannerPicker.value)}${currentWeekStartIso ? `&week_start=${currentWeekStartIso}` : ""}`;
            const response = await fetch(url, { credentials: "same-origin" });
            const data = await response.json();
            if (!response.ok) throw new Error(data.detail || "برنامه دریافت نشد.");

            // Update heading week title and status badge
            const weekTitle = document.getElementById("consultant-study-week-title");
            const weekBadge = document.getElementById("consultant-study-week-badge");
            if (weekTitle) {
                const currentWeekData = studentWeeksArchive.find(w => w.week_start === currentWeekStartIso);
                const wLabel = currentWeekData ? currentWeekData.label : getShamsiWeekDate(currentWeekOffset).label;
                weekTitle.textContent = `پیش‌نمایش برنامه: ${wLabel}`;
                if (weekBadge) {
                    if (currentWeekData?.is_current || currentWeekOffset === 0) {
                        weekBadge.className = "planner-week-badge";
                        weekBadge.textContent = "هفته جاری";
                    } else if (currentWeekData?.is_past || currentWeekOffset < 0) {
                        weekBadge.className = "planner-week-badge is-past";
                        weekBadge.textContent = "هفته گذشته";
                    } else {
                        weekBadge.className = "planner-week-badge is-future";
                        weekBadge.textContent = "برنامه‌ریزی آینده";
                    }
                }
            }

            const names = ["شنبه", "یکشنبه", "دوشنبه", "سه‌شنبه", "چهارشنبه", "پنجشنبه", "جمعه"];
            const grid = document.createElement("div");
            grid.className = "planner-week-grid";

            names.forEach((day, index) => {
                const col = document.createElement("section");
                col.className = "planner-day";
                col.dataset.weekday = String(index);

                // Drag & Drop event listeners on day column
                col.addEventListener("dragover", (e) => {
                    e.preventDefault();
                    e.dataTransfer.dropEffect = "move";
                    col.classList.add("is-drag-over");
                });

                col.addEventListener("dragleave", (e) => {
                    if (!col.contains(e.relatedTarget)) {
                        col.classList.remove("is-drag-over");
                    }
                });

                col.addEventListener("drop", async (e) => {
                    e.preventDefault();
                    col.classList.remove("is-drag-over");
                    const sessionId = e.dataTransfer.getData("text/plain");
                    if (!sessionId) return;
                    const targetWeekday = index;

                    try {
                        const csrfToken = await getFreshCsrfToken();
                        const updateRes = await fetch(`/api/consultations/study-sessions/${sessionId}/update/`, {
                            method: "POST",
                            credentials: "same-origin",
                            headers: { "Content-Type": "application/json", "X-CSRFToken": csrfToken },
                            body: JSON.stringify({ weekday: targetWeekday })
                        });
                        const text = await updateRes.text();
                        let result;
                        try { result = JSON.parse(text); } catch (err) { result = {}; }
                        if (!updateRes.ok) throw new Error(result.detail || "جابه‌جایی روز انجام نشد.");
                        await loadPlannerWeek();
                    } catch (err) {
                        alert("خطا در جابه‌جایی برنامه: " + err.message);
                    }
                });

                const h = document.createElement("h4");
                h.textContent = day;
                col.append(h);

                const rows = data.results.filter(x => x.weekday === index);
                if (!rows.length) {
                    const empty = document.createElement("span");
                    empty.className = "planner-day-empty";
                    empty.textContent = "بدون برنامه";
                    col.append(empty);
                }

                rows.forEach((item) => {
                    const card = document.createElement("article");
                    card.className = "planner-session-card";
                    card.draggable = true;
                    card.style.setProperty("--plan-color", plannerColors[item.color] || plannerColors.mint);

                    // Card header with drag handle and actions
                    const cardTop = document.createElement("div");
                    cardTop.className = "planner-card-top";

                    const dragHandle = document.createElement("div");
                    dragHandle.className = "session-drag-handle";
                    dragHandle.title = "جابه‌جایی درس (کشیدن با ماوس یا لمس رو موبایل)";
                    dragHandle.innerHTML = getFormalSvgIcon("drag");

                    const btnGroup = document.createElement("div");
                    btnGroup.className = "planner-card-btn-group";

                    // Move / Transfer button
                    const moveBtn = document.createElement("button");
                    moveBtn.type = "button";
                    moveBtn.className = "planner-card-move-btn";
                    moveBtn.title = "انتقال به روز دیگر";
                    moveBtn.innerHTML = getFormalSvgIcon("move");
                    moveBtn.addEventListener("click", async (e) => {
                        e.stopPropagation();
                        const dayNames = ["شنبه", "یکشنبه", "دوشنبه", "سه‌شنبه", "چهارشنبه", "پنجشنبه", "جمعه"];
                        const promptText = `سهمیه «${item.subject}» به کدام روز منتقل شود؟\n\n` +
                            dayNames.map((d, i) => `${i}: ${d}`).join("\n") +
                            `\n\n(شماره روز ۰ تا ۶ را وارد کنید. روز فعلی: ${dayNames[item.weekday]})`;
                        const targetInput = prompt(promptText, String(item.weekday));
                        if (targetInput === null) return;
                        const targetWeekday = parseInt(targetInput.trim(), 10);
                        if (isNaN(targetWeekday) || targetWeekday < 0 || targetWeekday > 6) {
                            alert("لطفاً عددی بین ۰ تا ۶ وارد نمایید.");
                            return;
                        }
                        if (targetWeekday === item.weekday) return;

                        moveBtn.disabled = true;
                        try {
                            const csrfToken = await getFreshCsrfToken();
                            const updRes = await fetch(`/api/consultations/study-sessions/${item.id}/update/`, {
                                method: "POST",
                                credentials: "same-origin",
                                headers: { "Content-Type": "application/json", "X-CSRFToken": csrfToken },
                                body: JSON.stringify({ weekday: targetWeekday })
                            });
                            const text = await updRes.text();
                            let result;
                            try { result = JSON.parse(text); } catch (err) { result = {}; }
                            if (!updRes.ok) throw new Error(result.detail || "انتقال سهمیه انجام نشد.");
                            await loadPlannerWeek();
                        } catch (err) {
                            alert("خطا در انتقال سهمیه: " + err.message);
                            moveBtn.disabled = false;
                        }
                    });

                    // Delete button
                    const deleteBtn = document.createElement("button");
                    deleteBtn.type = "button";
                    deleteBtn.className = "planner-card-delete-btn";
                    deleteBtn.title = "حذف این سهمیه مطالعه";
                    deleteBtn.innerHTML = getFormalSvgIcon("trash");
                    deleteBtn.addEventListener("click", async (e) => {
                        e.stopPropagation();
                        if (!confirm(`آیا از حذف سهمیه «${item.subject}» مطمئن هستید؟`)) return;
                        deleteBtn.disabled = true;
                        try {
                            const csrfToken = await getFreshCsrfToken();
                            const delRes = await fetch(`/api/consultations/study-sessions/${item.id}/delete/`, {
                                method: "POST",
                                credentials: "same-origin",
                                headers: { "X-CSRFToken": csrfToken }
                            });
                            const text = await delRes.text();
                            let result;
                            try { result = JSON.parse(text); } catch (err) { result = {}; }
                            if (!delRes.ok) throw new Error(result.detail || "حذف سهمیه انجام نشد.");
                            await loadPlannerWeek();
                        } catch (err) {
                            alert("خطا در حذف سهمیه: " + err.message);
                            deleteBtn.disabled = false;
                        }
                    });

                    btnGroup.append(moveBtn, deleteBtn);
                    cardTop.append(dragHandle, btnGroup);
                    card.append(cardTop);

                    // Desktop Mouse Drag event listeners
                    card.addEventListener("dragstart", (e) => {
                        e.dataTransfer.setData("text/plain", String(item.id));
                        card.classList.add("is-dragging");
                    });

                    card.addEventListener("dragend", () => {
                        card.classList.remove("is-dragging");
                    });

                    // Mobile Touch Drag & Drop logic
                    let touchStartX = 0;
                    let touchStartY = 0;
                    let isTouchDragging = false;
                    let ghostCard = null;
                    let activeTargetCol = null;

                    const onTouchStart = (e) => {
                        if (e.touches.length !== 1) return;
                        touchStartX = e.touches[0].clientX;
                        touchStartY = e.touches[0].clientY;
                        isTouchDragging = false;
                    };

                    const onTouchMove = (e) => {
                        if (e.touches.length !== 1) return;
                        const touch = e.touches[0];
                        const dx = touch.clientX - touchStartX;
                        const dy = touch.clientY - touchStartY;

                        if (!isTouchDragging && (Math.abs(dx) > 8 || Math.abs(dy) > 8)) {
                            isTouchDragging = true;
                            card.classList.add("is-dragging");
                            ghostCard = card.cloneNode(true);
                            ghostCard.className = "planner-session-card touch-ghost-card";
                            document.body.appendChild(ghostCard);
                        }

                        if (isTouchDragging && ghostCard) {
                            if (e.cancelable) e.preventDefault();
                            ghostCard.style.left = `${touch.clientX}px`;
                            ghostCard.style.top = `${touch.clientY}px`;

                            if (plannerWeek) {
                                const rect = plannerWeek.getBoundingClientRect();
                                if (touch.clientX < rect.left + 50) {
                                    plannerWeek.scrollLeft -= 14;
                                } else if (touch.clientX > rect.right - 50) {
                                    plannerWeek.scrollLeft += 14;
                                }
                            }

                            const elemUnder = document.elementFromPoint(touch.clientX, touch.clientY);
                            const colUnder = elemUnder ? elemUnder.closest(".planner-day") : null;

                            if (colUnder !== activeTargetCol) {
                                if (activeTargetCol) activeTargetCol.classList.remove("is-drag-over");
                                activeTargetCol = colUnder;
                                if (activeTargetCol) activeTargetCol.classList.add("is-drag-over");
                            }
                        }
                    };

                    const onTouchEnd = async (e) => {
                        if (ghostCard) {
                            ghostCard.remove();
                            ghostCard = null;
                        }
                        card.classList.remove("is-dragging");

                        if (isTouchDragging && activeTargetCol) {
                            activeTargetCol.classList.remove("is-drag-over");
                            const targetWeekday = Number(activeTargetCol.dataset.weekday);
                            isTouchDragging = false;

                            if (!isNaN(targetWeekday) && targetWeekday !== item.weekday) {
                                try {
                                    const csrfToken = await getFreshCsrfToken();
                                    const updateRes = await fetch(`/api/consultations/study-sessions/${item.id}/update/`, {
                                        method: "POST",
                                        credentials: "same-origin",
                                        headers: { "Content-Type": "application/json", "X-CSRFToken": csrfToken },
                                        body: JSON.stringify({ weekday: targetWeekday })
                                    });
                                    if (!updateRes.ok) throw new Error("انتقال انجام نشد.");
                                    await loadPlannerWeek();
                                } catch (err) {
                                    alert("خطا در جابه‌جایی درس: " + err.message);
                                }
                            }
                        }
                        if (activeTargetCol) activeTargetCol.classList.remove("is-drag-over");
                        activeTargetCol = null;
                        isTouchDragging = false;
                    };

                    const onTouchCancel = () => {
                        if (ghostCard) {
                            ghostCard.remove();
                            ghostCard = null;
                        }
                        card.classList.remove("is-dragging");
                        if (activeTargetCol) activeTargetCol.classList.remove("is-drag-over");
                        activeTargetCol = null;
                        isTouchDragging = false;
                    };

                    dragHandle.addEventListener("touchstart", onTouchStart, { passive: true });
                    dragHandle.addEventListener("touchmove", onTouchMove, { passive: false });
                    dragHandle.addEventListener("touchend", onTouchEnd);
                    dragHandle.addEventListener("touchcancel", onTouchCancel);

                    card.addEventListener("touchstart", onTouchStart, { passive: true });
                    card.addEventListener("touchmove", onTouchMove, { passive: false });
                    card.addEventListener("touchend", onTouchEnd);
                    card.addEventListener("touchcancel", onTouchCancel);

                    const time = document.createElement("span");
                    time.className = "planner-session-time";
                    time.textContent = `${numberFa(Math.floor(item.planned_minutes / 60))} ساعت و ${numberFa(item.planned_minutes % 60)} دقیقه`;

                    const subject = document.createElement("strong");
                    subject.textContent = item.subject;

                    const task = document.createElement("span");
                    task.textContent = item.mode === "test"
                        ? `${numberFa(item.test_count)} تست`
                        : item.mode === "written"
                        ? "حل تشریحی"
                        : "مطالعهٔ درس‌نامه";

                    card.append(time, subject, task);

                    if (item.instructions) {
                        const note = document.createElement("small");
                        note.textContent = item.instructions;
                        card.append(note);
                    }

                    col.append(card);
                });

                grid.append(col);
            });

            plannerWeek.replaceChildren(grid);
        } catch (error) {
            plannerWeek.textContent = error.message;
        }
    }

    function getSubjectCategory(subject) {
        if (!subject) return "general";
        const s = subject.toLocaleLowerCase("fa");
        if (s.includes("شیمی")) return "chemistry";
        if (s.includes("زیست")) return "biology";
        if (s.includes("ریاضی") || s.includes("حسابان") || s.includes("هندسه") || s.includes("آمار")) return "math";
        if (s.includes("فیزیک")) return "physics";
        return "general";
    }

    function renderStudentReportsView() {
        const target = document.getElementById("consultant-study-reports");
        if (!target) return;
        target.replaceChildren();

        // 1. Filter by date range
        let filtered = currentStudentReports.slice();
        if (reportsDateRange.start) {
            filtered = filtered.filter(r => (r.study_date || "") >= reportsDateRange.start);
        }
        if (reportsDateRange.end) {
            filtered = filtered.filter(r => (r.study_date || "") <= reportsDateRange.end);
        }

        // 2. Sort by study_date
        filtered.sort((a, b) => {
            const dateA = a.study_date || "";
            const dateB = b.study_date || "";
            if (reportsDateSortOrder === "asc") {
                return dateA.localeCompare(dateB) || (a.id - b.id);
            }
            return dateB.localeCompare(dateA) || (b.id - a.id);
        });

        // 3. Update total badge & active filter bar
        const totalBadge = document.getElementById("dossierReportsTotalBadge");
        if (totalBadge) {
            totalBadge.textContent = `${numberFa(currentStudentReports.length)} گزارش`;
        }

        const activeBar = document.getElementById("reportsActiveFiltersBar");
        const rangeText = document.getElementById("reportsDateRangeText");
        const countText = document.getElementById("reportsFilteredCount");
        const triggerLabel = document.getElementById("jalaliDateRangeLabel");

        if (reportsDateRange.start || reportsDateRange.end) {
            if (activeBar) activeBar.style.display = "flex";
            const startFa = formatJalaliDisplay(reportsDateRange.start, "short") || "ابتدای دوره";
            const endFa = formatJalaliDisplay(reportsDateRange.end, "short") || "امروز";
            const labelStr = `از ${startFa} تا ${endFa}`;
            if (rangeText) rangeText.textContent = labelStr;
            if (triggerLabel) triggerLabel.textContent = `بازه: ${labelStr}`;
            if (countText) countText.textContent = `نمایش ${numberFa(filtered.length)} از ${numberFa(currentStudentReports.length)} گزارش`;
        } else {
            if (activeBar) activeBar.style.display = "none";
            if (triggerLabel) triggerLabel.textContent = "بازه زمانی: همه گزارش‌ها";
        }

        if (!filtered.length) {
            const empty = document.createElement("div");
            empty.className = "glass-articles-empty";
            empty.innerHTML = `
                <div class="glass-articles-empty-icon">${getFormalSvgIcon("calendar")}</div>
                <h4>${currentStudentReports.length === 0 ? "هنوز گزارشی ثبت نشده است" : "گزارشی در این بازهٔ زمانی یافت نشد"}</h4>
                <p>${currentStudentReports.length === 0 ? "گزارش‌های روزانه دانش‌آموز هر شب ساعت ۱۲ قطعی شده و در اینجا به نمایش درمی‌آیند." : "می‌توانید با کلیک روی دکمهٔ بازه زمانی، تاریخ دیگری را انتخاب یا فیلتر را حذف کنید."}</p>
            `;
            target.append(empty);
            return;
        }

        // 4. Render 3D Glassmorphic Quote / Speech Bubble Cards
        filtered.forEach(report => {
            const card = document.createElement("article");
            card.className = "study-report-quote-card";

            const header = document.createElement("div");
            header.className = "report-bubble-header";

            const subjectGroup = document.createElement("div");
            subjectGroup.className = "report-subject-group";

            const cat = getSubjectCategory(report.subject);
            const badge = document.createElement("span");
            badge.className = `report-subject-badge report-subject-badge--${cat}`;
            badge.innerHTML = `${getFormalSvgIcon(cat === "math" ? "math" : cat === "biology" ? "biology" : cat === "physics" ? "physics" : cat === "chemistry" ? "chemistry" : "book")} <span>${report.subject}</span>`;

            const duration = document.createElement("span");
            duration.className = "report-duration-chip";
            const hrs = Math.floor(report.minutes / 60);
            const mins = report.minutes % 60;
            const durText = hrs > 0 ? (mins > 0 ? `${numberFa(hrs)} ساعت و ${numberFa(mins)} دقیقه` : `${numberFa(hrs)} ساعت`) : `${numberFa(mins)} دقیقه`;
            duration.innerHTML = `${getFormalSvgIcon("clock")} <span>${durText}</span>`;

            subjectGroup.append(badge, duration);

            const metaRight = document.createElement("div");
            metaRight.className = "report-header-meta";

            const dateChip = document.createElement("span");
            dateChip.className = "report-date-chip";
            const jalaliFull = formatJalaliDisplay(report.study_date, "full");
            dateChip.innerHTML = `${getFormalSvgIcon("calendar")} <span>${jalaliFull}</span>`;

            const midnightTag = document.createElement("span");
            midnightTag.className = "report-midnight-tag";
            midnightTag.innerHTML = `${getFormalSvgIcon("check")} <span>ارسال ۱۲ شب</span>`;

            metaRight.append(dateChip, midnightTag);
            header.append(subjectGroup, metaRight);

            // Quote bubble for Student's comment/notes
            const quoteBubble = document.createElement("div");
            quoteBubble.className = "report-quote-bubble";

            const quoteIcon = document.createElement("div");
            quoteIcon.className = "report-quote-icon";
            quoteIcon.textContent = "“";

            const quoteContent = document.createElement("div");
            quoteContent.className = "report-quote-content";

            if (report.notes && report.notes.trim()) {
                const noteText = document.createElement("p");
                noteText.className = "report-quote-text";
                noteText.textContent = report.notes;
                quoteContent.append(noteText);
            } else {
                const emptyNote = document.createElement("p");
                emptyNote.className = "report-quote-empty";
                emptyNote.textContent = "مطالعه انجام شد بدون یادداشت اضافه";
                quoteContent.append(emptyNote);
            }

            quoteBubble.append(quoteIcon, quoteContent);
            card.append(header, quoteBubble);
            target.append(card);
        });
    }

    async function loadStudyReports() {
        const target = document.getElementById("consultant-study-reports");
        if (!target || !plannerPicker?.value) return;
        target.innerHTML = `<p class="consultant-article-hint">در حال بارگذاری گزارش‌های مطالعه…</p>`;
        try {
            const response = await fetch(`/api/consultations/study-reports/?student=${encodeURIComponent(plannerPicker.value)}`, { credentials: "same-origin" });
            const data = await response.json();
            if (!response.ok) throw new Error(data.detail || "گزارش‌ها دریافت نشد.");
            currentStudentReports = data.results || [];
            initJalaliDatePicker();
            renderStudentReportsView();
        } catch (error) {
            target.innerHTML = `<p class="consultant-article-hint">${error.message || "خطا در دریافت گزارش‌ها"}</p>`;
        }
    }

    let isJalaliPickerInitialized = false;
    function initJalaliDatePicker() {
        if (isJalaliPickerInitialized) return;
        isJalaliPickerInitialized = true;

        const triggerBtn = document.getElementById("jalaliDateRangePickerBtn");
        const backdrop = document.getElementById("jalaliPickerBackdrop");
        const closeBtn = document.getElementById("jalaliPickerCloseBtn");
        const prevMonthBtn = document.getElementById("jalaliPrevMonthBtn");
        const nextMonthBtn = document.getElementById("jalaliNextMonthBtn");
        const monthLabel = document.getElementById("jalaliCurrentMonthLabel");
        const daysGrid = document.getElementById("jalaliDaysGrid");
        const resetBtn = document.getElementById("jalaliResetFilterBtn");
        const applyBtn = document.getElementById("jalaliApplyFilterBtn");
        const clearTagBtn = document.getElementById("reportsClearDateBtn");
        const sortSelect = document.getElementById("reportsDateSort");
        const rangeStartDisplay = document.getElementById("rangeStartDisplay");
        const rangeEndDisplay = document.getElementById("rangeEndDisplay");
        const rangeStartBox = document.getElementById("rangeStartBox");
        const rangeEndBox = document.getElementById("rangeEndBox");
        const presetChips = document.querySelectorAll(".jalali-quick-presets .preset-chip");

        const todayObj = new Date();
        const todayJalali = gregorianToJalali(todayObj.getFullYear(), todayObj.getMonth() + 1, todayObj.getDate());
        const todayIso = toIsoDate(todayObj.getFullYear(), todayObj.getMonth() + 1, todayObj.getDate());

        let viewJy = todayJalali.jy;
        let viewJm = todayJalali.jm;
        let tempStartIso = reportsDateRange.start;
        let tempEndIso = reportsDateRange.end;
        let pickingStep = "start"; // 'start' or 'end'

        function openPicker() {
            tempStartIso = reportsDateRange.start;
            tempEndIso = reportsDateRange.end;
            pickingStep = tempStartIso ? "end" : "start";
            if (tempStartIso) {
                const parts = tempStartIso.split("-").map(Number);
                const j = gregorianToJalali(parts[0], parts[1], parts[2]);
                viewJy = j.jy;
                viewJm = j.jm;
            } else {
                viewJy = todayJalali.jy;
                viewJm = todayJalali.jm;
            }
            if (backdrop) backdrop.style.display = "flex";
            if (triggerBtn) triggerBtn.classList.add("is-open");
            renderCalendar();
        }

        function closePicker() {
            if (backdrop) backdrop.style.display = "none";
            if (triggerBtn) triggerBtn.classList.remove("is-open");
        }

        triggerBtn?.addEventListener("click", openPicker);
        closeBtn?.addEventListener("click", closePicker);
        backdrop?.addEventListener("click", (e) => {
            if (e.target === backdrop) closePicker();
        });

        clearTagBtn?.addEventListener("click", () => {
            reportsDateRange = { start: null, end: null };
            tempStartIso = null;
            tempEndIso = null;
            presetChips.forEach(c => c.classList.toggle("active", c.dataset.preset === "all"));
            renderStudentReportsView();
        });

        sortSelect?.addEventListener("change", (e) => {
            reportsDateSortOrder = e.target.value;
            renderStudentReportsView();
        });

        prevMonthBtn?.addEventListener("click", () => {
            viewJm--;
            if (viewJm < 1) {
                viewJm = 12;
                viewJy--;
            }
            renderCalendar();
        });

        nextMonthBtn?.addEventListener("click", () => {
            viewJm++;
            if (viewJm > 12) {
                viewJm = 1;
                viewJy++;
            }
            renderCalendar();
        });

        presetChips.forEach(chip => {
            chip.addEventListener("click", () => {
                presetChips.forEach(c => c.classList.toggle("active", c === chip));
                const p = chip.dataset.preset;
                const now = new Date();
                const nowIso = toIsoDate(now.getFullYear(), now.getMonth() + 1, now.getDate());

                if (p === "all") {
                    tempStartIso = null;
                    tempEndIso = null;
                } else if (p === "today") {
                    tempStartIso = nowIso;
                    tempEndIso = nowIso;
                    viewJy = todayJalali.jy;
                    viewJm = todayJalali.jm;
                } else if (p === "last7") {
                    const d = new Date(now);
                    d.setDate(d.getDate() - 6);
                    tempStartIso = toIsoDate(d.getFullYear(), d.getMonth() + 1, d.getDate());
                    tempEndIso = nowIso;
                    viewJy = todayJalali.jy;
                    viewJm = todayJalali.jm;
                } else if (p === "last30") {
                    const d = new Date(now);
                    d.setDate(d.getDate() - 29);
                    tempStartIso = toIsoDate(d.getFullYear(), d.getMonth() + 1, d.getDate());
                    tempEndIso = nowIso;
                    viewJy = todayJalali.jy;
                    viewJm = todayJalali.jm;
                } else if (p === "thisMonth") {
                    const m1 = jalaliToGregorian(todayJalali.jy, todayJalali.jm, 1);
                    const mEnd = jalaliToGregorian(todayJalali.jy, todayJalali.jm, jalaliMonthDays(todayJalali.jy, todayJalali.jm));
                    tempStartIso = toIsoDate(m1.gy, m1.gm, m1.gd);
                    tempEndIso = toIsoDate(mEnd.gy, mEnd.gm, mEnd.gd);
                    viewJy = todayJalali.jy;
                    viewJm = todayJalali.jm;
                }
                pickingStep = "start";
                renderCalendar();
            });
        });

        resetBtn?.addEventListener("click", () => {
            tempStartIso = null;
            tempEndIso = null;
            reportsDateRange = { start: null, end: null };
            presetChips.forEach(c => c.classList.toggle("active", c.dataset.preset === "all"));
            closePicker();
            renderStudentReportsView();
        });

        applyBtn?.addEventListener("click", () => {
            if (tempStartIso && !tempEndIso) {
                tempEndIso = tempStartIso;
            }
            if (tempStartIso && tempEndIso && tempStartIso > tempEndIso) {
                const swap = tempStartIso;
                tempStartIso = tempEndIso;
                tempEndIso = swap;
            }
            reportsDateRange = { start: tempStartIso, end: tempEndIso };
            closePicker();
            renderStudentReportsView();
        });

        function renderCalendar() {
            if (monthLabel) {
                monthLabel.textContent = `${jalaliMonthNames[viewJm - 1]} ${numberFa(viewJy)}`;
            }

            if (rangeStartDisplay) {
                rangeStartDisplay.textContent = tempStartIso ? formatJalaliDisplay(tempStartIso, "short") : "انتخاب نشده";
            }
            if (rangeEndDisplay) {
                rangeEndDisplay.textContent = tempEndIso ? formatJalaliDisplay(tempEndIso, "short") : "انتخاب نشده";
            }

            if (rangeStartBox && rangeEndBox) {
                rangeStartBox.classList.toggle("is-active", pickingStep === "start");
                rangeEndBox.classList.toggle("is-active", pickingStep === "end");
            }

            if (!daysGrid) return;
            daysGrid.replaceChildren();

            const totalMonthDays = jalaliMonthDays(viewJy, viewJm);
            const firstGreg = jalaliToGregorian(viewJy, viewJm, 1);
            const firstDateObj = new Date(Date.UTC(firstGreg.gy, firstGreg.gm - 1, firstGreg.gd));
            const startWeekday = (firstDateObj.getUTCDay() + 1) % 7; // 0=Sat ... 6=Fri

            // Empty prefix cells
            for (let i = 0; i < startWeekday; i++) {
                const emptyCell = document.createElement("div");
                emptyCell.className = "jalali-day-cell is-empty";
                daysGrid.append(emptyCell);
            }

            // Month days
            for (let day = 1; day <= totalMonthDays; day++) {
                const greg = jalaliToGregorian(viewJy, viewJm, day);
                const cellIso = toIsoDate(greg.gy, greg.gm, greg.gd);

                const btn = document.createElement("button");
                btn.type = "button";
                btn.className = "jalali-day-cell";
                btn.textContent = numberFa(day);

                if (cellIso === todayIso) {
                    btn.classList.add("is-today");
                }

                if (tempStartIso && !tempEndIso && cellIso === tempStartIso) {
                    btn.classList.add("is-range-single");
                } else if (tempStartIso && tempEndIso) {
                    if (cellIso === tempStartIso && cellIso === tempEndIso) {
                        btn.classList.add("is-range-single");
                    } else if (cellIso === tempStartIso) {
                        btn.classList.add("is-range-start");
                    } else if (cellIso === tempEndIso) {
                        btn.classList.add("is-range-end");
                    } else if (cellIso > tempStartIso && cellIso < tempEndIso) {
                        btn.classList.add("is-in-range");
                    }
                }

                btn.addEventListener("click", () => {
                    presetChips.forEach(c => c.classList.remove("active"));
                    if (pickingStep === "start" || !tempStartIso) {
                        tempStartIso = cellIso;
                        tempEndIso = null;
                        pickingStep = "end";
                    } else {
                        if (cellIso < tempStartIso) {
                            tempEndIso = tempStartIso;
                            tempStartIso = cellIso;
                        } else {
                            tempEndIso = cellIso;
                        }
                        pickingStep = "start";
                    }
                    renderCalendar();
                });

                daysGrid.append(btn);
            }
        }
    }

    plannerPicker?.addEventListener("change", () => {
        loadPlannerWeek();
        loadStudyReports();
    });

    plannerForm?.addEventListener("submit", async (event) => {
        event.preventDefault();
        const message = document.getElementById("planner-form-message");
        const studentId = plannerPicker?.value;
        if (!studentId) {
            message.textContent = "اول دانش‌آموز را انتخاب کنید.";
            return;
        }
        const button = plannerForm.querySelector('button[type="submit"]');
        if (button) button.disabled = true;
        message.textContent = "در حال ذخیره…";

        try {
            const csrfToken = await getFreshCsrfToken();
            const payload = Object.fromEntries(new FormData(plannerForm));
            payload.student_id = Number(studentId);

            if (currentWeekStartIso) {
                payload.week_start_date = currentWeekStartIso;
            }

            if (!payload.subject || !payload.subject.trim()) {
                message.textContent = "لطفاً ابتدا کتاب و فصل درسی را انتخاب یا وارد کنید.";
                if (button) button.disabled = false;
                return;
            }

            const response = await fetch("/api/consultations/study-sessions/create/", {
                method: "POST",
                credentials: "same-origin",
                headers: { "Content-Type": "application/json", "X-CSRFToken": csrfToken },
                body: JSON.stringify(payload)
            });

            const text = await response.text();
            let result;
            try {
                result = JSON.parse(text);
            } catch (jsonErr) {
                result = { detail: `خطا در ارتباط با سرور (${response.status})` };
            }

            if (!response.ok) throw new Error(result.detail || "ذخیره برنامه انجام نشد.");

            message.textContent = "سهمیهٔ مطالعه به برنامهٔ دانش‌آموز اضافه شد.";
            plannerForm.reset();
            document.getElementById("curriculumResetBtn")?.click();
            await loadPlannerWeek();
            await loadStudyReports();
        } catch (error) {
            message.textContent = error.message;
        } finally {
            if (button) button.disabled = false;
        }
    });

    let reportsFilterTimeout;
    ["consultant-report-search", "consultant-report-grade", "consultant-report-major"].forEach(id => {
        document.getElementById(id)?.addEventListener("input", () => {
            clearTimeout(reportsFilterTimeout);
            reportsFilterTimeout = setTimeout(loadDailyStudyReports, 250);
        });
    });

    async function loadDailyStudyReports() {
        const target = document.getElementById("consultant-grouped-reports");
        if (!target) return;
        const search = normalizeDigits((document.getElementById("consultant-report-search")?.value || "").trim()).toLocaleLowerCase("fa");
        const grade = document.getElementById("consultant-report-grade")?.value || "";
        const major = document.getElementById("consultant-report-major")?.value || "";
        const countBadge = document.getElementById("consultant-report-filter-count");

        target.replaceChildren();
        const loading = document.createElement("p");
        loading.className = "consultant-article-hint";
        loading.textContent = "در حال دریافت گزارش‌های مطالعه…";
        target.append(loading);

        try {
            const params = new URLSearchParams();
            if (search) params.set("q", search);
            if (grade) params.set("grade", grade);
            if (major) params.set("major", major);

            const response = await fetch(`/api/consultations/study-reports/?${params.toString()}`, { credentials: "same-origin" });
            const data = await response.json();
            if (!response.ok) throw new Error(data.detail || "دریافت گزارش‌ها انجام نشد.");

            target.replaceChildren();
            const reports = data.results || [];

            const byStudent = new Map();
            reports.forEach(r => {
                if (!byStudent.has(r.student_id)) {
                    byStudent.set(r.student_id, {
                        student_id: r.student_id,
                        student_name: r.student_name,
                        student_phone: r.student_phone,
                        student_grade: r.student_grade,
                        student_major: r.student_major,
                        reports: []
                    });
                }
                byStudent.get(r.student_id).reports.push(r);
            });

            if (countBadge) {
                countBadge.textContent = `نمایش ${numberFa(byStudent.size)} دانش‌آموز دارای گزارش`;
            }

            if (!byStudent.size) {
                const empty = document.createElement("div");
                empty.className = "consultant-chat-empty";
                empty.textContent = "هنوز گزارشی ثبت نشده است یا با این فیلترها موردی پیدا نشد. (گزارش‌های هر روز ساعت ۱۲ شب ارسال و قطعی می‌شوند)";
                target.append(empty);
                return;
            }

            byStudent.forEach(group => {
                const card = document.createElement("article");
                card.className = "consultant-student-report-group";

                const header = document.createElement("div");
                header.className = "consultant-student-report-header";

                const avatar = document.createElement("span");
                avatar.className = "consultant-chat-room__avatar";
                avatar.textContent = (group.student_name || "د").trim().slice(0, 1);

                const info = document.createElement("div");
                const name = document.createElement("strong");
                name.textContent = group.student_name;
                const meta = document.createElement("span");
                meta.className = "consultant-article-meta";
                meta.textContent = [group.student_phone, group.student_grade, group.student_major].filter(Boolean).join(" · ");
                info.append(name, meta);

                const totalMinutes = group.reports.reduce((sum, r) => sum + (r.minutes || 0), 0);
                const totalBadge = document.createElement("div");
                totalBadge.className = "consultant-report-total-badge";
                totalBadge.textContent = `مجموع: ${numberFa(Math.floor(totalMinutes / 60))} ساعت و ${numberFa(totalMinutes % 60)} دقیقه (${numberFa(group.reports.length)} درس)`;

                header.append(avatar, info, totalBadge);
                card.append(header);

                const list = document.createElement("div");
                list.className = "consultant-student-report-list";

                group.reports.forEach(r => {
                    const row = document.createElement("div");
                    row.className = "consultant-report-item";

                    const rowMain = document.createElement("div");
                    const title = document.createElement("strong");
                    title.textContent = r.subject;
                    const duration = document.createElement("span");
                    duration.className = "consultant-report-duration";
                    duration.textContent = `${numberFa(Math.floor(r.minutes / 60))} ساعت و ${numberFa(r.minutes % 60)} دقیقه`;
                    const date = document.createElement("span");
                    date.className = "consultant-report-date";
                    date.textContent = `تاریخ: ${formatJalaliDisplay(r.study_date, "short")}`;
                    rowMain.append(title, duration, date);

                    if (r.notes) {
                        const note = document.createElement("p");
                        note.className = "consultant-report-notes";
                        note.textContent = `یادداشت دانش‌آموز: ${r.notes}`;
                        rowMain.append(note);
                    }

                    const tag = document.createElement("span");
                    tag.className = "consultant-article-status consultant-article-status--published";
                    tag.textContent = "ارسال‌شده ۱۲ شب";

                    row.append(rowMain, tag);
                    list.append(row);
                });

                card.append(list);
                target.append(card);
            });
        } catch (error) {
            target.textContent = error.message || "خطا در دریافت گزارش‌ها.";
        }
    }

    async function loadTelegramStatus() {
        const statusText = document.getElementById("consultant-telegram-status-text");
        const connectBtn = document.getElementById("consultant-telegram-connect-btn");
        const testBtn = document.getElementById("consultant-telegram-test-btn");
        const disconnectBtn = document.getElementById("consultant-telegram-disconnect-btn");
        if (!statusText || !connectBtn) return;

        try {
            const res = await fetch("/api/consultations/telegram/status/", { credentials: "same-origin" });
            const data = await res.json();
            if (!res.ok) throw new Error(data.detail || "بررسی وضعیت تلگرام انجام نشد.");

            if (data.is_connected) {
                const dateStr = data.connected_at ? new Date(data.connected_at).toLocaleDateString("fa-IR") : "";
                statusText.textContent = `متصل به تلگرام${dateStr ? ` (از تاریخ ${dateStr})` : ""} · گزارش‌های شبانه دانش‌آموزان به تلگرام شما ارسال می‌شوند.`;
                connectBtn.style.display = "none";
                if (testBtn) testBtn.style.display = "inline-flex";
                if (disconnectBtn) disconnectBtn.style.display = "inline-flex";
            } else {
                if (data.deep_link) {
                    connectBtn.href = data.deep_link;
                    connectBtn.style.display = "inline-flex";
                    connectBtn.onclick = null;
                    statusText.textContent = "هنوز حسابی متصل نشده است. روی دکمهٔ اتصال کلیک کرده و در تلگرام Start را بزنید.";
                } else {
                    connectBtn.href = "#";
                    connectBtn.style.display = "inline-flex";
                    connectBtn.onclick = (e) => {
                        e.preventDefault();
                        alert("نام کاربری یا توکن ربات تلگرام هنوز در تنظیمات سرور ثبت نشده است.");
                    };
                    statusText.textContent = "ربات تلگرام در تنظیمات سرور فعال نشده است.";
                }
                if (testBtn) testBtn.style.display = "none";
                if (disconnectBtn) disconnectBtn.style.display = "none";
            }
        } catch (err) {
            statusText.textContent = err.message || "خطا در بررسی وضعیت تلگرام.";
        }
    }

    const testTelegramBtn = document.getElementById("consultant-telegram-test-btn");
    testTelegramBtn?.addEventListener("click", async () => {
        const originalText = testTelegramBtn.textContent;
        testTelegramBtn.disabled = true;
        testTelegramBtn.textContent = "در حال ارسال…";
        try {
            const csrf = await fetch("/api/auth/csrf/", { credentials: "same-origin" }).then(r => r.json());
            const res = await fetch("/api/consultations/telegram/test/", {
                method: "POST",
                credentials: "same-origin",
                headers: { "Content-Type": "application/json", "X-CSRFToken": csrf.csrfToken }
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.detail || "ارسال پیام تستی انجام نشد.");
            alert(data.detail || "پیام تستی با موفقیت به تلگرام شما ارسال شد.");
        } catch (err) {
            alert(err.message || "خطا در ارسال پیام تستی.");
        } finally {
            testTelegramBtn.disabled = false;
            testTelegramBtn.textContent = originalText;
        }
    });

    const disconnectTelegramBtn = document.getElementById("consultant-telegram-disconnect-btn");
    disconnectTelegramBtn?.addEventListener("click", async () => {
        if (!confirm("آیا از قطع اتصال تلگرام اطمینان دارید؟ گزارش‌های شبانه دیگر برای شما ارسال نخواهد شد.")) return;
        disconnectTelegramBtn.disabled = true;
        try {
            const csrf = await fetch("/api/auth/csrf/", { credentials: "same-origin" }).then(r => r.json());
            const res = await fetch("/api/consultations/telegram/disconnect/", {
                method: "POST",
                credentials: "same-origin",
                headers: { "Content-Type": "application/json", "X-CSRFToken": csrf.csrfToken }
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.detail || "قطع اتصال انجام نشد.");
            alert(data.detail || "اتصال تلگرام با موفقیت قطع شد.");
            await loadTelegramStatus();
        } catch (err) {
            alert(err.message || "خطا در قطع اتصال تلگرام.");
        } finally {
            disconnectTelegramBtn.disabled = false;
        }
    });

    function createStudentGlassCard(item, idx) {
        const card = document.createElement("article");
        card.className = "student-glass-card";

        const gradients = [
            ["#6366f1", "#a855f7", "rgba(99, 102, 241, 0.22)"],
            ["#ec4899", "#f43f5e", "rgba(236, 72, 153, 0.22)"],
            ["#06b6d4", "#3b82f6", "rgba(6, 182, 212, 0.22)"],
            ["#10b981", "#059669", "rgba(16, 185, 129, 0.22)"],
            ["#f59e0b", "#d97706", "rgba(245, 158, 11, 0.22)"]
        ];
        const [g1, g2, glow] = gradients[idx % gradients.length];
        card.style.setProperty("--card-glow", glow);

        // Avatar Wrap
        const avatarWrap = document.createElement("div");
        avatarWrap.className = "student-card-avatar-wrap";
        const avatar = document.createElement("div");
        avatar.className = "student-card-avatar";
        avatar.style.setProperty("--avatar-g1", g1);
        avatar.style.setProperty("--avatar-g2", g2);
        avatar.textContent = (item.student_name || "د").trim().slice(0, 1);
        avatarWrap.appendChild(avatar);

        // Name
        const name = document.createElement("h3");
        name.className = "student-card-name";
        name.textContent = item.student_name || "دانش‌آموز";

        // Meta
        const meta = document.createElement("div");
        meta.className = "student-card-meta";
        const metaParts = [
            item.student_grade ? `پایه ${item.student_grade}` : null,
            item.student_major,
            item.student_gender_label && item.student_gender_label !== "ثبت نشده" ? item.student_gender_label : null
        ].filter(Boolean);
        meta.textContent = metaParts.length ? metaParts.join(" · ") : "مشخصات تحصیلی ثبت نشده";

        // Plan Badge
        const plan = document.createElement("span");
        plan.className = "student-card-plan";
        plan.innerHTML = `${getFormalSvgIcon("badge")} <span>پلن ${item.plan_label || "VIP"}</span>`;

        // Actions
        const actions = document.createElement("div");
        actions.className = "student-card-actions";

        const dossierBtn = document.createElement("button");
        dossierBtn.type = "button";
        dossierBtn.className = "student-btn-dossier";
        dossierBtn.innerHTML = `
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
            <span>ورود به صفحه دانش‌آموز</span>
        `;
        dossierBtn.addEventListener("click", (e) => {
            e.preventDefault();
            openStudentDossier(item, true);
        });

        const chatBtn = document.createElement("a");
        chatBtn.className = "student-btn-chat";
        chatBtn.href = `consultation-chat.html?request=${encodeURIComponent(item.id)}`;
        chatBtn.innerHTML = `
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 11.5a8.38 8.38 0 0 1-9 8.5 9.7 9.7 0 0 1-4-.8L3 21l1.8-4.3A8.1 8.1 0 0 1 3 11.5 8.5 8.5 0 0 1 12 3a8.5 8.5 0 0 1 9 8.5Z"/></svg>
            <span>گفت‌وگو</span>
        `;

        actions.append(dossierBtn, chatBtn);
        card.append(avatarWrap, name, meta, plan, actions);
        return card;
    }

    async function loadAssignedStudents() {
        const target = document.getElementById("consultant-assigned-list");
        const dashboardList = document.getElementById("consultant-dashboard-students-list");
        if (!target) return;
        const selectedStudentId = document.getElementById("planner-student")?.value || "";
        try {
            const response = await fetch("/api/consultations/requests/", { credentials: "same-origin" });
            const data = await response.json();
            if (!response.ok) throw new Error(data.detail || "دریافت دانش‌آموزان انجام نشد.");
            
            target.replaceChildren();
            if (dashboardList) dashboardList.replaceChildren();

            const roomTarget = document.getElementById("consultant-chat-rooms");
            const roomCount = document.getElementById("consultant-chat-room-count");
            const statStudents = document.getElementById("consultant-stat-students");
            if (roomTarget) roomTarget.replaceChildren();

            plannerStudents = data.results || [];
            if (roomCount) roomCount.textContent = `${numberFa(plannerStudents.length)} اتاق`;
            if (statStudents) statStudents.textContent = numberFa(plannerStudents.length);

            const picker = document.getElementById("planner-student");
            if (picker) {
                if (picker.tagName === "SELECT") {
                    picker.replaceChildren();
                    if (!plannerStudents.length) {
                        picker.add(new Option("هنوز دانش‌آموزی تخصیص داده نشده", ""));
                        picker.disabled = true;
                    } else {
                        picker.disabled = false;
                        picker.add(new Option("دانش‌آموز را انتخاب کنید", ""));
                        plannerStudents.forEach((item) => picker.add(new Option(item.student_name, item.student_id)));
                        if (plannerStudents.some(item => String(item.student_id) === selectedStudentId)) picker.value = selectedStudentId;
                    }
                } else {
                    if (selectedStudentId) picker.value = selectedStudentId;
                }
            }

            const search = normalizeDigits((document.getElementById("consultant-student-search")?.value || "").trim()).toLocaleLowerCase("fa");
            const grade = document.getElementById("consultant-student-grade")?.value || "";
            const major = document.getElementById("consultant-student-major")?.value || "";
            const gender = document.getElementById("consultant-student-gender")?.value || "";

            const visibleStudents = plannerStudents.filter(item => {
                const matchesSearch = !search || normalizeDigits(`${item.student_name} ${item.student_phone}`).toLocaleLowerCase("fa").includes(search);
                const matchesGrade = !grade || item.student_grade_value === grade;
                const matchesMajor = !major || item.student_major_value === major;
                const matchesGender = !gender || (gender === "unspecified" ? !item.student_gender : item.student_gender === gender);
                return matchesSearch && matchesGrade && matchesMajor && matchesGender;
            });

            const filterCount = document.getElementById("consultant-student-filter-count");
            if (filterCount) filterCount.textContent = `نمایش ${numberFa(visibleStudents.length)} از ${numberFa(plannerStudents.length)} دانش‌آموز`;

            if (!plannerStudents.length) {
                const empty = document.createElement("p");
                empty.className = "consultant-article-hint";
                empty.textContent = "هنوز دانش‌آموزی به شما تخصیص داده نشده است. پس از تأیید مدیر نمایش داده خواهد شد.";
                target.append(empty);

                if (dashboardList) {
                    const emptyDash = document.createElement("p");
                    emptyDash.className = "consultant-article-hint";
                    emptyDash.textContent = "هنوز دانش‌آموزی به شما تخصیص داده نشده است.";
                    dashboardList.append(emptyDash);
                }
                if (roomTarget) {
                    const noRooms = document.createElement("p");
                    noRooms.className = "consultant-chat-empty";
                    noRooms.textContent = "هنوز اتاق گفت‌وگویی ندارید. پس از تخصیص دانش‌آموز، اتاقش اینجا نمایش داده می‌شود.";
                    roomTarget.append(noRooms);
                }
                return;
            }

            // Populate Conversations Chat Rooms
            if (roomTarget) {
                plannerStudents.forEach((item) => {
                    const room = document.createElement("article");
                    room.className = "consultant-chat-room";
                    const avatar = document.createElement("span");
                    avatar.className = "consultant-chat-room__avatar";
                    avatar.textContent = (item.student_name || "د").trim().slice(0, 1);
                    const detail = document.createElement("div");
                    detail.className = "consultant-chat-room__detail";
                    const studentName = document.createElement("strong");
                    studentName.textContent = item.student_name || "دانش‌آموز";
                    const meta = document.createElement("span");
                    meta.textContent = [item.student_grade ? `پایه ${item.student_grade}` : "", item.student_major, `پلن ${item.plan_label}`].filter(Boolean).join(" · ");
                    const preview = document.createElement("small");
                    preview.textContent = "گفت‌وگوی خصوصی با دانش‌آموز";
                    detail.append(studentName, meta, preview);
                    const open = document.createElement("a");
                    open.className = "consultant-chat-room__open";
                    open.href = `consultation-chat.html?request=${encodeURIComponent(item.id)}`;
                    open.textContent = "ورود به اتاق";
                    room.append(avatar, detail, open);
                    roomTarget.append(room);
                });
            }

            // Populate dashboard assigned students with Apple Glass Cards
            if (dashboardList) {
                plannerStudents.forEach((item, idx) => {
                    dashboardList.append(createStudentGlassCard(item, idx));
                });
            }

            // Populate assigned students list with Apple Glass Cards
            if (!visibleStudents.length) {
                const empty = document.createElement("p");
                empty.className = "consultant-chat-empty";
                empty.textContent = "دانش‌آموزی با این فیلترها پیدا نشد.";
                target.append(empty);
            } else {
                visibleStudents.forEach((item, idx) => {
                    target.append(createStudentGlassCard(item, idx));
                });
            }

            // If current URL hash is #student/{id}, automatically open that student's dossier
            const hash = location.hash.slice(1);
            if (hash.startsWith("student/")) {
                const sId = Number(hash.split("/")[1]);
                const found = plannerStudents.find(s => s.student_id === sId);
                if (found) {
                    openStudentDossier(found, false);
                }
            }
        } catch (error) {
            console.error("Failed to load assigned students:", error);
            target.textContent = error.message || "دریافت فهرست انجام نشد.";
        }
    }

    async function openStudentDossier(student, updateHash = true, activeTab = "planner") {
        currentDossierStudent = student;
        if (!student) return;

        // Hide all views, display student dossier
        const allViewIds = [
            "view-dashboard",
            "view-students",
            "view-student-dossier",
            "view-conversations",
            "view-articles",
            "view-profile"
        ];
        allViewIds.forEach(id => {
            const el = document.getElementById(id);
            if (el) el.style.display = (id === "view-student-dossier") ? "block" : "none";
        });

        const dossierSection = document.getElementById("consultant-student-dossier");
        if (dossierSection) dossierSection.style.display = "block";

        const titleEl = document.getElementById("consultantPageTitle");
        if (titleEl) titleEl.textContent = `پرونده تحصیلی: ${student.student_name || "دانش‌آموز"}`;

        document.querySelectorAll(".payeh-consultant__nav-item[data-page]").forEach(item => {
            item.classList.toggle("active", item.dataset.page === "students");
        });

        const avatar = document.getElementById("dossierAvatar");
        if (avatar) avatar.textContent = (student.student_name || "د").trim().slice(0, 1);

        const name = document.getElementById("dossierName");
        if (name) name.textContent = student.student_name || "دانش‌آموز";

        const plan = document.getElementById("dossierPlan");
        if (plan) plan.innerHTML = `${getFormalSvgIcon("badge")} <span>پلن ${student.plan_label || "VIP"}</span>`;

        const meta = document.getElementById("dossierMeta");
        if (meta) {
            meta.replaceChildren();
            const chips = document.createElement("div");
            chips.className = "dossier-meta-chips";
            if (student.student_grade) {
                const c = document.createElement("span");
                c.className = "dossier-meta-chip";
                c.innerHTML = `${getFormalSvgIcon("grade")} <span>پایه ${student.student_grade}</span>`;
                chips.append(c);
            }
            if (student.student_major) {
                const c = document.createElement("span");
                c.className = "dossier-meta-chip";
                c.innerHTML = `${getFormalSvgIcon("book")} <span>${student.student_major}</span>`;
                chips.append(c);
            }
            if (student.student_gender_label && student.student_gender_label !== "ثبت نشده") {
                const c = document.createElement("span");
                c.className = "dossier-meta-chip";
                c.innerHTML = `<span>${student.student_gender_label}</span>`;
                chips.append(c);
            }
            if (student.student_phone) {
                const c = document.createElement("span");
                c.className = "dossier-meta-chip";
                c.innerHTML = `${getFormalSvgIcon("phone")} <span>${student.student_phone}</span>`;
                chips.append(c);
            }
            meta.append(chips);
        }

        reportsDateRange = { start: null, end: null };

        const chatLink = document.getElementById("dossierChatLink");
        if (chatLink) {
            chatLink.href = `consultation-chat.html?request=${encodeURIComponent(student.id)}`;
        }

        if (plannerPicker) {
            plannerPicker.value = String(student.student_id);
        }

        // Reset tabs to requested activeTab
        const targetTab = (activeTab === "reports") ? "reports" : "planner";
        document.querySelectorAll(".dossier-tab-btn").forEach(b => b.classList.toggle("active", b.dataset.tab === targetTab));
        const panePlanner = document.getElementById("dossierPanePlanner");
        const paneReports = document.getElementById("dossierPaneReports");
        if (panePlanner) panePlanner.style.display = targetTab === "planner" ? "block" : "none";
        if (paneReports) paneReports.style.display = targetTab === "reports" ? "block" : "none";

        if (updateHash) {
            history.pushState(null, "", `#student/${student.student_id}`);
        }

        window.scrollTo({ top: 0, behavior: "smooth" });

        await loadStudentWeeksArchive(student.student_id);
        loadPlannerWeek();
        loadStudyReports();
    }

    function closeStudentDossier() {
        currentDossierStudent = null;
        history.pushState(null, "", "#students");
        showPage("students");
    }

    document.getElementById("dossierBackBtn")?.addEventListener("click", closeStudentDossier);

    // Dossier Tabs
    document.querySelectorAll(".dossier-tab-btn[data-tab]").forEach(btn => {
        btn.addEventListener("click", () => {
            const tabName = btn.dataset.tab;
            document.querySelectorAll(".dossier-tab-btn").forEach(b => b.classList.toggle("active", b === btn));
            const panePlanner = document.getElementById("dossierPanePlanner");
            const paneReports = document.getElementById("dossierPaneReports");
            if (panePlanner) panePlanner.style.display = tabName === "planner" ? "block" : "none";
            if (paneReports) paneReports.style.display = tabName === "reports" ? "block" : "none";
        });
    });

    // Custom iOS Frosted Glass Select Dropdown Picker Class
    class CustomGlassSelect {
        constructor(container, { placeholder = "-- انتخاب کنید --", icon = "book", onChange = null, disabled = false } = {}) {
            this.container = container;
            this.placeholder = placeholder;
            this.icon = icon;
            this.onChange = onChange;
            this.disabled = disabled;
            this.items = [];
            this.value = "";
            this.selectedItem = null;
            this.render();
        }

        render() {
            if (!this.container) return;
            this.container.innerHTML = "";
            this.wrapper = document.createElement("div");
            this.wrapper.className = "apple-glass-picker-box";

            this.trigger = document.createElement("button");
            this.trigger.type = "button";
            this.trigger.className = "glass-picker-trigger";
            this.trigger.disabled = this.disabled;

            this.triggerContent = document.createElement("div");
            this.triggerContent.className = "picker-trigger-content";

            this.triggerIcon = document.createElement("span");
            this.triggerIcon.className = "picker-trigger-icon";
            this.triggerIcon.innerHTML = getFormalSvgIcon(this.icon);

            this.triggerText = document.createElement("span");
            this.triggerText.className = "picker-trigger-text";
            this.triggerText.textContent = this.placeholder;

            this.triggerContent.append(this.triggerIcon, this.triggerText);

            const chevronSvg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
            chevronSvg.setAttribute("class", "picker-chevron");
            chevronSvg.setAttribute("viewBox", "0 0 24 24");
            const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
            path.setAttribute("d", "m6 9 6 6 6-6");
            chevronSvg.appendChild(path);

            this.trigger.append(this.triggerContent, chevronSvg);

            this.popover = document.createElement("div");
            this.popover.className = "glass-picker-popover";
            this.popover.style.display = "none";

            // Mobile Sheet Header
            const sheetHeader = document.createElement("div");
            sheetHeader.className = "glass-picker-sheet-header";
            const dragHandle = document.createElement("div");
            dragHandle.className = "glass-picker-drag-handle";
            const sheetTitle = document.createElement("span");
            sheetTitle.className = "glass-picker-sheet-title";
            sheetTitle.textContent = this.placeholder;
            const closeBtn = document.createElement("button");
            closeBtn.type = "button";
            closeBtn.className = "glass-picker-close-btn";
            closeBtn.innerHTML = `${getFormalSvgIcon("close")} <span>بستن</span>`;
            closeBtn.addEventListener("click", (e) => {
                e.stopPropagation();
                this.close();
            });
            sheetHeader.append(dragHandle, sheetTitle, closeBtn);

            const searchWrap = document.createElement("div");
            searchWrap.className = "glass-picker-search-wrap";
            const searchIcon = document.createElement("span");
            searchIcon.className = "glass-picker-search-icon";
            searchIcon.innerHTML = getFormalSvgIcon("search");
            this.searchInput = document.createElement("input");
            this.searchInput.type = "text";
            this.searchInput.className = "glass-picker-search";
            this.searchInput.placeholder = "جستجو در گزینه‌ها…";
            searchWrap.append(searchIcon, this.searchInput);

            this.list = document.createElement("div");
            this.list.className = "glass-picker-list";

            this.popover.append(sheetHeader, searchWrap, this.list);
            this.wrapper.append(this.trigger, this.popover);
            this.container.appendChild(this.wrapper);

            this.trigger.addEventListener("click", (e) => {
                e.stopPropagation();
                if (this.disabled) return;
                this.toggle();
            });

            this.searchInput.addEventListener("input", () => {
                this.filter(this.searchInput.value);
            });

            document.addEventListener("click", (e) => {
                if (this.isOpen() && this.wrapper && !this.wrapper.contains(e.target) && !this.container?.contains(e.target)) {
                    this.close();
                }
            });

            document.addEventListener("keydown", (e) => {
                if (e.key === "Escape" && this.isOpen()) {
                    this.close();
                }
            });
        }

        setOptions(items) {
            this.items = items || [];
            this.filter("");
        }

        filter(query = "") {
            if (!this.list) return;
            const q = normalizeDigits(query.trim()).toLowerCase();
            this.list.innerHTML = "";

            const filtered = this.items.filter(item => {
                if (!q) return true;
                return normalizeDigits(item.label).toLowerCase().includes(q) ||
                       (item.group && normalizeDigits(item.group).toLowerCase().includes(q));
            });

            if (!filtered.length) {
                const empty = document.createElement("div");
                empty.className = "glass-picker-empty";
                empty.textContent = "موردی پیدا نشد.";
                this.list.appendChild(empty);
                return;
            }

            let currentGroup = null;
            filtered.forEach(item => {
                if (item.group && item.group !== currentGroup) {
                    currentGroup = item.group;
                    const groupTitle = document.createElement("div");
                    groupTitle.className = "glass-picker-group-title";
                    groupTitle.textContent = currentGroup;
                    this.list.appendChild(groupTitle);
                }

                const opt = document.createElement("div");
                opt.className = `glass-picker-option${this.value === item.value ? " is-selected" : ""}`;
                
                const labelSpan = document.createElement("span");
                labelSpan.textContent = item.label;

                opt.appendChild(labelSpan);

                if (this.value === item.value) {
                    const check = document.createElement("span");
                    check.className = "option-check";
                    check.innerHTML = getFormalSvgIcon("check");
                    opt.appendChild(check);
                }

                opt.addEventListener("click", (e) => {
                    e.stopPropagation();
                    this.select(item);
                });

                this.list.appendChild(opt);
            });
        }

        select(item) {
            this.value = item ? item.value : "";
            this.selectedItem = item;
            this.triggerText.textContent = item ? item.label : this.placeholder;
            if (item && item.icon) this.triggerIcon.innerHTML = getFormalSvgIcon(item.icon);
            this.close();
            if (this.onChange) this.onChange(this.value, item);
        }

        setValue(val) {
            const item = this.items.find(i => String(i.value) === String(val));
            this.value = item ? item.value : "";
            this.selectedItem = item || null;
            this.triggerText.textContent = item ? item.label : this.placeholder;
            if (item && item.icon) this.triggerIcon.innerHTML = getFormalSvgIcon(item.icon);
            this.filter(this.searchInput?.value || "");
        }

        setDisabled(bool) {
            this.disabled = bool;
            if (this.trigger) this.trigger.disabled = bool;
            if (bool) this.close();
        }

        reset() {
            this.value = "";
            this.selectedItem = null;
            this.triggerText.textContent = this.placeholder;
            this.triggerIcon.innerHTML = getFormalSvgIcon(this.icon);
            if (this.searchInput) this.searchInput.value = "";
            this.filter("");
        }

        toggle() {
            if (this.isOpen()) this.close();
            else this.open();
        }

        open() {
            document.querySelectorAll(".glass-picker-popover").forEach(p => p.style.display = "none");
            document.querySelectorAll(".apple-glass-picker-box").forEach(b => b.classList.remove("is-open"));
            document.querySelectorAll(".curriculum-field").forEach(f => f.classList.remove("is-picker-open"));
            document.querySelectorAll(".glass-picker-backdrop").forEach(el => el.remove());

            this.popover.style.display = "flex";
            this.wrapper.classList.add("is-open");
            if (this.container) this.container.classList.add("is-open");
            const field = this.container?.closest(".curriculum-field");
            if (field) field.classList.add("is-picker-open");

            if (this.searchInput) {
                this.searchInput.value = "";
                this.filter("");
                setTimeout(() => this.searchInput.focus(), 60);
            }
        }

        close() {
            if (this.popover) this.popover.style.display = "none";
            if (this.wrapper) this.wrapper.classList.remove("is-open");
            if (this.container) this.container.classList.remove("is-open");
            const field = this.container?.closest(".curriculum-field");
            if (field) field.classList.remove("is-picker-open");
        }

        isOpen() {
            return this.popover && this.popover.style.display !== "none";
        }
    }

    function getShamsiWeekDate(offset = 0) {
        const now = new Date();
        const jsDay = now.getDay();
        const iranDay = (jsDay + 1) % 7;
        const sat = new Date(now);
        sat.setDate(now.getDate() - iranDay + (offset * 7));
        sat.setHours(0, 0, 0, 0);

        const fri = new Date(sat);
        fri.setDate(sat.getDate() + 6);

        const pad = n => String(n).padStart(2, '0');
        const satIso = `${sat.getFullYear()}-${pad(sat.getMonth() + 1)}-${pad(sat.getDate())}`;

        const faSat = new Intl.DateTimeFormat('fa-IR', { month: 'short', day: 'numeric' }).format(sat);
        const faFri = new Intl.DateTimeFormat('fa-IR', { month: 'short', day: 'numeric' }).format(fri);

        let label = "";
        if (offset === 0) label = `این هفته (شنبه ${faSat} تا جمعه ${faFri})`;
        else if (offset === 1) label = `هفته بعد (شنبه ${faSat} تا جمعه ${faFri})`;
        else if (offset === 2) label = `۲ هفته بعد (شنبه ${faSat} تا جمعه ${faFri})`;
        else if (offset === 3) label = `۳ هفته بعد (شنبه ${faSat} تا جمعه ${faFri})`;
        else if (offset === -1) label = `هفته قبل (شنبه ${faSat} تا جمعه ${faFri})`;
        else label = `${offset > 0 ? `${numberFa(offset)} هفته بعد` : `${numberFa(Math.abs(offset))} هفته قبل`} (${faSat} تا ${faFri})`;

        return { offset, satIso, label };
    }

    function openArchiveModal() {
        const backdrop = document.getElementById("dossierArchiveModalBackdrop");
        if (backdrop) backdrop.style.display = "flex";
    }

    function closeArchiveModal() {
        const backdrop = document.getElementById("dossierArchiveModalBackdrop");
        if (backdrop) backdrop.style.display = "none";
    }

    async function loadStudentWeeksArchive(studentId) {
        if (!studentId) return;
        const weekSelect = document.getElementById("dossierWeekSelect");
        const weekStartHidden = document.getElementById("planner-week-start-hidden");
        const statTotalSessions = document.getElementById("archiveStatTotalSessions");
        const statTotalWeeks = document.getElementById("archiveStatTotalWeeks");
        const statFirstWeek = document.getElementById("archiveStatFirstWeek");
        const archiveList = document.getElementById("archiveModalList");

        try {
            const res = await fetch(`/api/consultations/study-sessions/weeks/?student=${encodeURIComponent(studentId)}`, { credentials: "same-origin" });
            const data = await res.json();
            if (!res.ok) throw new Error(data.detail || "دریافت آرشیو هفته‌ها انجام نشد.");

            studentWeeksArchive = data.results || [];

            // Compute statistics
            const totalSessions = studentWeeksArchive.reduce((acc, w) => acc + (w.session_count || 0), 0);
            if (statTotalSessions) statTotalSessions.textContent = numberFa(totalSessions);
            if (statTotalWeeks) statTotalWeeks.textContent = numberFa(studentWeeksArchive.length);
            if (statFirstWeek) {
                const oldestWeek = studentWeeksArchive.find(w => w.session_count > 0) || studentWeeksArchive[0];
                statFirstWeek.textContent = oldestWeek ? oldestWeek.label : "—";
            }

            // Populate the dropdown selector
            if (weekSelect) {
                weekSelect.innerHTML = "";
                studentWeeksArchive.forEach(w => {
                    const tag = w.is_current ? " [هفته جاری]" : (w.is_past ? " [گذشته]" : " [آینده]");
                    const sessionCountText = w.session_count ? ` (${numberFa(w.session_count)} درس)` : " (بدون برنامه)";
                    const opt = new Option(`${w.label}${sessionCountText}${tag}`, w.week_start);
                    weekSelect.appendChild(opt);
                });

                // Default selection: current week or currently selected week
                let targetWeek = studentWeeksArchive.find(w => w.week_start === currentWeekStartIso);
                if (!targetWeek) {
                    targetWeek = studentWeeksArchive.find(w => w.is_current) || studentWeeksArchive[0];
                }
                if (targetWeek) {
                    currentWeekStartIso = targetWeek.week_start;
                    weekSelect.value = targetWeek.week_start;
                    if (weekStartHidden) weekStartHidden.value = currentWeekStartIso;
                }
            }

            // Render modal list items
            if (archiveList) {
                archiveList.innerHTML = "";
                if (!studentWeeksArchive.length) {
                    archiveList.innerHTML = '<p class="consultant-article-hint">هیچ هفته‌ای یافت نشد.</p>';
                    return;
                }

                studentWeeksArchive.forEach(w => {
                    const item = document.createElement("article");
                    item.className = `archive-week-item${w.week_start === currentWeekStartIso ? " is-active" : ""}`;

                    const info = document.createElement("div");
                    info.className = "archive-week-info";

                    const titleRow = document.createElement("div");
                    titleRow.className = "archive-week-title-row";

                    const title = document.createElement("strong");
                    title.textContent = w.label;

                    const badge = document.createElement("span");
                    if (w.is_current) {
                        badge.className = "archive-tag archive-tag-current";
                        badge.textContent = "هفته جاری";
                    } else if (w.is_past) {
                        badge.className = "archive-tag archive-tag-past";
                        badge.textContent = "گذشته";
                    } else {
                        badge.className = "archive-tag archive-tag-future";
                        badge.textContent = "برنامه‌ریزی آینده";
                    }

                    titleRow.append(title, badge);

                    const meta = document.createElement("div");
                    meta.className = "archive-week-meta";
                    const countSpan = document.createElement("span");
                    countSpan.textContent = `${numberFa(w.session_count)} سهمیه مطالعه`;
                    const durSpan = document.createElement("span");
                    const h = Math.floor((w.total_planned_minutes || 0) / 60);
                    const m = (w.total_planned_minutes || 0) % 60;
                    durSpan.textContent = `${numberFa(h)} ساعت و ${numberFa(m)} دقیقه`;
                    meta.append(countSpan, durSpan);

                    info.append(titleRow, meta);

                    const action = document.createElement("div");
                    action.className = "archive-week-action";
                    action.innerHTML = `${getFormalSvgIcon("arrowRight")}`;

                    item.append(info, action);

                    item.addEventListener("click", () => {
                        currentWeekStartIso = w.week_start;
                        if (weekSelect) weekSelect.value = w.week_start;
                        if (weekStartHidden) weekStartHidden.value = currentWeekStartIso;
                        closeArchiveModal();
                        loadPlannerWeek();
                    });

                    archiveList.appendChild(item);
                });
            }
        } catch (err) {
            console.error("Failed to load student weeks archive:", err);
            if (archiveList) archiveList.innerHTML = `<p class="consultant-article-hint">${err.message}</p>`;
        }
    }

    function initWeekNavigator() {
        const weekSelect = document.getElementById("dossierWeekSelect");
        const prevBtn = document.getElementById("weekNavPrevBtn");
        const nextBtn = document.getElementById("weekNavNextBtn");
        const archiveBtn = document.getElementById("weekArchiveBtn");
        const archiveCloseBtn = document.getElementById("archiveModalCloseBtn");
        const archiveBackdrop = document.getElementById("dossierArchiveModalBackdrop");
        const copyBtn = document.getElementById("weekCopyBtn");
        const weekStartHidden = document.getElementById("planner-week-start-hidden");
        if (!weekSelect) return;

        archiveBtn?.addEventListener("click", openArchiveModal);
        archiveCloseBtn?.addEventListener("click", closeArchiveModal);
        archiveBackdrop?.addEventListener("click", (e) => {
            if (e.target === archiveBackdrop) closeArchiveModal();
        });

        function populateFallbackWeekSelect() {
            weekSelect.innerHTML = "";
            const offsets = [-1, 0, 1, 2, 3, 4];
            offsets.forEach(off => {
                const w = getShamsiWeekDate(off);
                const opt = new Option(w.label, w.satIso);
                if (off === currentWeekOffset) opt.selected = true;
                weekSelect.appendChild(opt);
            });
            const currentW = getShamsiWeekDate(currentWeekOffset);
            currentWeekStartIso = currentW.satIso;
            if (weekStartHidden) weekStartHidden.value = currentWeekStartIso;
        }

        populateFallbackWeekSelect();

        weekSelect.addEventListener("change", () => {
            currentWeekStartIso = weekSelect.value;
            if (weekStartHidden) weekStartHidden.value = currentWeekStartIso;
            loadPlannerWeek();
        });

        prevBtn?.addEventListener("click", () => {
            if (studentWeeksArchive && studentWeeksArchive.length > 0) {
                const currentIdx = studentWeeksArchive.findIndex(w => w.week_start === currentWeekStartIso);
                if (currentIdx > 0) {
                    const prevWeek = studentWeeksArchive[currentIdx - 1];
                    currentWeekStartIso = prevWeek.week_start;
                    weekSelect.value = prevWeek.week_start;
                    if (weekStartHidden) weekStartHidden.value = currentWeekStartIso;
                    loadPlannerWeek();
                    return;
                }
            }
            currentWeekOffset -= 1;
            populateFallbackWeekSelect();
            loadPlannerWeek();
        });

        nextBtn?.addEventListener("click", () => {
            if (studentWeeksArchive && studentWeeksArchive.length > 0) {
                const currentIdx = studentWeeksArchive.findIndex(w => w.week_start === currentWeekStartIso);
                if (currentIdx !== -1 && currentIdx < studentWeeksArchive.length - 1) {
                    const nextWeek = studentWeeksArchive[currentIdx + 1];
                    currentWeekStartIso = nextWeek.week_start;
                    weekSelect.value = nextWeek.week_start;
                    if (weekStartHidden) weekStartHidden.value = currentWeekStartIso;
                    loadPlannerWeek();
                    return;
                }
            }
            currentWeekOffset += 1;
            populateFallbackWeekSelect();
            loadPlannerWeek();
        });

        copyBtn?.addEventListener("click", async () => {
            if (!plannerPicker?.value) return;
            const currentIdx = studentWeeksArchive.findIndex(w => w.week_start === currentWeekStartIso);
            let nextSatIso = "";
            let nextLabel = "";
            if (currentIdx !== -1 && currentIdx < studentWeeksArchive.length - 1) {
                const nextW = studentWeeksArchive[currentIdx + 1];
                nextSatIso = nextW.week_start;
                nextLabel = nextW.label;
            } else {
                const computed = getShamsiWeekDate(currentWeekOffset + 1);
                nextSatIso = computed.satIso;
                nextLabel = computed.label;
            }

            if (!confirm(`آیا مایلید تمام جلسات این هفته به هفته بعد (${nextLabel}) کپی شوند؟`)) return;

            copyBtn.disabled = true;
            const origHtml = copyBtn.innerHTML;
            copyBtn.innerHTML = "<span>در حال کپی برنامه…</span>";

            try {
                const res = await fetch(`/api/consultations/study-sessions/?student=${encodeURIComponent(plannerPicker.value)}&week_start=${currentWeekStartIso}`, { credentials: "same-origin" });
                const data = await res.json();
                const currentSessions = data.results || [];
                if (!currentSessions.length) {
                    alert("در این هفته هیچ برنامه‌ای برای کپی وجود ندارد.");
                    return;
                }

                const csrfToken = await getFreshCsrfToken();
                let copiedCount = 0;
                for (const sess of currentSessions) {
                    const payload = {
                        student_id: Number(plannerPicker.value),
                        weekday: sess.weekday,
                        planned_minutes: sess.planned_minutes,
                        subject: sess.subject,
                        mode: sess.mode,
                        test_count: sess.test_count,
                        instructions: sess.instructions || "",
                        color: sess.color || "mint",
                        week_start_date: nextSatIso
                    };
                    await fetch("/api/consultations/study-sessions/create/", {
                        method: "POST",
                        credentials: "same-origin",
                        headers: { "Content-Type": "application/json", "X-CSRFToken": csrfToken },
                        body: JSON.stringify(payload)
                    });
                    copiedCount++;
                }

                alert(`${numberFa(copiedCount)} سهمیه با موفقیت به هفته بعد کپی شد.`);
                await loadStudentWeeksArchive(Number(plannerPicker.value));
                currentWeekStartIso = nextSatIso;
                if (weekSelect) weekSelect.value = nextSatIso;
                await loadPlannerWeek();
            } catch (err) {
                alert("خطا در کپی برنامه: " + err.message);
            } finally {
                copyBtn.disabled = false;
                copyBtn.innerHTML = origHtml;
            }
        });
    }

    function initCurriculumSelector() {
        const previewBar = document.getElementById("curriculumPreviewBar");
        const previewPills = document.getElementById("curriculumPreviewPills");
        const resetBtn = document.getElementById("curriculumResetBtn");
        const modeToggle = document.getElementById("curriculumModeToggle");
        const cascadeContainer = document.getElementById("curriculumCascadeContainer");
        const manualContainer = document.getElementById("curriculumManualContainer");
        const manualSubject = document.getElementById("curriculumManualSubject");
        const hiddenSubject = document.getElementById("planner-subject-hidden");
        const instructionsInput = document.getElementById("planner-instructions-input");

        const bookBox = document.getElementById("picker-box-book");
        const chapterBox = document.getElementById("picker-box-chapter");
        const topicBox = document.getElementById("picker-box-topic");

        if (!bookBox || !chapterBox || !topicBox || !hiddenSubject) return;

        const curriculumData = window.CURRICULUM_DATA || (typeof CURRICULUM_DATA !== "undefined" ? CURRICULUM_DATA : []);
        if (!Array.isArray(curriculumData) || !curriculumData.length) {
            console.warn("Curriculum data not loaded or empty.");
            return;
        }

        let isManualMode = false;
        let lastAutoInstruction = "";

        // Build options for BookPicker
        const bookOptions = [];
        curriculumData.forEach((book) => {
            bookOptions.push({
                value: book.id,
                label: book.title,
                group: book.category || "سایر دروس",
                icon: book.icon || "book",
                bookObj: book
            });
        });

        function updateSelection() {
            if (isManualMode) {
                const manualVal = (manualSubject?.value || "").trim();
                hiddenSubject.value = manualVal;
                if (previewBar) previewBar.style.display = "none";
                return;
            }

            const selectedBookId = bookPicker.value;
            const bookItem = bookOptions.find(b => b.value === selectedBookId);
            const book = bookItem ? bookItem.bookObj : null;

            if (!book) {
                hiddenSubject.value = "";
                if (previewBar) previewBar.style.display = "none";
                return;
            }

            const chapterVal = chapterPicker.value;
            if (chapterVal === "" || chapterVal === null || chapterVal === undefined) {
                hiddenSubject.value = "";
                if (previewBar) previewBar.style.display = "none";
                return;
            }

            const chapterIdx = Number(chapterVal);
            const chapter = book.chapters ? book.chapters[chapterIdx] : null;
            if (!chapter) {
                hiddenSubject.value = "";
                if (previewBar) previewBar.style.display = "none";
                return;
            }

            const topicVal = topicPicker.value;
            const hasTopic = topicVal !== "" && topicVal !== null && topicVal !== undefined && topicVal !== "__ALL__";
            const topic = hasTopic && chapter.topics ? chapter.topics[Number(topicVal)] : null;

            let formattedSubject = topic
                ? `${book.title} · ${chapter.title} · ${topic}`
                : `${book.title} · ${chapter.title}`;

            if (formattedSubject.length > 150) {
                formattedSubject = formattedSubject.slice(0, 147) + "...";
            }
            hiddenSubject.value = formattedSubject;

            if (previewPills && previewBar) {
                previewPills.replaceChildren();

                const pillBook = document.createElement("span");
                pillBook.className = "preview-pill pill-book";
                pillBook.innerHTML = `${getFormalSvgIcon("book")} <span>${book.title}</span>`;
                previewPills.appendChild(pillBook);

                const pillChapter = document.createElement("span");
                pillChapter.className = "preview-pill pill-chapter";
                pillChapter.innerHTML = `${getFormalSvgIcon("chapter")} <span>${chapter.title}</span>`;
                previewPills.appendChild(pillChapter);

                if (topic) {
                    const pillTopic = document.createElement("span");
                    pillTopic.className = "preview-pill pill-topic";
                    pillTopic.innerHTML = `${getFormalSvgIcon("topic")} <span>${topic}</span>`;
                    previewPills.appendChild(pillTopic);
                } else {
                    const pillAll = document.createElement("span");
                    pillAll.className = "preview-pill pill-all";
                    pillAll.innerHTML = `${getFormalSvgIcon("all")} <span>کل فصل</span>`;
                    previewPills.appendChild(pillAll);
                }

                previewBar.style.display = "flex";
            }

            if (instructionsInput) {
                const currentVal = instructionsInput.value.trim();
                if (!currentVal || currentVal === lastAutoInstruction) {
                    const suggestion = topic
                        ? `مطالعه و حل تست مبحث: ${topic}`
                        : `مطالعه و مرور کامل: ${chapter.title}`;
                    instructionsInput.value = suggestion;
                    lastAutoInstruction = suggestion;
                }
            }
        }

        const bookPicker = new CustomGlassSelect(bookBox, {
            placeholder: "-- انتخاب کتاب درسی (الزامی) --",
            icon: "book",
            onChange: (val) => {
                const bookItem = bookOptions.find(b => b.value === val);
                const book = bookItem ? bookItem.bookObj : null;

                chapterPicker.reset();
                topicPicker.reset();

                if (!book || !book.chapters || !book.chapters.length) {
                    chapterPicker.setOptions([]);
                    chapterPicker.setDisabled(true);
                    topicPicker.setOptions([]);
                    topicPicker.setDisabled(true);
                    updateSelection();
                    return;
                }

                const chOptions = book.chapters.map((ch, idx) => ({
                    value: String(idx),
                    label: ch.title,
                    icon: "chapter"
                }));

                chapterPicker.setOptions(chOptions);
                chapterPicker.setDisabled(false);
                topicPicker.setOptions([]);
                topicPicker.setDisabled(true);
                updateSelection();
            }
        });
        bookPicker.setOptions(bookOptions);

        const chapterPicker = new CustomGlassSelect(chapterBox, {
            placeholder: "-- انتخاب فصل (الزامی) --",
            icon: "chapter",
            disabled: true,
            onChange: (val) => {
                const bookItem = bookOptions.find(b => b.value === bookPicker.value);
                const book = bookItem ? bookItem.bookObj : null;

                topicPicker.reset();

                if (!book || val === "" || !book.chapters || !book.chapters[Number(val)]) {
                    topicPicker.setOptions([]);
                    topicPicker.setDisabled(true);
                    updateSelection();
                    return;
                }

                const chapter = book.chapters[Number(val)];
                const topOptions = [
                    { value: "__ALL__", label: "کل فصل (بدون مبحث خاص)", icon: "all" }
                ];
                if (chapter.topics && chapter.topics.length) {
                    chapter.topics.forEach((t, idx) => {
                        topOptions.push({
                            value: String(idx),
                            label: t,
                            icon: "topic"
                        });
                    });
                }

                topicPicker.setOptions(topOptions);
                topicPicker.setDisabled(false);
                updateSelection();
            }
        });

        const topicPicker = new CustomGlassSelect(topicBox, {
            placeholder: "-- کل فصل (بدون مبحث خاص) --",
            icon: "topic",
            disabled: true,
            onChange: () => updateSelection()
        });

        resetBtn?.addEventListener("click", () => {
            bookPicker.reset();
            chapterPicker.reset();
            chapterPicker.setDisabled(true);
            topicPicker.reset();
            topicPicker.setDisabled(true);
            if (manualSubject) manualSubject.value = "";
            if (instructionsInput && instructionsInput.value === lastAutoInstruction) {
                instructionsInput.value = "";
            }
            lastAutoInstruction = "";
            updateSelection();
        });

        modeToggle?.addEventListener("click", () => {
            isManualMode = !isManualMode;
            if (isManualMode) {
                if (cascadeContainer) cascadeContainer.style.display = "none";
                if (manualContainer) manualContainer.style.display = "block";
                modeToggle.innerHTML = `<span class="toggle-icon">${getFormalSvgIcon("book")}</span><span class="toggle-text">انتخاب از سرفصل‌های مصوب</span>`;
                if (manualSubject) manualSubject.focus();
            } else {
                if (cascadeContainer) cascadeContainer.style.display = "block";
                if (manualContainer) manualContainer.style.display = "none";
                modeToggle.innerHTML = `<span class="toggle-icon">${getFormalSvgIcon("edit")}</span><span class="toggle-text">ورود دستی / سایر</span>`;
            }
            updateSelection();
        });

        manualSubject?.addEventListener("input", () => {
            if (isManualMode) updateSelection();
        });
    }

    initCurriculumSelector();
    initWeekNavigator();
    showPage(location.hash.slice(1) || "dashboard");
};

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initConsultantApp);
} else {
    initConsultantApp();
}
