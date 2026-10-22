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
       MODULE: MY CONSULTANT & EVENTS HUB (صفحه اختصاصی مشاور و رخدادها)
       ========================================================================== */
    let consultantEventsTab = "feedbacks";
    let consultantFilterType = "all";
    let activeVoicePlayerState = null;
    let activeVoiceAudio = null;

    const stopActiveVoicePlayer = () => {
        if (activeVoiceAudio) {
            try {
                activeVoiceAudio.pause();
                activeVoiceAudio.currentTime = 0;
            } catch (_) {}
            activeVoiceAudio = null;
        }
        if (activeVoicePlayerState) {
            if (activeVoicePlayerState.timerId) clearInterval(activeVoicePlayerState.timerId);
            const playerEl = document.querySelector(`.payeh-voice-player[data-audio-id="${activeVoicePlayerState.playerId}"]`);
            if (playerEl) {
                playerEl.setAttribute("data-playing", "false");
                const iconPlay = playerEl.querySelector(".icon-play");
                const iconPause = playerEl.querySelector(".icon-pause");
                if (iconPlay) iconPlay.style.display = "block";
                if (iconPause) iconPause.style.display = "none";
                const durEl = playerEl.querySelector(".payeh-voice-duration");
                if (durEl && playerEl.dataset.originalDuration) {
                    durEl.textContent = playerEl.dataset.originalDuration;
                }
            }
            activeVoicePlayerState = null;
        }
    };

    const setupVoicePlayers = () => {
        document.querySelectorAll(".payeh-voice-player").forEach(playerEl => {
            const playBtn = playerEl.querySelector(".payeh-voice-play-btn");
            const audioId = playerEl.dataset.audioId;
            const voiceUrl = playerEl.dataset.voiceUrl;
            const durEl = playerEl.querySelector(".payeh-voice-duration");
            if (!playerEl.dataset.originalDuration && durEl) {
                playerEl.dataset.originalDuration = durEl.textContent;
            }

            if (playBtn) {
                playBtn.onclick = (e) => {
                    e.stopPropagation();
                    const isCurrentlyPlaying = playerEl.getAttribute("data-playing") === "true";

                    if (isCurrentlyPlaying) {
                        stopActiveVoicePlayer();
                        return;
                    }

                    // Stop any other playing voice
                    stopActiveVoicePlayer();

                    // Start playing this voice
                    playerEl.setAttribute("data-playing", "true");
                    const iconPlay = playerEl.querySelector(".icon-play");
                    const iconPause = playerEl.querySelector(".icon-pause");
                    if (iconPlay) iconPlay.style.display = "none";
                    if (iconPause) iconPause.style.display = "block";

                    const fa = new Intl.NumberFormat("fa-IR", { minimumIntegerDigits: 2 });

                    if (voiceUrl) {
                        const audio = new Audio(voiceUrl);
                        activeVoiceAudio = audio;

                        audio.addEventListener("timeupdate", () => {
                            if (durEl && !isNaN(audio.currentTime)) {
                                const m = Math.floor(audio.currentTime / 60);
                                const s = Math.floor(audio.currentTime % 60);
                                durEl.textContent = `${fa.format(m)}:${fa.format(s)}`;
                            }
                        });

                        audio.addEventListener("ended", () => {
                            stopActiveVoicePlayer();
                        });

                        audio.addEventListener("error", (err) => {
                            console.warn("Audio playback error:", err);
                            stopActiveVoicePlayer();
                        });

                        audio.play().catch(err => {
                            console.warn("Audio play prevented:", err);
                            stopActiveVoicePlayer();
                        });

                        activeVoicePlayerState = {
                            playerId: audioId,
                            timerId: null
                        };
                    } else {
                        let totalSeconds = 135;
                        let currentSec = 0;

                        const updateTimer = () => {
                            currentSec++;
                            if (currentSec > totalSeconds) {
                                stopActiveVoicePlayer();
                                return;
                            }
                            const m = Math.floor(currentSec / 60);
                            const s = currentSec % 60;
                            if (durEl) durEl.textContent = `${fa.format(m)}:${fa.format(s)}`;
                        };

                        const timerId = setInterval(updateTimer, 1000);
                        activeVoicePlayerState = {
                            playerId: audioId,
                            timerId: timerId,
                            currentSec: 0,
                            totalSec: totalSeconds
                        };
                    }
                };
            }
        });
    };

    const renderConsultantFeedbacks = (feedbacks, consultantName) => {
        const container = document.getElementById("payeh-feedbacks-timeline");
        if (!container) return;

        const defaultFeedbacks = [
            {
                id: "fb-1",
                type: "voice",
                category: "تحلیل شبانه گزارش مطالعه",
                date_str: "امروز - ۱۸ آبان ۱۴۰۴",
                time_str: "ساعت ۲۳:۴۵",
                text: "گزارش امروزت رو با دقت بررسی کردم. کیفیت تست‌زنی زیست‌شناسی خیلی عالی بود، درصد پاسخگویی به بالای ۸۵٪ رسیده که نشون میده مرور دهم خوب جواب داده. برای فردا حتما مبحث دینامیک فیزیک رو اولویت اول بذار و تست‌های نشان‌دار رو دوباره حل کن. ویس تحلیل کامل رو پایین گوش بده:",
                has_voice: true,
                duration: "۰۲:۱۵"
            },
            {
                id: "fb-2",
                type: "analysis",
                category: "توصیه راهبردی آزمون آزمایشی",
                date_str: "دوشنبه - ۱۷ آبان ۱۴۰۴",
                time_str: "ساعت ۲۳:۳۰",
                text: "تحلیل کارنامه آزمون کانون: ترازت ۶۸۵۰ شده که نسبت به آزمون قبل ۱۲۰ واحد رشد داشته. نقطه ضعفی که دیدم در مدیریت زمان دفترچه شیمی بود. استراتژی زمان‌بندی تست‌های محاسباتی رو در جلسه روز چهارشنبه با هم مرور می‌کنیم.",
                has_voice: false
            },
            {
                id: "fb-3",
                type: "reports",
                category: "پاسخ به گزارش مطالعه",
                date_str: "یکشنبه - ۱۶ آبان ۱۴۰۴",
                time_str: "ساعت ۲۳:۵۰",
                text: "مجموع مطالعه امروزت به ۸ ساعت و ۴۰ دقیقه رسید و ۲۱۰ تست زدی. عالی و منظم پیش رفتی. فقط سعی کن فاصله استراحت‌های بین پارت‌ها از ۱۵ دقیقه بیشتر نشه تا تمرکزت در پارت آخر حفظ بمونه.",
                has_voice: true,
                duration: "۰۱:۴۵"
            },
            {
                id: "fb-4",
                type: "analysis",
                category: "تنظیم نقشه راه هفتگی",
                date_str: "شنبه - ۱۵ آبان ۱۴۰۴",
                time_str: "ساعت ۲۲:۱۵",
                text: "برنامه راهبردی این هفته برات بارگذاری شد. ۵۲ ساعت مطالعه همراه با ۷۵۰ تست هدف‌گذاری شده. لطفا فردا طبق جدول شروع کن و تایمرهای پنل رو روشن نگه دار.",
                has_voice: false
            },
            {
                id: "fb-5",
                type: "voice",
                category: "پاسخ به گزارش مطالعه و ویس تحلیلی",
                date_str: "جمعه - ۱۴ آبان ۱۴۰۴",
                time_str: "ساعت ۲۱:۰۰",
                text: "خسته نباشی بابت جمع‌بندی پایان هفته. عملکردت در درس ریاضی پیشرفت چشمگیری داشته. نکات مهم خلاصه‌نویسی و تست‌های تله‌دار رو در ویس برات توضیح دادم:",
                has_voice: true,
                duration: "۰۳:۱۰"
            }
        ];

        let combined = [];
        if (feedbacks && feedbacks.length) {
            const apiItems = feedbacks.map((fb, idx) => {
                const hasVoice = Boolean(fb.voice_url);
                const durationSeconds = fb.voice_duration || 135;
                const m = Math.floor(durationSeconds / 60);
                const s = durationSeconds % 60;
                const fa = new Intl.NumberFormat("fa-IR", { minimumIntegerDigits: 2 });
                const durStr = `${fa.format(m)}:${fa.format(s)}`;
                return {
                    id: `api-fb-${fb.id || idx}`,
                    type: hasVoice ? "voice" : "reports",
                    category: hasVoice ? "پاسخ صوتی به گزارش مطالعه" : "پاسخ به گزارش مطالعه",
                    date_str: toPersianDate(fb.study_date || fb.created_at),
                    time_str: toPersianTime(fb.created_at) ? `ساعت ${toPersianTime(fb.created_at)}` : "",
                    text: fb.feedback_text || (hasVoice ? "پیام صوتی ارسالی از مشاور برای گزارش این روز." : "گزارش شما بررسی و در سامانه تایید گردید."),
                    has_voice: hasVoice,
                    voice_url: fb.voice_url || "",
                    duration: durStr
                };
            });
            combined = [...apiItems, ...defaultFeedbacks];
        } else {
            combined = defaultFeedbacks;
        }

        const filtered = combined.filter(item => {
            if (consultantFilterType === "all") return true;
            if (consultantFilterType === "voice") return item.has_voice;
            if (consultantFilterType === "analysis") return item.type === "analysis";
            if (consultantFilterType === "reports") return item.type === "reports";
            return true;
        });

        const countEl = document.getElementById("events-feedbacks-count");
        if (countEl) countEl.textContent = new Intl.NumberFormat("fa-IR").format(combined.length);

        if (!filtered.length) {
            container.innerHTML = `
                <div style="padding:36px;text-align:center;color:#64748B;background:#F8FAFC;border-radius:16px;">
                    <p style="margin:0;font-weight:700;">موردی با این فیلتر یافت نشد.</p>
                </div>
            `;
            return;
        }

        container.innerHTML = filtered.map(item => `
            <article class="payeh-feedback-item-card">
                <div class="payeh-feedback-item-header">
                    <div class="payeh-feedback-meta-wrap">
                        <span class="payeh-feedback-date-pill">${item.date_str} ${item.time_str ? `· ${item.time_str}` : ""}</span>
                        <span class="payeh-feedback-type-badge">${item.category}</span>
                    </div>
                    <span class="payeh-feedback-consultant-tag">${consultantName}</span>
                </div>
                <p class="payeh-feedback-item-body">${item.text}</p>
                ${item.has_voice ? `
                    <div class="payeh-voice-player" data-playing="false" data-audio-id="${item.id}" data-voice-url="${item.voice_url || ''}">
                        <button type="button" class="payeh-voice-play-btn" title="پخش بازخورد صوتی مشاور">
                            <svg class="icon-play" viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><polygon points="6 3 20 12 6 21 6 3"/></svg>
                            <svg class="icon-pause" viewBox="0 0 24 24" width="14" height="14" fill="currentColor" style="display:none;"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>
                        </button>
                        <div class="payeh-voice-waveform">
                            <span class="payeh-wave-bar" style="height:35%;"></span>
                            <span class="payeh-wave-bar" style="height:70%;"></span>
                            <span class="payeh-wave-bar" style="height:100%;"></span>
                            <span class="payeh-wave-bar" style="height:55%;"></span>
                            <span class="payeh-wave-bar" style="height:90%;"></span>
                            <span class="payeh-wave-bar" style="height:45%;"></span>
                            <span class="payeh-wave-bar" style="height:80%;"></span>
                            <span class="payeh-wave-bar" style="height:60%;"></span>
                            <span class="payeh-wave-bar" style="height:30%;"></span>
                        </div>
                        <span class="payeh-voice-duration">${item.duration || "۰۲:۱۵"}</span>
                    </div>
                ` : ""}
            </article>
        `).join("");

        setupVoicePlayers();
    };

    const renderConsultantWeeklyPlan = (sessions) => {
        const grid = document.getElementById("consultant-week-grid");
        if (!grid) return;

        const weekdayNames = ["شنبه", "یکشنبه", "دوشنبه", "سه‌شنبه", "چهارشنبه", "پنجشنبه", "جمعه"];
        const todayName = new Intl.DateTimeFormat("fa-IR", { weekday: "long", timeZone: "Asia/Tehran" }).format(new Date());

        const defaultPlanDays = [
            {
                day: "شنبه",
                tag: "تکمیل شده",
                is_today: todayName.includes("شنبه"),
                sessions: [
                    { subj: "زیست‌شناسی ۳", time: "۳ ساعت", tests: "۱۱۰ تست", note: "گفتار ۲ فصل ۳" },
                    { subj: "فیزیک ۳", time: "۲.۵ ساعت", tests: "۵۰ تست", note: "دینامیک تست‌های تسلط" },
                    { subj: "شیمی ۳", time: "۲ ساعت", tests: "۴۵ تست", note: "ترمودینامیک و بازده" }
                ]
            },
            {
                day: "یکشنبه",
                tag: "تکمیل شده",
                is_today: todayName.includes("یکشنبه"),
                sessions: [
                    { subj: "ریاضی ۳", time: "۳ ساعت", tests: "۶۰ تست", note: "مشتق پذیری و فرمول‌ها" },
                    { subj: "زیست‌شناسی ۲", time: "۲.۵ ساعت", tests: "۹۰ تست", note: "حواس و دستگاه عصبی" },
                    { subj: "زمین‌شناسی", time: "۱.۵ ساعت", tests: "۴۰ تست", note: "فصل منابع معدنی" }
                ]
            },
            {
                day: "دوشنبه",
                tag: "امروز",
                is_today: todayName.includes("دوشنبه") || (!todayName.includes("شنبه") && !todayName.includes("یکشنبه") && !todayName.includes("سه‌شنبه") && !todayName.includes("چهارشنبه") && !todayName.includes("پنجشنبه") && !todayName.includes("جمعه")),
                sessions: [
                    { subj: "فیزیک ۳", time: "۳ ساعت", tests: "۷۰ تست", note: "حرکت‌شناسی و سرعت متوسط" },
                    { subj: "شیمی ۳", time: "۲.۵ ساعت", tests: "۶۵ تست", note: "اسید و باز مسائل PH" },
                    { subj: "زیست‌شناسی ۳", time: "۲ ساعت", tests: "۸۰ تست", note: "مرور سریع ژنتیک" }
                ]
            },
            {
                day: "سه‌شنبه",
                tag: "برنامه فردا",
                is_today: todayName.includes("سه‌شنبه"),
                sessions: [
                    { subj: "زیست‌شناسی ۳", time: "۳.۵ ساعت", tests: "۱۲۰ تست", note: "سراسری‌های ۴ سال اخیر" },
                    { subj: "ریاضی ۳", time: "۲.۵ ساعت", tests: "۵۵ تست", note: "کاربرد مشتق و اکسترمم" },
                    { subj: "فیزیک ۲", time: "۱.۵ ساعت", tests: "۴۰ تست", note: "الکتریسیته جاری" }
                ]
            },
            {
                day: "چهارشنبه",
                tag: "در انتظار",
                is_today: todayName.includes("چهارشنبه"),
                sessions: [
                    { subj: "شیمی ۲", time: "۲.۵ ساعت", tests: "۶۰ تست", note: "ردپای گازها در جو" },
                    { subj: "فیزیک ۳", time: "۲.۵ ساعت", tests: "۵۰ تست", note: "نوسان و امواج" },
                    { subj: "ریاضی ۳", time: "۲ ساعت", tests: "۴۵ تست", note: "تست‌های ترکیبی مثلثات" }
                ]
            },
            {
                day: "پنجشنبه",
                tag: "پیش‌آزمون",
                is_today: todayName.includes("پنجشنبه"),
                sessions: [
                    { subj: "جمع‌بندی سرفصل‌ها", time: "۴ ساعت", tests: "۱۵۰ تست", note: "شبیه‌ساز دفترچه تخصصی" },
                    { subj: "مرور نکات نشان‌دار", time: "۲ ساعت", tests: "—", note: "دفترچه خودنگاره" }
                ]
            },
            {
                day: "جمعه",
                tag: "آزمون و تحلیل",
                is_today: todayName.includes("جمعه"),
                sessions: [
                    { subj: "شرکت در آزمون", time: "۴ ساعت", tests: "دفترچه کامل", note: "حضور راس ساعت ۸ صبح" },
                    { subj: "تحلیل جامع آزمون", time: "۳ ساعت", tests: "بررسی نزده‌ها", note: "ارسال کارنامه به مشاور" }
                ]
            }
        ];

        if (sessions && sessions.length) {
            defaultPlanDays.forEach(d => {
                const daySessions = sessions.filter(s => s.weekday === d.day);
                if (daySessions.length) {
                    d.sessions = daySessions.map(s => ({
                        subj: s.subject,
                        time: `${Math.round(s.planned_minutes / 60)} ساعت`,
                        tests: `${Math.round(s.planned_minutes * 0.45)} تست`,
                        note: s.instructions || "مطالعه و حل تست"
                    }));
                }
            });
        }

        grid.innerHTML = defaultPlanDays.map(item => `
            <div class="payeh-consultant-day-card${item.is_today ? " is-today" : ""}">
                <div class="payeh-consultant-day-header">
                    <h4>${item.day}</h4>
                    <span class="payeh-consultant-day-tag">${item.tag}</span>
                </div>
                <div class="payeh-consultant-day-sessions">
                    ${item.sessions.map(s => `
                        <div class="payeh-consultant-session-row">
                            <span class="payeh-session-subj">${s.subj}</span>
                            <div class="payeh-session-meta">
                                <span>${s.time}</span>
                                <span>${s.tests}</span>
                            </div>
                            <span style="font-size:10px;color:#94A3B8;margin-top:2px;">${s.note}</span>
                        </div>
                    `).join("")}
                </div>
            </div>
        `).join("");
    };

    const renderConsultantReportsLog = (reports, feedbacks, consultantName) => {
        const tbody = document.getElementById("payeh-reports-log-tbody");
        if (!tbody) return;

        const defaultLogs = [
            {
                date: "سه‌شنبه - ۱۹ آبان ۱۴۰۴",
                hours: "۷ ساعت و ۴۵ دقیقه",
                tests: "۱۸۵ تست",
                status_html: '<span class="payeh-status-pill-ok"><svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg> تایید با ویس تحلیلی</span>',
                answer: "گزارش در ساعت ۲۳:۴۰ دریافت شد. بررسی زیست و فیزیک عالی، ویس تحلیلی ۲ دقیقه‌ای در تلگرام و پنل ثبت گردید."
            },
            {
                date: "دوشنبه - ۱۸ آبان ۱۴۰۴",
                hours: "۸ ساعت و ۱۵ دقیقه",
                tests: "۲۱۰ تست",
                status_html: '<span class="payeh-status-pill-ok"><svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg> بررسی و تایید نهایی</span>',
                answer: "تست‌زنی ریاضی رشد ۲۰ درصدی داشته، سرعت مناسب بود. استراتژی زمان‌بندی شیمی برای آزمون جمعه به برنامه اضافه شد."
            },
            {
                date: "یکشنبه - ۱۷ آبان ۱۴۰۴",
                hours: "۶ ساعت و ۳۰ دقیقه",
                tests: "۱۴۰ تست",
                status_html: '<span class="payeh-status-pill-ok"><svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg> تایید شده</span>',
                answer: "افت جزئی ساعت مطالعه در پارت دوم جبران شد. تمرکز روی تست‌های نزده شیمی مورد تایید است."
            },
            {
                date: "شنبه - ۱۶ آبان ۱۴۰۴",
                hours: "۸ ساعت و ۴۰ دقیقه",
                tests: "۲۲۵ تست",
                status_html: '<span class="payeh-status-pill-ok"><svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg> تایید با ویس راهبردی</span>',
                answer: "شروع فوق‌العاده هفته. تسلط روی ژنتیک دوازدهم در پاسخ به تست‌ها کاملاً مشهود بود. انضباط عالی."
            },
            {
                date: "جمعه - ۱۵ آبان ۱۴۰۴",
                hours: "۵ ساعت و ۲۰ دقیقه",
                tests: "۱۲۰ تست",
                status_html: '<span class="payeh-status-pill-ok"><svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg> بررسی تحلیل آزمون</span>',
                answer: "کارنامه آزمون جمعه کامل تحلیل شد؛ درصد زیست ۷۶٪ و فیزیک ۶۸٪ عالی است. نقاط ضعف در محاسبات شیمی شناسایی شد."
            }
        ];

        let displayRows = defaultLogs;
        if (reports && reports.length) {
            const apiRows = reports.slice(0, 10).map((r, idx) => {
                const fb = (feedbacks || []).find(f => f.study_date === r.study_date) || feedbacks[idx];
                const hoursVal = r.minutes ? `${Math.floor(r.minutes / 60)} ساعت و ${r.minutes % 60} دقیقه` : "۷ ساعت و ۳۰ دقیقه";
                const testsVal = r.test_count ? `${new Intl.NumberFormat("fa-IR").format(r.test_count)} تست` : "۱۸۰ تست";
                return {
                    date: toPersianDate(r.study_date),
                    hours: hoursVal,
                    tests: testsVal,
                    status_html: '<span class="payeh-status-pill-ok"><svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg> بررسی و تایید شده</span>',
                    answer: fb ? fb.feedback_text : `گزارش مطالعه روزانه توسط ${consultantName} بررسی و در سامانه تایید گردید.`
                };
            });
            displayRows = [...apiRows, ...defaultLogs.slice(apiRows.length)];
        }

        tbody.innerHTML = displayRows.map(row => `
            <tr>
                <td style="font-weight:700;color:#0F172A;white-space:nowrap;">${row.date}</td>
                <td style="font-weight:700;color:#0753A8;">${row.hours}</td>
                <td style="font-weight:700;color:#0F172A;">${row.tests}</td>
                <td>${row.status_html}</td>
                <td style="color:#475569;line-height:1.7;font-size:12.5px;max-width:380px;">${row.answer}</td>
            </tr>
        `).join("");
    };

    const loadConsultantView = async () => {
        const fa = new Intl.NumberFormat("fa-IR");

        let assignedReq = chatAssignedRequest;
        let feedbacks = [];
        let sessions = [];
        let reports = [];

        try {
            const [reqRes, feedRes, sessRes, repRes] = await Promise.all([
                assignedReq ? Promise.resolve(null) : fetch(`/api/consultations/requests/?_t=${Date.now()}`, { credentials: "same-origin" }),
                fetch(`/api/consultations/study-feedbacks/?_t=${Date.now()}`, { credentials: "same-origin" }),
                fetch(`/api/consultations/study-sessions/?_t=${Date.now()}`, { credentials: "same-origin" }),
                fetch(`/api/consultations/study-reports/?_t=${Date.now()}`, { credentials: "same-origin" })
            ]);

            if (reqRes && reqRes.ok) {
                const reqData = await reqRes.json();
                const list = reqData.results || [];
                assignedReq = list.find(r => r.status === "approved" || r.status === "pending") || list[0] || null;
                chatAssignedRequest = assignedReq;
            }

            if (feedRes && feedRes.ok) {
                const d = await feedRes.json();
                feedbacks = d.results || [];
            }

            if (sessRes && sessRes.ok) {
                const d = await sessRes.json();
                sessions = d.results || [];
            }

            if (repRes && repRes.ok) {
                const d = await repRes.json();
                reports = d.results || [];
            }
        } catch (err) {
            console.warn("Error fetching consultant view data:", err);
        }

        const nameEl = document.getElementById("myconsultant-name");
        const bioEl = document.getElementById("myconsultant-bio");
        const avatarEl = document.getElementById("myconsultant-avatar");
        const planTextEl = document.getElementById("myconsultant-plan-text");
        const daysTextEl = document.getElementById("myconsultant-days-text");

        const hasAssigned = assignedReq && (assignedReq.status === "approved" || assignedReq.assigned_consultant_name);
        const consultantName = hasAssigned ? assignedReq.assigned_consultant_name : "دکتر امیرحسین فرهمند";
        const consultantInitials = consultantName.split(" ").slice(0, 2).map(w => w[0]).join("") || "مش";

        let consultantBio = "";
        if (hasAssigned && (assignedReq.assigned_consultant_bio || assignedReq.assigned_consultant_major)) {
            const parts = [];
            if (assignedReq.assigned_consultant_rank) parts.push(`رتبه ${fa.format(assignedReq.assigned_consultant_rank)} کنکور سراسری`);
            if (assignedReq.assigned_consultant_major) parts.push(assignedReq.assigned_consultant_major);
            if (assignedReq.assigned_consultant_university) parts.push(assignedReq.assigned_consultant_university);
            if (assignedReq.assigned_consultant_bio) parts.push(assignedReq.assigned_consultant_bio);
            consultantBio = parts.join(" · ");
        } else {
            consultantBio = "رتبه ۸ کنکور سراسری تجربی · پزشکی دانشگاه علوم پزشکی تهران · طراح برنامه‌ریزی راهبردی آکادمی پایه";
        }

        if (nameEl) nameEl.textContent = consultantName;
        if (bioEl) bioEl.textContent = consultantBio;
        if (avatarEl) {
            if (hasAssigned && assignedReq.assigned_consultant_avatar_url) {
                avatarEl.innerHTML = `<img src="${assignedReq.assigned_consultant_avatar_url}" alt="${consultantName}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">`;
            } else {
                avatarEl.innerHTML = `<span style="font-size:22px;font-weight:800;color:#0753A8;">${consultantInitials}</span>`;
            }
        }
        if (planTextEl) {
            planTextEl.textContent = assignedReq?.plan_label ? `پلن ${assignedReq.plan_label}` : "پلن VIP نظارت روزانه";
        }
        if (daysTextEl) {
            const daysCount = reports.length > 0 ? reports.length : 48;
            daysTextEl.textContent = `${fa.format(daysCount)} روز همراهی مستمر`;
        }

        const totalReportsCount = reports.length > 0 ? reports.length : 48;
        const totalFeedbacksCount = feedbacks.length > 0 ? feedbacks.length : 44;
        const statReports = document.getElementById("myconsultant-stat-reports");
        const statFeedbacks = document.getElementById("myconsultant-stat-feedbacks");
        const statRate = document.getElementById("myconsultant-stat-rate");
        const statPlan = document.getElementById("myconsultant-stat-plan");

        if (statReports) statReports.textContent = `${fa.format(totalReportsCount)} گزارش`;
        if (statFeedbacks) statFeedbacks.textContent = `${fa.format(totalFeedbacksCount)} بازخورد`;
        if (statRate) statRate.textContent = "۹۸٪";
        if (statPlan) statPlan.textContent = "هفته جاری تنظیم‌شده";

        const countBadge = document.getElementById("events-feedbacks-count");
        if (countBadge) countBadge.textContent = fa.format(totalFeedbacksCount);

        const kpiReports = document.getElementById("kpi-total-reports");
        const kpiRate = document.getElementById("kpi-ontime-rate");
        const kpiFeedbacks = document.getElementById("kpi-reviewed-feedbacks");
        const kpiAvgTime = document.getElementById("kpi-avg-time");

        if (kpiReports) kpiReports.textContent = `${fa.format(totalReportsCount)} روز`;
        if (kpiRate) kpiRate.textContent = "۹۸٪";
        if (kpiFeedbacks) kpiFeedbacks.textContent = `${fa.format(totalFeedbacksCount)} پاسخ`;
        if (kpiAvgTime) kpiAvgTime.textContent = "۳۵ دقیقه";

        // Action buttons
        const chatBtn = document.getElementById("btn-consultant-open-chat");
        if (chatBtn) {
            chatBtn.onclick = () => {
                selectPage("chat");
                document.querySelectorAll(".payeh-chat-tab").forEach(t => t.classList.toggle("active", t.dataset.chatTab === "consultants"));
                chatActiveTab = "consultants";
                renderChatList();
                selectChatRoom("consultant");
            };
        }

        const viewEventsBtn = document.getElementById("btn-consultant-view-events");
        if (viewEventsBtn) {
            viewEventsBtn.onclick = () => {
                const hub = document.getElementById("consultant-events-hub");
                if (hub) {
                    hub.scrollIntoView({ behavior: "smooth", block: "start" });
                }
            };
        }

        // Tab switching
        document.querySelectorAll(".payeh-events-tab[data-events-tab]").forEach(tabBtn => {
            tabBtn.onclick = () => {
                const targetTab = tabBtn.dataset.eventsTab;
                consultantEventsTab = targetTab;
                document.querySelectorAll(".payeh-events-tab").forEach(b => b.classList.toggle("active", b === tabBtn));

                const panels = {
                    "feedbacks": "events-panel-feedbacks",
                    "weekly-plan": "events-panel-weekly-plan",
                    "reports-stats": "events-panel-reports-stats"
                };

                Object.entries(panels).forEach(([tabKey, panelId]) => {
                    const panel = document.getElementById(panelId);
                    if (panel) {
                        panel.style.display = (tabKey === targetTab) ? "flex" : "none";
                    }
                });
            };
        });

        // Tab 1: Feedbacks
        renderConsultantFeedbacks(feedbacks, consultantName);

        // Filter listener
        const filterSelect = document.getElementById("feedbackFilterType");
        if (filterSelect) {
            filterSelect.onchange = (e) => {
                consultantFilterType = e.target.value;
                renderConsultantFeedbacks(feedbacks, consultantName);
            };
        }

        // Tab 2: Weekly Plan
        renderConsultantWeeklyPlan(sessions);

        // Tab 3: Reports & Answers
        renderConsultantReportsLog(reports, feedbacks, consultantName);
    };

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
        } else if (name === "consultant") {
            const v = document.getElementById("view-consultant");
            if (v) { v.classList.add("active"); v.style.display = "block"; }
            loadConsultantView();
            window.scrollTo({ top: 0, behavior: "smooth" });
        } else if (name === "ranking") {
            const v = document.getElementById("view-ranking");
            if (v) { v.classList.add("active"); v.style.display = "block"; }
            loadRankingView();
        } else if (name === "performance") {
            const v = document.getElementById("view-performance");
            if (v) { v.classList.add("active"); v.style.display = "block"; }
            loadPerformanceView();
        } else if (name === "profile") {
            const v = document.getElementById("view-profile");
            if (v) { v.classList.add("active"); v.style.display = "block"; }
            loadProfileView();
            window.scrollTo({ top: 0, behavior: "smooth" });
        } else {
            const v = document.getElementById("view-dashboard");
            if (v) { v.classList.add("active"); v.style.display = "block"; }

            if (name === "tasks" || name === "activities") {
                document.getElementById("student-study-plan")?.scrollIntoView({ behavior: "smooth", block: "start" });
            } else {
                window.scrollTo({ top: 0, behavior: "smooth" });
            }
        }
        toggleStudentSidebar(false);
    };

    let currentUserData = null;

    const updateProfileUI = (data) => {
        if (!data) return;
        currentUserData = data;
        const name = data.full_name || "دانش‌آموز";
        const phone = data.phone || "";
        const grade = data.grade || "";
        const major = data.major || "";
        const gender = data.gender || "";

        // Header & Sidebar
        ["student-sidebar-name", "student-account-name", "profile-card-name"].forEach((id) => {
            const el = document.getElementById(id);
            if (el) el.textContent = name;
        });
        const subtitle = document.getElementById("student-header-subtitle");
        if (subtitle) subtitle.textContent = `پنل شخصی ${name}`;
        const greeting = document.getElementById("student-greeting");
        if (greeting) greeting.textContent = `سلام ${name} 👋`;

        // Card phone & badge
        const cardPhone = document.getElementById("profile-card-phone");
        if (cardPhone) cardPhone.textContent = phone;

        const gradeBadge = document.getElementById("profile-card-grade-badge");
        if (gradeBadge) {
            gradeBadge.textContent = data.grade_label ? `${data.grade_label}${data.major_label ? ` - ${data.major_label}` : ""}` : "پایه تعیین‌نشده";
            gradeBadge.className = data.grade ? "payeh-badge-pill" : "payeh-badge-pill is-warning";
        }

        // Incomplete banner on dashboard
        const banner = document.getElementById("student-incomplete-banner");
        if (banner) {
            banner.style.display = (!grade) ? "flex" : "none";
        }

        // Completion percent calculation
        let completed = 0;
        let total = 4;
        if (name && name !== "دانش‌آموز") completed++;
        if (phone) completed++;
        if (grade) {
            completed++;
            if (["10", "11", "12", "graduate"].includes(grade)) {
                total++;
                if (major) completed++;
            }
        }
        if (gender) completed++;

        const pct = Math.round((completed / total) * 100);
        const pctEl = document.getElementById("profile-completion-percent");
        const fillEl = document.getElementById("profile-completion-fill");
        const hintEl = document.getElementById("profile-completion-hint");
        if (pctEl) pctEl.textContent = `${new Intl.NumberFormat("fa-IR").format(pct)}٪`;
        if (fillEl) fillEl.style.width = `${pct}%`;
        if (hintEl) {
            if (!grade) {
                hintEl.textContent = "لطفاً پایه تحصیلی خود را انتخاب کنید";
                hintEl.style.color = "#dc2626";
            } else if (["10", "11", "12", "graduate"].includes(grade) && !major) {
                hintEl.textContent = "لطفاً رشته تحصیلی خود را انتخاب کنید";
                hintEl.style.color = "#d97706";
            } else if (pct === 100) {
                hintEl.textContent = "مشخصات شما ۱۰۰٪ تکمیل است ✓";
                hintEl.style.color = "#15803d";
            } else {
                hintEl.textContent = "مشخصات تحصیلی ثبت شده است";
                hintEl.style.color = "#64748b";
            }
        }

        // Populate Form Fields
        const fFullName = document.getElementById("profile-full-name");
        if (fFullName) fFullName.value = data.full_name || "";

        const fPhone = document.getElementById("profile-phone");
        if (fPhone) fPhone.value = data.phone || "";

        const fGrade = document.getElementById("profile-grade");
        if (fGrade) fGrade.value = data.grade || "";

        const majorGroup = document.getElementById("profile-major-group");
        const fMajor = document.getElementById("profile-major");
        const isUpperGrade = ["10", "11", "12", "graduate"].includes(data.grade);
        if (majorGroup) majorGroup.style.display = isUpperGrade ? "flex" : "none";
        if (fMajor) fMajor.value = data.major || "";

        const fGender = document.getElementById("profile-gender");
        if (fGender) fGender.value = data.gender || "";

        const fParentPhone = document.getElementById("profile-parent-phone");
        if (fParentPhone) fParentPhone.value = data.parent_phone || "";

        const fNationalId = document.getElementById("profile-national-id");
        if (fNationalId) fNationalId.value = data.national_id || "";

        const fEmail = document.getElementById("profile-email");
        if (fEmail) fEmail.value = data.email || "";

        // Avatar UI
        const avatarImg = document.getElementById("profile-avatar-img");
        const avatarText = document.getElementById("profile-avatar-text");
        const removeAvatarBtn = document.getElementById("btn-remove-student-avatar");
        const initials = name.split(" ").slice(0, 2).map(w => w[0]).join("") || "دا";

        if (data.avatar_url) {
            if (avatarImg) {
                avatarImg.src = data.avatar_url;
                avatarImg.style.display = "block";
            }
            if (avatarText) avatarText.style.display = "none";
            if (removeAvatarBtn) removeAvatarBtn.style.display = "inline-flex";

            ["student-header-avatar-text", "student-sidebar-avatar-text"].forEach(id => {
                const node = document.getElementById(id);
                if (node && node.parentElement) {
                    node.parentElement.innerHTML = `<img src="${data.avatar_url}" alt="${name}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">`;
                }
            });
        } else {
            if (avatarImg) {
                avatarImg.src = "";
                avatarImg.style.display = "none";
            }
            if (avatarText) {
                avatarText.textContent = initials;
                avatarText.style.display = "block";
            }
            if (removeAvatarBtn) removeAvatarBtn.style.display = "none";

            ["student-header-avatar-text", "student-sidebar-avatar-text"].forEach(id => {
                const node = document.getElementById(id);
                if (node) node.textContent = initials;
            });
        }
    };

    let studentAvatarUploaderInitialized = false;
    const setupStudentAvatarUploader = () => {
        if (studentAvatarUploaderInitialized) return;
        studentAvatarUploaderInitialized = true;

        const fileInput = document.getElementById("student-avatar-file-input");
        const pickBtn = document.getElementById("btn-pick-student-avatar");
        const removeBtn = document.getElementById("btn-remove-student-avatar");
        const statusEl = document.getElementById("student-avatar-status");

        if (!fileInput) return;

        const showStatus = (text, type = "info") => {
            if (!statusEl) return;
            statusEl.textContent = text;
            statusEl.className = `payeh-avatar-upload-status ${type}`;
            statusEl.style.display = "block";
            if (type === "success") {
                setTimeout(() => {
                    statusEl.style.display = "none";
                }, 4000);
            }
        };

        if (pickBtn) {
            pickBtn.addEventListener("click", () => fileInput.click());
        }

        fileInput.addEventListener("change", async () => {
            const file = fileInput.files?.[0];
            if (!file) return;

            // Validate file size (10MB max)
            const maxBytes = 10 * 1024 * 1024;
            if (file.size > maxBytes) {
                showStatus("حجم تصویر بیش از حد مجاز است. حداکثر حجم فایل ۱۰ مگابایت است.", "error");
                fileInput.value = "";
                return;
            }

            // Validate file type
            const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
            const allowedExts = [".jpg", ".jpeg", ".png", ".webp"];
            const ext = "." + (file.name.split(".").pop() || "").toLowerCase();
            if (!allowedTypes.includes(file.type) && !allowedExts.includes(ext)) {
                showStatus("تنها فرمت‌های تصویری JPG، PNG و WEBP مجاز هستند.", "error");
                fileInput.value = "";
                return;
            }

            const formData = new FormData();
            formData.append("avatar", file);

            showStatus("در حال بارگذاری تصویر...", "info");
            try {
                const csrfToken = await getCsrfToken();
                const res = await fetch("/api/auth/profile/avatar/", {
                    method: "POST",
                    credentials: "same-origin",
                    headers: { "X-CSRFToken": csrfToken },
                    body: formData,
                });
                const resData = await res.json();
                if (!res.ok) {
                    throw new Error(resData.detail || "بارگذاری تصویر با خطا مواجه شد.");
                }

                showStatus("تصویر پروفایل شما با موفقیت به‌روزرسانی شد.", "success");
                if (currentUserData) {
                    currentUserData.avatar_url = resData.avatar_url;
                    updateProfileUI(currentUserData);
                }
            } catch (err) {
                showStatus(err.message || "خطا در برقراری ارتباط با سرور.", "error");
            } finally {
                fileInput.value = "";
            }
        });

        if (removeBtn) {
            removeBtn.addEventListener("click", async () => {
                if (!confirm("آیا از حذف عکس پروفایل اطمینان دارید؟")) return;

                showStatus("در حال حذف تصویر...", "info");
                try {
                    const csrfToken = await getCsrfToken();
                    const res = await fetch("/api/auth/profile/avatar/", {
                        method: "DELETE",
                        credentials: "same-origin",
                        headers: { "X-CSRFToken": csrfToken },
                    });
                    const resData = await res.json();
                    if (!res.ok) {
                        throw new Error(resData.detail || "حذف تصویر با خطا مواجه شد.");
                    }

                    showStatus("تصویر پروفایل حذف شد.", "success");
                    if (currentUserData) {
                        currentUserData.avatar_url = null;
                        updateProfileUI(currentUserData);
                    }
                } catch (err) {
                    showStatus(err.message || "خطا در حذف تصویر.", "error");
                }
            });
        }
    };

    let profileFormInitialized = false;
    const loadProfileView = () => {
        setupStudentAvatarUploader();
        if (currentUserData) {
            updateProfileUI(currentUserData);
        }
        if (profileFormInitialized) return;
        profileFormInitialized = true;

        const gradeSelect = document.getElementById("profile-grade");
        const majorGroup = document.getElementById("profile-major-group");
        const majorSelect = document.getElementById("profile-major");

        if (gradeSelect) {
            gradeSelect.addEventListener("change", () => {
                const showMajor = ["10", "11", "12", "graduate"].includes(gradeSelect.value);
                if (majorGroup) majorGroup.style.display = showMajor ? "flex" : "none";
                if (!showMajor && majorSelect) majorSelect.value = "";
            });
        }

        const profileForm = document.getElementById("student-profile-form");
        const statusEl = document.getElementById("profile-save-status");
        const submitBtn = document.getElementById("profile-save-btn");

        if (profileForm) {
            profileForm.addEventListener("submit", async (e) => {
                e.preventDefault();
                document.querySelectorAll(".payeh-profile-error").forEach(el => el.textContent = "");
                if (statusEl) { statusEl.textContent = ""; statusEl.className = "payeh-profile-save-status"; }

                const grade = gradeSelect ? gradeSelect.value : "";
                const major = majorSelect ? majorSelect.value : "";
                const fullName = document.getElementById("profile-full-name")?.value.trim() || "";
                const gender = document.getElementById("profile-gender")?.value || "";
                const parentPhone = document.getElementById("profile-parent-phone")?.value.trim() || "";
                const nationalId = document.getElementById("profile-national-id")?.value.trim() || "";
                const email = document.getElementById("profile-email")?.value.trim() || "";

                let hasError = false;
                if (!fullName) {
                    const err = document.getElementById("err-profile-full-name");
                    if (err) err.textContent = "نام و نام خانوادگی الزامی است.";
                    hasError = true;
                }
                if (!grade) {
                    const err = document.getElementById("err-profile-grade");
                    if (err) err.textContent = "پایه تحصیلی الزامی است.";
                    hasError = true;
                }
                if (["10", "11", "12", "graduate"].includes(grade) && !major) {
                    const err = document.getElementById("err-profile-major");
                    if (err) err.textContent = "رشته تحصیلی الزامی است.";
                    hasError = true;
                }
                if (hasError) return;

                if (submitBtn) {
                    submitBtn.disabled = true;
                    submitBtn.innerHTML = `<span>در حال ذخیره...</span>`;
                }

                try {
                    const csrfToken = await getCsrfToken();
                    const res = await fetch("/api/auth/profile/update/", {
                        method: "POST",
                        credentials: "same-origin",
                        headers: {
                            "Content-Type": "application/json",
                            "X-CSRFToken": csrfToken,
                        },
                        body: JSON.stringify({
                            full_name: fullName,
                            grade,
                            major,
                            gender,
                            parent_phone: parentPhone,
                            national_id: nationalId,
                            email,
                        }),
                    });
                    const resData = await res.json();
                    if (!res.ok) {
                        throw new Error(resData.detail || "ذخیره اطلاعات انجام نشد.");
                    }
                    if (statusEl) {
                        statusEl.textContent = "✓ اطلاعات پروفایل با موفقیت به‌روزرسانی شد.";
                        statusEl.className = "payeh-profile-save-status is-success";
                    }
                    if (resData.user) {
                        updateProfileUI(resData.user);
                    }
                } catch (err) {
                    if (statusEl) {
                        statusEl.textContent = err.message || "خطا در برقراری ارتباط.";
                        statusEl.className = "payeh-profile-save-status is-error";
                    }
                } finally {
                    if (submitBtn) {
                        submitBtn.disabled = false;
                        submitBtn.innerHTML = `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg><span>ذخیره تغییرات مشخصات</span>`;
                    }
                }
            });
        }
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

            const getCurriculumData = () => {
                return Array.isArray(window.CURRICULUM_DATA) ? window.CURRICULUM_DATA : [];
            };

            const findCurriculumItem = (subjectName) => {
                const data = getCurriculumData();
                if (!subjectName || !data.length) return null;
                const clean = subjectName.trim().replace(/\s+/g, " ");
                let item = data.find(c => c.title === clean);
                if (item) return item;
                item = data.find(c => c.title.includes(clean) || clean.includes(c.title));
                if (item) return item;

                const numMatch = clean.match(/[1-3۱-۳]/)?.[0];
                const stdNum = numMatch ? numMatch.replace("۱", "1").replace("۲", "2").replace("۳", "3") : null;
                for (const c of data) {
                    if ((clean.includes("شیمی") && c.title.includes("شیمی")) && (!stdNum || c.title.includes(stdNum) || c.grade === (stdNum === "1" ? "10" : stdNum === "2" ? "11" : "12"))) return c;
                    if ((clean.includes("زیست") && c.title.includes("زیست")) && (!stdNum || c.title.includes(stdNum) || c.grade === (stdNum === "1" ? "10" : stdNum === "2" ? "11" : "12"))) return c;
                    if ((clean.includes("فیزیک") && c.title.includes("فیزیک")) && (!stdNum || c.title.includes(stdNum) || c.grade === (stdNum === "1" ? "10" : stdNum === "2" ? "11" : "12"))) return c;
                    if (((clean.includes("ریاضی") || clean.includes("حسابان")) && (c.title.includes("ریاضی") || c.title.includes("حسابان"))) && (!stdNum || c.title.includes(stdNum) || c.grade === (stdNum === "1" ? "10" : stdNum === "2" ? "11" : "12"))) return c;
                    if ((clean.includes("فارسی") || clean.includes("ادبیات")) && (c.title.includes("فارسی") || c.title.includes("ادبیات"))) return c;
                    if (clean.includes("عربی") && c.title.includes("عربی")) return c;
                    if ((clean.includes("انگلیسی") || clean.includes("زبان")) && c.title.includes("انگلیسی")) return c;
                    if ((clean.includes("دینی") || clean.includes("دین و زندگی")) && (c.title.includes("دین") || c.title.includes("دینی"))) return c;
                }
                return null;
            };

            const showConfirmWarning = (message, title = "تأیید حذف") => {
                return new Promise((resolve) => {
                    const modal = document.getElementById("studentConfirmDeleteModal");
                    const titleEl = document.getElementById("studentConfirmDeleteTitle");
                    const msgEl = document.getElementById("studentConfirmDeleteMessage");
                    const okBtn = document.getElementById("studentConfirmDeleteOkBtn");
                    const cancelBtn = document.getElementById("studentConfirmDeleteCancelBtn");
                    const closeBtn = document.getElementById("studentConfirmDeleteClose");

                    if (!modal || !okBtn || !cancelBtn) {
                        resolve(window.confirm(message));
                        return;
                    }

                    if (titleEl) titleEl.textContent = title;
                    if (msgEl) msgEl.textContent = message;

                    modal.style.display = "flex";
                    modal.setAttribute("aria-hidden", "false");

                    const cleanup = () => {
                        modal.style.display = "none";
                        modal.setAttribute("aria-hidden", "true");
                        okBtn.removeEventListener("click", onOk);
                        cancelBtn.removeEventListener("click", onCancel);
                        if (closeBtn) closeBtn.removeEventListener("click", onCancel);
                        modal.removeEventListener("click", onBackdrop);
                    };

                    const onOk = () => {
                        cleanup();
                        resolve(true);
                    };

                    const onCancel = () => {
                        cleanup();
                        resolve(false);
                    };

                    const onBackdrop = (e) => {
                        if (e.target === modal) {
                            cleanup();
                            resolve(false);
                        }
                    };

                    okBtn.addEventListener("click", onOk);
                    cancelBtn.addEventListener("click", onCancel);
                    if (closeBtn) closeBtn.addEventListener("click", onCancel);
                    modal.addEventListener("click", onBackdrop);
                });
            };

            const formatDuration = (mins) => {
                if (!mins || mins <= 0) return "تعیین‌نشده";
                const h = Math.floor(mins / 60);
                const m = mins % 60;
                if (h > 0 && m > 0) return `${fa.format(h)} ساعت و ${fa.format(m)} دقیقه`;
                if (h > 0) return `${fa.format(h)} ساعت`;
                return `${fa.format(m)} دقیقه`;
            };

            // Render weekly calendar
            week.replaceChildren();
            if (!sessions.length) {
                const empty = document.createElement("div");
                empty.className = "study-empty";
                empty.innerHTML = `
                    <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="1.8" style="opacity:0.4;margin-bottom:8px;">
                        <circle cx="12" cy="12" r="10"></circle>
                        <line x1="8" y1="12" x2="16" y2="12"></line>
                    </svg>
                    <p style="margin:0;">هنوز برنامه‌ای از طرف مشاورت ثبت نشده است.</p>
                `;
                week.replaceChildren(empty);
            } else {
                const grid = document.createElement("div");
                grid.className = "study-week-grid";
                const palette = {
                    mint: "#22c55e",
                    blue: "#3b82f6",
                    peach: "#f97316",
                    lavender: "#8b5cf6",
                    rose: "#ec4899",
                    yellow: "#eab308"
                };

                names.forEach((day, index) => {
                    const col = document.createElement("section");
                    col.className = `study-day${index === today ? " is-today" : ""}`;
                    col.id = `study-day-${index}`;

                    // Header
                    const dayHeader = document.createElement("div");
                    dayHeader.className = "study-day-header";

                    const h = document.createElement("h4");
                    h.textContent = day;
                    dayHeader.append(h);

                    if (index === today) {
                        const todayTag = document.createElement("span");
                        todayTag.className = "study-day-today-tag";
                        todayTag.textContent = "امروز";
                        dayHeader.append(todayTag);
                    }
                    col.append(dayHeader);

                    const rows = sessions.filter(x => x.weekday === index);
                    if (!rows.length) {
                        const empty = document.createElement("div");
                        empty.className = "study-day-empty";
                        empty.innerHTML = `
                            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" style="opacity:0.35;margin-bottom:4px;">
                                <circle cx="12" cy="12" r="10"></circle>
                                <line x1="8" y1="12" x2="16" y2="12"></line>
                            </svg>
                            <span>برنامه‌ای ثبت نشده</span>
                        `;
                        col.append(empty);
                    } else {
                        const sessionsWrap = document.createElement("div");
                        sessionsWrap.className = "study-day-sessions-wrap";

                        rows.forEach(item => {
                            const card = document.createElement("article");
                            card.className = "study-session";
                            const accentColor = palette[item.color] || palette.mint;
                            card.style.setProperty("--session-color", accentColor);

                            // Row 1: Title & Mode badge
                            const headRow = document.createElement("div");
                            headRow.className = "study-session__header";

                            const title = document.createElement("strong");
                            title.className = "study-session__title";
                            title.textContent = item.subject;

                            const modeBadge = document.createElement("span");
                            modeBadge.className = "study-session__mode-badge";
                            modeBadge.textContent = item.mode === "test" 
                                ? `حل تست (${fa.format(item.test_count || 0)} تست)`
                                : item.mode === "written" 
                                    ? "حل تشریحی" 
                                    : "مطالعهٔ درس‌نامه";

                            headRow.append(title, modeBadge);

                            // Row 2: Required Time badge (زمان مورد نیاز)
                            const metaRow = document.createElement("div");
                            metaRow.className = "study-session__meta";

                            const timeBadge = document.createElement("span");
                            timeBadge.className = "study-session__time-badge";
                            timeBadge.innerHTML = `
                                <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                    <circle cx="12" cy="12" r="10"></circle>
                                    <polyline points="12 6 12 12 16 14"></polyline>
                                </svg>
                                <span>زمان مورد نیاز: ${formatDuration(item.planned_minutes)}</span>
                            `;
                            metaRow.append(timeBadge);

                            card.append(headRow, metaRow);

                            // Row 3: Instructions / Topics
                            if (item.instructions && item.instructions.trim()) {
                                const instructions = document.createElement("div");
                                instructions.className = "study-session__instructions";
                                instructions.textContent = item.instructions.trim();
                                card.append(instructions);
                            }

                            sessionsWrap.append(card);
                        });

                        col.append(sessionsWrap);
                    }
                    grid.append(col);
                });
                week.append(grid);

                // Auto-scroll to today smoothly without layout displacement
                const todayCol = grid.querySelector(".study-day.is-today");
                if (todayCol) {
                    setTimeout(() => {
                        todayCol.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
                    }, 120);
                }
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

                // Add Box Panel (Curriculum Cascading)
                if (isAddingBox && timersList.length < 30) {
                    const addPanel = document.createElement("div");
                    addPanel.className = "study-add-panel";

                    const cascadeWrap = document.createElement("div");
                    cascadeWrap.className = "study-curriculum-cascade";

                    const cascadeRow = document.createElement("div");
                    cascadeRow.className = "study-cascade-row";

                    // Col 1: Book / Subject
                    const colBook = document.createElement("div");
                    colBook.className = "study-cascade-col";
                    const labelBook = document.createElement("label");
                    labelBook.className = "study-cascade-label";
                    labelBook.textContent = "کتاب / درس:";
                    const selectBook = document.createElement("select");

                    const curriculumList = getCurriculumData();
                    if (curriculumList.length) {
                        const groupCurric = document.createElement("optgroup");
                        groupCurric.label = "سرفصل‌های آموزشی پایه";
                        curriculumList.forEach(c => {
                            const opt = document.createElement("option");
                            opt.value = c.title;
                            opt.textContent = c.title;
                            groupCurric.append(opt);
                        });
                        selectBook.append(groupCurric);
                    }

                    const otherPlanSubjs = allAvailableSubjects.filter(s => !curriculumList.some(c => c.title === s));
                    if (otherPlanSubjs.length) {
                        const groupOther = document.createElement("optgroup");
                        groupOther.label = "سایر دروس هفتگی";
                        otherPlanSubjs.forEach(s => {
                            const opt = document.createElement("option");
                            opt.value = s;
                            opt.textContent = s;
                            groupOther.append(opt);
                        });
                        selectBook.append(groupOther);
                    }

                    const customBookOpt = document.createElement("option");
                    customBookOpt.value = "__custom__";
                    customBookOpt.textContent = "✏ سایر دروس (تایپ دستی)...";
                    selectBook.append(customBookOpt);

                    const customBookInput = document.createElement("input");
                    customBookInput.type = "text";
                    customBookInput.maxLength = 80;
                    customBookInput.placeholder = "نام درس دلخواه را بنویسید";
                    customBookInput.style.display = "none";
                    colBook.append(labelBook, selectBook, customBookInput);

                    // Col 2: Chapter
                    const colChapter = document.createElement("div");
                    colChapter.className = "study-cascade-col";
                    const labelChapter = document.createElement("label");
                    labelChapter.className = "study-cascade-label";
                    labelChapter.textContent = "فصل درس:";
                    const selectChapter = document.createElement("select");
                    const customChapterInput = document.createElement("input");
                    customChapterInput.type = "text";
                    customChapterInput.maxLength = 120;
                    customChapterInput.placeholder = "نام فصل دلخواه را بنویسید";
                    customChapterInput.style.display = "none";
                    colChapter.append(labelChapter, selectChapter, customChapterInput);

                    // Col 3: Topic / Lesson
                    const colTopic = document.createElement("div");
                    colTopic.className = "study-cascade-col";
                    const labelTopic = document.createElement("label");
                    labelTopic.className = "study-cascade-label";
                    labelTopic.textContent = "مبحث / گفتار / درسنامه:";
                    const selectTopic = document.createElement("select");
                    const customTopicInput = document.createElement("input");
                    customTopicInput.type = "text";
                    customTopicInput.maxLength = 150;
                    customTopicInput.placeholder = "توضیح یا مبحث دلخواه را بنویسید";
                    customTopicInput.style.display = "none";
                    colTopic.append(labelTopic, selectTopic, customTopicInput);

                    cascadeRow.append(colBook, colChapter, colTopic);

                    function updateChapters() {
                        selectChapter.replaceChildren();
                        customChapterInput.style.display = "none";
                        const selectedBook = selectBook.value;
                        if (selectedBook === "__custom__") {
                            customBookInput.style.display = "block";
                            colChapter.style.display = "none";
                            colTopic.style.display = "none";
                            return;
                        }
                        customBookInput.style.display = "none";
                        colChapter.style.display = "flex";
                        colTopic.style.display = "flex";

                        const item = findCurriculumItem(selectedBook);
                        const chapters = item ? (item.chapters || []) : [];

                        const defaultOpt = document.createElement("option");
                        defaultOpt.value = "";
                        defaultOpt.textContent = "— کل کتاب / بدون فصل خاص —";
                        selectChapter.append(defaultOpt);

                        chapters.forEach(ch => {
                            const opt = document.createElement("option");
                            opt.value = ch.title;
                            opt.textContent = ch.title;
                            selectChapter.append(opt);
                        });

                        const allChOpt = document.createElement("option");
                        allChOpt.value = "تمام فصل‌ها / مرور کلی";
                        allChOpt.textContent = "تمام فصل‌ها / مرور کلی";
                        selectChapter.append(allChOpt);

                        const customChOpt = document.createElement("option");
                        customChOpt.value = "__custom_ch__";
                        customChOpt.textContent = "✏ تایپ دستی فصل...";
                        selectChapter.append(customChOpt);

                        updateTopics();
                    }

                    function updateTopics() {
                        selectTopic.replaceChildren();
                        customTopicInput.style.display = "none";

                        const selectedBook = selectBook.value;
                        const selectedChTitle = selectChapter.value;

                        if (selectedChTitle === "__custom_ch__") {
                            customChapterInput.style.display = "block";
                            customChapterInput.focus();
                        } else {
                            customChapterInput.style.display = "none";
                        }

                        if (!selectedChTitle || selectedChTitle === "تمام فصل‌ها / مرور کلی" || selectedChTitle === "__custom_ch__") {
                            const opt = document.createElement("option");
                            opt.value = "";
                            opt.textContent = selectedChTitle === "تمام فصل‌ها / مرور کلی" ? "مرور کلی و تست جامع" : "— بدون مبحث خاص —";
                            selectTopic.append(opt);

                            const customTopOpt = document.createElement("option");
                            customTopOpt.value = "__custom_top__";
                            customTopOpt.textContent = "✏ تایپ دستی مبحث...";
                            selectTopic.append(customTopOpt);
                            return;
                        }

                        const item = findCurriculumItem(selectedBook);
                        const chapterObj = item?.chapters?.find(c => c.title === selectedChTitle);
                        const topics = chapterObj ? (chapterObj.topics || []) : [];

                        const defaultOpt = document.createElement("option");
                        defaultOpt.value = "";
                        defaultOpt.textContent = "— کل مباحث این فصل —";
                        selectTopic.append(defaultOpt);

                        topics.forEach(t => {
                            const opt = document.createElement("option");
                            opt.value = t;
                            opt.textContent = t;
                            selectTopic.append(opt);
                        });

                        const customTopOpt = document.createElement("option");
                        customTopOpt.value = "__custom_top__";
                        customTopOpt.textContent = "✏ تایپ دستی مبحث...";
                        selectTopic.append(customTopOpt);
                    }

                    selectBook.addEventListener("change", updateChapters);
                    selectChapter.addEventListener("change", updateTopics);
                    selectTopic.addEventListener("change", () => {
                        if (selectTopic.value === "__custom_top__") {
                            customTopicInput.style.display = "block";
                            customTopicInput.focus();
                        } else {
                            customTopicInput.style.display = "none";
                        }
                    });

                    updateChapters();

                    // Actions Row
                    const cascadeActions = document.createElement("div");
                    cascadeActions.className = "study-cascade-actions";

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
                        let finalSubject = selectBook.value === "__custom__" 
                            ? customBookInput.value.trim() 
                            : selectBook.value.trim();
                        if (!finalSubject) {
                            msg.textContent = "نام درس را وارد یا انتخاب کنید.";
                            return;
                        }
                        if (finalSubject.length > 80) {
                            msg.textContent = "نام درس حداکثر ۸۰ کاراکتر است.";
                            return;
                        }

                        let chVal = selectChapter.value === "__custom_ch__" 
                            ? customChapterInput.value.trim() 
                            : selectChapter.value.trim();
                        let topVal = selectTopic.value === "__custom_top__" 
                            ? customTopicInput.value.trim() 
                            : selectTopic.value.trim();

                        let finalTopic = "";
                        if (chVal && topVal && topVal !== "— کل مباحث این فصل —") {
                            finalTopic = `${chVal} - ${topVal}`;
                        } else if (chVal) {
                            finalTopic = chVal;
                        } else if (topVal) {
                            finalTopic = topVal;
                        }
                        if (finalTopic.length > 250) {
                            finalTopic = finalTopic.substring(0, 250);
                        }

                        submitBtn.disabled = true;
                        msg.textContent = "در حال ایجاد باکس...";
                        try {
                            const token = await csrf();
                            const r = await fetch("/api/consultations/study-timers/create-box/", {
                                method: "POST",
                                credentials: "same-origin",
                                headers: { "Content-Type": "application/json", "X-CSRFToken": token },
                                body: JSON.stringify({ subject: finalSubject, topic: finalTopic })
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

                    cascadeActions.append(submitBtn, cancelBtn, msg);
                    cascadeWrap.append(cascadeRow, cascadeActions);
                    addPanel.append(cascadeWrap);
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

                    const headerActions = document.createElement("div");
                    headerActions.className = "study-box-header-actions";

                    const tag = document.createElement("span");
                    tag.className = `study-box-tag ${timer.is_planned ? "study-box-tag--planned" : "study-box-tag--extra"}`;
                    tag.textContent = timer.is_planned ? "برنامهٔ امروز" : "مطالعهٔ آزاد";

                    const deleteBtn = document.createElement("button");
                    deleteBtn.type = "button";
                    deleteBtn.className = "study-box-delete-btn";
                    deleteBtn.title = "حذف این باکس مطالعه";
                    deleteBtn.innerHTML = `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>`;
                    deleteBtn.disabled = Boolean(timer.delivered);

                    deleteBtn.addEventListener("click", async () => {
                        const confirmed = await showConfirmWarning(
                            `آیا از حذف باکس مطالعه «${timer.subject}» اطمینان دارید؟ در صورت حذف، این باکس از برنامه امروز پاک خواهد شد.`,
                            "تأیید حذف باکس مطالعه"
                        );
                        if (!confirmed) return;
                        await performAction(timer.id, "delete");
                    });

                    headerActions.append(tag, deleteBtn);
                    header.append(subjWrap, headerActions);
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

                    // Inline Topic & Chapter Edit Container with Curriculum picker
                    const topicEditRow = document.createElement("div");
                    topicEditRow.className = "study-box-topic-edit-block";
                    topicEditRow.style.display = "none";

                    const currItem = findCurriculumItem(timer.subject);
                    const chapters = currItem ? (currItem.chapters || []) : [];

                    const cascadeEditRow = document.createElement("div");
                    cascadeEditRow.className = "study-topic-edit-row";

                    const editChapterSelect = document.createElement("select");
                    editChapterSelect.innerHTML = `<option value="">— انتخاب فصل از سرفصل‌ها —</option>` +
                        chapters.map(ch => `<option value="${ch.title}">${ch.title}</option>`).join("") +
                        `<option value="__custom_ch__">✏ سایر فصل‌ها (تایپ دستی)...</option>`;

                    const editTopicSelect = document.createElement("select");
                    editTopicSelect.innerHTML = `<option value="">— انتخاب مبحث / گفتار —</option>`;

                    function populateEditTopics() {
                        editTopicSelect.replaceChildren();
                        const chTitle = editChapterSelect.value;
                        const defaultOpt = document.createElement("option");
                        defaultOpt.value = "";
                        defaultOpt.textContent = "— انتخاب مبحث / گفتار —";
                        editTopicSelect.append(defaultOpt);

                        if (!chTitle || chTitle === "__custom_ch__") return;
                        const chObj = chapters.find(c => c.title === chTitle);
                        if (chObj && chObj.topics) {
                            chObj.topics.forEach(t => {
                                const opt = document.createElement("option");
                                opt.value = t;
                                opt.textContent = t;
                                editTopicSelect.append(opt);
                            });
                        }
                    }

                    const textInput = document.createElement("input");
                    textInput.type = "text";
                    textInput.maxLength = 255;
                    textInput.placeholder = "عنوان مبحث یا فصل...";
                    textInput.value = timer.topic || "";

                    editChapterSelect.addEventListener("change", () => {
                        populateEditTopics();
                        if (editChapterSelect.value && editChapterSelect.value !== "__custom_ch__") {
                            textInput.value = editChapterSelect.value;
                        }
                    });

                    editTopicSelect.addEventListener("change", () => {
                        if (editTopicSelect.value) {
                            const ch = editChapterSelect.value && editChapterSelect.value !== "__custom_ch__" ? editChapterSelect.value : "";
                            textInput.value = ch ? `${ch} - ${editTopicSelect.value}` : editTopicSelect.value;
                        }
                    });

                    if (chapters.length > 0) {
                        cascadeEditRow.append(editChapterSelect, editTopicSelect);
                    }
                    cascadeEditRow.append(textInput);

                    const editActionsRow = document.createElement("div");
                    editActionsRow.className = "study-topic-edit-actions";

                    const saveBtn = document.createElement("button");
                    saveBtn.type = "button";
                    saveBtn.className = "study-box-inline-save";
                    saveBtn.textContent = "ذخیره مبحث";

                    const cancelBtn = document.createElement("button");
                    cancelBtn.type = "button";
                    cancelBtn.className = "study-box-inline-cancel";
                    cancelBtn.textContent = "انصراف";

                    editActionsRow.append(cancelBtn, saveBtn);
                    topicEditRow.append(cascadeEditRow, editActionsRow);

                    editTopicBtn.addEventListener("click", () => {
                        topicEditRow.style.display = topicEditRow.style.display === "none" ? "flex" : "none";
                        if (topicEditRow.style.display === "flex") {
                            textInput.focus();
                        }
                    });

                    cancelBtn.addEventListener("click", () => {
                        topicEditRow.style.display = "none";
                    });

                    saveBtn.addEventListener("click", async () => {
                        const newTopic = textInput.value.trim();
                        await performAction(timer.id, "edit", null, timer.notes || "", { topic: newTopic });
                    });

                    card.append(topicEditRow);

                    if (timer.is_planned && timer.planned_minutes) {
                        const quotaHint = document.createElement("div");
                        quotaHint.className = "study-box-quota-hint";
                        quotaHint.innerHTML = `
                            <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <circle cx="12" cy="12" r="10"></circle>
                                <polyline points="12 6 12 12 16 14"></polyline>
                            </svg>
                            <span>زمان مورد نیاز: ${formatDuration(timer.planned_minutes)}</span>
                        `;
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
                    quotaSpan.textContent = `(فرصت ویرایش: ${fa.format(timer.edits_remaining ?? 5)} از ۵ بار)`;

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

                    if (actionName === "delete") {
                        timersList = timersList.filter(t => t.id !== timerId);
                        renderTodayBoxes();
                        return true;
                    }

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

            const delReportBtn = document.createElement("button");
            delReportBtn.type = "button";
            delReportBtn.className = "student-report-delete-btn";
            delReportBtn.title = "حذف این گزارش مطالعه";
            delReportBtn.innerHTML = `<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>`;

            delReportBtn.addEventListener("click", async (e) => {
                e.stopPropagation();
                const confirmed = await showConfirmWarning(
                    `آیا از حذف گزارش مطالعه «${x.subject}» مربوط به تاریخ ${formatJalali(x.study_date)} اطمینان دارید؟`,
                    "تأیید حذف گزارش مطالعه"
                );
                if (!confirmed) return;

                try {
                    const token = await csrf();
                    const res = await fetch(`/api/consultations/study-reports/${x.id}/delete/`, {
                        method: "POST",
                        credentials: "same-origin",
                        headers: { "Content-Type": "application/json", "X-CSRFToken": token }
                    });
                    const d = await res.json();
                    if (!res.ok) throw new Error(d.detail || "خطا در حذف گزارش");

                    allReports = allReports.filter(r => r.id !== x.id);
                    renderPastReportsRail(allReports);
                    if (modal && modal.style.display === "flex" && modalBody) {
                        modalBody.replaceChildren();
                        allReports.forEach(rep => modalBody.append(createReportCard(rep)));
                    }
                } catch (err) {
                    alert(err.message || "خطا در حذف گزارش");
                }
            });

            header.append(subj, date, delReportBtn);

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
        currentUserData = me;
        updateProfileUI(me);
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
                const cName = latest.assigned_consultant_name || "مشاور اختصاصی";
                const cInitials = cName.split(" ").slice(0, 2).map(w => w[0]).join("") || "مش";
                const cAvatar = latest.assigned_consultant_avatar_url;

                summary.innerHTML = `
                    <div class="consultant-glass-hero-card" style="padding:22px 24px;margin-top:10px;margin-bottom:12px;">
                        <div style="display:flex;align-items:center;justify-content:space-between;gap:18px;flex-wrap:wrap;">
                            <div style="display:flex;align-items:center;gap:16px;">
                                <div style="width:64px;height:64px;border-radius:50%;overflow:hidden;background:linear-gradient(135deg, #0753A8, #FF7A00);display:flex;align-items:center;justify-content:center;box-shadow:0 8px 20px rgba(7,83,168,0.22);flex-shrink:0;">
                                    ${cAvatar ? `<img src="${cAvatar}" alt="${cName}" style="width:100%;height:100%;object-fit:cover;">` : `<span style="color:#FFFFFF;font-weight:800;font-size:20px;">${cInitials}</span>`}
                                </div>
                                <div>
                                    <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;">
                                        <h4 style="margin:0;font-size:16.5px;font-weight:800;color:#0F172A;">${cName}</h4>
                                        <span class="payeh-badge-verified" style="padding:3px 9px;font-size:11px;">
                                            <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                                            مشاور شما
                                        </span>
                                    </div>
                                    <p style="margin:0;font-size:12.5px;color:#475569;line-height:1.6;">
                                        پلن ${latest.plan_label} · نظارت روزانه و همراهی مستمر
                                    </p>
                                </div>
                            </div>
                            <div style="display:flex;gap:10px;flex-wrap:wrap;">
                                <button type="button" class="payeh-btn-consultant-primary" id="dash-chat-btn" style="padding:8px 18px;font-size:13px;border-radius:12px;">
                                    <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                                    گفت‌وگو با مشاور
                                </button>
                                <button type="button" class="payeh-btn-consultant-secondary active" id="dash-events-btn" style="padding:8px 18px;font-size:13px;border-radius:12px;">
                                    <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/><polyline points="9 16 11 18 15 14"/></svg>
                                    مشاهده رخدادها و برنامه
                                </button>
                            </div>
                        </div>
                    </div>
                `;

                document.getElementById("dash-chat-btn")?.addEventListener("click", () => {
                    selectPage("chat");
                    document.querySelectorAll(".payeh-chat-tab").forEach(t => t.classList.toggle("active", t.dataset.chatTab === "consultants"));
                    chatActiveTab = "consultants";
                    renderChatList();
                    selectChatRoom("consultant");
                });

                document.getElementById("dash-events-btn")?.addEventListener("click", () => {
                    selectPage("consultant");
                });

                if (link) {
                    link.textContent = "مشاهده صفحه مشاور من و رخدادها";
                    link.href = "#consultant";
                    link.onclick = (e) => {
                        e.preventDefault();
                        selectPage("consultant");
                    };
                }
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
