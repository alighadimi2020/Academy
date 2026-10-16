document.addEventListener("DOMContentLoaded", async () => {
    const target = document.getElementById("blog-detail");
    const id = new URLSearchParams(window.location.search).get("id");
    if (!/^\d+$/.test(id || "")) { target.textContent = "شناسه مقاله معتبر نیست."; return; }

    const make = (tag, className, text) => {
        const node = document.createElement(tag);
        if (className) node.className = className;
        if (text !== undefined) node.textContent = text;
        return node;
    };

    try {
        const response = await fetch(`/api/blog/posts/${encodeURIComponent(id)}/`);
        const post = await response.json();
        if (!response.ok) throw new Error(post.detail || "مقاله پیدا نشد.");
        document.title = `${post.title} | مجله آنلاین پایه`;
        target.replaceChildren();
        if (post.category) target.append(make("span", "blog-eyebrow", post.category));
        target.append(make("h1", "", post.title));
        const meta = make("div", "blog-detail__meta");
        meta.append(make("span", "", `نویسنده: ${post.author}`));
        meta.append(make("span", "", `${new Intl.NumberFormat("fa-IR").format(post.reading_minutes)} دقیقه مطالعه`));
        if (post.published_at) meta.append(make("span", "", new Date(post.published_at).toLocaleDateString("fa-IR")));
        target.append(meta, make("p", "blog-detail__summary", post.summary));
        const appendImagesAfter = (sectionIndex) => {
            const images = post.images.filter((image) => Number(image.after_section || 0) === sectionIndex);
            if (!images.length) return;
            const gallery = make("div", "blog-gallery");
            images.forEach((image, index) => { const img = document.createElement("img"); img.src = image.url; img.alt = image.alt_text || `تصویر ${index + 1} برای ${post.title}`; img.loading = "lazy"; gallery.append(img); });
            target.append(gallery);
        };
        appendImagesAfter(0);

        if (post.sections.length) {
            const toc = make("nav", "blog-toc");
            toc.setAttribute("aria-label", "فهرست بخش‌های مقاله");
            toc.append(make("h2", "", "در این مقاله"));
            const list = document.createElement("ol");
            post.sections.forEach((section, index) => {
                const item = document.createElement("li");
                const link = make("a", "", section.heading);
                link.href = `#blog-section-${index + 1}`;
                item.append(link);
                list.append(item);
            });
            toc.append(list);
            target.append(toc);
        }

        if (post.video_embed_url) {
            const video = make("div", "blog-video");
            const frame = document.createElement("iframe");
            frame.src = post.video_embed_url;
            frame.title = `ویدیوی آپارات: ${post.title}`;
            frame.loading = "lazy";
            frame.referrerPolicy = "strict-origin-when-cross-origin";
            frame.allow = "fullscreen; picture-in-picture";
            frame.allowFullscreen = true;
            frame.setAttribute("sandbox", "allow-scripts allow-same-origin allow-presentation");
            video.append(frame);
            target.append(video);
            const videoLink = make("a", "blog-back", "اگر ویدیو پخش نشد، در آپارات ببینید");
            videoLink.href = post.video_url;
            videoLink.target = "_blank";
            videoLink.rel = "noopener noreferrer";
            target.append(videoLink);
        }

        post.sections.forEach((section, index) => {
            const sectionNode = make("section", "blog-detail__section");
            sectionNode.id = `blog-section-${index + 1}`;
            sectionNode.append(make("h2", "", section.heading), make("p", "", section.body));
            target.append(sectionNode);
            appendImagesAfter(index + 1);
        });

        const me = await fetch(`/api/auth/me/?_t=${Date.now()}`, { credentials: "same-origin", cache: "no-store" });
        if (me.ok) {
            const user = await me.json();
            if (["consultant", "manager", "admin"].includes(user.role)) document.getElementById("write-link").hidden = false;
        }
    } catch (error) {
        target.textContent = error.message || "بارگذاری مقاله ممکن نشد.";
    }
});
