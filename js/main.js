document.addEventListener("DOMContentLoaded", () => {
    const homepageMagazine = document.getElementById("homepage-magazine-cards");
    if (homepageMagazine) loadHomepageMagazine(homepageMagazine);
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
