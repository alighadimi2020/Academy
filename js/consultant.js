document.addEventListener("DOMContentLoaded", async () => {
    const sidebar = document.getElementById("consultantSidebar");
    const menuButton = document.getElementById("consultantMenu");
    const articleList = document.getElementById("consultant-article-list");
    const count = document.getElementById("consultant-article-count");
    const numberFa = (value) => new Intl.NumberFormat("fa-IR").format(value);
    const normalizeDigits = (value) => String(value).replace(/[۰-۹]/g, digit => String("۰۱۲۳۴۵۶۷۸۹".indexOf(digit))).replace(/[٠-٩]/g, digit => String("٠١٢٣٤٥٦٧٨٩".indexOf(digit)));
    let plannerStudents = [];
    const titles = { dashboard: "داشبورد", planner: "برنامه‌ریزی درسی", students: "دانش‌آموزان من", activities: "گزارش‌های مطالعه", conversations: "گفتگوها", articles: "مقالات من", profile: "پروفایل" };
    const showPage = (name) => {
        document.querySelectorAll(".payeh-consultant__nav-item[data-page]").forEach((item) => item.classList.toggle("active", item.dataset.page === name));
        const title = document.getElementById("consultantPageTitle");
        if (title) title.textContent = titles[name] || titles.dashboard;
        const section = name === "planner" ? "consultant-study-planner" : name === "articles" ? "consultant-articles" : name === "profile" ? "consultant-profile-settings" : name === "conversations" ? "consultant-conversation-rooms" : name === "students" ? "consultant-assigned-students" : name === "activities" ? "consultant-study-reports-section" : null;
        if (section) document.getElementById(section)?.scrollIntoView({ behavior: "smooth", block: "start" });
        else window.scrollTo({ top: 0, behavior: "smooth" });
        sidebar?.classList.remove("is-open");
        if (name === "activities") { loadDailyStudyReports(); loadTelegramStatus(); }
    };
    document.querySelectorAll(".payeh-consultant__nav-item[data-page]").forEach((item) => item.addEventListener("click", (event) => {
        event.preventDefault(); const name = item.dataset.page; history.replaceState(null, "", `#${name}`); showPage(name);
    }));
    window.addEventListener("hashchange", () => showPage(location.hash.slice(1) || "dashboard"));
    menuButton?.addEventListener("click", () => sidebar?.classList.toggle("is-open"));
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
        const response = await fetch("/api/blog/mine/", { credentials: "same-origin" });
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.detail || "دریافت مقاله‌ها انجام نشد.");
        const posts = payload.results || [];
        if (count) count.textContent = numberFa(posts.length);
        articleList.replaceChildren();
        if (!posts.length) { const empty = document.createElement("p"); empty.textContent = "هنوز مقاله‌ای ثبت نکرده‌اید. از دکمهٔ بالا اولین مقاله‌تان را بنویسید."; articleList.append(empty); }
        const labels = { pending: "در انتظار تأیید", published: "منتشرشده", rejected: "نیازمند اصلاح" };
        posts.forEach((post) => {
            const row = document.createElement("article"); row.className = "consultant-article-row";
            const details = document.createElement("div"); const heading = document.createElement("h4"); heading.textContent = post.title;
            const meta = document.createElement("div"); meta.className = "consultant-article-meta";
            const date = post.created_at ? new Date(post.created_at).toLocaleDateString("fa-IR") : "";
            meta.textContent = [post.category, `${numberFa(post.reading_minutes)} دقیقه مطالعه`, date].filter(Boolean).join(" · "); details.append(heading, meta);
            const status = document.createElement("span"); status.className = `consultant-article-status consultant-article-status--${post.status}`; status.textContent = labels[post.status] || post.status; row.append(details, status); articleList.append(row);
            if (post.status === "published") { const link = document.createElement("a"); link.className = "consultant-article-link"; link.href = `blog-detail.html?id=${encodeURIComponent(post.id)}`; link.textContent = "مشاهده مقاله منتشرشده"; details.append(link); }
            if (post.status === "rejected" && post.review_note) { const note = document.createElement("p"); note.className = "consultant-article-note"; note.textContent = `توضیح مدیر: ${post.review_note}`; details.append(note); }
        });
    } catch (error) { if (articleList) articleList.textContent = error.message || "فهرست مقاله‌ها بارگذاری نشد."; }
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
        const loading=document.createElement("p");loading.className="consultant-article-hint";loading.textContent="در حال دریافت برنامه…";plannerWeek.replaceChildren(loading);
        try {
            const response = await fetch(`/api/consultations/study-sessions/?student=${encodeURIComponent(plannerPicker.value)}`, {credentials:"same-origin"});
            const data = await response.json(); if (!response.ok) throw new Error(data.detail || "برنامه دریافت نشد.");
            const names = ["شنبه","یکشنبه","دوشنبه","سه‌شنبه","چهارشنبه","پنجشنبه","جمعه"];
            const grid = document.createElement("div"); grid.className = "planner-week-grid";
            names.forEach((day,index) => { const col=document.createElement("section"); col.className="planner-day"; const h=document.createElement("h4");h.textContent=day;col.append(h);const rows=data.results.filter(x=>x.weekday===index); if(!rows.length){const empty=document.createElement("span");empty.className="planner-day-empty";empty.textContent="بدون برنامه";col.append(empty);} rows.forEach(item=>{const card=document.createElement("article");card.className="planner-session-card";card.style.setProperty("--plan-color",plannerColors[item.color]||plannerColors.mint);const time=document.createElement("span");time.className="planner-session-time";time.textContent=`${numberFa(Math.floor(item.planned_minutes/60))} ساعت و ${numberFa(item.planned_minutes%60)} دقیقه`;const subject=document.createElement("strong");subject.textContent=item.subject;const task=document.createElement("span");task.textContent=item.mode==="test"?`${numberFa(item.test_count)} تست`:item.mode==="written"?"حل تشریحی":"مطالعهٔ درس‌نامه";card.append(time,subject,task);if(item.instructions){const note=document.createElement("small");note.textContent=item.instructions;card.append(note);}col.append(card);});grid.append(col);});plannerWeek.replaceChildren(grid);
        } catch(error) { plannerWeek.textContent=error.message; }
    }
    async function loadStudyReports() {
        const target=document.getElementById("consultant-study-reports"); if(!target||!plannerPicker?.value)return;
        try{const response=await fetch(`/api/consultations/study-reports/?student=${encodeURIComponent(plannerPicker.value)}`,{credentials:"same-origin"});const data=await response.json();if(!response.ok)throw new Error(data.detail||"گزارش‌ها دریافت نشد.");target.replaceChildren();if(!data.results.length){target.textContent="هنوز گزارشی ثبت نشده است.";return;}data.results.forEach(report=>{const row=document.createElement("article");row.className="planner-session-card";const title=document.createElement("strong");title.textContent=`${report.subject} · ${numberFa(report.minutes)} دقیقه`;const day=document.createElement("span");day.textContent=report.study_date;row.append(title,day);if(report.notes){const note=document.createElement("small");note.textContent=report.notes;row.append(note);}target.append(row);});}catch(error){target.textContent=error.message;}
    }
    plannerPicker?.addEventListener("change", ()=>{loadPlannerWeek();loadStudyReports();});
    plannerForm?.addEventListener("submit", async (event) => {
        event.preventDefault(); const message=document.getElementById("planner-form-message"); const studentId=plannerPicker?.value;
        if(!studentId){message.textContent="اول دانش‌آموز را انتخاب کنید.";return;}
        const button=plannerForm.querySelector('button[type="submit"]');button.disabled=true;message.textContent="در حال ذخیره…";
        try { const csrf=await fetch("/api/auth/csrf/",{credentials:"same-origin"}).then(r=>r.json());const payload=Object.fromEntries(new FormData(plannerForm));payload.student_id=Number(studentId);const response=await fetch("/api/consultations/study-sessions/create/",{method:"POST",credentials:"same-origin",headers:{"Content-Type":"application/json","X-CSRFToken":csrf.csrfToken},body:JSON.stringify(payload)});const result=await response.json();if(!response.ok)throw new Error(result.detail||"ذخیره برنامه انجام نشد.");message.textContent="سهمیهٔ مطالعه به برنامهٔ دانش‌آموز اضافه شد.";plannerForm.reset();await loadPlannerWeek();await loadStudyReports();}catch(error){message.textContent=error.message;}finally{button.disabled=false;}
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
                    date.textContent = `تاریخ: ${r.study_date}`;
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

    async function loadAssignedStudents() {
        const target = document.getElementById("consultant-assigned-list");
        const dashboardList = document.getElementById("consultant-dashboard-students-list");
        if (!target) return;
        const selectedStudentId=document.getElementById("planner-student")?.value||"";
        try {
            const response = await fetch("/api/consultations/requests/", { credentials: "same-origin" });
            const data = await response.json(); if (!response.ok) throw new Error(data.detail || "دریافت دانش‌آموزان انجام نشد.");
            target.replaceChildren();
            if (dashboardList) dashboardList.replaceChildren();
            const roomTarget = document.getElementById("consultant-chat-rooms");
            const roomCount = document.getElementById("consultant-chat-room-count");
            if (roomTarget) roomTarget.replaceChildren();
            plannerStudents = data.results || [];
            if (roomCount) roomCount.textContent = `${numberFa(plannerStudents.length)} اتاق`;
            const picker = document.getElementById("planner-student");
            if (picker) { picker.replaceChildren(); if (!plannerStudents.length) { picker.add(new Option("هنوز دانش‌آموزی تخصیص داده نشده", "")); picker.disabled = true; } else { picker.disabled = false; picker.add(new Option("دانش‌آموز را انتخاب کنید", "")); plannerStudents.forEach((item) => picker.add(new Option(item.student_name, item.student_id))); if(plannerStudents.some(item=>String(item.student_id)===selectedStudentId))picker.value=selectedStudentId; } }
            const search=normalizeDigits((document.getElementById("consultant-student-search")?.value||"").trim()).toLocaleLowerCase("fa");
            const grade=document.getElementById("consultant-student-grade")?.value||"", major=document.getElementById("consultant-student-major")?.value||"", gender=document.getElementById("consultant-student-gender")?.value||"";
            const visibleStudents=plannerStudents.filter(item=>{
                const matchesSearch=!search||normalizeDigits(`${item.student_name} ${item.student_phone}`).toLocaleLowerCase("fa").includes(search);
                const matchesGrade=!grade||item.student_grade_value===grade;
                const matchesMajor=!major||item.student_major_value===major;
                const matchesGender=!gender||(gender==="unspecified"?!item.student_gender:item.student_gender===gender);
                return matchesSearch&&matchesGrade&&matchesMajor&&matchesGender;
            });
            const filterCount=document.getElementById("consultant-student-filter-count");if(filterCount)filterCount.textContent=`نمایش ${numberFa(visibleStudents.length)} از ${numberFa(plannerStudents.length)} دانش‌آموز`;
            if(!visibleStudents.length&&plannerStudents.length){const empty=document.createElement("p");empty.className="consultant-chat-empty";empty.textContent="دانش‌آموزی با این فیلترها پیدا نشد.";target.append(empty);}
            if (!data.results.length) {
                const empty = document.createElement("p"); empty.className = "consultant-article-hint"; empty.textContent = "پس از تخصیص دانش‌آموز توسط مدیر، نام او را در بخش برنامه‌ریزی انتخاب کنید."; target.append(empty);
                if (dashboardList) { const emptyDash = document.createElement("p"); emptyDash.className = "consultant-article-hint"; emptyDash.textContent = "هنوز دانش‌آموزی به شما تخصیص داده نشده است."; dashboardList.append(emptyDash); }
                if (roomTarget) { const noRooms = document.createElement("p"); noRooms.className = "consultant-chat-empty"; noRooms.textContent = "هنوز اتاق گفت‌وگویی ندارید. پس از تخصیص دانش‌آموز، اتاقش اینجا نمایش داده می‌شود."; roomTarget.append(noRooms); }
                return;
            }

            // Populate dashboard assigned students cleanly and securely
            if (dashboardList) {
                plannerStudents.forEach((item) => {
                    const card = document.createElement("article");
                    card.className = "payeh-consultant__student-card";
                    const main = document.createElement("div");
                    main.className = "payeh-consultant__student-main";
                    const avatar = document.createElement("div");
                    avatar.className = "payeh-consultant__student-avatar";
                    avatar.textContent = (item.student_name || "د").trim().slice(0, 1);
                    const textWrap = document.createElement("div");
                    const strong = document.createElement("strong");
                    strong.textContent = item.student_name || "دانش‌آموز";
                    const sub = document.createElement("span");
                    sub.textContent = `${item.student_phone} · ${item.student_grade || ""} ${item.student_major || ""}`;
                    textWrap.append(strong, sub);
                    main.append(avatar, textWrap);

                    const statusBadge = document.createElement("div");
                    statusBadge.className = "payeh-consultant__student-status";
                    const dot = document.createElement("span");
                    statusBadge.append(dot, document.createTextNode("فعال"));

                    const actionBtn = document.createElement("a");
                    actionBtn.className = "payeh-consultant__student-action";
                    actionBtn.href = `consultation-chat.html?request=${encodeURIComponent(item.id)}`;
                    actionBtn.textContent = "گفتگو و برنامه";

                    card.append(main, statusBadge, actionBtn);
                    dashboardList.append(card);
                });
            }

            data.results.forEach((item) => {
                if (roomTarget) {
                    const room = document.createElement("article"); room.className = "consultant-chat-room";
                    const avatar = document.createElement("span"); avatar.className = "consultant-chat-room__avatar"; avatar.textContent = (item.student_name || "د").trim().slice(0,1);
                    const detail = document.createElement("div"); detail.className = "consultant-chat-room__detail";
                    const studentName = document.createElement("strong"); studentName.textContent = item.student_name || "دانش‌آموز";
                    const meta = document.createElement("span"); meta.textContent = [item.student_grade, item.student_major, `پلن ${item.plan_label}`].filter(Boolean).join(" · ");
                    const preview = document.createElement("small"); preview.textContent = "گفت‌وگوی خصوصی با مشاور";
                    detail.append(studentName, meta, preview);
                    const open = document.createElement("a"); open.className = "consultant-chat-room__open"; open.href = `consultation-chat.html?request=${encodeURIComponent(item.id)}`; open.textContent = "ورود به اتاق";
                    room.append(avatar, detail, open); roomTarget.append(room);
                }
                const row = document.createElement("article"); row.className = "consultant-assigned-row";
                if(!visibleStudents.some(student=>student.id===item.id))return;
                const info = document.createElement("div"); const name = document.createElement("strong"); name.textContent = item.student_name;
                const meta = document.createElement("span"); meta.textContent = `${item.student_phone} · ${item.student_grade || ""}${item.student_major ? ` · ${item.student_major}` : ""} · ${item.student_gender_label||"ثبت نشده"} · پلن ${item.plan_label}`; info.append(name, meta);
                const link = document.createElement("a"); link.href = `consultation-chat.html?request=${encodeURIComponent(item.id)}`; link.textContent = "گفت‌وگو";
                row.append(info, link); target.append(row);
            });
        } catch (error) { target.textContent = error.message || "دریافت فهرست انجام نشد."; }
    }

    showPage(location.hash.slice(1) || "dashboard");
});
