const consultantPages = {
    dashboard: "داشبورد",
    students: "دانش‌آموزان من",
    activities: "فعالیت‌ها",
    conversations: "گفتگوها",
    articles: "مقالات من",
    profile: "پروفایل"
};

const consultantPageTitle = document.getElementById("consultantPageTitle");
const consultantSidebar = document.getElementById("consultantSidebar");
const consultantMenu = document.getElementById("consultantMenu");

function setConsultantPage(page) {
    const title = consultantPages[page] || consultantPages.dashboard;

    consultantPageTitle.textContent = title;

    document.querySelectorAll(".payeh-consultant__nav-item").forEach(item => {
        item.classList.toggle(
            "active",
            item.dataset.page === page
        );
    });

    consultantSidebar.classList.remove("open");
}

function loadConsultantPage() {
    const page = window.location.hash.replace("#", "") || "dashboard";
    setConsultantPage(page);
}

document.querySelectorAll(".payeh-consultant__nav-item").forEach(item => {
    item.addEventListener("click", () => {
        const page = item.dataset.page;

        if (window.location.hash !== `#${page}`) {
            window.location.hash = page;
        } else {
            setConsultantPage(page);
        }
    });
});

document.querySelectorAll("[data-page]").forEach(item => {
    item.addEventListener("click", () => {
        const page = item.dataset.page;

        if (window.location.hash !== `#${page}`) {
            window.location.hash = page;
        }
    });
});

consultantMenu.addEventListener("click", () => {
    consultantSidebar.classList.toggle("open");
});

window.addEventListener("hashchange", loadConsultantPage);

loadConsultantPage();