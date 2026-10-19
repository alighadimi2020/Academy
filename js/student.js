const initStudentApp = async () => {
    const sidebar = document.getElementById("studentSidebar");
    const menuButton = document.getElementById("studentMenu");
    const pageTitle = document.getElementById("studentPageTitle");
    const titles = {
        dashboard: "داشبورد",
        chat: "پیام‌ها و گفت‌وگو",
        ranking: "رتبه‌بندی و لیگ برتر",
        performance: "عملکرد من",
        activities: "فعالیت‌های من",
        consultant: "مشاور من",
        tasks: "برنامه و وظایف",
        profile: "پروفایل"
    };

    const faDigit = (n) => {
        if (n === null || n === undefined || isNaN(n)) return "۰";
        return new Intl.NumberFormat("fa-IR").format(n);
    };

    const toPersianDate = (dateInput, options = {}) => {
        if (!dateInput) return "";
        try {
            let d;
            if (typeof dateInput === "string" && dateInput.includes("-") && !dateInput.includes("T")) {
                const parts = dateInput.split("-").map(Number);
                d = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2], 12, 0, 0));
            } else {
                d = new Date(dateInput);
            }
            if (isNaN(d.getTime())) return String(dateInput);
            const defaultOpts = {
                timeZone: "Asia/Tehran",
                year: "numeric",
                month: "long",
                day: "numeric",
                ...options
            };
            return new Intl.DateTimeFormat("fa-IR-u-ca-persian", defaultOpts).format(d);
        } catch {
            return String(dateInput);
        }
    };

    const toPersianDateTime = (dateInput) => {
        if (!dateInput) return "";
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

    const toPersianTime = (dateInput) => {
        if (!dateInput) return "";
        try {
            const d = new Date(dateInput);
            if (isNaN(d.getTime())) return "";
            return new Intl.DateTimeFormat("fa-IR-u-ca-persian", {
                timeZone: "Asia/Tehran",
                hour: "2-digit",
                minute: "2-digit"
            }).format(d);
        } catch {
            return "";
        }
    };

    const getCsrfToken = async () => {
        const match = document.cookie.match(/csrftoken=([^;]+)/);
        if (match) return match[1];
        try {
            const res = await fetch(`/api/auth/csrf/?_t=${Date.now()}`, { credentials: "same-origin", cache: "no-store" });
            const d = await res.json();
            return d.csrfToken;
        } catch {
            return "";
        }
    };

    // Vector Cartoon Character Generator (STRICTLY NO EMOJIS)
    const getCartoonAvatarSvg = (avatarIdx = 0, size = 64) => {
        const pal = [
            { bg: "#fef3c7", face: "#fde68a", hair: "#d97706", acc: "#f59e0b", glasses: true, cap: true },
            { bg: "#ede9fe", face: "#ddd6fe", hair: "#7c3aed", acc: "#8b5cf6", glasses: false, cap: false },
            { bg: "#d1fae5", face: "#a7f3d0", hair: "#059669", acc: "#10b981", glasses: true, cap: false },
            { bg: "#e0f2fe", face: "#bae6fd", hair: "#0284c7", acc: "#0ea5e9", glasses: false, cap: false },
            { bg: "#fce7f3", face: "#fbcfe8", hair: "#db2777", acc: "#ec4899", glasses: false, cap: true },
            { bg: "#ffedd5", face: "#fed7aa", hair: "#ea580c", acc: "#f97316", glasses: true, cap: false },
            { bg: "#ccfbf1", face: "#99f6e4", hair: "#0d9488", acc: "#14b8a6", glasses: false, cap: false },
            { bg: "#fee2e2", face: "#fecaca", hair: "#dc2626", acc: "#ef4444", glasses: true, cap: true },
        ];
        const c = pal[Math.abs(avatarIdx || 0) % pal.length];
        return `<svg viewBox="0 0 100 100" width="${size}" height="${size}" class="payeh-cartoon-avatar">
            <circle cx="50" cy="50" r="48" fill="${c.bg}" stroke="${c.acc}" stroke-width="2.5"/>
            <path d="M22 88 C25 68 75 68 78 88 Z" fill="${c.acc}"/>
            <rect x="44" y="60" width="12" height="12" rx="4" fill="${c.face}"/>
            <ellipse cx="50" cy="46" rx="24" ry="22" fill="${c.face}"/>
            <path d="M26 44 C26 24 74 24 74 44 C68 34 56 32 50 34 C42 32 32 36 26 44 Z" fill="${c.hair}"/>
            <circle cx="41" cy="46" r="3" fill="#1e293b"/>
            <circle cx="42" cy="45" r="1" fill="#ffffff"/>
            <circle cx="59" cy="46" r="3" fill="#1e293b"/>
            <circle cx="60" cy="45" r="1" fill="#ffffff"/>
            <path d="M37 40 Q41 38 45 40" stroke="#1e293b" stroke-width="2" fill="none" stroke-linecap="round"/>
            <path d="M55 40 Q59 38 63 40" stroke="#1e293b" stroke-width="2" fill="none" stroke-linecap="round"/>
            <path d="M43 54 Q50 61 57 54" stroke="#1e293b" stroke-width="2.2" fill="none" stroke-linecap="round"/>
            <circle cx="35" cy="52" r="4" fill="#f43f5e" opacity="0.3"/>
            <circle cx="65" cy="52" r="4" fill="#f43f5e" opacity="0.3"/>
            ${c.glasses ? `
            <circle cx="41" cy="46" r="8" fill="none" stroke="#1e293b" stroke-width="2"/>
            <circle cx="59" cy="46" r="8" fill="none" stroke="#1e293b" stroke-width="2"/>
            <line x1="49" y1="46" x2="51" y2="46" stroke="#1e293b" stroke-width="2"/>` : ''}
            ${c.cap ? `
            <polygon points="50,14 74,24 50,30 26,24" fill="#1e293b"/>
            <rect x="42" y="27" width="16" height="5" fill="#0f172a"/>
            <line x1="68" y1="24" x2="72" y2="34" stroke="#eab308" stroke-width="2"/>
            <circle cx="72" cy="35" r="2" fill="#eab308"/>` : ''}
        </svg>`;
    };

    /* ==========================================================================
       CHAT & MESSENGER MODULE
       ========================================================================== */
    let currentUserId = null;
    let chatActiveRoomId = null;
    let chatActiveTab = "all";
    let chatPollTimer = null;
    let chatAnnouncements = [];
    let chatAssignedRequest = null;
    let chatSelectedImage = null;
    let chatPreviewUrl = null;

    const loadChatView = async () => {
        try {
            const [annRes, reqRes] = await Promise.all([
                fetch(`/api/consultations/announcements/?_t=${Date.now()}`, { credentials: "same-origin" }),
                fetch(`/api/consultations/requests/?_t=${Date.now()}`, { credentials: "same-origin" })
            ]);
            if (annRes.ok) {
                const annData = await annRes.json();
                chatAnnouncements = annData.results || [];
            }
            if (reqRes.ok) {
                const reqData = await reqRes.json();
                chatAssignedRequest = (reqData.results || []).find(r => r.status === "approved" || r.status === "pending") || null;
            }
            renderChatRooms();
            if (!chatActiveRoomId) {
                selectChatRoom("channel");
            } else {
                selectChatRoom(chatActiveRoomId);
            }
        } catch (err) {
            console.error("Error loading chat view:", err);
        }
    };

    const renderChatRooms = () => {
        const list = document.getElementById("chatRoomsList");
        if (!list) return;
        list.replaceChildren();

        const latestAnn = chatAnnouncements[0];
        const annSnippet = latestAnn ? (latestAnn.title || latestAnn.body.slice(0, 40)) : "اطلاعیه‌های رسمی آکادمی";
        const annDate = latestAnn ? toPersianDate(latestAnn.created_at, { month: "short", day: "numeric" }) : "";

        // 1. Channel Room Item
        if (chatActiveTab === "all" || chatActiveTab === "channels") {
            const item = document.createElement("div");
            item.className = `payeh-chat-item${chatActiveRoomId === "channel" ? " active" : ""}`;
            item.dataset.roomId = "channel";
            item.innerHTML = `
                <div class="payeh-chat-avatar-wrap">
                    <div class="payeh-chat-avatar payeh-chat-avatar--channel">کا</div>
                </div>
                <div class="payeh-chat-item__content">
                    <div class="payeh-chat-item__top">
                        <span class="payeh-chat-item__name">کانال اطلاع‌رسانی پایه</span>
                        <span class="payeh-chat-item__time">${annDate}</span>
                    </div>
                    <div class="payeh-chat-item__bottom">
                        <span class="payeh-chat-item__snippet">${annSnippet}</span>
                        <span class="payeh-chat-badge payeh-chat-badge--channel">رسمی</span>
                    </div>
                </div>
            `;
            item.addEventListener("click", () => selectChatRoom("channel"));
            list.append(item);
        }

        // 2. Consultant Room Item
        if (chatActiveTab === "all" || chatActiveTab === "consultants") {
            const hasConsultant = chatAssignedRequest && chatAssignedRequest.status === "approved";
            const consultantName = hasConsultant ? chatAssignedRequest.assigned_consultant_name : (chatAssignedRequest ? "در انتظار تایید مشاور" : "مشاور من");
            const initials = consultantName.split(" ").slice(0, 2).map(w => w[0]).join("") || "مش";

            const item = document.createElement("div");
            item.className = `payeh-chat-item${chatActiveRoomId === "consultant" ? " active" : ""}`;
            item.dataset.roomId = "consultant";
            item.innerHTML = `
                <div class="payeh-chat-avatar-wrap">
                    <div class="payeh-chat-avatar payeh-chat-avatar--consultant">${initials}</div>
                </div>
                <div class="payeh-chat-item__content">
                    <div class="payeh-chat-item__top">
                        <span class="payeh-chat-item__name">${consultantName}</span>
                        <span class="payeh-chat-item__time">آنلاین</span>
                    </div>
                    <div class="payeh-chat-item__bottom">
                        <span class="payeh-chat-item__snippet">${hasConsultant ? "ارتباط مستقیم با مشاور" : "مشاهده وضعیت درخواست"}</span>
                        <span class="payeh-chat-badge payeh-chat-badge--consultant">${hasConsultant ? "مشاور" : "درخواست"}</span>
                    </div>
                </div>
            `;
            item.addEventListener("click", () => selectChatRoom("consultant"));
            list.append(item);
        }
    };

    const selectChatRoom = async (roomId) => {
        chatActiveRoomId = roomId;
        document.querySelectorAll(".payeh-chat-item").forEach(item => {
            item.classList.toggle("active", item.dataset.roomId === roomId);
        });

        const container = document.querySelector(".payeh-chat-container");
        if (container) container.classList.add("has-active-chat");

        const emptyState = document.getElementById("chatEmptyState");
        const activeContainer = document.getElementById("chatActiveContainer");
        if (emptyState) emptyState.style.display = "none";
        if (activeContainer) activeContainer.style.display = "flex";

        const titleEl = document.getElementById("chatActiveTitle");
        const subEl = document.getElementById("chatActiveSubtitle");
        const avatarEl = document.getElementById("chatActiveAvatar");
        const badgeEl = document.getElementById("chatActiveBadge");
        const stream = document.getElementById("chatMessagesStream");
        const consultantInput = document.getElementById("chatConsultantInputBar");
        const channelReadonly = document.getElementById("chatChannelReadonlyBar");

        if (roomId === "channel") {
            if (titleEl) titleEl.textContent = "کانال اطلاع‌رسانی پایه";
            if (subEl) subEl.textContent = "کانال رسمی مدیریت آکادمی پایه";
            if (avatarEl) {
                avatarEl.textContent = "کا";
                avatarEl.className = "payeh-chat-active__avatar payeh-chat-avatar--channel";
            }
            if (badgeEl) {
                badgeEl.textContent = "فقط خواندنی";
                badgeEl.className = "payeh-chat-role-badge payeh-chat-badge--channel";
            }
            if (consultantInput) consultantInput.style.display = "none";
            if (channelReadonly) channelReadonly.style.display = "flex";

            renderAnnouncementStream();
        } else if (roomId === "consultant") {
            const hasConsultant = chatAssignedRequest && chatAssignedRequest.status === "approved";
            const consultantName = hasConsultant ? chatAssignedRequest.assigned_consultant_name : "مشاور من";
            const initials = consultantName.split(" ").slice(0, 2).map(w => w[0]).join("") || "مش";

            if (titleEl) titleEl.textContent = consultantName;
            if (subEl) subEl.textContent = hasConsultant ? `مشاور اختصاصی · پلن ${chatAssignedRequest.plan_label}` : "درخواست مشاوره";
            if (avatarEl) {
                avatarEl.textContent = initials;
                avatarEl.className = "payeh-chat-active__avatar payeh-chat-avatar--consultant";
            }
            if (badgeEl) {
                badgeEl.textContent = hasConsultant ? "گفت‌وگو فعال" : "در انتظار";
                badgeEl.className = "payeh-chat-role-badge payeh-chat-badge--consultant";
            }

            if (hasConsultant) {
                if (consultantInput) consultantInput.style.display = "flex";
                if (channelReadonly) channelReadonly.style.display = "none";
                await loadConsultantMessages();
            } else {
                if (consultantInput) consultantInput.style.display = "none";
                if (channelReadonly) channelReadonly.style.display = "none";
                if (stream) {
                    stream.replaceChildren();
                    const notice = document.createElement("div");
                    notice.className = "payeh-chat-empty-state";
                    notice.innerHTML = `
                        <div class="payeh-chat-empty-icon">
                            <svg viewBox="0 0 24 24"><path d="M21 11.5a8.38 8.38 0 0 1-9 8.5 9.7 9.7 0 0 1-4-.8L3 21l1.8-4.3A8.1 8.1 0 0 1 3 11.5 8.5 8.5 0 0 1 12 3a8.5 8.5 0 0 1 9 8.5Z"/></svg>
                        </div>
                        <h3>مشاور اختصاصی فعال ندارید</h3>
                        <p>${chatAssignedRequest ? "درخواست شما ثبت شده و منتظر تایید مدیر مجموعه است." : "شما هنوز درخواستی برای مشاوره ثبت نکرده‌اید."}</p>
                        <a href="consultations.html" class="payeh-student__hero-button" style="margin-top:14px; text-decoration:none;">مشاهده و انتخاب مشاوران</a>
                    `;
                    stream.append(notice);
                }
            }
        }
    };

    const renderAnnouncementStream = () => {
        const stream = document.getElementById("chatMessagesStream");
        if (!stream) return;
        stream.replaceChildren();

        if (!chatAnnouncements.length) {
            const p = document.createElement("p");
            p.className = "student-feedbacks-empty";
            p.textContent = "هنوز اطلاعیه‌ای در کانال منتشر نشده است.";
            stream.append(p);
            return;
        }

        chatAnnouncements.forEach(a => {
            const card = document.createElement("article");
            card.className = "payeh-announcement-card";

            const top = document.createElement("div");
            top.className = "payeh-announcement-card__top";

            const tag = document.createElement("span");
            tag.className = "payeh-announcement-card__tag";
            tag.innerHTML = `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 17H2a3 3 0 0 0 3-3V9a7 7 0 0 1 14 0v5a3 3 0 0 0 3 3zm-8.27 4a2 2 0 0 1-3.46 0"/></svg> ${a.author_name || "مدیر مجموعه"}`;

            const time = document.createElement("span");
            time.className = "payeh-announcement-card__time";
            time.textContent = toPersianDateTime(a.created_at);

            top.append(tag, time);

            if (a.title) {
                const title = document.createElement("h4");
                title.className = "payeh-announcement-card__title";
                title.textContent = a.title;
                card.append(top, title);
            } else {
                card.append(top);
            }

            const body = document.createElement("p");
            body.className = "payeh-announcement-card__body";
            body.textContent = a.body;
            card.append(body);

            if (a.image_url) {
                const img = document.createElement("img");
                img.className = "payeh-announcement-card__image";
                img.src = a.image_url;
                img.alt = a.title || "تصویر اطلاعیه";
                card.append(img);
            }

            stream.append(card);
        });

        stream.scrollTop = stream.scrollHeight;
    };

    const loadConsultantMessages = async () => {
        if (!chatAssignedRequest || chatAssignedRequest.status !== "approved") return;
        const stream = document.getElementById("chatMessagesStream");
        if (!stream) return;

        try {
            const res = await fetch(`/api/consultations/requests/${chatAssignedRequest.id}/messages/?_t=${Date.now()}`, { credentials: "same-origin" });
            if (!res.ok) throw new Error("خطا در دریافت پیام‌ها");
            const data = await res.json();
            const messages = data.results || [];

            stream.replaceChildren();
            if (!messages.length) {
                const p = document.createElement("p");
                p.className = "student-feedbacks-empty";
                p.textContent = "هنوز پیامی ارسال نشده است. اولین پیام را شما ارسال کنید!";
                stream.append(p);
                return;
            }

            messages.forEach(msg => {
                const isMine = currentUserId ? (msg.sender_id === currentUserId) : (msg.sender_role === "student" || msg.sender_name === "شما");
                const bubble = document.createElement("div");
                bubble.className = `payeh-chat-bubble ${isMine ? "is-mine" : "is-other"}`;

                const sender = document.createElement("span");
                sender.className = "payeh-chat-bubble__sender";
                sender.textContent = isMine ? "شما" : (msg.sender_name || "مشاور");
                bubble.append(sender);

                if (msg.image_url) {
                    const img = document.createElement("img");
                    img.className = "payeh-chat-bubble__image";
                    img.src = `/api/consultations/requests/${chatAssignedRequest.id}/images/${msg.id}/`;
                    img.alt = "تصویر پیوست";
                    bubble.append(img);
                }

                if (msg.body) {
                    const text = document.createElement("div");
                    text.className = "payeh-chat-bubble__text";
                    text.textContent = msg.body;
                    bubble.append(text);
                }

                const time = document.createElement("span");
                time.className = "payeh-chat-bubble__time";
                time.textContent = msg.created_at ? toPersianTime(msg.created_at) : "";
                bubble.append(time);

                stream.append(bubble);
            });

            stream.scrollTop = stream.scrollHeight;
        } catch (err) {
            console.error("Consultant message fetch error:", err);
        }
    };

    const sendConsultantMessage = async (e) => {
        if (e) e.preventDefault();
        if (!chatAssignedRequest || chatAssignedRequest.status !== "approved") return;
        const textInput = document.getElementById("chatTextInput");
        const sendBtn = document.getElementById("chatSendBtn");
        const text = textInput ? textInput.value.trim() : "";

        if (!text && !chatSelectedImage) return;

        const csrfToken = await getCsrfToken();
        const formData = new FormData();
        formData.append("body", text || "تصویر ارسال شد");
        if (chatSelectedImage) {
            formData.append("image", chatSelectedImage);
        }

        if (sendBtn) sendBtn.disabled = true;

        try {
            const res = await fetch(`/api/consultations/requests/${chatAssignedRequest.id}/messages/`, {
                method: "POST",
                credentials: "same-origin",
                headers: { "X-CSRFToken": csrfToken },
                body: formData
            });
            if (!res.ok) {
                const errData = await res.json().catch(() => ({}));
                alert(errData.detail || "خطا در ارسال پیام");
                return;
            }

            if (textInput) textInput.value = "";
            clearChatImage();
            await loadConsultantMessages();
        } catch (err) {
            alert(err.message || "خطا در ارسال پیام");
        } finally {
            if (sendBtn) sendBtn.disabled = false;
        }
    };

    const clearChatImage = () => {
        chatSelectedImage = null;
        if (chatPreviewUrl) {
            URL.revokeObjectURL(chatPreviewUrl);
            chatPreviewUrl = null;
        }
        const preview = document.getElementById("chatImagePreview");
        if (preview) preview.style.display = "none";
        const fileInput = document.getElementById("chatImageInput");
        if (fileInput) fileInput.value = "";
    };

    // Chat search and tab filters
    document.getElementById("chatSearchInput")?.addEventListener("input", (e) => {
        const query = e.target.value.trim().toLowerCase();
        document.querySelectorAll(".payeh-chat-item").forEach(item => {
            const name = item.querySelector(".payeh-chat-item__name")?.textContent.toLowerCase() || "";
            const snip = item.querySelector(".payeh-chat-item__snippet")?.textContent.toLowerCase() || "";
            const match = !query || name.includes(query) || snip.includes(query);
            item.style.display = match ? "flex" : "none";
        });
    });

    document.querySelectorAll(".payeh-chat-tab[data-chat-tab]").forEach(tab => {
        tab.addEventListener("click", () => {
            document.querySelectorAll(".payeh-chat-tab").forEach(t => t.classList.remove("active"));
            tab.classList.add("active");
            chatActiveTab = tab.dataset.chatTab;
            renderChatRooms();
        });
    });

    document.getElementById("chatBackMobile")?.addEventListener("click", () => {
        const container = document.querySelector(".payeh-chat-container");
        if (container) container.classList.remove("has-active-chat");
    });

    document.getElementById("chatImageInput")?.addEventListener("change", (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (file.size > 5 * 1024 * 1024) {
            alert("حجم تصویر نباید بیشتر از ۵ مگابایت باشد.");
            e.target.value = "";
            return;
        }
        chatSelectedImage = file;
        if (chatPreviewUrl) URL.revokeObjectURL(chatPreviewUrl);
        chatPreviewUrl = URL.createObjectURL(file);

        const preview = document.getElementById("chatImagePreview");
        const thumb = document.getElementById("chatPreviewThumb");
        const nameEl = document.getElementById("chatPreviewName");
        if (thumb) thumb.src = chatPreviewUrl;
        if (nameEl) nameEl.textContent = `${file.name} (${(file.size / 1024).toFixed(0)} کیلوبایت)`;
        if (preview) preview.style.display = "flex";
    });

    document.getElementById("chatPreviewRemove")?.addEventListener("click", clearChatImage);
    document.getElementById("chatMessageForm")?.addEventListener("submit", sendConsultantMessage);

    /* ==========================================================================
       RANKING & LEAGUE MODULE (NO EMOJIS - Vector Cartoon Icons)
       ========================================================================== */
    let currentRankingMetric = "hours";

    const loadRankingView = async (metric = currentRankingMetric) => {
        currentRankingMetric = metric;
        document.querySelectorAll(".payeh-ranking-tab[data-metric]").forEach(tab => {
            tab.classList.toggle("active", tab.dataset.metric === metric);
        });

        const labelMap = { hours: "ساعت مطالعه", tests: "تست‌های زده‌شده", avg_tests: "میانگین تست روزانه" };
        const thLabel = document.getElementById("thMetricLabel");
        if (thLabel) thLabel.textContent = labelMap[metric] || "امتیاز معیار";

        try {
            const res = await fetch(`/api/consultations/ranking/?metric=${metric}&_t=${Date.now()}`, { credentials: "same-origin" });
            if (!res.ok) throw new Error("دریافت رتبه‌بندی ممکن نشد.");
            const data = await res.json();

            renderPodium(data.top_three || [], metric);
            renderMyRankCard(data.my_stats, data.gap_to_next, metric, data.total_students);
            renderLeaderboardTable(data.leaderboard || [], metric);

            const countBadge = document.getElementById("rankingCountBadge");
            if (countBadge) countBadge.textContent = `${faDigit(data.total_students)} شرکت‌کننده`;
        } catch (err) {
            console.error("Error loading ranking view:", err);
        }
    };

    const renderPodium = (topThree, metric) => {
        const container = document.getElementById("rankingPodium");
        if (!container) return;
        container.replaceChildren();

        if (!topThree.length) {
            container.innerHTML = `<p class="student-feedbacks-empty">اطلاعاتی برای نمایش در سکوی قهرمانی ثبت نشده است.</p>`;
            return;
        }

        const unitMap = { hours: "ساعت", tests: "تست", avg_tests: "تست/روز" };
        const unit = unitMap[metric] || "";

        // Reorder for 3D podium display: Rank 2 on right, Rank 1 in center, Rank 3 on left (in RTL)
        const spots = [];
        const rank1 = topThree.find(x => x.rank === 1);
        const rank2 = topThree.find(x => x.rank === 2);
        const rank3 = topThree.find(x => x.rank === 3);

        if (rank2) spots.push(rank2);
        if (rank1) spots.push(rank1);
        if (rank3) spots.push(rank3);

        spots.forEach(item => {
            const spotEl = document.createElement("div");
            spotEl.className = `payeh-podium-spot payeh-podium-spot--${item.rank}`;

            let badgeSvg = "";
            if (item.rank === 1) {
                badgeSvg = `<svg class="payeh-podium-badge-svg" viewBox="0 0 24 24" width="28" height="28" fill="#f59e0b">
                    <path d="M5 16L3 5l5.5 5L12 4l3.5 6L21 5l-2 11H5zm14 3c0 .6-.4 1-1 1H6c-.6 0-1-.4-1-1v-1h14v1z"/>
                </svg>`;
            } else if (item.rank === 2) {
                badgeSvg = `<svg class="payeh-podium-badge-svg" viewBox="0 0 24 24" width="24" height="24" fill="#94a3b8">
                    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                </svg>`;
            } else {
                badgeSvg = `<svg class="payeh-podium-badge-svg" viewBox="0 0 24 24" width="22" height="22" fill="#d97706">
                    <circle cx="12" cy="8" r="7"/><polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88"/>
                </svg>`;
            }

            const avatarHtml = getCartoonAvatarSvg(item.avatar_index || item.student_id, item.rank === 1 ? 84 : 70);

            spotEl.innerHTML = `
                <div class="payeh-podium-character-wrap">
                    ${badgeSvg}
                    <div class="payeh-podium-avatar-card">
                        ${avatarHtml}
                    </div>
                </div>
                <div class="payeh-podium-name">${item.name}</div>
                <div class="payeh-podium-score">${faDigit(item.score)} ${unit}</div>
                <div class="payeh-podium-pedestal">
                    <span class="payeh-podium-pedestal-num">${faDigit(item.rank)}</span>
                    <span class="payeh-podium-pedestal-label">${item.rank === 1 ? 'قهرمان' : (item.rank === 2 ? 'رتبه دوم' : 'رتبه سوم')}</span>
                </div>
            `;
            container.append(spotEl);
        });
    };

    const renderMyRankCard = (myStats, gapToNext, metric, totalStudents) => {
        const card = document.getElementById("rankingMyCard");
        if (!card) return;
        if (!myStats) {
            card.style.display = "none";
            return;
        }
        card.style.display = "flex";

        const unitMap = { hours: "ساعت", tests: "تست", avg_tests: "تست/روز" };
        const unit = unitMap[metric] || "";
        const avatarSvg = getCartoonAvatarSvg(myStats.avatar_index || myStats.student_id, 46);

        let gapHtml = "";
        if (gapToNext) {
            gapHtml = `<div class="payeh-my-gap-badge">
                تنها ${faDigit(gapToNext.points_needed)} ${unit} تا رتبه ${faDigit(gapToNext.target_rank)} فاصله داری! 🎯
            </div>`;
        } else if (myStats.rank === 1) {
            gapHtml = `<div class="payeh-my-gap-badge" style="background:#fef3c7; border-color:#fde68a; color:#b45309;">
                صدرنشین لیگ! جایگاه خود را حفظ کنید 👑
            </div>`;
        }

        const pct = Math.max(1, Math.round((myStats.rank / Math.max(1, totalStudents)) * 100));

        card.innerHTML = `
            <div class="payeh-my-position-left">
                <div class="payeh-my-avatar-wrap">
                    ${avatarSvg}
                </div>
                <div>
                    <h3 class="payeh-my-position-title">جایگاه شما: رتبه ${faDigit(myStats.rank)} از ${faDigit(totalStudents)}</h3>
                    <p class="payeh-my-position-sub">جزو برترین ${faDigit(pct)}٪ داوطلبان آکادمی پایه</p>
                </div>
            </div>
            <div class="payeh-my-position-right">
                <div class="payeh-my-stat-pill">
                    <span class="payeh-my-stat-label">امتیاز ثبت‌شده</span>
                    <span class="payeh-my-stat-val">${faDigit(myStats.score)} ${unit}</span>
                </div>
                ${gapHtml}
            </div>
        `;
    };

    const renderLeaderboardTable = (leaderboard, metric) => {
        const tbody = document.getElementById("rankingTableBody");
        if (!tbody) return;
        tbody.replaceChildren();

        const unitMap = { hours: "ساعت", tests: "تست", avg_tests: "تست/روز" };
        const unit = unitMap[metric] || "";

        leaderboard.forEach(item => {
            const tr = document.createElement("tr");
            if (item.is_me) tr.className = "is-me";

            let rankBadge = "";
            if (item.rank === 1) {
                rankBadge = `<span class="payeh-rank-badge payeh-rank-badge--1">۱</span>`;
            } else if (item.rank === 2) {
                rankBadge = `<span class="payeh-rank-badge payeh-rank-badge--2">۲</span>`;
            } else if (item.rank === 3) {
                rankBadge = `<span class="payeh-rank-badge payeh-rank-badge--3">۳</span>`;
            } else {
                rankBadge = `<span class="payeh-rank-badge payeh-rank-badge--other">${faDigit(item.rank)}</span>`;
            }

            const miniAvatar = getCartoonAvatarSvg(item.avatar_index || item.student_id, 32);

            tr.innerHTML = `
                <td>${rankBadge}</td>
                <td>
                    <div class="payeh-student-cell">
                        <div class="payeh-student-mini-avatar">${miniAvatar}</div>
                        <span>${item.name}</span>
                        ${item.is_me ? '<span class="payeh-tag" style="background:#bbf7d0; color:#15803d;">شما</span>' : ''}
                    </div>
                </td>
                <td><span class="payeh-tag">${item.grade} · ${item.major}</span></td>
                <td><strong style="color:#227b4c; font-size:14px;">${faDigit(item.score)} ${unit}</strong></td>
                <td>${faDigit(item.total_hours)} ساعت</td>
                <td>${faDigit(item.total_tests)} تست</td>
                <td>${faDigit(item.avg_tests)} تست/روز</td>
            `;
            tbody.append(tr);
        });
    };

    document.querySelectorAll(".payeh-ranking-tab[data-metric]").forEach(btn => {
        btn.addEventListener("click", () => {
            const m = btn.dataset.metric;
            loadRankingView(m);
        });
    });

    /* ==========================================================================
       PERFORMANCE & ANALYTICS CHARTS (SVG Pure Responsive)
       ========================================================================== */
    let perfInterval = "weekly";
    let perfMetric = "hours";

    const loadPerformanceView = async () => {
        try {
            const res = await fetch(`/api/consultations/student-performance/?interval=${perfInterval}&metric=${perfMetric}&_t=${Date.now()}`, { credentials: "same-origin" });
            if (!res.ok) throw new Error("خطا در دریافت اطلاعات عملکرد تحصیلی");
            const data = await res.json();

            renderPerfKpis(data.kpi);
            renderPerfLineChart(data.timeline || [], perfMetric);
            renderPerfDonutChart(data.subject_breakdown || [], perfMetric, perfMetric === "hours" ? data.kpi.total_hours : data.kpi.total_tests);
        } catch (err) {
            console.error("Performance view error:", err);
        }
    };

    const renderPerfKpis = (kpi) => {
        const container = document.getElementById("perfKpiContainer");
        if (!container || !kpi) return;

        container.innerHTML = `
            <div class="payeh-kpi-card">
                <div class="payeh-kpi-icon" style="background:#ecfdf5; color:#059669;">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                </div>
                <div class="payeh-kpi-info">
                    <span class="payeh-kpi-label">مجموع ساعت مطالعه</span>
                    <span class="payeh-kpi-value">${faDigit(kpi.total_hours)} <span class="payeh-kpi-unit">ساعت</span></span>
                </div>
            </div>

            <div class="payeh-kpi-card">
                <div class="payeh-kpi-icon" style="background:#eff6ff; color:#2563eb;">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
                </div>
                <div class="payeh-kpi-info">
                    <span class="payeh-kpi-label">کل تست‌های ثبت‌شده</span>
                    <span class="payeh-kpi-value">${faDigit(kpi.total_tests)} <span class="payeh-kpi-unit">تست</span></span>
                </div>
            </div>

            <div class="payeh-kpi-card">
                <div class="payeh-kpi-icon" style="background:#fef3c7; color:#d97706;">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>
                </div>
                <div class="payeh-kpi-info">
                    <span class="payeh-kpi-label">میانگین روزانه</span>
                    <span class="payeh-kpi-value">${faDigit(kpi.avg_daily_tests)} <span class="payeh-kpi-unit">تست/روز</span></span>
                </div>
            </div>

            <div class="payeh-kpi-card">
                <div class="payeh-kpi-icon" style="background:#f5f3ff; color:#7c3aed;">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>
                </div>
                <div class="payeh-kpi-info">
                    <span class="payeh-kpi-label">بیشترین تمرکز درسی</span>
                    <span class="payeh-kpi-value" style="font-size:16px;">${kpi.top_subject}</span>
                </div>
            </div>
        `;
    };

    const renderPerfLineChart = (timeline, metric) => {
        const container = document.getElementById("perfLineChartContainer");
        const titleEl = document.getElementById("perfLineChartTitle");
        const unitEl = document.getElementById("perfLineChartUnit");
        if (!container) return;

        const isHours = metric === "hours";
        if (titleEl) titleEl.textContent = `روند ${isHours ? "ساعت مطالعه" : "تست‌های حل‌شده"} در طول زمان`;
        if (unitEl) unitEl.textContent = `واحد: ${isHours ? "ساعت" : "تست"}`;

        container.replaceChildren();

        if (!timeline.length) {
            container.innerHTML = `<p class="student-feedbacks-empty">اطلاعاتی در این بازه زمانی برای رسم نمودار وجود ندارد.</p>`;
            return;
        }

        const width = 640;
        const height = 260;
        const padL = 45;
        const padR = 25;
        const padT = 30;
        const padB = 40;
        const plotW = width - padL - padR;
        const plotH = height - padT - padB;

        const rawVals = timeline.map(t => Number(t.value) || 0);
        const maxRaw = Math.max(...rawVals, 0);
        const maxVal = maxRaw === 0 ? 10 : Math.ceil(maxRaw * 1.25);

        // Calculate coords
        const points = timeline.map((item, i) => {
            const x = padL + (i / Math.max(1, timeline.length - 1)) * plotW;
            const y = padT + plotH - ((Number(item.value) || 0) / maxVal) * plotH;
            return { x, y, label: item.label, value: item.value };
        });

        // Cubic Bezier path
        let linePath = `M ${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)}`;
        for (let i = 0; i < points.length - 1; i++) {
            const p0 = points[i === 0 ? 0 : i - 1];
            const p1 = points[i];
            const p2 = points[i + 1];
            const p3 = points[i + 2] || p2;
            const cp1x = p1.x + (p2.x - p0.x) / 6;
            const cp1y = p1.y + (p2.y - p0.y) / 6;
            const cp2x = p2.x - (p3.x - p1.x) / 6;
            const cp2y = p2.y - (p3.y - p1.y) / 6;
            linePath += ` C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
        }

        const areaPath = `${linePath} L ${points[points.length - 1].x.toFixed(1)} ${(padT + plotH).toFixed(1)} L ${points[0].x.toFixed(1)} ${(padT + plotH).toFixed(1)} Z`;

        // 4 Horizontal Guide Lines
        let gridLines = "";
        for (let g = 0; g <= 4; g++) {
            const gy = padT + (g / 4) * plotH;
            const gVal = Math.round(maxVal * (1 - g / 4));
            gridLines += `
                <line x1="${padL}" y1="${gy.toFixed(1)}" x2="${padL + plotW}" y2="${gy.toFixed(1)}" stroke="#e2e8f0" stroke-dasharray="4,4"/>
                <text x="${padL - 10}" y="${(gy + 4).toFixed(1)}" font-size="11" fill="#94a3b8" text-anchor="end" font-weight="700">${faDigit(gVal)}</text>
            `;
        }

        // X-Axis Labels
        let xLabels = "";
        points.forEach((p, idx) => {
            xLabels += `<text x="${p.x.toFixed(1)}" y="${(height - 10).toFixed(1)}" font-size="11" fill="#64748b" text-anchor="middle" font-weight="700">${p.label}</text>`;
        });

        // Interactive Dots
        let dots = "";
        points.forEach((p, idx) => {
            dots += `
                <circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="5.5" fill="#227b4c" stroke="#ffffff" stroke-width="2.5" class="payeh-chart-dot" data-idx="${idx}" style="cursor:pointer; transition:transform 0.15s ease;"/>
            `;
        });

        const svgHtml = `
            <svg class="payeh-svg-chart" viewBox="0 0 ${width} ${height}" preserveAspectRatio="xMidYMid meet">
                <defs>
                    <linearGradient id="lineGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stop-color="#227b4c" stop-opacity="0.32"/>
                        <stop offset="100%" stop-color="#227b4c" stop-opacity="0.0"/>
                    </linearGradient>
                </defs>
                ${gridLines}
                <path d="${areaPath}" fill="url(#lineGrad)"/>
                <path d="${linePath}" fill="none" stroke="#227b4c" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/>
                ${xLabels}
                ${dots}
            </svg>
            <div id="chartTooltip" class="payeh-chart-tooltip" style="display:none; opacity:0;"></div>
        `;

        container.innerHTML = svgHtml;

        // Tooltip listeners
        const tooltip = container.querySelector("#chartTooltip");
        container.querySelectorAll(".payeh-chart-dot").forEach(dot => {
            dot.addEventListener("mouseenter", (e) => {
                const idx = Number(dot.dataset.idx);
                const pt = points[idx];
                if (!pt || !tooltip) return;
                tooltip.textContent = `${pt.label}: ${faDigit(pt.value)} ${isHours ? "ساعت" : "تست"}`;
                tooltip.style.display = "block";
                tooltip.style.opacity = "1";
                const rect = dot.getBoundingClientRect();
                const parentRect = container.getBoundingClientRect();
                tooltip.style.left = `${rect.left - parentRect.left + 5}px`;
                tooltip.style.top = `${rect.top - parentRect.top - 10}px`;
            });
            dot.addEventListener("mouseleave", () => {
                if (tooltip) {
                    tooltip.style.opacity = "0";
                    tooltip.style.display = "none";
                }
            });
        });
    };

    const renderPerfDonutChart = (subjects, metric, totalVal) => {
        const chartBox = document.getElementById("perfDonutChartContainer");
        const legendBox = document.getElementById("perfDonutLegend");
        const titleEl = document.getElementById("perfDonutChartTitle");
        const unitEl = document.getElementById("perfDonutChartUnit");
        if (!chartBox || !legendBox) return;

        const isHours = metric === "hours";
        if (titleEl) titleEl.textContent = `توزیع تمرکز بر اساس ${isHours ? "ساعت مطالعه" : "تعداد تست"}`;
        if (unitEl) unitEl.textContent = isHours ? "سهم ساعت" : "سهم تست";

        chartBox.replaceChildren();
        legendBox.replaceChildren();

        if (!subjects.length) {
            chartBox.innerHTML = `<p class="student-feedbacks-empty">داده‌ای ثبت نشده است.</p>`;
            return;
        }

        const size = 220;
        const radius = 72;
        const strokeW = 24;
        const circumference = 2 * Math.PI * radius;
        let cumulativeOffset = 0;

        let arcsHtml = "";
        subjects.forEach(item => {
            const pct = Math.max(0, Number(item.percentage) || 0);
            const dash = (pct / 100) * circumference;
            const gap = Math.max(0, circumference - dash);

            arcsHtml += `
                <circle cx="${size / 2}" cy="${size / 2}" r="${radius}"
                        fill="transparent"
                        stroke="${item.color}"
                        stroke-width="${strokeW}"
                        stroke-dasharray="${dash.toFixed(2)} ${gap.toFixed(2)}"
                        stroke-dashoffset="${(-cumulativeOffset).toFixed(2)}"
                        style="transition:stroke-dasharray 0.3s ease;"/>
            `;
            cumulativeOffset += dash;
        });

        chartBox.innerHTML = `
            <svg viewBox="0 0 ${size} ${size}" width="100%" height="100%" style="transform:rotate(-90deg);">
                <circle cx="${size / 2}" cy="${size / 2}" r="${radius}" fill="transparent" stroke="#f1f5f9" stroke-width="${strokeW}"/>
                ${arcsHtml}
            </svg>
            <div class="payeh-donut-center-info">
                <span class="payeh-donut-center-val">${faDigit(totalVal)}</span>
                <span class="payeh-donut-center-label">${isHours ? "کل ساعات" : "کل تست‌ها"}</span>
            </div>
        `;

        // Render Legend Items
        subjects.forEach(item => {
            const row = document.createElement("div");
            row.className = "payeh-donut-legend-item";
            row.innerHTML = `
                <div class="payeh-donut-legend-left">
                    <span class="payeh-donut-legend-dot" style="background:${item.color};"></span>
                    <span class="payeh-donut-legend-name">${item.subject}</span>
                </div>
                <div class="payeh-donut-legend-right">
                    <span class="payeh-donut-legend-val">${faDigit(item.value)} ${isHours ? "ساعت" : "تست"}</span>
                    <span class="payeh-donut-legend-pct">${faDigit(item.percentage)}٪</span>
                </div>
            `;
            legendBox.append(row);
        });
    };

    // Performance Toolbar Listeners
    document.querySelectorAll(".payeh-perf-interval-btn[data-interval]").forEach(btn => {
        btn.addEventListener("click", () => {
            document.querySelectorAll(".payeh-perf-interval-btn").forEach(b => b.classList.remove("active"));
            btn.classList.add("active");
            perfInterval = btn.dataset.interval;
            loadPerformanceView();
        });
    });

    document.querySelectorAll(".payeh-perf-metric-btn[data-metric]").forEach(btn => {
        btn.addEventListener("click", () => {
            document.querySelectorAll(".payeh-perf-metric-btn").forEach(b => b.classList.remove("active"));
            btn.classList.add("active");
            perfMetric = btn.dataset.metric;
            loadPerformanceView();
        });
    });

    /* ==========================================================================
       SPA NAVIGATION ROUTER
       ========================================================================== */
    const selectPage = (name) => {
        document.querySelectorAll(".payeh-student__nav-item[data-page]").forEach((item) => item.classList.toggle("active", item.dataset.page === name));
        if (pageTitle) pageTitle.textContent = titles[name] || titles.dashboard;

        // Hide all views
        document.querySelectorAll(".payeh-student__view").forEach(v => {
            v.classList.remove("active");
            v.style.display = "none";
        });

        if (name === "chat") {
            const v = document.getElementById("view-chat");
            if (v) { v.classList.add("active"); v.style.display = "block"; }
            loadChatView();
        } else if (name === "ranking") {
            const v = document.getElementById("view-ranking");
            if (v) { v.classList.add("active"); v.style.display = "block"; }
            loadRankingView();
        } else if (name === "performance") {
            const v = document.getElementById("view-performance");
            if (v) { v.classList.add("active"); v.style.display = "block"; }
            loadPerformanceView();
        } else {
            const v = document.getElementById("view-dashboard");
            if (v) { v.classList.add("active"); v.style.display = "block"; }

            if (name === "consultant") {
                document.getElementById("student-consultant-panel")?.scrollIntoView({ behavior: "smooth", block: "center" });
            } else if (name === "tasks" || name === "activities") {
                document.getElementById("student-study-plan")?.scrollIntoView({ behavior: "smooth", block: "start" });
            } else if (name === "profile") {
                document.getElementById("student-profile-panel")?.scrollIntoView({ behavior: "smooth", block: "start" });
            } else {
                window.scrollTo({ top: 0, behavior: "smooth" });
            }
        }
        toggleStudentSidebar(false);
    };

    const studentSidebarOverlay = document.getElementById("studentSidebarOverlay");
    const studentSidebarClose = document.getElementById("studentSidebarClose");

    const toggleStudentSidebar = (force) => {
        if (!sidebar) return;
        const isCurrentlyOpen = sidebar.classList.contains("is-open") || sidebar.classList.contains("open");
        const willOpen = typeof force === "boolean" ? force : !isCurrentlyOpen;

        sidebar.classList.toggle("is-open", willOpen);
        sidebar.classList.toggle("open", willOpen);

        if (studentSidebarOverlay) {
            studentSidebarOverlay.classList.toggle("is-active", willOpen);
            studentSidebarOverlay.classList.toggle("active", willOpen);
        }

        document.body.classList.toggle("payeh-sidebar-locked", willOpen);
    };
    window.toggleStudentSidebar = toggleStudentSidebar;

    document.querySelectorAll("[data-page]").forEach((item) => item.addEventListener("click", (event) => {
        event.preventDefault();
        const name = item.dataset.page;
        history.replaceState(null, "", `#${name}`);
        selectPage(name);
        toggleStudentSidebar(false);
    }));

    let lastMenuToggle = 0;
    const handleMenuToggle = (e) => {
        const now = Date.now();
        if (now - lastMenuToggle < 300) {
            if (e) {
                e.preventDefault();
                e.stopPropagation();
            }
            return;
        }
        lastMenuToggle = now;
        if (e) {
            e.stopPropagation();
        }
        toggleStudentSidebar();
    };

    menuButton?.addEventListener("click", handleMenuToggle);

    studentSidebarClose?.addEventListener("click", (e) => {
        if (e) e.stopPropagation();
        toggleStudentSidebar(false);
    });

    studentSidebarOverlay?.addEventListener("click", (e) => {
        if (e) e.stopPropagation();
        toggleStudentSidebar(false);
    });

    document.addEventListener("keydown", (e) => {
        if (e.key === "Escape") {
            toggleStudentSidebar(false);
        }
    });

    document.addEventListener("click", (e) => {
        if (window.innerWidth <= 1024) {
            if (sidebar && (sidebar.classList.contains("is-open") || sidebar.classList.contains("open"))) {
                if (!sidebar.contains(e.target) && !menuButton?.contains(e.target)) {
                    toggleStudentSidebar(false);
                }
            }
        }
    });
    window.addEventListener("hashchange", () => selectPage(location.hash.slice(1) || "dashboard"));
    document.querySelector(".payeh-student__logout")?.addEventListener("click", async () => {
        try { const csrf = await fetch(`/api/auth/csrf/?_t=${Date.now()}`, { credentials: "same-origin", cache: "no-store" }).then((response) => response.json()); await fetch("/api/auth/logout/", { method: "POST", credentials: "same-origin", headers: { "X-CSRFToken": csrf.csrfToken } }); }
        finally { location.replace(`login.html?_t=${Date.now()}`); }
    });

    async function loadStudyPlan() {
        const week = document.getElementById("study-week"), box = document.getElementById("study-now"), dateLabel = document.getElementById("study-date");
        if (!week || !box) return;
        const names = ["شنبه", "یکشنبه", "دوشنبه", "سه‌شنبه", "چهارشنبه", "پنجشنبه", "جمعه"], dayIndexes = { "شنبه": 0, "یکشنبه": 1, "دوشنبه": 2, "سه‌شنبه": 3, "چهارشنبه": 4, "پنجشنبه": 5, "جمعه": 6 };
        const fa = new Intl.NumberFormat("fa-IR");
        const weekday = new Intl.DateTimeFormat("fa-IR", { weekday: "long", timeZone: "Asia/Tehran" }).format(new Date());
        const today = dayIndexes[weekday] ?? 0;
        dateLabel.textContent = new Intl.DateTimeFormat("fa-IR-u-ca-persian", { weekday: "long", year: "numeric", month: "long", day: "numeric", timeZone: "Asia/Tehran" }).format(new Date());

        try {
            const [response, timerResponse] = await Promise.all([
                fetch("/api/consultations/study-sessions/", { credentials: "same-origin" }),
                fetch("/api/consultations/study-timers/today/", { credentials: "same-origin" })
            ]);
            const payload = await response.json(), timerData = await timerResponse.json();
            if (!response.ok) throw new Error(payload.detail || "برنامه دریافت نشد.");

            const sessions = payload.results || [];
            let timersList = (timerData.results || []).map(x => ({
                ...x,
                clientSince: x.running ? Date.now() : null
            }));

            // Collect all defined subjects across the student's weekly study plan
            const planSubjects = Array.from(new Set(sessions.map(s => (s.subject || "").trim()).filter(Boolean)));
            const curriculumSubjects = [
                "زیست‌شناسی", "شیمی", "فیزیک", "ریاضی", "ادبیات فارسی", "عربی",
                "زبان انگلیسی", "دین و زندگی", "حسابان", "هندسه", "گسسته و آمار",
                "زمین‌شناسی", "علوم و فنون ادبی", "عربی اختصاصی", "جامعه‌شناسی",
                "روان‌شناسی", "فلسفه و منطق", "اقتصاد", "تاریخ", "جغرافیا"
            ];
            const allAvailableSubjects = Array.from(new Set([...planSubjects, ...curriculumSubjects]));

            // Render weekly calendar
            week.replaceChildren();
            if (!sessions.length) {
                const empty = document.createElement("p");
                empty.className = "study-empty";
                empty.textContent = "هنوز برنامه‌ای از طرف مشاورت ثبت نشده است.";
                week.replaceChildren(empty);
            } else {
                const grid = document.createElement("div");
                grid.className = "study-week-grid";
                const palette = { mint: "#dff2e6", blue: "#e2efff", peach: "#ffeadc", lavender: "#efe8ff", rose: "#ffe5eb", yellow: "#fff3c9" };
                names.forEach((day, index) => {
                    const col = document.createElement("section");
                    col.className = `study-day${index === today ? " is-today" : ""}`;
                    const h = document.createElement("h4");
                    h.textContent = `${day}${index === today ? " · امروز" : ""}`;
                    col.append(h);
                    const rows = sessions.filter(x => x.weekday === index);
                    if (!rows.length) {
                        const empty = document.createElement("span");
                        empty.className = "study-day-empty";
                        empty.textContent = "برنامه‌ای ثبت نشده";
                        col.append(empty);
                    }
                    rows.forEach(item => {
                        const card = document.createElement("article");
                        card.className = "study-session";
                        card.style.setProperty("--session-color", palette[item.color] || palette.mint);
                        const title = document.createElement("strong");
                        title.textContent = item.subject;
                        const duration = document.createElement("span");
                        duration.textContent = `سهمیه: ${fa.format(Math.floor(item.planned_minutes / 60))} ساعت و ${fa.format(item.planned_minutes % 60)} دقیقه`;
                        const task = document.createElement("span");
                        task.textContent = item.mode === "test" ? `حل تست · ${fa.format(item.test_count)} تست` : item.mode === "written" ? "حل تشریحی" : "مطالعهٔ درس‌نامه";
                        card.append(title, duration, task);
                        if (item.instructions) {
                            const note = document.createElement("small");
                            note.textContent = item.instructions;
                            card.append(note);
                        }
                        col.append(card);
                    });
                    grid.append(col);
                });
                week.append(grid);
            }

            const csrf = async () => (await fetch("/api/auth/csrf/", { credentials: "same-origin" })).json().then(x => x.csrfToken);

            let isAddingBox = false;

            function renderTodayBoxes() {
                box.hidden = false;
                box.className = "study-today-section";
                box.replaceChildren();

                // Topbar
                const topbar = document.createElement("div");
                topbar.className = "study-today-topbar";

                const titleWrap = document.createElement("div");
                titleWrap.className = "study-today-title-wrap";
                const h3 = document.createElement("h3");
                h3.className = "study-today-title";
                h3.textContent = "گزارش مطالعهٔ امروز";
                const desc = document.createElement("p");
                desc.className = "study-today-desc";
                desc.textContent = "هر درس باکس مجزا دارد. زمان ثبت و در ساعت ۱۲ شب به‌صورت خودکار روانه پنل مشاور می‌شود.";
                titleWrap.append(h3, desc);

                const actions = document.createElement("div");
                actions.className = "study-today-actions";

                const badge = document.createElement("span");
                badge.className = "study-boxes-badge";
                badge.textContent = `${fa.format(timersList.length)} از ۳۰ باکس استفاده‌شده`;

                const addBtn = document.createElement("button");
                addBtn.type = "button";
                addBtn.className = "study-add-box-btn";
                addBtn.textContent = "+ افزودن باکس درس جدید";
                addBtn.disabled = timersList.length >= 30;
                addBtn.addEventListener("click", () => {
                    isAddingBox = !isAddingBox;
                    renderTodayBoxes();
                });

                actions.append(badge, addBtn);
                topbar.append(titleWrap, actions);
                box.append(topbar);

                // Add Box Panel
                if (isAddingBox && timersList.length < 30) {
                    const addPanel = document.createElement("div");
                    addPanel.className = "study-add-panel";

                    const select = document.createElement("select");
                    allAvailableSubjects.forEach(s => {
                        const opt = document.createElement("option");
                        opt.value = s;
                        opt.textContent = s;
                        select.append(opt);
                    });
                    const customOpt = document.createElement("option");
                    customOpt.value = "__custom__";
                    customOpt.textContent = "سایر دروس (تایپ دستی)...";
                    select.append(customOpt);

                    const customInput = document.createElement("input");
                    customInput.type = "text";
                    customInput.maxLength = 80;
                    customInput.placeholder = "نام درس دلخواه را بنویسید";
                    customInput.style.display = "none";

                    select.addEventListener("change", () => {
                        customInput.style.display = select.value === "__custom__" ? "inline-block" : "none";
                        if (select.value === "__custom__") customInput.focus();
                    });

                    const submitBtn = document.createElement("button");
                    submitBtn.type = "button";
                    submitBtn.textContent = "ایجاد باکس مطالعه";

                    const cancelBtn = document.createElement("button");
                    cancelBtn.type = "button";
                    cancelBtn.className = "btn-cancel";
                    cancelBtn.textContent = "انصراف";
                    cancelBtn.addEventListener("click", () => {
                        isAddingBox = false;
                        renderTodayBoxes();
                    });

                    const msg = document.createElement("span");
                    msg.style.fontSize = "12px";
                    msg.style.color = "#c0392b";

                    submitBtn.addEventListener("click", async () => {
                        let finalSubject = select.value === "__custom__" ? customInput.value.trim() : select.value.trim();
                        if (!finalSubject) {
                            msg.textContent = "نام درس را وارد کنید.";
                            return;
                        }
                        if (finalSubject.length > 80) {
                            msg.textContent = "نام درس حداکثر ۸۰ کاراکتر است.";
                            return;
                        }
                        submitBtn.disabled = true;
                        msg.textContent = "در حال ایجاد باکس...";
                        try {
                            const token = await csrf();
                            const r = await fetch("/api/consultations/study-timers/create-box/", {
                                method: "POST",
                                credentials: "same-origin",
                                headers: { "Content-Type": "application/json", "X-CSRFToken": token },
                                body: JSON.stringify({ subject: finalSubject })
                            });
                            const d = await r.json();
                            if (!r.ok) throw new Error(d.detail || "ایجاد باکس انجام نشد.");
                            timersList.push({
                                ...d,
                                clientSince: null
                            });
                            isAddingBox = false;
                            renderTodayBoxes();
                        } catch (err) {
                            msg.textContent = err.message || "خطا در ایجاد باکس.";
                            submitBtn.disabled = false;
                        }
                    });

                    addPanel.append(select, customInput, submitBtn, cancelBtn, msg);
                    box.append(addPanel);
                }

                // Grid of Boxes
                const grid = document.createElement("div");
                grid.className = "study-boxes-grid";

                if (!timersList.length) {
                    const emptyCard = document.createElement("div");
                    emptyCard.style.padding = "24px";
                    emptyCard.style.textAlign = "center";
                    emptyCard.style.color = "#627367";
                    emptyCard.style.gridColumn = "1/-1";
                    emptyCard.textContent = "امروز هنوز باکسی برای مطالعه ثبت نشده است. با دکمه بالا اولین باکس را اضافه کن!";
                    grid.append(emptyCard);
                }

                timersList.forEach(timer => {
                    const card = document.createElement("article");
                    card.className = `study-box-card${timer.running ? " is-running" : ""}${timer.finished ? " is-finished" : ""}${timer.delivered ? " is-delivered" : ""}`;
                    card.id = `study-box-card-${timer.id}`;

                    // Header
                    // Header with Subject & Edit Subject button
                    const header = document.createElement("div");
                    header.className = "study-box-header";

                    const subjWrap = document.createElement("div");
                    subjWrap.className = "study-box-subject-wrap";

                    const subjStrong = document.createElement("strong");
                    subjStrong.className = "study-box-subject";
                    subjStrong.textContent = timer.subject;

                    const editSubjBtn = document.createElement("button");
                    editSubjBtn.type = "button";
                    editSubjBtn.className = "study-box-edit-icon-btn";
                    editSubjBtn.title = "تغییر درس";
                    editSubjBtn.innerHTML = `<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg>`;
                    editSubjBtn.disabled = Boolean(timer.delivered);

                    subjWrap.append(subjStrong, editSubjBtn);

                    const tag = document.createElement("span");
                    tag.className = `study-box-tag ${timer.is_planned ? "study-box-tag--planned" : "study-box-tag--extra"}`;
                    tag.textContent = timer.is_planned ? "برنامهٔ امروز" : "مطالعهٔ آزاد";

                    header.append(subjWrap, tag);
                    card.append(header);

                    // Inline Subject Edit Container (hidden by default)
                    const subjEditRow = document.createElement("div");
                    subjEditRow.className = "study-box-inline-edit";
                    subjEditRow.style.display = "none";
                    subjEditRow.innerHTML = `
                        <select class="study-box-inline-select">
                            ${allAvailableSubjects.map(s => `<option value="${s}" ${s === timer.subject ? "selected" : ""}>${s}</option>`).join("")}
                        </select>
                        <button type="button" class="study-box-inline-save">ذخیره</button>
                        <button type="button" class="study-box-inline-cancel">انصراف</button>
                    `;
                    editSubjBtn.addEventListener("click", () => {
                        subjEditRow.style.display = subjEditRow.style.display === "none" ? "flex" : "none";
                    });
                    subjEditRow.querySelector(".study-box-inline-cancel").addEventListener("click", () => {
                        subjEditRow.style.display = "none";
                    });
                    subjEditRow.querySelector(".study-box-inline-save").addEventListener("click", async () => {
                        const newSubj = subjEditRow.querySelector(".study-box-inline-select").value.trim();
                        if (!newSubj) return;
                        await performAction(timer.id, "edit", null, timer.notes || "", { subject: newSubj });
                    });
                    card.append(subjEditRow);

                    // Topic / Chapter Row (clearly visible)
                    const topicRow = document.createElement("div");
                    topicRow.className = "study-box-topic-row";

                    const topicInfo = document.createElement("div");
                    topicInfo.className = "study-box-topic-info";
                    const topicLabel = document.createElement("span");
                    topicLabel.className = "study-box-topic-label";
                    topicLabel.textContent = "مبحث / فصل:";
                    const topicText = document.createElement("span");
                    topicText.className = "study-box-topic-text";
                    topicText.textContent = timer.topic || "تعیین‌نشده (کلیک جهت درج)";
                    topicInfo.append(topicLabel, topicText);

                    const editTopicBtn = document.createElement("button");
                    editTopicBtn.type = "button";
                    editTopicBtn.className = "study-box-edit-icon-btn";
                    editTopicBtn.title = "ویرایش مبحث و فصل";
                    editTopicBtn.innerHTML = `<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg>`;
                    editTopicBtn.disabled = Boolean(timer.delivered);

                    topicRow.append(topicInfo, editTopicBtn);
                    card.append(topicRow);

                    // Inline Topic Edit Container (hidden by default)
                    const topicEditRow = document.createElement("div");
                    topicEditRow.className = "study-box-inline-edit";
                    topicEditRow.style.display = "none";
                    topicEditRow.innerHTML = `
                        <input type="text" class="study-box-inline-input" placeholder="مبحث یا فصل مطالعه (مثلاً: فصل ۲ - گوارش)" value="${timer.topic ? String(timer.topic).replace(/"/g, '&quot;') : ''}" maxlength="255">
                        <button type="button" class="study-box-inline-save">ذخیره</button>
                        <button type="button" class="study-box-inline-cancel">انصراف</button>
                    `;
                    editTopicBtn.addEventListener("click", () => {
                        topicEditRow.style.display = topicEditRow.style.display === "none" ? "flex" : "none";
                        if (topicEditRow.style.display === "flex") {
                            topicEditRow.querySelector(".study-box-inline-input").focus();
                        }
                    });
                    topicEditRow.querySelector(".study-box-inline-cancel").addEventListener("click", () => {
                        topicEditRow.style.display = "none";
                    });
                    topicEditRow.querySelector(".study-box-inline-save").addEventListener("click", async () => {
                        const newTopic = topicEditRow.querySelector(".study-box-inline-input").value.trim();
                        await performAction(timer.id, "edit", null, timer.notes || "", { topic: newTopic });
                    });
                    card.append(topicEditRow);

                    if (timer.is_planned && timer.planned_minutes) {
                        const quotaHint = document.createElement("div");
                        quotaHint.className = "study-box-quota-hint";
                        quotaHint.textContent = `سهمیه امروز: ${fa.format(Math.floor(timer.planned_minutes / 60))} ساعت و ${fa.format(timer.planned_minutes % 60)} دقیقه`;
                        card.append(quotaHint);
                    }

                    // Timer display & Status badge
                    const timerWrap = document.createElement("div");
                    timerWrap.className = "study-box-timer-wrap";

                    const digitsRow = document.createElement("div");
                    digitsRow.className = "study-timer-digits-row";

                    const dot = document.createElement("span");
                    dot.className = "study-pulsing-dot";
                    dot.style.display = timer.running ? "inline-block" : "none";

                    const timeDisplay = document.createElement("span");
                    timeDisplay.className = "study-box-time";
                    timeDisplay.id = `study-time-${timer.id}`;
                    const secs = timer.elapsed_seconds + (timer.running && timer.clientSince ? Math.floor((Date.now() - timer.clientSince) / 1000) : 0);
                    timeDisplay.textContent = `${fa.format(Math.floor(secs / 3600))}:${fa.format(Math.floor((secs % 3600) / 60)).padStart(2, "۰")}:${fa.format(secs % 60).padStart(2, "۰")}`;

                    digitsRow.append(dot, timeDisplay);

                    const timeLabel = document.createElement("span");
                    timeLabel.className = "study-time-label";
                    timeLabel.textContent = "زمان مطالعه‌شده";

                    const stateBadge = document.createElement("span");
                    stateBadge.className = "study-state-badge";
                    if (timer.delivered) {
                        stateBadge.className += " badge--delivered";
                        stateBadge.textContent = "ارسال‌شده به مشاور";
                    } else if (timer.running) {
                        stateBadge.className += " badge--running";
                        stateBadge.textContent = "در حال مطالعه";
                    } else if (timer.finished) {
                        stateBadge.className += " badge--finished";
                        stateBadge.textContent = "ثبت‌شده (ارسال ۱۲ شب)";
                    } else if (timer.elapsed_seconds > 0) {
                        stateBadge.className += " badge--paused";
                        stateBadge.textContent = "استپ / توقف موقت";
                    } else {
                        stateBadge.className += " badge--idle";
                        stateBadge.textContent = "شروع‌نشده";
                    }

                    timerWrap.append(digitsRow, timeLabel, stateBadge);
                    card.append(timerWrap);

                    // Actions
                    const actionGroup = document.createElement("div");
                    actionGroup.className = "study-box-actions";

                    // Button 1: Start / Resume / Pause toggle
                    const startBtn = document.createElement("button");
                    startBtn.type = "button";
                    startBtn.className = "study-box-btn study-btn--start";
                    if (timer.running) {
                        startBtn.textContent = "⏸ استپ (توقف موقت)";
                        startBtn.className += " is-pause-mode";
                    } else if (timer.finished) {
                        startBtn.textContent = "▶ ادامهٔ مطالعه";
                    } else if (timer.elapsed_seconds > 0) {
                        startBtn.textContent = "▶ ادامهٔ مطالعه";
                    } else {
                        startBtn.textContent = "▶ شروع مطالعه";
                    }
                    startBtn.disabled = Boolean(timer.delivered);

                    // Button 2: Pause / Stop (ALWAYS VISIBLE!)
                    const pauseBtn = document.createElement("button");
                    pauseBtn.type = "button";
                    pauseBtn.className = `study-box-btn study-btn--pause${timer.running ? " is-active" : ""}`;
                    pauseBtn.textContent = "⏸ استپ و توقف موقت";
                    pauseBtn.disabled = !timer.running || Boolean(timer.delivered);

                    // Button 3: Finish & Submit
                    const finishBtn = document.createElement("button");
                    finishBtn.type = "button";
                    finishBtn.className = `study-box-btn study-btn--finish${timer.finished ? " is-registered" : ""}`;
                    finishBtn.textContent = timer.finished ? "✔ ثبت شد (ارسال ۱۲ شب)" : "⏹ اتمام و ثبت گزارش";
                    finishBtn.disabled = Boolean(timer.delivered);

                    actionGroup.append(startBtn, pauseBtn, finishBtn);
                    card.append(actionGroup);

                    // Notes
                    const notesArea = document.createElement("textarea");
                    notesArea.className = "study-box-notes";
                    notesArea.maxLength = 1000;
                    notesArea.placeholder = "توضیحات و گزارش کار (مباحث، تعداد تست‌ها یا صفحات مطالعه‌شده)...";
                    notesArea.value = timer.notes || "";
                    notesArea.disabled = Boolean(timer.delivered);
                    notesArea.addEventListener("input", () => {
                        timer.notes = notesArea.value;
                    });
                    card.append(notesArea);

                    // Quick Note Save Row
                    const noteSaveRow = document.createElement("div");
                    noteSaveRow.className = "study-notes-save-row";
                    const noteSaveBtn = document.createElement("button");
                    noteSaveBtn.type = "button";
                    noteSaveBtn.className = "study-notes-save-btn";
                    noteSaveBtn.textContent = "💾 ذخیره توضیحات گزارش";
                    noteSaveBtn.disabled = Boolean(timer.delivered);
                    noteSaveBtn.addEventListener("click", () => {
                        performAction(timer.id, "edit", null, notesArea.value);
                    });
                    noteSaveRow.append(noteSaveBtn);
                    card.append(noteSaveRow);

                    // Manual Time Correction Section
                    const manualSection = document.createElement("div");
                    manualSection.className = "study-box-manual-section";

                    const manualHeader = document.createElement("div");
                    manualHeader.className = "study-manual-header";

                    const manualTitle = document.createElement("span");
                    manualTitle.className = "study-manual-title";
                    manualTitle.textContent = "اصلاح دستی زمان مطالعه‌شده:";

                    const quotaSpan = document.createElement("span");
                    quotaSpan.className = "study-manual-quota";
                    quotaSpan.textContent = `(سهمیه: ${fa.format(timer.edits_remaining ?? 5)} از ۵ بار)`;

                    manualHeader.append(manualTitle, quotaSpan);
                    manualSection.append(manualHeader);

                    const manualHint = document.createElement("p");
                    manualHint.className = "study-manual-hint";
                    manualHint.textContent = "چنانچه مقدار تایمر اشتباه است، می‌توانید زمان مطالعه‌شده را از این طریق به صورت دستی اصلاح کنید.";
                    manualSection.append(manualHint);

                    const manualControls = document.createElement("div");
                    manualControls.className = "study-manual-controls";

                    const hLabel = document.createElement("label");
                    hLabel.className = "study-manual-field";
                    hLabel.append("ساعت: ");
                    const hoursInput = document.createElement("input");
                    hoursInput.type = "number";
                    hoursInput.min = "0";
                    hoursInput.max = "24";
                    hoursInput.className = "study-manual-num";
                    hoursInput.value = "";
                    hoursInput.placeholder = "۰";
                    hoursInput.disabled = Boolean(timer.delivered) || Number(timer.edits_remaining ?? 5) <= 0;
                    hLabel.append(hoursInput);

                    const mLabel = document.createElement("label");
                    mLabel.className = "study-manual-field";
                    mLabel.append("دقیقه: ");
                    const minutesInput = document.createElement("input");
                    minutesInput.type = "number";
                    minutesInput.min = "0";
                    minutesInput.max = "59";
                    minutesInput.className = "study-manual-num";
                    minutesInput.value = "";
                    minutesInput.placeholder = "۰";
                    minutesInput.disabled = Boolean(timer.delivered) || Number(timer.edits_remaining ?? 5) <= 0;
                    mLabel.append(minutesInput);

                    const manualSaveBtn = document.createElement("button");
                    manualSaveBtn.type = "button";
                    manualSaveBtn.className = "study-manual-btn";
                    manualSaveBtn.textContent = "ثبت اصلاح دستی زمان مطالعه‌شده";
                    manualSaveBtn.disabled = Boolean(timer.delivered) || Number(timer.edits_remaining ?? 5) <= 0;

                    manualControls.append(hLabel, mLabel, manualSaveBtn);
                    manualSection.append(manualControls);
                    card.append(manualSection);

                    // Status Message
                    const statusMsg = document.createElement("div");
                    statusMsg.className = "study-box-status";
                    if (timer.delivered) {
                        statusMsg.textContent = "📤 گزارش این درس ساعت ۱۲ شب برای مشاور ارسال شد.";
                    } else if (timer.finished) {
                        statusMsg.textContent = "✅ گزارش این درس ثبت شده و ساعت ۱۲ شب ارسال خواهد شد. تا قبل از ۱۲ شب می‌توانید با «ادامهٔ مطالعه» زمان بیشتری بیفزایید یا زمان مطالعه‌شده و توضیحات را ویرایش کنید.";
                    } else if (timer.running) {
                        statusMsg.textContent = "⏱ در حال مطالعه… برای وقفه «استپ و توقف موقت» را بزنید.";
                    } else if (timer.elapsed_seconds > 0) {
                        statusMsg.textContent = "⏸ زمان متوقف است (استپ). می‌توانید «ادامهٔ مطالعه» را بزنید یا با «اتمام و ثبت گزارش» آن را ثبت کنید.";
                    } else {
                        statusMsg.textContent = "آماده برای شروع مطالعهٔ این درس.";
                    }
                    card.append(statusMsg);

                    // Event Listeners
                    startBtn.addEventListener("click", () => {
                        if (timer.running) {
                            performAction(timer.id, "pause", null, notesArea.value);
                        } else {
                            performAction(timer.id, "start", null, notesArea.value);
                        }
                    });
                    pauseBtn.addEventListener("click", () => {
                        performAction(timer.id, "pause", null, notesArea.value);
                    });
                    finishBtn.addEventListener("click", () => {
                        const confirmMsg = timer.finished
                            ? "می‌خواهی تغییرات گزارش را برای ارسال ساعت ۱۲ شب به‌روزرسانی کنی؟"
                            : "مطمئنی مطالعهٔ این درس را به پایان رساندی؟ گزارش نهایی ساعت ۱۲ شب برای مشاور ارسال می‌شود و تا قبل از ۱۲ شب هم قابل ویرایش است.";
                        if (window.confirm(confirmMsg)) {
                            performAction(timer.id, "finish", null, notesArea.value);
                        }
                    });
                    manualSaveBtn.addEventListener("click", () => {
                        const hVal = hoursInput.value.trim();
                        const mVal = minutesInput.value.trim();
                        if (hVal === "" && mVal === "") {
                            alert("لطفاً برای اصلاح دستی، مقدار ساعت یا دقیقه را وارد کنید.");
                            return;
                        }
                        const h = hVal === "" ? 0 : parseInt(hVal, 10);
                        const m = mVal === "" ? 0 : parseInt(mVal, 10);
                        if (isNaN(h) || h < 0 || h > 24 || isNaN(m) || m < 0 || m > 59) {
                            alert("لطفاً ساعت (بین ۰ تا ۲۴) و دقیقه (بین ۰ تا ۵۹) معتبر وارد کنید.");
                            return;
                        }
                        const totalMinutes = h * 60 + m;
                        if (totalMinutes > 1440) {
                            alert("مجموع زمان نمی‌تواند بیشتر از ۲۴ ساعت (۱۴۴۰ دقیقه) باشد.");
                            return;
                        }
                        performAction(timer.id, "edit", totalMinutes, notesArea.value);
                    });

                    grid.append(card);
                });

                box.append(grid);
            }

            // Central action handler
            async function performAction(timerId, actionName, minutes = null, notesVal = "", extra = {}) {
                const card = document.getElementById(`study-box-card-${timerId}`);
                if (card) {
                    card.style.opacity = "0.7";
                    card.style.pointerEvents = "none";
                }
                try {
                    const token = await csrf();
                    if (!token) throw new Error("توکن امنیتی دریافت نشد؛ صفحه را تازه کنید.");
                    const payload = { timer_id: timerId, action: actionName, notes: notesVal, ...extra };
                    if (minutes !== null) payload.minutes = minutes;
                    const r = await fetch("/api/consultations/study-timers/action/", {
                        method: "POST",
                        credentials: "same-origin",
                        headers: { "Content-Type": "application/json", "X-CSRFToken": token },
                        body: JSON.stringify(payload)
                    });
                    const d = await r.json();
                    if (!r.ok) throw new Error(d.detail || `خطا در ثبت (${r.status})`);

                    // If starting, pause any other running timer locally
                    if (actionName === "start") {
                        timersList.forEach(t => {
                            if (t.id !== timerId && t.running) {
                                t.elapsed_seconds += t.clientSince ? Math.floor((Date.now() - t.clientSince) / 1000) : 0;
                                t.running = false;
                                t.clientSince = null;
                            }
                        });
                    }

                    const idx = timersList.findIndex(t => t.id === timerId);
                    if (idx !== -1) {
                        timersList[idx] = {
                            ...timersList[idx],
                            ...d,
                            clientSince: d.running ? Date.now() : null
                        };
                    }
                    renderTodayBoxes();
                    return true;
                } catch (err) {
                    alert(err.message || "خطا در عملیات زمان‌سنج.");
                    if (card) {
                        card.style.opacity = "1";
                        card.style.pointerEvents = "auto";
                    }
                    return false;
                }
            }

            // Global 1-second ticker for running timer
            if (window.studyTimerTicker) clearInterval(window.studyTimerTicker);
            window.studyTimerTicker = setInterval(() => {
                const active = timersList.find(t => t.running);
                if (!active || !active.clientSince) return;
                const secs = active.elapsed_seconds + Math.floor((Date.now() - active.clientSince) / 1000);
                const node = document.getElementById(`study-time-${active.id}`);
                if (node) {
                    node.textContent = `${fa.format(Math.floor(secs / 3600))}:${fa.format(Math.floor((secs % 3600) / 60)).padStart(2, "۰")}:${fa.format(secs % 60).padStart(2, "۰")}`;
                }
            }, 1000);

            renderTodayBoxes();

            // Load delivered study report history & render in glassmorphic rail
            try {
                const reports = await fetch(`/api/consultations/study-reports/?_t=${Date.now()}`, { credentials: "same-origin" }).then(r => r.json());
                renderPastReportsRail(reports.results || []);
            } catch (err) {
                console.error("Error loading past study reports:", err);
            }
        } catch (error) {
            week.textContent = error.message || "برنامه دریافت نشد.";
        }
    }

    const renderPastReportsRail = (allReports) => {
        const rail = document.getElementById("student-glass-reports-rail");
        const modal = document.getElementById("studentAllReportsModal");
        const modalBody = document.getElementById("studentAllReportsModalBody");
        if (!rail) return;
        rail.replaceChildren();

        const fa = new Intl.NumberFormat("fa-IR");

        const formatJalali = (dStr) => {
            return toPersianDate(dStr, { month: "long", day: "numeric" });
        };

        const createReportCard = (x) => {
            const card = document.createElement("article");
            card.className = "student-glass-report-card";

            const header = document.createElement("div");
            header.className = "student-glass-card__header";

            const subj = document.createElement("h4");
            subj.className = "student-glass-card__subject";
            subj.textContent = x.subject;

            const date = document.createElement("span");
            date.className = "student-glass-card__date";
            date.textContent = formatJalali(x.study_date);

            header.append(subj, date);

            const topicEl = document.createElement("div");
            topicEl.className = "student-glass-card__topic";
            topicEl.innerHTML = `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path></svg> <span>${x.topic || "مطالعه مباحث اصلی"}</span>`;

            const stats = document.createElement("div");
            stats.className = "student-glass-card__stats";

            const h = Math.floor(x.minutes / 60);
            const m = x.minutes % 60;
            const timeStr = h > 0 ? `${fa.format(h)} ساعت و ${fa.format(m)} دقیقه` : `${fa.format(m)} دقیقه`;

            stats.innerHTML = `
                <div class="student-glass-card__stat-item">
                    <span class="student-glass-card__stat-label">مدت مطالعه</span>
                    <span class="student-glass-card__stat-val">${timeStr}</span>
                </div>
                <div class="student-glass-card__stat-item" style="align-items:flex-end;">
                    <span class="student-glass-card__stat-label">تست زده‌شده</span>
                    <span class="student-glass-card__stat-val">${x.test_count > 0 ? `${fa.format(x.test_count)} تست` : "—"}</span>
                </div>
            `;

            card.append(header, topicEl, stats);

            if (x.notes) {
                const notes = document.createElement("p");
                notes.className = "student-glass-card__notes";
                notes.textContent = x.notes;
                card.append(notes);
            }

            const status = document.createElement("div");
            status.className = "student-glass-card__status";
            status.innerHTML = `<span class="student-glass-card__status-dot"></span> <span>تحویل‌شده به مشاور (نهایی)</span>`;
            card.append(status);

            return card;
        };

        if (!allReports.length) {
            const empty = document.createElement("div");
            empty.style.padding = "28px";
            empty.style.textAlign = "center";
            empty.style.color = "#64748b";
            empty.style.width = "100%";
            empty.textContent = "هنوز گزارش مطالعه‌ای در سامانه نهایی نشده است. گزارش‌های ثبت‌شده هر شب ساعت ۱۲ به این بخش منتقل می‌شوند.";
            rail.append(empty);
            return;
        }

        // Show last 10 in rail
        allReports.slice(0, 10).forEach(x => {
            rail.append(createReportCard(x));
        });

        // View more card with arrow at end of rail
        const moreCard = document.createElement("div");
        moreCard.className = "student-glass-more-card";
        moreCard.title = "مشاهده تمام گزارش‌های گذشته";
        moreCard.innerHTML = `
            <div class="student-glass-more-arrow">
                <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.5">
                    <line x1="5" y1="12" x2="19" y2="12"></line>
                    <polyline points="12 5 19 12 12 19"></polyline>
                </svg>
            </div>
            <span class="student-glass-more-title">مشاهده بیشتر</span>
            <span class="student-glass-more-sub">آرشیو تمام گزارش‌ها (${fa.format(allReports.length)})</span>
        `;
        moreCard.addEventListener("click", () => {
            if (modal && modalBody) {
                modalBody.replaceChildren();
                allReports.forEach(x => modalBody.append(createReportCard(x)));
                modal.style.display = "flex";
                modal.setAttribute("aria-hidden", "false");
            }
        });
        rail.append(moreCard);

        document.getElementById("studentCloseReportsModal")?.addEventListener("click", () => {
            if (modal) {
                modal.style.display = "none";
                modal.setAttribute("aria-hidden", "true");
            }
        });

        modal?.addEventListener("click", (e) => {
            if (e.target === modal) {
                modal.style.display = "none";
                modal.setAttribute("aria-hidden", "true");
            }
        });
    };

    async function loadStudyFeedbacks() {
        const target = document.getElementById("student-feedbacks-list");
        if (!target) return;

        try {
            const response = await fetch("/api/consultations/study-feedbacks/", { credentials: "same-origin" });
            const data = await response.json();
            if (!response.ok) throw new Error(data.detail || "دریافت بازخوردها انجام نشد.");

            target.replaceChildren();
            const list = data.results || [];
            if (!list.length) {
                const empty = document.createElement("p");
                empty.className = "student-feedbacks-empty";
                empty.textContent = "هنوز بازخوردی از طرف مشاور برای گزارش‌های مطالعه شما ثبت نشده است.";
                target.append(empty);
                return;
            }

            list.forEach(item => {
                const card = document.createElement("article");
                card.className = "student-feedback-card";

                const header = document.createElement("div");
                header.className = "student-feedback-header";

                const author = document.createElement("span");
                author.className = "student-feedback-author";
                author.textContent = `مشاور: ${item.consultant_name}`;

                const meta = document.createElement("span");
                meta.className = "student-feedback-meta";
                const studyDateFa = toPersianDate(item.study_date);
                const timeFa = toPersianTime(item.created_at);
                meta.textContent = `مربوط به گزارش مطالعهٔ ${studyDateFa}${timeFa ? ` · ساعت ${timeFa}` : ""}`;

                header.append(author, meta);

                const body = document.createElement("p");
                body.className = "student-feedback-text";
                body.textContent = item.feedback_text;

                card.append(header, body);
                target.append(card);
            });
        } catch (error) {
            target.replaceChildren();
            const err = document.createElement("p");
            err.className = "student-feedbacks-empty";
            err.textContent = error.message || "خطا در دریافت بازخوردها.";
            target.append(err);
        }
    }

    try {
        const meResponse = await fetch(`/api/auth/me/?_t=${Date.now()}`, { credentials: "same-origin", cache: "no-store" });
        if (!meResponse.ok) { location.assign("login.html"); return; }
        const me = await meResponse.json();
        currentUserId = me.id;
        if (me.role !== "student") { location.assign(me.role === "consultant" ? "consultant.html" : "manager.html"); return; }
        const name = me.full_name || "دانش‌آموز";
        loadStudyPlan();
        loadStudyFeedbacks();
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
};

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initStudentApp);
} else {
    initStudentApp();
}
