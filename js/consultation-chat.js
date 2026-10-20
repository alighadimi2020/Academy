document.addEventListener("DOMContentLoaded", async () => {
    const params = new URLSearchParams(location.search);
    const requestId = params.get("request");
    const staffConversationId = params.get("staff");
    const isStaffChat = Boolean(staffConversationId);
    const conversationId = isStaffChat ? staffConversationId : requestId;
    const messagesPath = isStaffChat ? `/api/consultations/staff-conversations/${encodeURIComponent(staffConversationId)}/messages/` : `/api/consultations/requests/${encodeURIComponent(requestId)}/messages/`;
    const target = document.getElementById("chat-messages");
    const form = document.getElementById("chat-form");
    const bodyField = document.getElementById("chat-body");
    const imageInput = document.getElementById("chat-image");
    const attachButton = document.getElementById("chat-attach");
    const preview = document.getElementById("chat-image-preview");
    const sendButton = document.getElementById("chat-send");
    const error = document.getElementById("chat-error");
    const limit = document.getElementById("chat-limit");
    const title = document.getElementById("chat-title");
    const fa = new Intl.NumberFormat("fa-IR");
    const maxImageBytes = 5 * 1024 * 1024;
    const acceptedTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
    let currentUser;
    let timer;
    let selectedImage = null;
    let previewUrl = null;
    let remainingImages = 5;

    const make = (tag, cls, text) => {
        const el = document.createElement(tag);
        if (cls) el.className = cls;
        if (text !== undefined) el.textContent = text;
        return el;
    };
    const setError = (text, failed = true) => {
        error.textContent = text;
        error.className = `consultation-message${failed ? " is-error" : " is-success"}`;
    };
    const setBackLink = (href, text) => {
        [document.getElementById("chat-back-link"), document.getElementById("chat-back-link-mobile")].forEach(link => {
            if (!link) return;
            link.href = href;
            if (link.id === "chat-back-link") link.textContent = text;
        });
    };
    const updateQuota = (data) => {
        remainingImages = data.remaining_images_today ?? 5;
        limit.textContent = `تصویر باقی‌ماندهٔ امروز: ${fa.format(remainingImages)} از ۵ · پیام باقی‌مانده: ${fa.format(data.remaining_today)} از ۱۰۰۰`;
        attachButton.disabled = remainingImages < 1;
        attachButton.title = remainingImages < 1 ? "سهمیهٔ روزانهٔ تصویر تمام شده است" : "پیوست تصویر";
        sendButton.disabled = data.remaining_today < 1;
    };
    let renderedMessageIds = [];
    let isInitialLoad = true;

    function isNearBottom(threshold = 120) {
        if (!target) return true;
        return target.scrollHeight - target.scrollTop - target.clientHeight <= threshold;
    }

    function scrollToBottom(smooth = false) {
        if (!target) return;
        if (smooth) {
            target.scrollTo({ top: target.scrollHeight, behavior: "smooth" });
        } else {
            target.scrollTop = target.scrollHeight;
        }
    }

    const showSelectedImage = (file) => {
        if (previewUrl) URL.revokeObjectURL(previewUrl);
        preview.replaceChildren();
        previewUrl = URL.createObjectURL(file);
        const img = make("img", "chat-image-preview__thumb");
        img.src = previewUrl;
        img.alt = "پیش‌نمایش تصویر پیوست‌شده";
        const info = make("span", "chat-image-preview__name", `${file.name} · ${(file.size / 1024 / 1024).toFixed(2)} مگابایت`);
        const remove = make("button", "chat-image-preview__remove", "×");
        remove.type = "button";
        remove.setAttribute("aria-label", "حذف تصویر پیوست‌شده");
        remove.title = "حذف تصویر پیوست‌شده";
        remove.addEventListener("click", clearSelectedImage);
        preview.append(img, info, remove);
        preview.hidden = false;
    };
    function clearSelectedImage() {
        selectedImage = null;
        imageInput.value = "";
        preview.hidden = true;
        preview.replaceChildren();
        if (previewUrl) URL.revokeObjectURL(previewUrl);
        previewUrl = null;
    }

    if (!/^\d+$/.test(conversationId || "") || (isStaffChat && requestId) || (!isStaffChat && !requestId)) {
        target.textContent = "شناسه گفت‌وگو معتبر نیست.";
        form.hidden = true;
        return;
    }

    const renderBubble = (item) => {
        const mine = item.sender_id === currentUser.id;
        const bubble = make("article", `chat-message${mine ? " is-mine" : " is-other"}`);
        bubble.setAttribute("data-msg-id", String(item.id));
        bubble.append(make("span", "chat-message__name", mine ? "شما" : item.sender_name));
        if (item.image_url) {
            const imagePath = isStaffChat ? `/api/consultations/staff-conversations/${encodeURIComponent(staffConversationId)}/images/${Number(item.id)}/` : `/api/consultations/requests/${encodeURIComponent(requestId)}/images/${Number(item.id)}/`;
            const image = make("img", "chat-message__image");
            image.src = imagePath;
            image.alt = "تصویر ارسال‌شده در گفت‌وگو";
            image.loading = "eager";
            image.referrerPolicy = "same-origin";
            image.addEventListener("load", () => {
                if (isNearBottom(250) || isInitialLoad) {
                    scrollToBottom(false);
                }
            });
            bubble.append(image);
        }
        if (item.body) bubble.append(make("p", "chat-message__body", item.body));
        const stamp = make("time", "chat-message__time", new Date(item.created_at).toLocaleTimeString("fa-IR", { hour: "2-digit", minute: "2-digit" }));
        stamp.dateTime = item.created_at;
        bubble.append(stamp);
        return bubble;
    };

    const loadMessages = async (forceScroll = false) => {
        try {
            const response = await fetch(messagesPath, { credentials: "same-origin" });
            const data = await response.json();
            if (!response.ok) throw new Error(data.detail || "دریافت پیام‌ها ممکن نشد.");

            const results = data.results || [];
            updateQuota(data);

            const newIds = results.map((item) => Number(item.id));
            const isSame = newIds.length === renderedMessageIds.length &&
                newIds.every((id, idx) => id === renderedMessageIds[idx]);

            // No changes at all - keep DOM and scroll completely stable
            if (isSame) {
                return true;
            }

            const wasNearBottom = isNearBottom(120);
            const shouldScroll = forceScroll || isInitialLoad || wasNearBottom;

            const canAppendOnly = !isInitialLoad &&
                renderedMessageIds.length > 0 &&
                newIds.length > renderedMessageIds.length &&
                renderedMessageIds.every((id, idx) => id === newIds[idx]);

            if (canAppendOnly) {
                // Incremental append: only add new bubbles!
                const newItems = results.slice(renderedMessageIds.length);
                newItems.forEach((item) => {
                    target.append(renderBubble(item));
                });
                renderedMessageIds = newIds;
            } else {
                // Full rebuild needed (initial load, or order changed)
                target.replaceChildren();
                if (!results.length) {
                    target.append(make("p", "chat-placeholder", "هنوز پیامی ردوبدل نشده. گفت‌وگو را شروع کنید."));
                } else {
                    results.forEach((item) => {
                        target.append(renderBubble(item));
                    });
                }
                renderedMessageIds = newIds;
            }

            if (shouldScroll) {
                scrollToBottom(false);
                requestAnimationFrame(() => scrollToBottom(false));
                setTimeout(() => scrollToBottom(false), 50);
                setTimeout(() => scrollToBottom(false), 200);
            }

            isInitialLoad = false;
            return true;
        } catch (failure) {
            target.textContent = failure.message || "دریافت پیام‌ها انجام نشد.";
            if (timer) clearInterval(timer);
            return false;
        }
    };

    attachButton.addEventListener("click", () => {
        if (remainingImages > 0) imageInput.click();
    });
    imageInput.addEventListener("change", () => {
        const file = imageInput.files?.[0];
        if (!file) return;
        if (!acceptedTypes.has(file.type)) {
            clearSelectedImage();
            setError("فقط تصویرهای JPEG، PNG و WebP قابل انتخاب هستند.");
            return;
        }
        if (file.size > maxImageBytes) {
            clearSelectedImage();
            setError("حجم تصویر باید حداکثر ۵ مگابایت باشد.");
            return;
        }
        if (remainingImages < 1) {
            clearSelectedImage();
            setError("سهمیهٔ ۵ تصویر روزانهٔ شما تمام شده است.");
            return;
        }
        selectedImage = file;
        setError("");
        showSelectedImage(file);
    });
    bodyField.addEventListener("keydown", (event) => {
        if (event.key === "Enter" && !event.shiftKey && !event.isComposing) {
            event.preventDefault();
            form.requestSubmit();
        }
    });
    bodyField.addEventListener("input", () => {
        bodyField.style.height = "auto";
        bodyField.style.height = `${Math.min(bodyField.scrollHeight, 160)}px`;
    });

    try {
        const meResponse = await fetch(`/api/auth/me/?_t=${Date.now()}`, { credentials: "same-origin", cache: "no-store" });
        if (!meResponse.ok) { location.assign("login.html"); return; }
        currentUser = await meResponse.json();
        if (isStaffChat) {
            if (currentUser.role === "consultant") {
                const response = await fetch("/api/consultations/staff-conversations/", {credentials:"same-origin"});
                const data = await response.json();
                if (!response.ok || Number(data.conversation?.id) !== Number(staffConversationId)) throw new Error(data.detail || "به این اتاق دسترسی ندارید.");
                title.textContent = "گفت‌وگو با مدیر مجموعه";
                setBackLink("consultant.html#conversations", "بازگشت به اتاق‌های گفتگو");
            } else if (["manager", "admin"].includes(currentUser.role)) {
                const response = await fetch("/api/consultations/staff-conversations/", {credentials:"same-origin"});
                const data = await response.json();
                const room = (data.results || []).find((entry) => Number(entry.id) === Number(staffConversationId));
                if (!response.ok || !room) throw new Error(data.detail || "به این اتاق دسترسی ندارید.");
                title.textContent = `گفت‌وگو با ${room.consultant_name || "مشاور"}`;
                setBackLink("manager.html#conversations", "بازگشت به اتاق‌های مشاوران");
            } else throw new Error("به این اتاق دسترسی ندارید.");
        } else {
            const requestsResponse = await fetch("/api/consultations/requests/", { credentials: "same-origin" });
            const requests = await requestsResponse.json();
            if (!requestsResponse.ok) throw new Error(requests.detail || "گفت‌وگو پیدا نشد.");
            const item = requests.results.find((entry) => entry.id === Number(requestId));
            if (!item || item.status !== "approved") throw new Error("به این گفت‌وگو دسترسی ندارید.");
            const other = currentUser.role === "student" ? item.assigned_consultant_name : item.student_name;
            title.textContent = `گفت‌وگو با ${other || "مشاور"}`;
            setBackLink(currentUser.role === "consultant" ? "consultant.html#students" : "consultations.html", currentUser.role === "consultant" ? "بازگشت به دانش‌آموزان من" : "بازگشت به پنل");
        }
        const loaded = await loadMessages(true);
        if (loaded) timer = setInterval(() => loadMessages(false), 5000);
    } catch (failure) {
        target.textContent = failure.message || "گفت‌وگو بارگذاری نشد.";
        form.hidden = true;
        return;
    }

    form.addEventListener("submit", async (event) => {
        event.preventDefault();
        const text = bodyField.value.trim();
        if (!text && !selectedImage) { setError("یک پیام بنویسید یا تصویری پیوست کنید."); return; }
        if (selectedImage && (!acceptedTypes.has(selectedImage.type) || selectedImage.size > maxImageBytes)) { setError("تصویر انتخاب‌شده شرایط مجاز را ندارد."); return; }
        if (selectedImage && remainingImages < 1) { setError("سهمیهٔ ۵ تصویر روزانهٔ شما تمام شده است."); return; }
        sendButton.disabled = true;
        attachButton.disabled = true;
        setError("");
        try {
            const csrf = await fetch("/api/auth/csrf/", { credentials: "same-origin" }).then((response) => response.json());
            const payload = new FormData();
            if (text) payload.append("body", text);
            if (selectedImage) payload.append("image", selectedImage, selectedImage.name);
            const response = await fetch(messagesPath, {
                method: "POST", credentials: "same-origin",
                headers: { "X-CSRFToken": csrf.csrfToken },
                body: payload,
            });
            const result = await response.json();
            if (!response.ok) throw new Error(result.detail || "ارسال پیام انجام نشد.");
            bodyField.value = "";
            bodyField.style.height = "auto";
            clearSelectedImage();
            await loadMessages(true);
        } catch (failure) {
            setError(failure.message || "ارسال پیام انجام نشد.");
        } finally {
            sendButton.disabled = false;
            attachButton.disabled = remainingImages < 1;
        }
    });

    bodyField.addEventListener("focus", () => {
        setTimeout(() => scrollToBottom(true), 300);
    });

    window.addEventListener("resize", () => {
        if (isNearBottom(120)) {
            scrollToBottom(false);
        }
    });

    window.addEventListener("beforeunload", () => {
        if (timer) clearInterval(timer);
        if (previewUrl) URL.revokeObjectURL(previewUrl);
    });
});
