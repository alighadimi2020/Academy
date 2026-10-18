document.addEventListener("DOMContentLoaded", async () => {
    if (new URLSearchParams(location.search).get("embedded") === "manager") {
        document.body.classList.add("blog-review-embedded");
        document.getElementById("review-back-link")?.remove();
        document.querySelector(".blog-topbar")?.remove();
    }
    const list = document.getElementById("pending-posts");
    const message = document.getElementById("review-message");
    const make = (tag, className, text) => { const node = document.createElement(tag); if (className) node.className = className; if (text !== undefined) node.textContent = text; return node; };
    const statusMessage = (text, error = false) => { message.textContent = text; message.className = `blog-message${error ? " is-error" : " is-success"}`; };
    const numberFa = (value) => new Intl.NumberFormat("fa-IR").format(value);
    const toPersianDateTime = (dateInput) => {
        if (!dateInput) return "—";
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
    try {
        const me = await fetch(`/api/auth/me/?_t=${Date.now()}`, { credentials: "same-origin", cache: "no-store" });
        if (!me.ok) { location.assign("login.html"); return; }
        const user = await me.json();
        if (!["manager", "admin"].includes(user.role)) { list.textContent = "دسترسی بررسی مقاله‌ها فقط برای مدیر مجموعه و ادمین سایت است."; return; }
    } catch { list.textContent = "بررسی دسترسی ممکن نشد؛ اتصال را بررسی کنید."; return; }

    const loadPending = async () => {
        const response = await fetch("/api/blog/pending/", { credentials: "same-origin" });
        const data = await response.json();
        if (!response.ok) throw new Error(data.detail || "دریافت فهرست انجام نشد.");
        list.replaceChildren();
        if (!data.results.length) { list.append(make("p", "blog-muted", "مقاله‌ای در انتظار تأیید نیست.")); return; }
        data.results.forEach((post) => {
            const card = make("article", "blog-review-card");
            const title = make("h2", "blog-review-title", post.title);
            const metadata = make("div", "blog-review-meta");
            [post.category, `نویسنده: ${post.author}`, `زمان مطالعه: ${numberFa(post.reading_minutes)} دقیقه`, `ارسال: ${toPersianDateTime(post.created_at)}`].filter(Boolean).forEach((value) => metadata.append(make("span", "", value)));
            card.append(title, metadata, make("h3", "blog-review-subheading", "خلاصه مقاله"), make("p", "", post.summary));
            const appendImagesAfter = (sectionIndex) => {
                const images = (post.images || []).filter((image) => Number(image.after_section || 0) === sectionIndex);
                if (!images.length) return;
                card.append(make("h3", "blog-review-subheading", sectionIndex === 0 ? "تصاویر پس از خلاصه" : `تصاویر پس از بخش ${numberFa(sectionIndex)}`));
                const gallery = make("div", "blog-gallery");
                images.forEach((image, index) => { const img = document.createElement("img"); img.src = image.url; img.alt = image.alt_text || `تصویر ${index + 1}`; img.loading = "lazy"; gallery.append(img); });
                card.append(gallery);
            };
            appendImagesAfter(0);
            if (post.sections?.length) {
                const sectionTitle = make("h3", "blog-review-subheading", `متن مقاله · ${numberFa(post.sections.length)} بخش`); card.append(sectionTitle);
                const toc = make("nav", "blog-toc"); toc.setAttribute("aria-label", "فهرست تیترهای مقاله"); toc.append(make("h4", "", "فهرست تیترها"));
                const ol = document.createElement("ol");
                post.sections.forEach((section, index) => {
                    const li = document.createElement("li");
                    const targetId = `review-${post.id}-${index + 1}`;
                    const link = make("a", "", section.heading);
                    link.href = `#${targetId}`;
                    link.addEventListener("click", (e) => {
                        e.preventDefault();
                        const block = document.getElementById(targetId);
                        if (block) {
                            block.scrollIntoView({ behavior: "smooth", block: "start" });
                            block.classList.add("is-target-highlight");
                            setTimeout(() => block.classList.remove("is-target-highlight"), 1600);
                        }
                    });
                    li.append(link);
                    ol.append(li);
                });
                toc.append(ol); card.append(toc);
                post.sections.forEach((section, index) => { const block = make("section", "blog-review-section"); block.id = `review-${post.id}-${index + 1}`; block.append(make("h4", "", section.heading), make("p", "", section.body)); card.append(block); appendImagesAfter(index + 1); });
            } else { (post.images || []).filter((image) => Number(image.after_section || 0) > 0).forEach((image) => { const gallery = make("div", "blog-gallery"); const img = document.createElement("img"); img.src = image.url; img.alt = image.alt_text || "تصویر مقاله"; img.loading = "lazy"; gallery.append(img); card.append(gallery); }); }
            if (post.video_url) {
                card.append(make("h3", "blog-review-subheading", "ویدیوی آپارات"));
                if (post.video_embed_url) { const player = make("div", "blog-video"); const frame = document.createElement("iframe"); frame.src = post.video_embed_url; frame.title = `پیش‌نمایش آپارات: ${post.title}`; frame.loading = "lazy"; frame.referrerPolicy = "strict-origin-when-cross-origin"; frame.allow = "fullscreen; picture-in-picture"; frame.allowFullscreen = true; frame.setAttribute("sandbox", "allow-scripts allow-same-origin allow-presentation"); player.append(frame); card.append(player); }
                const videoLink = make("a", "blog-back", "باز کردن ویدیو در آپارات"); videoLink.href = post.video_url; videoLink.target = "_blank"; videoLink.rel = "noopener noreferrer"; card.append(videoLink);
            }
            const noteLabel = make("label", "blog-field"); noteLabel.append(make("span", "", "توضیح برای نویسنده (اختیاری؛ برای رد مقاله)"));
            const note = document.createElement("textarea"); note.maxLength = 500; note.rows = 2; note.placeholder = "موارد لازم برای اصلاح را بنویسید…"; noteLabel.append(note); card.append(noteLabel);
            const actions = make("div", "blog-review-card__actions");
            const approve = make("button", "blog-button blog-button--primary", "تأیید و انتشار"); approve.type = "button";
            const reject = make("button", "blog-button blog-button--light", "رد مقاله"); reject.type = "button";
            const moderate = async (action) => {
                approve.disabled = reject.disabled = true;
                try {
                    const csrf = await fetch("/api/auth/csrf/", { credentials: "same-origin" }).then((result) => result.json());
                    const result = await fetch(`/api/blog/posts/${encodeURIComponent(post.id)}/moderate/`, { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json", "X-CSRFToken": csrf.csrfToken }, body: JSON.stringify({ action, note: note.value.trim() }) });
                    const payload = await result.json(); if (!result.ok) throw new Error(payload.detail || "عملیات انجام نشد.");
                    statusMessage(action === "approve" ? "مقاله تأیید و منتشر شد." : "مقاله رد شد و توضیح برای نویسنده ذخیره شد."); await loadPending();
                } catch (error) { statusMessage(error.message || "عملیات انجام نشد.", true); approve.disabled = reject.disabled = false; }
            };
            approve.addEventListener("click", () => moderate("approve")); reject.addEventListener("click", () => moderate("reject"));
            actions.append(approve, reject); card.append(actions); list.append(card);
        });
    };
    try { await loadPending(); } catch (error) { list.textContent = error.message || "دریافت مقاله‌ها انجام نشد."; }
});
