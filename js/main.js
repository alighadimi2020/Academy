document.addEventListener("DOMContentLoaded", () => {
    // Check if user is logged in and update header button
    // Check if user is logged in and update header & mobile nav buttons
    const loginLink = document.querySelector(".payeh-header__login");
    const mobileAuthLink = document.querySelector(".payeh-mobile-auth-link");
    fetch(`/api/auth/me/?_t=${Date.now()}`, { credentials: "include", cache: "no-store" })
        .then(res => res.ok ? res.json() : null)
        .then(user => {
            if (user && user.role) {
                const roles = {
                    manager: { label: "پنل مدیریت", url: "manager.html" },
                    admin: { label: "پنل مدیریت", url: "manager.html" },
                    consultant: { label: "پنل مشاور", url: "consultant.html" },
                    student: { label: "پنل کاربری", url: "student.html" },
                    applicant: { label: "پیگیری ثبت‌نام", url: "consultant-register.html#status" },
                };
                const conf = roles[user.role] || { label: "پنل کاربری", url: "student.html" };
                if (loginLink) {
                    loginLink.href = conf.url;
                    const span = loginLink.querySelector("span");
                    if (span) span.textContent = conf.label;
                    loginLink.style.background = "#eff6ff";
                    loginLink.style.borderColor = "#93c5fd";
                    loginLink.style.color = "#1d4ed8";
                }
                if (mobileAuthLink) {
                    mobileAuthLink.href = conf.url;
                    const span = mobileAuthLink.querySelector("span");
                    if (span) span.textContent = conf.label;
                    mobileAuthLink.classList.add("payeh-bottom-item--active");
                }
            }
        })
        .catch(() => {});

    // Scroll listener for dynamic glass header
    const headerInner = document.querySelector(".payeh-header__inner");
    if (headerInner) {
        const onScroll = () => {
            if (window.scrollY > 25) {
                headerInner.classList.add("is-scrolled");
            } else {
                headerInner.classList.remove("is-scrolled");
            }
        };
        window.addEventListener("scroll", onScroll, { passive: true });
        onScroll();
    }

    const homepageMagazine = document.getElementById("homepage-magazine-cards");
    if (homepageMagazine) loadHomepageMagazine(homepageMagazine);

    // Rank Estimator Homepage Teaser
    const pSlider = document.getElementById('home-percent-slider');
    const gSlider = document.getElementById('home-gpa-slider');
    const pVal = document.getElementById('home-percent-val');
    const gVal = document.getElementById('home-gpa-val');
    const rPreview = document.getElementById('home-rank-preview');

    if (pSlider && gSlider && rPreview) {
        const updateHomeEstimator = () => {
            const p = parseFloat(pSlider.value) || 45;
            const g = parseFloat(gSlider.value) || 18;
            if (pVal) pVal.textContent = Math.round(p).toLocaleString('fa-IR') + '٪';
            if (gVal) gVal.textContent = g.toLocaleString('fa-IR', { minimumFractionDigits: 1 });

            // Official 1404 formula model (60% Savabegh, 40% Konkur)
            const tKonkur = 5000 + p * 75;
            const tSavabegh = 3000 + (g / 20) * 8700;
            const totalT = tKonkur * 0.40 + tSavabegh * 0.60;

            let estRank = 150000;
            if (totalT >= 11800) estRank = 85;
            else if (totalT >= 11000) estRank = 350;
            else if (totalT >= 10200) estRank = 1250;
            else if (totalT >= 9500) estRank = 3200;
            else if (totalT >= 8800) estRank = 6800;
            else if (totalT >= 8000) estRank = 13500;
            else if (totalT >= 7000) estRank = 30000;
            else if (totalT >= 6000) estRank = 62000;
            else estRank = 95000;

            rPreview.textContent = Math.round(estRank).toLocaleString('fa-IR');
        };

        pSlider.addEventListener('input', updateHomeEstimator);
        gSlider.addEventListener('input', updateHomeEstimator);
        updateHomeEstimator();
    }

    const revealElements = document.querySelectorAll("[data-payeh-reveal]");

    if (!revealElements.length) {
        return;
    }

    const revealObserver = new IntersectionObserver(
        (entries, observer) => {
            entries.forEach((entry) => {
                if (!entry.isIntersecting) {
                    return;
                }

                entry.target.classList.add("is-visible");
                observer.unobserve(entry.target);
            });
        },
        {
            threshold: 0.12,
            rootMargin: "0px 0px -60px 0px"
        }
    );

    revealElements.forEach((element) => {
        revealObserver.observe(element);
    });
});


async function loadHomepageMagazine(container) {
    const make = (tag, className, text) => {
        const node = document.createElement(tag);
        if (className) node.className = className;
        if (text !== undefined) node.textContent = text;
        return node;
    };
    const numberFa = (value) => new Intl.NumberFormat("fa-IR").format(value);
    try {
        const response = await fetch("/api/blog/posts/");
        const data = await response.json();
        if (!response.ok) throw new Error(data.detail || "دریافت مقاله‌ها انجام نشد.");
        container.replaceChildren();
        const posts = (data.results || []).slice(0, 3);
        if (!posts.length) {
            container.append(make("p", "payeh-magazine__empty", "هنوز مقاله منتشرشده‌ای در مجله نیست."));
            return;
        }
        posts.forEach((post) => {
            const card = make("article", "payeh-magazine__card");
            const imageLink = make("a", "payeh-magazine__image");
            imageLink.href = `blog-detail.html?id=${encodeURIComponent(post.id)}`;
            imageLink.setAttribute("aria-label", `مطالعه ${post.title}`);
            if (post.images?.length) {
                const image = document.createElement("img");
                image.src = post.images[0].url;
                image.alt = post.images[0].alt_text || post.title;
                image.loading = "lazy";
                imageLink.append(image);
            } else {
                imageLink.classList.add("payeh-magazine__image--empty");
                imageLink.append(make("span", "", "مجله آکادمی"));
            }
            const content = make("div", "payeh-magazine__content");
            if (post.category) content.append(make("span", "payeh-magazine__category", post.category));
            content.append(make("h3", "payeh-magazine__card-title", post.title));
            const bottom = make("div", "payeh-magazine__card-bottom");
            bottom.append(make("span", "payeh-magazine__meta", `${numberFa(post.reading_minutes)} دقیقه مطالعه`));
            const link = make("a", "payeh-magazine__arrow");
            link.href = imageLink.href;
            link.setAttribute("aria-label", `مطالعه ${post.title}`);
            const arrow = document.createElementNS("http://www.w3.org/2000/svg", "svg");
            arrow.setAttribute("viewBox", "0 0 24 24");
            arrow.setAttribute("aria-hidden", "true");
            const line = document.createElementNS("http://www.w3.org/2000/svg", "path");
            line.setAttribute("d", "M5 12h14");
            const head = document.createElementNS("http://www.w3.org/2000/svg", "path");
            head.setAttribute("d", "m13 6 6 6-6 6");
            arrow.append(line, head);
            link.append(arrow);
            bottom.append(link);
            content.append(bottom);
            card.append(imageLink, content);
            container.append(card);
        });
    } catch {
        container.replaceChildren(make("p", "payeh-magazine__empty", "نمایش مقاله‌ها ممکن نشد."));
    }
}
