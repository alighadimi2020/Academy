document.addEventListener("DOMContentLoaded", async () => {
    const form = document.getElementById("blog-form");
    const sectionsRoot = document.getElementById("blog-sections");
    const imageInput = document.getElementById("blog-images");
    const preview = document.getElementById("image-preview");
    const message = document.getElementById("blog-message");
    const readingTime = document.getElementById("reading-time");
    const addButton = document.getElementById("add-section");
    const submitButton = document.getElementById("submit-blog");
    const api = "/api/blog/";
    const statusLabels = { pending: "در انتظار تأیید", published: "منتشرشده", rejected: "ردشده" };
    let editingPostId = new URLSearchParams(window.location.search).get("edit");
    const numberFa = (value) => new Intl.NumberFormat("fa-IR").format(value);

    const meResponse = await fetch("/api/auth/me/", { credentials: "same-origin" });
    if (!meResponse.ok) { window.location.assign("login.html"); return; }
    const user = await meResponse.json();
    if (!["consultant", "manager", "admin"].includes(user.role)) {
        document.querySelector("main").replaceChildren(Object.assign(document.createElement("p"), { textContent: "فقط حساب مشاور یا مدیر می‌تواند مقاله ثبت کند." }));
        return;
    }
    if (["manager", "admin"].includes(user.role)) document.getElementById("review-link").hidden = false;

    const setMessage = (text, error = false) => {
        message.textContent = text;
        message.className = `blog-message${error ? " is-error" : " is-success"}`;
    };

    const updateReadingTime = () => {
        const text = [...form.querySelectorAll('[name="heading"], [name="body"], [name="summary"]')]
            .map((field) => field.value.trim()).join(" ");
        const words = text.split(/\s+/).filter(Boolean).length;
        readingTime.textContent = `${numberFa(Math.max(1, Math.ceil(words / 200)))} دقیقه`;
    };

    const addSection = () => {
        if (sectionsRoot.children.length >= 20) return;
        const section = document.createElement("section");
        section.className = "blog-section";
        const head = document.createElement("div");
        head.className = "blog-section__head";
        const label = document.createElement("strong");
        label.textContent = `بخش ${numberFa(sectionsRoot.children.length + 1)}`;
        const remove = document.createElement("button");
        remove.type = "button";
        remove.className = "blog-remove";
        remove.textContent = "حذف بخش";
        remove.addEventListener("click", () => { section.remove(); renumberSections(); updateReadingTime(); });
        head.append(label, remove);
        const heading = document.createElement("input");
        heading.name = "heading";
        heading.maxLength = 140;
        heading.required = true;
        heading.placeholder = "تیتر بخش، مثل: نکته‌های مهم برنامه‌ریزی";
        heading.setAttribute("aria-label", "تیتر بخش");
        heading.addEventListener("input", () => { updateReadingTime(); refreshImagePlacementOptions(); });
        const body = document.createElement("textarea");
        body.name = "body";
        body.maxLength = 20000;
        body.required = true;
        body.placeholder = "متن این بخش را بنویسید…";
        body.setAttribute("aria-label", "متن بخش");
        body.addEventListener("input", updateReadingTime);
        section.append(head, heading, body);
        sectionsRoot.append(section);
        renumberSections();
        refreshImagePlacementOptions();
        updateReadingTime();
    };

    const renumberSections = () => {
        [...sectionsRoot.querySelectorAll(".blog-section__head strong")]
            .forEach((label, index) => { label.textContent = `بخش ${numberFa(index + 1)}`; });
        addButton.disabled = sectionsRoot.children.length >= 20;
        refreshImagePlacementOptions();
    };

    function refreshImagePlacementOptions() {
        preview.querySelectorAll("select[name=\"image_positions\"]").forEach((select) => {
            const previous = Number(select.value || 0);
            const options = [new Option("بعد از خلاصه (قبل از بخش اول)", "0")];
            [...sectionsRoot.querySelectorAll(".blog-section")].forEach((section, index) => {
                const heading = section.querySelector('[name="heading"]').value.trim();
                options.push(new Option(`بعد از بخش ${numberFa(index + 1)}${heading ? `: ${heading}` : ""}`, String(index + 1)));
            });
            select.replaceChildren(...options);
            select.value = String(Math.min(previous, options.length - 1));
        });
    }

    addButton.addEventListener("click", addSection);
    form.querySelector('[name="summary"]').addEventListener("input", updateReadingTime);
    addSection();

    let selectedImageFiles = [];
    let previewObjectUrls = [];
    const renderImagePreviews = () => {
        previewObjectUrls.forEach((url) => URL.revokeObjectURL(url));
        previewObjectUrls = [];
        preview.replaceChildren();
        const invalid = selectedImageFiles.length > 10 || selectedImageFiles.some((file) => file.size > 4 * 1024 * 1024 || !["image/jpeg", "image/png", "image/webp"].includes(file.type));
        if (invalid) {
            selectedImageFiles = [];
            imageInput.value = "";
            preview.replaceChildren();
            setMessage("حداکثر ۱۰ تصویر JPG، PNG یا WebP انتخاب کنید؛ حجم هرکدام باید زیر ۴ مگابایت باشد.", true);
            return;
        }
        selectedImageFiles.forEach((file, index) => {
            const tile = document.createElement("div");
            tile.className = "blog-image-thumb";
            const image = document.createElement("img");
            const objectUrl = URL.createObjectURL(file);
            previewObjectUrls.push(objectUrl);
            image.src = objectUrl;
            image.alt = `پیش‌نمایش تصویر ${index + 1}`;
            const label = document.createElement("span");
            label.textContent = `${numberFa(index + 1)} · ${numberFa((file.size / 1024 / 1024).toFixed(1))} مگابایت`;
            const placement = document.createElement("select");
            placement.name = "image_positions";
            placement.setAttribute("aria-label", `جایگاه تصویر ${index + 1}`);
            const remove = document.createElement("button");
            remove.type = "button";
            remove.className = "blog-image-remove";
            remove.textContent = "حذف تصویر";
            remove.setAttribute("aria-label", `حذف تصویر ${index + 1}`);
            remove.addEventListener("click", () => {
                selectedImageFiles.splice(index, 1);
                const transfer = new DataTransfer();
                selectedImageFiles.forEach((selectedFile) => transfer.items.add(selectedFile));
                imageInput.files = transfer.files;
                renderImagePreviews();
            });
            tile.append(image, label, placement, remove);
            preview.append(tile);
            refreshImagePlacementOptions();
        });
    };

    imageInput.addEventListener("change", () => {
        selectedImageFiles = [...imageInput.files];
        renderImagePreviews();
    });

    form.addEventListener("submit", async (event) => {
        event.preventDefault();
        setMessage("");
        if (!form.reportValidity()) return;
        const sectionData = [...sectionsRoot.querySelectorAll(".blog-section")].map((section) => ({
            heading: section.querySelector('[name="heading"]').value.trim(),
            body: section.querySelector('[name="body"]').value.trim(),
        }));
        if (sectionData.some((section) => !section.heading || !section.body)) {
            setMessage("برای هر بخش تیتر و متن وارد کنید.", true);
            return;
        }

        const payload = new FormData(form);
        payload.set("sections", JSON.stringify(sectionData));
        const csrf = await fetch("/api/auth/csrf/", { credentials: "same-origin" }).then((response) => response.json());
        submitButton.disabled = true;
        submitButton.textContent = "در حال ثبت…";
        try {
            const submitUrl = editingPostId ? `${api}posts/${encodeURIComponent(editingPostId)}/revise/` : `${api}create/`;
            const response = await fetch(submitUrl, {
                method: "POST",
                credentials: "same-origin",
                headers: { "X-CSRFToken": csrf.csrfToken },
                body: payload,
            });
            const result = await response.json().catch(() => ({}));
            if (!response.ok) throw new Error(result.detail || "ثبت مقاله انجام نشد.");
            setMessage(result.status === "published" ? "مقاله منتشر شد و در مجله نمایش داده می‌شود." : editingPostId ? "مقاله اصلاح شد و دوباره برای تأیید مدیر ارسال شد." : "مقاله ثبت شد و پس از تأیید مدیر منتشر می‌شود.");
            editingPostId = null;
            window.history.replaceState(null, "", window.location.pathname);
            form.reset();
            previewObjectUrls.forEach((url) => URL.revokeObjectURL(url));
            previewObjectUrls = [];
            selectedImageFiles = [];
            imageInput.value = "";
            preview.replaceChildren();
            sectionsRoot.replaceChildren();
            addSection();
            await loadMyPosts();
        } catch (error) {
            setMessage(error.message, true);
        } finally {
            submitButton.disabled = false;
            submitButton.textContent = editingPostId ? "ثبت اصلاحات و ارسال برای بررسی" : "ثبت مقاله";
        }
    });

    async function loadMyPosts() {
        const target = document.getElementById("my-posts");
        try {
            const response = await fetch(`${api}mine/`, { credentials: "same-origin" });
            if (!response.ok) throw new Error();
            const data = await response.json();
            target.replaceChildren();
            if (!data.results.length) {
                const empty = document.createElement("p");
                empty.className = "blog-muted";
                empty.textContent = "هنوز نوشته‌ای ثبت نکرده‌اید.";
                target.append(empty);
                return [];
            }
            data.results.forEach((post) => {
                const row = document.createElement("div");
                row.className = "blog-post-row";
                const title = document.createElement("h3");
                title.textContent = post.title;
                const state = document.createElement("span");
                state.className = `blog-status blog-status--${post.status}`;
                state.textContent = statusLabels[post.status] || post.status;
                row.append(title, state);
                if (post.status === "rejected") {
                    const feedback = document.createElement("p");
                    feedback.className = "blog-review-note";
                    feedback.textContent = post.review_note || "مدیر توضیحی ثبت نکرده است؛ می‌توانید مقاله را اصلاح و دوباره ارسال کنید.";
                    const revise = document.createElement("a");
                    revise.href = `blog-editor.html?edit=${encodeURIComponent(post.id)}`;
                    revise.className = "blog-button blog-button--light";
                    revise.textContent = "ویرایش و ارسال دوباره";
                    row.append(feedback, revise);
                }
                if (post.status === "published") {
                    const link = document.createElement("a");
                    link.href = `blog-detail.html?id=${encodeURIComponent(post.id)}`;
                    link.textContent = "مشاهده مقاله";
                    row.append(link);
                }
                target.append(row);
            });
            return data.results;
        } catch {
            target.textContent = "فهرست نوشته‌ها بارگذاری نشد.";
            return [];
        }
    }

    const myPosts = await loadMyPosts();
    if (editingPostId) {
        const post = myPosts.find((item) => String(item.id) === String(editingPostId) && item.status === "rejected");
        if (!post) {
            setMessage("این مقاله برای ویرایش پیدا نشد یا در وضعیت قابل اصلاح نیست.", true);
            editingPostId = null;
        } else {
            form.elements.namedItem("title").value = post.title || "";
            form.elements.namedItem("summary").value = post.summary || "";
            form.elements.namedItem("category").value = post.category || "";
            form.elements.namedItem("video_url").value = post.video_url || "";
            sectionsRoot.replaceChildren();
            (post.sections || []).forEach((item) => {
                addSection();
                const section = sectionsRoot.lastElementChild;
                section.querySelector("[name=heading]").value = item.heading || "";
                section.querySelector("[name=body]").value = item.body || "";
            });
            if (!sectionsRoot.children.length) addSection();
            document.querySelector(".blog-intro h1").textContent = "ویرایش و ارسال دوباره مقاله";
            submitButton.textContent = "ثبت اصلاحات و ارسال برای بررسی";
            setMessage(post.review_note ? `توضیح مدیر: ${post.review_note} · تصویرهای فعلی حفظ می‌شوند مگر اینکه تصویر تازه‌ای انتخاب کنید.` : "مدیر توضیحی ثبت نکرده است؛ تصویرهای فعلی حفظ می‌شوند مگر اینکه تصویر تازه‌ای انتخاب کنید.");
            updateReadingTime();
        }
    }
});
