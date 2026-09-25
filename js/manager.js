const managerNavItems = document.querySelectorAll(".payeh-manager__nav-item");
const managerPages = document.querySelectorAll(".manager-page");
const managerPageTitle = document.getElementById("manager-page-title");
const managerSidebar = document.getElementById("manager-sidebar");
const managerMenuButton = document.getElementById("manager-menu-button");

const pageTitles = {
    dashboard: "داشبورد",
    consultants: "مشاوران",
    students: "دانش‌آموزان",
    conversations: "گفت‌وگوها",
    articles: "مقالات",
    settings: "تنظیمات"
};

function showManagerPage(pageName) {
    const targetPage = document.getElementById(`page-${pageName}`);

    if (!targetPage) {
        return;
    }

    managerPages.forEach((page) => {
        page.classList.remove("is-active");
    });

    managerNavItems.forEach((item) => {
        item.classList.toggle(
            "is-active",
            item.dataset.page === pageName
        );
    });

    targetPage.classList.add("is-active");

    if (managerPageTitle) {
        managerPageTitle.textContent = pageTitles[pageName] || "پنل مدیریت";
    }

    managerSidebar.classList.remove("is-open");

    window.scrollTo({
        top: 0,
        behavior: "smooth"
    });
}

managerNavItems.forEach((item) => {
    item.addEventListener("click", (event) => {
        event.preventDefault();

        const pageName = item.dataset.page;

        if (!pageName) {
            return;
        }

        window.location.hash = pageName;
        showManagerPage(pageName);
    });
});

function loadManagerPageFromHash() {
    const pageName = window.location.hash.replace("#", "");

    if (pageTitles[pageName]) {
        showManagerPage(pageName);
        return;
    }

    showManagerPage("dashboard");
}

window.addEventListener("hashchange", loadManagerPageFromHash);

if (managerMenuButton) {
    managerMenuButton.addEventListener("click", () => {
        managerSidebar.classList.toggle("is-open");
    });
}

document.addEventListener("click", (event) => {
    if (window.innerWidth > 800) {
        return;
    }

    if (
        managerSidebar.classList.contains("is-open") &&
        !managerSidebar.contains(event.target) &&
        !managerMenuButton.contains(event.target)
    ) {
        managerSidebar.classList.remove("is-open");
    }
});

loadManagerPageFromHash();