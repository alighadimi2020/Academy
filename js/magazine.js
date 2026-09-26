document.addEventListener("DOMContentLoaded", async () => {
    const list = document.getElementById("magazine-articles");
    const search = document.getElementById("magazine-search");
    const searchButton = document.getElementById("magazine-search-button");
    const writeLink = document.getElementById("magazine-write-link");
    const reviewLink = document.getElementById("magazine-review-link");
    const numberFa = (value) => new Intl.NumberFormat("fa-IR").format(value);

    try {
        const response = await fetch("/api/auth/me/");
        if (response.ok) {
            const user = await response.json();
            if (["consultant", "manager", "admin"].includes(user.role)) writeLink.hidden = false;
            if (["manager", "admin"].includes(user.role)) reviewLink.hidden = false;
        }
    } catch { /* Public browsing still works if no session exists. */ }

    const showEmpty = (text) => {
        const empty = document.createElement("p");
        empty.className = "magazine-loading";
        empty.textContent = text;
        list.replaceChildren(empty);
    };

    const loadPosts = async () => {
        showEmpty("در حال دریافت مقاله‌ها…");
        try {
            const query = search.value.trim();
            const response = await fetch(`/api/blog/posts/${query ? `?q=${encodeURIComponent(query)}` : ""}`);
            const data = await response.json();
            if (!response.ok) throw new Error(data.detail || "بارگذاری مقاله‌ها انجام نشد.");
            list.replaceChildren();
            if (!data.results.length) {
                showEmpty(query ? "مقاله‌ای با این عبارت پیدا نشد." : "هنوز مقاله منتشرشده‌ای وجود ندارد.");
                return;
            }
            data.results.forEach((post) => {
                const card = document.createElement("a");
                card.className = "payeh-magazine-article";
                card.href = `blog-detail.html?id=${encodeURIComponent(post.id)}`;
                const imageBox = document.createElement("div");
                imageBox.className = "payeh-magazine-article__image";
                if (post.images.length) {
                    const img = document.createElement("img");
                    img.src = post.images[0].url;
                    img.alt = post.images[0].alt_text || post.title;
                    img.loading = "lazy";
                    imageBox.append(img);
                } else {
                    imageBox.classList.add("payeh-magazine-article__image--empty");
                    imageBox.textContent = "مجله پایه";
                }
                const body = document.createElement("div");
                body.className = "payeh-magazine-article__body";
                if (post.category) {
                    const category = document.createElement("span");
                    category.className = "payeh-magazine-article__category";
                    category.textContent = post.category;
                    body.append(category);
                }
                const title = document.createElement("h3");
                title.textContent = post.title;
                const summary = document.createElement("p");
                summary.textContent = post.summary;
                const meta = document.createElement("div");
                meta.className = "payeh-magazine-article__meta";
                const readingTime = document.createElement("span");
                readingTime.textContent = `${numberFa(post.reading_minutes)} دقیقه مطالعه`;
                const author = document.createElement("span");
                author.textContent = post.author;
                meta.append(readingTime, author);
                body.append(title, summary, meta);
                card.append(imageBox, body);
                list.append(card);
            });
        } catch (error) {
            showEmpty(error.message || "بارگذاری مقاله‌ها ممکن نشد.");
        }
    };

    let timer;
    search.addEventListener("input", () => {
        clearTimeout(timer);
        timer = setTimeout(loadPosts, 250);
    });
    searchButton.addEventListener("click", loadPosts);
    search.addEventListener("keydown", (event) => {
        if (event.key === "Enter") { event.preventDefault(); loadPosts(); }
    });
    await loadPosts();
});
