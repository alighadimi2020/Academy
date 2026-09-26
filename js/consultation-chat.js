document.addEventListener("DOMContentLoaded", async () => {
    const requestId = new URLSearchParams(location.search).get("request");
    const target = document.getElementById("chat-messages");
    const form = document.getElementById("chat-form");
    const bodyField = document.getElementById("chat-body");
    const sendButton = document.getElementById("chat-send");
    const error = document.getElementById("chat-error");
    const limit = document.getElementById("chat-limit");
    const title = document.getElementById("chat-title");
    const make = (tag, cls, text) => { const el = document.createElement(tag); if (cls) el.className = cls; if (text !== undefined) el.textContent = text; return el; };
    if (!/^\d+$/.test(requestId || "")) { target.textContent = "شناسه گفت‌وگو معتبر نیست."; form.hidden = true; return; }
    let currentUser;
    let timer;
    const setError = (text, failed = true) => { error.textContent = text; error.className = `consultation-message${failed ? " is-error" : " is-success"}`; };
    const loadMessages = async (scrollToBottom = false) => {
        try {
            const response = await fetch(`/api/consultations/requests/${requestId}/messages/`, { credentials: "same-origin" });
            const data = await response.json(); if (!response.ok) throw new Error(data.detail || "دریافت پیام‌ها ممکن نشد.");
            const nearBottom = target.scrollHeight - target.scrollTop - target.clientHeight < 80;
            target.replaceChildren();
            if (!data.results.length) target.append(make("p", "consultation-message", "هنوز پیامی ردوبدل نشده است."));
            data.results.forEach((item) => {
                const mine = item.sender_id === currentUser.id;
                const bubble = make("article", `chat-message${mine ? " is-mine" : ""}`);
                bubble.append(make("span", "chat-message__name", mine ? "شما" : item.sender_name), make("p", "chat-message__body", item.body), make("time", "chat-message__time", new Date(item.created_at).toLocaleString("fa-IR")));
                target.append(bubble);
            });
            limit.textContent = `پیام باقی‌ماندهٔ امروز شما: ${new Intl.NumberFormat("fa-IR").format(data.remaining_today)} از ۱۰۰۰`;
            sendButton.disabled = data.remaining_today < 1;
            if (scrollToBottom || nearBottom) target.scrollTop = target.scrollHeight;
            return true;
        } catch (failure) { target.textContent = failure.message || "دریافت پیام‌ها انجام نشد."; if (timer) clearInterval(timer); return false; }
    };
    try {
        const meResponse = await fetch("/api/auth/me/", { credentials: "same-origin" });
        if (!meResponse.ok) { location.assign("login.html"); return; }
        currentUser = await meResponse.json();
        const requestsResponse = await fetch("/api/consultations/requests/", { credentials: "same-origin" });
        const requests = await requestsResponse.json(); if (!requestsResponse.ok) throw new Error(requests.detail || "گفت‌وگو پیدا نشد.");
        const item = requests.results.find((entry) => entry.id === Number(requestId));
        if (!item || item.status !== "approved") throw new Error("به این گفت‌وگو دسترسی ندارید.");
        const other = currentUser.role === "student" ? item.assigned_consultant_name : item.student_name;
        title.textContent = `گفت‌وگو با ${other || "مشاور"}`;
        document.getElementById("chat-back-link").href = currentUser.role === "consultant" ? "consultant.html#students" : "consultations.html";
        if (currentUser.role === "consultant") document.getElementById("chat-back-link").textContent = "بازگشت به دانش‌آموزان من";
        const loaded = await loadMessages(true);
        if (loaded) timer = setInterval(() => loadMessages(false), 5000);
    } catch (failure) { target.textContent = failure.message || "گفت‌وگو بارگذاری نشد."; form.hidden = true; return; }

    form.addEventListener("submit", async (event) => {
        event.preventDefault(); const text = bodyField.value.trim();
        if (!text) { setError("متن پیام را بنویسید."); return; }
        sendButton.disabled = true; setError("");
        try {
            const csrf = await fetch("/api/auth/csrf/", { credentials: "same-origin" }).then((response) => response.json());
            const response = await fetch(`/api/consultations/requests/${requestId}/messages/`, { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json", "X-CSRFToken": csrf.csrfToken }, body: JSON.stringify({ body: text }) });
            const result = await response.json(); if (!response.ok) throw new Error(result.detail || "ارسال پیام انجام نشد.");
            bodyField.value = ""; await loadMessages(true);
        } catch (failure) { setError(failure.message || "ارسال پیام انجام نشد."); sendButton.disabled = false; }
    });
});
