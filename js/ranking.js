(() => {
  "use strict";

  let students = [];
  let currentUser = null;
  let lastUpdatedAt = null;

  const $ = (selector) => document.querySelector(selector);

  const faNumber = new Intl.NumberFormat("fa-IR");
  const faDate = new Intl.DateTimeFormat("fa-IR", {
    dateStyle: "medium",
    timeStyle: "short",
  });

  const toFa = (value) => faNumber.format(value);

  const clearChildren = (node) => {
    while (node.firstChild) node.removeChild(node.firstChild);
  };

  const state = {
    query: "",
    sort: "rank",
    page: 1,
    pageSize: 8,
  };

  function getRankedStudents() {
    return [...students]
      .sort((a, b) => b.score - a.score)
      .map((student, index) => ({ ...student, rank: index + 1 }));
  }

  function getVisibleStudents() {
    const query = state.query.toLocaleLowerCase("fa");

    let list = getRankedStudents().filter((student) =>
      student.name.toLocaleLowerCase("fa").includes(query)
    );

    switch (state.sort) {
      case "score":
        list.sort((a, b) => b.score - a.score);
        break;
      case "name":
        list.sort((a, b) => a.name.localeCompare(b.name, "fa"));
        break;
      case "change":
        list.sort((a, b) => b.change - a.change);
        break;
      case "rank":
      default:
        list.sort((a, b) => a.rank - b.rank);
    }

    return list;
  }

  function renderHeader() {
    const nameEl = $("#headerUserName");
    const avatarEl = $("#headerAvatar");

    if (currentUser) {
      nameEl.textContent = currentUser.name;
      avatarEl.textContent = currentUser.avatar || "—";
    } else {
      nameEl.textContent = "—";
      avatarEl.textContent = "—";
    }
  }

  function renderOverview() {
    const ranked = getRankedStudents();
    const current = ranked.find((student) => student.isCurrent);

    $("#myRank").textContent = current ? toFa(current.rank) : "—";
    $("#myScore").textContent = current ? toFa(current.score) : "—";
    $("#studentTotal").textContent = students.length ? toFa(students.length) : "—";
    $("#lastUpdated").textContent = lastUpdatedAt ? faDate.format(lastUpdatedAt) : "—";

    renderPodium(ranked.slice(0, 3));
  }

  function renderPodium(topThree) {
    const container = $("#podiumList");
    clearChildren(container);

    topThree.forEach((student, index) => {
      const item = document.createElement("article");
      item.className = `podium-item rank-${index + 1}`;

      const top = document.createElement("div");
      top.className = "podium-top";

      const medal = document.createElement("span");
      medal.className = "rank-medal";
      medal.textContent = toFa(index + 1);

      const avatar = document.createElement("span");
      avatar.className = "podium-avatar";
      avatar.textContent = student.avatar || "—";

      top.append(medal, avatar);

      const name = document.createElement("strong");
      name.className = "podium-name";
      name.textContent = student.name;

      const score = document.createElement("span");
      score.className = "podium-score";
      score.textContent = `${toFa(student.score)} امتیاز`;

      item.append(top, name, score);
      container.append(item);
    });
  }

  function createChangeElement(change) {
    const element = document.createElement("span");

    if (change > 0) {
      element.className = "change up";
      element.textContent = `▲ ${toFa(change)}`;
    } else if (change < 0) {
      element.className = "change down";
      element.textContent = `▼ ${toFa(Math.abs(change))}`;
    } else {
      element.className = "change same";
      element.textContent = "—";
    }

    return element;
  }

  function createRankCell(student) {
    const cell = document.createElement("td");
    cell.className = "rank-cell";

    const chip = document.createElement("span");
    chip.className = "rank-chip";

    if (student.rank === 1) chip.classList.add("gold");
    else if (student.rank === 2) chip.classList.add("silver");
    else if (student.rank === 3) chip.classList.add("bronze");

    chip.textContent = toFa(student.rank);
    cell.append(chip, document.createTextNode(toFa(student.rank)));

    return cell;
  }

  function createNameCell(student) {
    const cell = document.createElement("td");
    const wrap = document.createElement("div");
    wrap.className = "student-cell";

    const avatar = document.createElement("span");
    avatar.className = "student-avatar";
    avatar.textContent = student.avatar || "—";

    const name = document.createElement("span");
    name.textContent = student.name;

    wrap.append(avatar, name);

    if (student.isCurrent) {
      const tag = document.createElement("span");
      tag.className = "you-tag";
      tag.textContent = "شما";
      wrap.append(tag);
    }

    cell.append(wrap);
    return cell;
  }

  function createStatusCell(student) {
    const cell = document.createElement("td");
    const pill = document.createElement("span");

    let label = "در فهرست";
    let modifier = "";

    if (student.isCurrent) {
      label = "رتبه شما";
      modifier = " current";
    } else if (student.rank <= 3) {
      label = "سه رتبه برتر";
      modifier = " top";
    }

    pill.className = `status-pill${modifier}`;
    pill.textContent = label;

    cell.append(pill);
    return cell;
  }

  function renderTable() {
    const list = getVisibleStudents();
    const pageCount = Math.max(1, Math.ceil(list.length / state.pageSize));

    if (state.page > pageCount) state.page = pageCount;

    const start = (state.page - 1) * state.pageSize;
    const visible = list.slice(start, start + state.pageSize);

    const body = $("#rankingTableBody");
    clearChildren(body);

    visible.forEach((student) => {
      const row = document.createElement("tr");
      if (student.isCurrent) row.classList.add("current-student");

      const scoreCell = document.createElement("td");
      scoreCell.className = "score-cell";
      scoreCell.textContent = toFa(student.score);

      const changeCell = document.createElement("td");
      changeCell.append(createChangeElement(student.change));

      row.append(
        createRankCell(student),
        createNameCell(student),
        scoreCell,
        changeCell,
        createStatusCell(student)
      );

      body.append(row);
    });

    const isEmpty = list.length === 0;
    $("#emptyState").hidden = !isEmpty;
    $(".table-wrap table").style.display = isEmpty ? "none" : "";

    $("#rowsInfo").textContent = isEmpty
      ? "نتیجه‌ای برای نمایش وجود ندارد"
      : `نمایش ${toFa(start + 1)} تا ${toFa(
          Math.min(start + state.pageSize, list.length)
        )} از ${toFa(list.length)} دانش‌آموز`;

    renderPagination(pageCount);
  }

  function renderPagination(pageCount) {
    const container = $("#pageNumbers");
    clearChildren(container);

    const maxButtons = 5;
    let first = Math.max(1, state.page - 2);
    let last = Math.min(pageCount, first + maxButtons - 1);
    first = Math.max(1, last - maxButtons + 1);

    for (let page = first; page <= last; page++) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "page-number" + (page === state.page ? " active" : "");
      button.textContent = toFa(page);
      button.setAttribute("aria-label", `صفحه ${page}`);

      if (page === state.page) {
        button.setAttribute("aria-current", "page");
      }

      button.addEventListener("click", () => {
        state.page = page;
        renderTable();
      });

      container.append(button);
    }

    $("#prevPage").disabled = state.page <= 1;
    $("#nextPage").disabled = state.page >= pageCount;
  }

  function setData({ students: newStudents = [], currentUser: newUser = null, lastUpdatedAt: newDate = null }) {
    students = Array.isArray(newStudents) ? newStudents : [];
    currentUser = newUser;
    lastUpdatedAt = newDate;

    state.page = 1;

    renderHeader();
    renderOverview();
    renderTable();
  }

  function reset() {
    setData({ students: [], currentUser: null, lastUpdatedAt: null });
  }

  window.PayehRanking = { setData, reset };

  $("#searchInput").addEventListener("input", (event) => {
    state.query = event.target.value.trim();
    state.page = 1;
    renderTable();
  });

  $("#sortSelect").addEventListener("change", (event) => {
    state.sort = event.target.value;
    state.page = 1;
    renderTable();
  });

  $("#pageSize").addEventListener("change", (event) => {
    state.pageSize = Number(event.target.value) || 8;
    state.page = 1;
    renderTable();
  });

  $("#prevPage").addEventListener("click", () => {
    if (state.page > 1) {
      state.page--;
      renderTable();
    }
  });

  $("#nextPage").addEventListener("click", () => {
    const pageCount = Math.max(
      1,
      Math.ceil(getVisibleStudents().length / state.pageSize)
    );

    if (state.page < pageCount) {
      state.page++;
      renderTable();
    }
  });

  renderHeader();
  renderOverview();
  renderTable();
})();