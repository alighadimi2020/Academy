document.addEventListener("DOMContentLoaded", async () => {
    const sidebar = document.getElementById("consultantSidebar");
    const menuButton = document.getElementById("consultantMenu");
    const articleList = document.getElementById("consultant-article-list");
    const count = document.getElementById("consultant-article-count");
    const numberFa = (value) => new Intl.NumberFormat("fa-IR").format(value);
    const titles = { dashboard: "داشبورد", students: "دانش‌آموزان من", activities: "فعالیت‌ها", conversations: "گفتگوها", articles: "مقالات من", profile: "پروفایل" };
    const showPage = (name) => {
        document.querySelectorAll(".payeh-consultant__nav-item[data-page]").forEach((item) => item.classList.toggle("active", item.dataset.page === name));
        const title = document.getElementById("consultantPageTitle");
        if (title) title.textContent = titles[name] || titles.dashboard;
        const section = name === "articles" ? "consultant-articles" : name === "profile" ? "consultant-profile-settings" : ["students", "conversations"].includes(name) ? "consultant-assigned-students" : null;
        if (section) document.getElementById(section)?.scrollIntoView({ behavior: "smooth", block: "start" });
        else window.scrollTo({ top: 0, behavior: "smooth" });
        sidebar?.classList.remove("is-open");
    };
    document.querySelectorAll(".payeh-consultant__nav-item[data-page]").forEach((item) => item.addEventListener("click", (event) => {
        event.preventDefault(); const name = item.dataset.page; history.replaceState(null, "", `#${name}`); showPage(name);
    }));
    window.addEventListener("hashchange", () => showPage(location.hash.slice(1) || "dashboard"));
    menuButton?.addEventListener("click", () => sidebar?.classList.toggle("is-open"));
    document.querySelector(".payeh-consultant__logout")?.addEventListener("click", async () => {
        try { const csrf = await fetch("/api/auth/csrf/", { credentials: "same-origin" }).then((r) => r.json()); await fetch("/api/auth/logout/", { method: "POST", credentials: "same-origin", headers: { "X-CSRFToken": csrf.csrfToken } }); }
        finally { location.assign("login.html"); }
    });
    try {
        const meResponse = await fetch("/api/auth/me/", { credentials: "same-origin" });
        if (!meResponse.ok) { location.assign("login.html"); return; }
        const user = await meResponse.json();
        if (user.role !== "consultant") { location.assign(user.role === "student" ? "student.html" : "manager.html"); return; }
        const consultantName = user.full_name || "مشاور";
        ["consultant-account-name", "consultant-header-name"].forEach((id) => { const node = document.getElementById(id); if (node) node.textContent = consultantName; });
        loadConsultantProfile();
        loadAssignedStudents();
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

    async function loadAssignedStudents() {
        const target = document.getElementById("consultant-assigned-list");
        if (!target) return;
        try {
            const response = await fetch("/api/consultations/requests/", { credentials: "same-origin" });
            const data = await response.json(); if (!response.ok) throw new Error(data.detail || "دریافت دانش‌آموزان انجام نشد.");
            target.replaceChildren();
            if (!data.results.length) { const empty = document.createElement("p"); empty.className = "consultant-article-hint"; empty.textContent = "هنوز دانش‌آموزی به شما تخصیص داده نشده است."; target.append(empty); return; }
            data.results.forEach((item) => {
                const row = document.createElement("article"); row.className = "consultant-assigned-row";
                const info = document.createElement("div"); const name = document.createElement("strong"); name.textContent = item.student_name;
                const meta = document.createElement("span"); meta.textContent = `${item.student_phone} · ${item.student_grade || ""}${item.student_major ? ` · ${item.student_major}` : ""} · پلن ${item.plan_label}`; info.append(name, meta);
                const link = document.createElement("a"); link.href = `consultation-chat.html?request=${encodeURIComponent(item.id)}`; link.textContent = "گفت‌وگو";
                row.append(info, link); target.append(row);
            });
        } catch (error) { target.textContent = error.message || "دریافت فهرست انجام نشد."; }
    }

    showPage(location.hash.slice(1) || "dashboard");
});
