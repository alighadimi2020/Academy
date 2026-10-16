document.addEventListener("DOMContentLoaded", async () => {
    const managerNavItems = document.querySelectorAll(".payeh-manager__nav-item");
    const managerPages = document.querySelectorAll(".manager-page");
    const managerPageTitle = document.getElementById("manager-page-title");
    const managerSidebar = document.getElementById("manager-sidebar");
    const managerMenuButton = document.getElementById("manager-menu-button");
    const pageTitles = {
        dashboard: "داشبورد",
        consultants: "مشاوران فعال",
        "consultant-applications": "درخواست‌های همکاری و رزومه‌ها",
        students: "دانش‌آموزان",
        conversations: "گفت‌وگو با مشاوران",
        articles: "مقالات",
        settings: "تنظیمات"
    };
    const make = (tag, className, text) => { const node = document.createElement(tag); if (className) node.className = className; if (text !== undefined) node.textContent = text; return node; };
    const numberFa = (value) => new Intl.NumberFormat("fa-IR").format(value);
    const state = { students: [], consultants: [], applications: [], activeAppStatusFilter: "all" };

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
            card.append(fields);
            if (!isStudent) {
                const actionRow = document.createElement("div");
                actionRow.style.cssText = "margin-top: 12px; padding-top: 10px; border-top: 1px dashed #e2e8f0; display: flex; justify-content: flex-end;";
                const resetBtn = document.createElement("button");
                resetBtn.type = "button";
                resetBtn.style.cssText = "background: #eff6ff; color: #2563eb; border: 1px solid #bfdbfe; padding: 6px 12px; border-radius: 8px; font-size: 11px; font-weight: 800; cursor: pointer; display: flex; align-items: center; gap: 6px;";
                resetBtn.innerHTML = `
                    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
                    <span>تنظیم مجدد رمز عبور</span>
                `;
                resetBtn.onclick = () => openResetPasswordModal(user);
                actionRow.append(resetBtn);
                card.append(actionRow);
            }
            target.append(card);
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

    const loadManagerChatRooms = async () => {
        const target=document.getElementById("manager-chat-rooms");const message=document.getElementById("manager-chat-rooms-message");if(!target)return;
        message.textContent="در حال دریافت اتاق‌ها…";target.replaceChildren();
        try{const response=await fetch("/api/consultations/staff-conversations/",{credentials:"same-origin"});const data=await response.json();if(!response.ok)throw new Error(data.detail||"اتاق‌های گفتگو دریافت نشدند.");
            const rooms=data.results||[];message.textContent=rooms.length?`${numberFa(rooms.length)} اتاق گفتگو`:"هنوز مشاوری اتاق گفتگو با مدیر ایجاد نکرده است.";
            rooms.forEach(room=>{const card=make("article","manager-chat-room");const avatar=make("span","manager-chat-room__avatar",(room.consultant_name||"م").trim().slice(0,1));const info=make("div","manager-chat-room__info");info.append(make("strong","",room.consultant_name),make("span","",room.last_message||"هنوز پیامی در این اتاق نیست."));const date=room.last_message_at?new Date(room.last_message_at).toLocaleString("fa-IR",{dateStyle:"short",timeStyle:"short"}):"گفتگوی جدید";info.append(make("small","",date));const link=document.createElement("a");link.href=`consultation-chat.html?staff=${encodeURIComponent(room.id)}`;link.textContent="بازکردن اتاق";card.append(avatar,info,link);target.append(card);});
        }catch(error){message.textContent=error.message||"دریافت اتاق‌ها انجام نشد.";}
    };

    const renderConsultantApplications = () => {
        const target = document.getElementById("manager-consultant-apps-list");
        const message = document.getElementById("manager-apps-message");
        const searchInput = document.getElementById("manager-apps-search");
        if (!target) return;

        const query = (searchInput?.value || "").trim().toLocaleLowerCase();
        const filterStatus = state.activeAppStatusFilter;

        let filtered = state.applications.slice();
        if (filterStatus !== "all") {
            filtered = filtered.filter(app => app.status === filterStatus);
        }
        if (query) {
            filtered = filtered.filter(app => 
                `${app.full_name} ${app.phone} ${app.konkur_quota || ""} ${app.quota_rank || ""} ${app.university_major || ""}`.toLocaleLowerCase().includes(query)
            );
        }

        target.replaceChildren();

        if (!filtered.length) {
            if (message) {
                message.style.display = "block";
                message.textContent = query 
                    ? "موردی با این عبارت در متقاضیان پیدا نشد." 
                    : (filterStatus === "pending" ? "هیچ درخواست در انتظار بررسی وجود ندارد." : "درخواستی در این دسته‌بندی یافت نشد.");
            }
            return;
        }

        if (message) message.style.display = "none";

        filtered.forEach((app) => {
            const card = make("article", "manager-user-card");
            card.style.cssText = "background: #ffffff; border: 1.5px solid #e2e8f0; border-radius: 16px; padding: 18px; display: flex; flex-direction: column; justify-content: space-between; box-shadow: 0 4px 12px rgba(0,0,0,0.03); transition: transform 0.2s ease;";
            
            const borderColors = { pending: "#f59e0b", approved: "#16a34a", rejected: "#ef4444" };
            card.style.borderTop = `4px solid ${borderColors[app.status] || '#cbd5e1'}`;

            // Header
            const header = make("div", "manager-user-card__header");
            header.style.cssText = "display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; gap: 8px;";
            
            const userBox = make("div", "");
            userBox.style.cssText = "display: flex; align-items: center; gap: 10px;";
            
            const avatar = make("span", "manager-user-card__avatar", (app.full_name || "م").trim().charAt(0));
            avatar.style.cssText = "width: 42px; height: 42px; border-radius: 12px; background: #eff6ff; color: #1d4ed8; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 16px;";
            
            const identity = make("div", "");
            const titleH3 = make("h3", "", app.full_name);
            titleH3.style.cssText = "margin: 0 0 4px; font-size: 15px; font-weight: 800; color: #0f172a;";
            const phoneLink = make("a", "", app.phone);
            phoneLink.href = `tel:${app.phone}`;
            phoneLink.style.cssText = "font-size: 12px; color: #64748b; text-decoration: none; font-weight: 600;";
            identity.append(titleH3, phoneLink);
            if (app.email) {
                const emailLink = make("a", "", app.email);
                emailLink.href = `mailto:${app.email}`;
                emailLink.style.cssText = "font-size: 11px; color: #2563eb; text-decoration: none; font-weight: 600; display: block; margin-top: 2px;";
                identity.append(emailLink);
            }
            userBox.append(avatar, identity);

            const statusConfig = {
                pending: { bg: "#fffbeb", text: "#b45309", border: "#fde68a", dot: "#d97706", label: "در انتظار بررسی" },
                approved: { bg: "#f0fdf4", text: "#15803d", border: "#bbf7d0", dot: "#16a34a", label: "تأیید شده" },
                rejected: { bg: "#fef2f2", text: "#b91c1c", border: "#fecaca", dot: "#dc2626", label: "رد شده" }
            };
            const sConf = statusConfig[app.status] || { bg: "#f1f5f9", text: "#475569", border: "#e2e8f0", dot: "#64748b", label: app.status_label };
            const statusTag = make("span", "");
            statusTag.style.cssText = `background: ${sConf.bg}; color: ${sConf.text}; border: 1px solid ${sConf.border}; padding: 4px 10px; border-radius: 99px; font-size: 11px; font-weight: 800; white-space: nowrap; display: inline-flex; align-items: center; gap: 6px;`;
            statusTag.innerHTML = `<span style="width: 6px; height: 6px; border-radius: 50%; background: ${sConf.dot};"></span><span>${sConf.label}</span>`;

            header.append(userBox, statusTag);
            card.append(header);

            // Fields Grid
            const fields = make("div", "");
            fields.style.cssText = "display: grid; grid-template-columns: 1fr 1fr; gap: 8px 12px; margin: 12px 0; background: #f8fafc; padding: 12px; border-radius: 12px; font-size: 12px;";

            const addField = (label, value) => {
                if (!value) return;
                const wrapper = document.createElement("div");
                const dt = make("div", "", label);
                dt.style.cssText = "color: #64748b; font-size: 11px; font-weight: 600; margin-bottom: 2px;";
                const dd = make("div", "", value);
                dd.style.cssText = "color: #1e293b; font-weight: 700;";
                wrapper.append(dt, dd);
                fields.append(wrapper);
            };

            addField("ایمیل", app.email);
            addField("تاریخ تولد شمسی", app.birth_date);
            addField("سال کنکور", app.konkur_year ? String(app.konkur_year) : "");
            addField("سهمیه کنکور", app.konkur_quota);
            addField("رتبه در سهمیه", app.quota_rank ? `رتبه ${numberFa(app.quota_rank)}` : "");
            addField("رشته و دانشگاه", [app.university_major, app.current_university].filter(Boolean).join(" - ") || "ثبت نشده");
            addField("سابقه مشاوره", app.experience_years ? `${numberFa(app.experience_years)} سال` : "بدون سابقه قبلی");
            addField("تاریخ درخواست", app.created_at);

            card.append(fields);

            // Bio / Description
            if (app.bio) {
                const bioP = make("p", "", `توضیحات: ${app.bio}`);
                bioP.style.cssText = "margin: 6px 0 12px; font-size: 12px; line-height: 1.7; color: #475569; background: #f1f5f9; padding: 8px 12px; border-radius: 8px;";
                card.append(bioP);
            }

            // Bottom Actions & Resume Section
            const bottomSec = document.createElement("div");
            bottomSec.style.cssText = "margin-top: auto; padding-top: 10px; border-top: 1px solid #f1f5f9;";

            // Resume Download Button
            if (app.resume_url) {
                const isPdf = (app.resume_filename || "").toLowerCase().endsWith(".pdf");
                const dlBtn = document.createElement("a");
                dlBtn.href = app.resume_url;
                dlBtn.target = "_blank";
                dlBtn.style.cssText = "display: flex; align-items: center; justify-content: center; gap: 8px; width: 100%; padding: 9px 12px; background: #eff6ff; color: #1d4ed8; text-decoration: none; border-radius: 10px; font-size: 12px; font-weight: 800; border: 1px solid #bfdbfe; margin-bottom: 10px; transition: background 0.15s ease;";
                dlBtn.innerHTML = `
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                        <polyline points="7 10 12 15 17 10"></polyline>
                        <line x1="12" y1="15" x2="12" y2="3"></line>
                    </svg>
                    <span>دانلود و بررسی رزومه</span>
                    <span style="background:#dbeafe; color:#1e40af; padding:2px 7px; border-radius:6px; font-size:10px; font-weight:800;">${isPdf ? 'PDF' : 'DOCX'}</span>
                `;
                bottomSec.append(dlBtn);
            }

            // Decision actions
            if (app.status === "pending") {
                const decisionBox = document.createElement("div");
                decisionBox.style.cssText = "background: #fafafa; border: 1px dashed #cbd5e1; border-radius: 12px; padding: 10px;";

                const noteInput = document.createElement("input");
                noteInput.type = "text";
                noteInput.placeholder = "توضیحات یا پیام مدیر (اختیاری)...";
                noteInput.style.cssText = "width: 100%; padding: 6px 10px; font-size: 12px; border: 1px solid #e2e8f0; border-radius: 8px; margin-bottom: 8px; outline: none; background: #ffffff;";

                const btnRow = document.createElement("div");
                btnRow.style.cssText = "display: flex; gap: 8px;";

                const approveBtn = document.createElement("button");
                approveBtn.className = "payeh-manager__button";
                approveBtn.style.cssText = "flex: 1; background: #16a34a; color: #fff; border: none; padding: 8px; border-radius: 8px; font-size: 12px; font-weight: 800; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 6px;";
                approveBtn.innerHTML = `
                    <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                        <polyline points="20 6 9 17 4 12"></polyline>
                    </svg>
                    <span>تأیید و ارتقا به مشاور</span>
                `;
                approveBtn.onclick = () => {
                    openApproveModal(app);
                };

                const rejectBtn = document.createElement("button");
                rejectBtn.className = "payeh-manager__button";
                rejectBtn.style.cssText = "flex: 1; background: #dc2626; color: #fff; border: none; padding: 8px; border-radius: 8px; font-size: 12px; font-weight: 800; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 6px;";
                rejectBtn.innerHTML = `
                    <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                        <line x1="18" y1="6" x2="6" y2="18"></line>
                        <line x1="6" y1="6" x2="18" y2="18"></line>
                    </svg>
                    <span>رد درخواست</span>
                `;
                rejectBtn.onclick = async () => {
                    const note = noteInput.value.trim() || prompt(`دلیل رد درخواست مشاور ${app.full_name} (اختیاری):`);
                    if (note === null) return;
                    rejectBtn.disabled = true;
                    try {
                        const csrf = await fetch("/api/auth/csrf/", { credentials: "same-origin" }).then(r => r.json());
                        const res = await fetch(`/api/consultations/manager/applications/${app.id}/decision/`, {
                            method: "POST",
                            credentials: "same-origin",
                            headers: { "Content-Type": "application/json", "X-CSRFToken": csrf.csrfToken },
                            body: JSON.stringify({ action: "reject", decision_note: note })
                        });
                        const rData = await res.json();
                        if (!res.ok) throw new Error(rData.detail || "رد درخواست انجام نشد.");
                        alert(rData.detail || "درخواست رد شد.");
                        await loadConsultantApplications();
                    } catch (e) {
                        alert(e.message);
                    } finally {
                        rejectBtn.disabled = false;
                    }
                };

                btnRow.append(approveBtn, rejectBtn);
                decisionBox.append(noteInput, btnRow);
                bottomSec.append(decisionBox);
            } else if (app.decision_note) {
                const noteBox = make("div", "");
                noteBox.style.cssText = "background: #f8fafc; border-radius: 8px; padding: 8px 10px; font-size: 11px; color: #475569; border-right: 3px solid #cbd5e1;";
                noteBox.textContent = `یادداشت مدیر: ${app.decision_note}`;
                bottomSec.append(noteBox);
            }

            card.append(bottomSec);
            target.append(card);
        });
    };

    const loadConsultantApplications = async () => {
        const message = document.getElementById("manager-apps-message");
        if (message) message.textContent = "در حال دریافت درخواست‌ها…";

        try {
            const response = await fetch("/api/consultations/manager/applications/", { credentials: "same-origin" });
            const data = await response.json();
            if (!response.ok) throw new Error(data.detail || "دریافت درخواست‌ها انجام نشد.");

            state.applications = data.results || [];
            
            // Calculate status counts
            const total = state.applications.length;
            const pendingCount = state.applications.filter(a => a.status === "pending").length;
            const approvedCount = state.applications.filter(a => a.status === "approved").length;
            const rejectedCount = state.applications.filter(a => a.status === "rejected").length;

            // Update DOM badges & stats
            const statTotal = document.getElementById("manager-apps-stat-total");
            const statPending = document.getElementById("manager-apps-stat-pending");
            const statApproved = document.getElementById("manager-apps-stat-approved");
            const statRejected = document.getElementById("manager-apps-stat-rejected");
            const dashBadge = document.getElementById("manager-apps-stat-dashboard");
            const navBadge = document.getElementById("manager-nav-badge-apps");

            if (statTotal) statTotal.textContent = numberFa(total);
            if (statPending) statPending.textContent = numberFa(pendingCount);
            if (statApproved) statApproved.textContent = numberFa(approvedCount);
            if (statRejected) statRejected.textContent = numberFa(rejectedCount);
            if (dashBadge) dashBadge.textContent = numberFa(pendingCount);

            if (navBadge) {
                if (pendingCount > 0) {
                    navBadge.style.display = "inline-block";
                    navBadge.textContent = numberFa(pendingCount);
                } else {
                    navBadge.style.display = "none";
                }
            }

            renderConsultantApplications();
        } catch (err) {
            if (message) message.textContent = err.message || "خطا در دریافت درخواست‌های مشاوران.";
        }
    };

    // Filter tab button bindings
    document.querySelectorAll(".manager-apps-tab-btn").forEach((btn) => {
        btn.addEventListener("click", () => {
            document.querySelectorAll(".manager-apps-tab-btn").forEach(b => {
                b.classList.remove("is-active");
                b.style.background = "transparent";
                b.style.color = "#64748b";
                b.style.boxShadow = "none";
            });
            btn.classList.add("is-active");
            btn.style.background = "#fff";
            btn.style.color = "#0f172a";
            btn.style.boxShadow = "0 1px 3px rgba(0,0,0,0.1)";

            state.activeAppStatusFilter = btn.dataset.status || "all";
            renderConsultantApplications();
        });
    });

    // Stat card click to filter
    const bindStatClick = (id, status) => {
        document.getElementById(id)?.addEventListener("click", () => {
            const targetBtn = document.querySelector(`.manager-apps-tab-btn[data-status="${status}"]`);
            if (targetBtn) targetBtn.click();
        });
    };
    bindStatClick("stat-filter-all", "all");
    bindStatClick("stat-filter-pending", "pending");
    bindStatClick("stat-filter-approved", "approved");
    bindStatClick("stat-filter-rejected", "rejected");

    document.getElementById("manager-apps-search")?.addEventListener("input", () => {
        renderConsultantApplications();
    });

    const showPage = (pageName) => {
        const targetPage = document.getElementById(`page-${pageName}`);
        if (!targetPage) return;
        managerPages.forEach((page) => page.classList.remove("is-active"));
        managerNavItems.forEach((item) => item.classList.toggle("is-active", item.dataset.page === pageName));
        targetPage.classList.add("is-active");
        if (managerPageTitle) managerPageTitle.textContent = pageTitles[pageName] || "پنل مدیریت";
        managerSidebar?.classList.remove("is-open");
        if (pageName === "students" || pageName === "consultants") {
            loadUsers(pageName === "students" ? "student" : "consultant");
        }
        if (pageName === "consultant-applications" || pageName === "dashboard") {
            loadConsultantApplications();
        }
        if (pageName === "conversations") loadManagerChatRooms();
        window.scrollTo({ top: 0, behavior: "smooth" });
    };

    managerNavItems.forEach((item) => item.addEventListener("click", (event) => {
        const pageName = item.dataset.page;
        if (!pageName) return;
        event.preventDefault(); window.location.hash = pageName; showPage(pageName);
        toggleSidebar(false);
    }));
    const loadPageFromHash = () => { const name = location.hash.slice(1); showPage(pageTitles[name] ? name : "dashboard"); };
    window.addEventListener("hashchange", loadPageFromHash);
    const managerOverlay = document.getElementById("manager-sidebar-overlay");
    const managerSidebarClose = document.getElementById("manager-sidebar-close");
    const toggleSidebar = (open) => {
        const isOpen = open !== undefined ? open : !managerSidebar?.classList.contains("is-open");
        managerSidebar?.classList.toggle("is-open", isOpen);
        managerOverlay?.classList.toggle("is-active", isOpen);
    };
    managerMenuButton?.addEventListener("click", (e) => {
        e.stopPropagation();
        toggleSidebar();
    });
    managerSidebarClose?.addEventListener("click", () => toggleSidebar(false));
    managerOverlay?.addEventListener("click", () => toggleSidebar(false));
    document.addEventListener("click", (event) => {
        if (managerSidebar?.classList.contains("is-open") && !managerSidebar.contains(event.target) && !managerMenuButton?.contains(event.target)) {
            toggleSidebar(false);
        }
    });
    document.addEventListener("keydown", (event) => {
        if (event.key === "Escape" && managerSidebar?.classList.contains("is-open")) {
            toggleSidebar(false);
        }
    });

    const openModal = (id) => {
        const m = document.getElementById(id);
        if (m) m.style.display = "flex";
    };
    const closeModal = (id) => {
        const m = document.getElementById(id);
        if (m) m.style.display = "none";
    };
    document.querySelectorAll(".modal-close-btn").forEach((btn) => {
        btn.addEventListener("click", () => {
            const modalId = btn.dataset.modal;
            if (modalId) closeModal(modalId);
        });
    });

    const generateRandomPassword = () => {
        const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
        let pass = "Paye@";
        for (let i = 0; i < 5; i++) {
            pass += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return pass;
    };

    let latestCredentials = null;
    const showCredentialsModal = (creds) => {
        latestCredentials = creds;
        document.getElementById("show-creds-fullname").textContent = creds.full_name || "مشاور";
        document.getElementById("show-creds-phone").textContent = creds.phone;
        document.getElementById("show-creds-password").textContent = creds.password;
        const copyBtnText = document.getElementById("btn-copy-creds-text");
        if (copyBtnText) copyBtnText.textContent = "کپی متن کامل پیام برای مشاور";
        openModal("modal-show-creds");
    };

    document.getElementById("btn-copy-creds")?.addEventListener("click", () => {
        if (!latestCredentials) return;
        const emailLine = latestCredentials.email ? `\nایمیل مشاور: ${latestCredentials.email}` : "";
        const text = `سلام ${latestCredentials.full_name} گرامی،\nحساب کاربری شما در سامانه پایه آکادمی فعال شد.\n\nاطلاعات ورود به پنل مشاور:\nنام کاربری (موبایل یا ایمیل): ${latestCredentials.phone}${emailLine}\nرمز عبور: ${latestCredentials.password}\nآدرس ورود: https://paye.academy/login.html\n\n(پس از ورود می‌توانید در صورت تمایل رمز عبور خود را تغییر دهید.)`;
        navigator.clipboard.writeText(text).then(() => {
            const copyBtnText = document.getElementById("btn-copy-creds-text");
            if (copyBtnText) copyBtnText.textContent = "✓ اطلاعات با موفقیت کپی شد!";
            setTimeout(() => {
                if (copyBtnText) copyBtnText.textContent = "کپی متن کامل پیام برای مشاور";
            }, 3000);
        }).catch(() => {
            prompt("متن مشخصات را دستی کپی کنید:", text);
        });
    });

    let currentAppForApproval = null;
    const openApproveModal = (app) => {
        currentAppForApproval = app;
        document.getElementById("approve-app-id").value = app.id;
        document.getElementById("approve-full-name").value = app.full_name;
        document.getElementById("approve-phone").value = app.phone;
        const emailEl = document.getElementById("approve-email");
        if (emailEl) emailEl.value = app.email || "ثبت نشده";
        document.getElementById("approve-password").value = generateRandomPassword();
        document.getElementById("approve-note").value = "";
        const errEl = document.getElementById("approve-modal-error");
        if (errEl) errEl.style.display = "none";
        openModal("modal-approve-app");
    };

    document.getElementById("btn-gen-pwd-approve")?.addEventListener("click", () => {
        document.getElementById("approve-password").value = generateRandomPassword();
    });

    document.getElementById("form-approve-consultant")?.addEventListener("submit", async (e) => {
        e.preventDefault();
        const appId = document.getElementById("approve-app-id").value;
        const phone = document.getElementById("approve-phone").value.trim();
        const password = document.getElementById("approve-password").value.trim();
        const note = document.getElementById("approve-note").value.trim();
        const submitBtn = document.getElementById("btn-submit-approve");
        const errEl = document.getElementById("approve-modal-error");

        submitBtn.disabled = true;
        if (errEl) errEl.style.display = "none";

        try {
            const csrf = await fetch("/api/auth/csrf/", { credentials: "same-origin" }).then(r => r.json());
            const res = await fetch(`/api/consultations/manager/applications/${appId}/decision/`, {
                method: "POST",
                credentials: "same-origin",
                headers: { "Content-Type": "application/json", "X-CSRFToken": csrf.csrfToken },
                body: JSON.stringify({ action: "approve", phone, password, decision_note: note })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.detail || "تأیید درخواست انجام نشد.");
            closeModal("modal-approve-app");
            const creds = data.credentials || { full_name: document.getElementById("approve-full-name").value, phone, password };
            if (currentAppForApproval?.email) creds.email = currentAppForApproval.email;
            showCredentialsModal(creds);
            await loadConsultantApplications();
            await loadUsers("consultant");
        } catch (err) {
            if (errEl) {
                errEl.style.display = "block";
                errEl.textContent = err.message;
            } else {
                alert(err.message);
            }
        } finally {
            submitBtn.disabled = false;
        }
    });

    const openResetPasswordModal = (user) => {
        document.getElementById("reset-user-id").value = user.id;
        document.getElementById("reset-consultant-name").value = user.full_name || user.phone;
        document.getElementById("reset-password-input").value = generateRandomPassword();
        const errEl = document.getElementById("reset-modal-error");
        if (errEl) errEl.style.display = "none";
        openModal("modal-reset-pwd");
    };

    document.getElementById("btn-gen-pwd-reset")?.addEventListener("click", () => {
        document.getElementById("reset-password-input").value = generateRandomPassword();
    });

    document.getElementById("form-reset-consultant-pwd")?.addEventListener("submit", async (e) => {
        e.preventDefault();
        const userId = document.getElementById("reset-user-id").value;
        const password = document.getElementById("reset-password-input").value.trim();
        const submitBtn = document.getElementById("btn-submit-reset-pwd");
        const errEl = document.getElementById("reset-modal-error");

        submitBtn.disabled = true;
        if (errEl) errEl.style.display = "none";

        try {
            const csrf = await fetch("/api/auth/csrf/", { credentials: "same-origin" }).then(r => r.json());
            const res = await fetch(`/api/manager/users/${userId}/password/`, {
                method: "POST",
                credentials: "same-origin",
                headers: { "Content-Type": "application/json", "X-CSRFToken": csrf.csrfToken },
                body: JSON.stringify({ password })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.detail || "تنظیم رمز جدید انجام نشد.");
            closeModal("modal-reset-pwd");
            showCredentialsModal(data.credentials || { full_name: document.getElementById("reset-consultant-name").value, phone: "---", password });
        } catch (err) {
            if (errEl) {
                errEl.style.display = "block";
                errEl.textContent = err.message;
            } else {
                alert(err.message);
            }
        } finally {
            submitBtn.disabled = false;
        }
    });

    // Manager Self Change Password Form Handler
    const pwdForm = document.getElementById("manager-change-password-form");
    const pwdMsg = document.getElementById("manager-pwd-message");
    const pwdBtn = document.getElementById("manager-pwd-submit-btn");
    pwdForm?.addEventListener("submit", async (e) => {
        e.preventDefault();
        const oldPwd = document.getElementById("mgr-old-pwd")?.value || "";
        const newPwd = document.getElementById("mgr-new-pwd")?.value || "";
        const confirmPwd = document.getElementById("mgr-confirm-pwd")?.value || "";

        if (newPwd !== confirmPwd) {
            pwdMsg.style.display = "block";
            pwdMsg.style.background = "#fef2f2";
            pwdMsg.style.color = "#dc2626";
            pwdMsg.textContent = "تکرار رمز عبور جدید یکسان نیست.";
            return;
        }
        if (newPwd.length < 8) {
            pwdMsg.style.display = "block";
            pwdMsg.style.background = "#fef2f2";
            pwdMsg.style.color = "#dc2626";
            pwdMsg.textContent = "رمز عبور جدید باید حداقل ۸ کاراکتر باشد.";
            return;
        }

        pwdBtn.disabled = true;
        pwdMsg.style.display = "block";
        pwdMsg.style.background = "#eff6ff";
        pwdMsg.style.color = "#2563eb";
        pwdMsg.textContent = "در حال تغییر رمز عبور…";

        try {
            const csrf = await fetch("/api/auth/csrf/", { credentials: "same-origin" }).then(r => r.json());
            const res = await fetch("/api/auth/password/change/", {
                method: "POST",
                credentials: "same-origin",
                headers: { "Content-Type": "application/json", "X-CSRFToken": csrf.csrfToken },
                body: JSON.stringify({
                    old_password: oldPwd,
                    new_password: newPwd,
                    new_password_confirm: confirmPwd
                })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.detail || "تغییر رمز عبور انجام نشد.");
            pwdMsg.style.background = "#f0fdf4";
            pwdMsg.style.color = "#16a34a";
            pwdMsg.textContent = data.detail || "رمز عبور مدیر با موفقیت تغییر کرد.";
            pwdForm.reset();
        } catch (err) {
            pwdMsg.style.background = "#fef2f2";
            pwdMsg.style.color = "#dc2626";
            pwdMsg.textContent = err.message;
        } finally {
            pwdBtn.disabled = false;
        }
    });

    document.getElementById("manager-logout-btn")?.addEventListener("click", async () => {
        try {
            const csrf = await fetch("/api/auth/csrf/", { credentials: "same-origin" }).then((r) => r.json());
            await fetch("/api/auth/logout/", {
                method: "POST",
                credentials: "same-origin",
                headers: { "X-CSRFToken": csrf.csrfToken }
            });
        } finally {
            location.assign("login.html");
        }
    });

    const meResponse = await fetch("/api/auth/me/", { credentials: "same-origin", cache: "no-store" });
    if (!meResponse.ok) { location.assign("login.html"); return; }
    const me = await meResponse.json();
    if (!["manager", "admin"].includes(me.role)) { location.assign(me.role === "student" ? "student.html" : "consultant.html"); return; }

    const mgrHeaderName = document.getElementById("manager-header-name");
    const mgrProfileName = document.getElementById("manager-profile-name");
    const mgrProfilePhone = document.getElementById("manager-profile-phone");
    const mgrHeaderAvatar = document.getElementById("manager-header-avatar");
    const managerName = me.full_name || "مدیر مجموعه";
    if (mgrHeaderName) mgrHeaderName.textContent = managerName;
    if (mgrProfileName) mgrProfileName.textContent = managerName;
    if (mgrProfilePhone) mgrProfilePhone.textContent = me.phone || "---";
    if (mgrHeaderAvatar) mgrHeaderAvatar.textContent = managerName.trim().charAt(0) || "م";

    loadPageFromHash();
    loadUsers("student");
    loadUsers("consultant");
    loadConsultantApplications();
});

