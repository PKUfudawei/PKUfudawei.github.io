(async function () {
  const page = document.querySelector(".dashboard");
  if (!page) return;
  const content = document.getElementById("dashboard-content");
  const update = document.getElementById("dashboard-update");
  const make = (tag, text, className) => {
    const element = document.createElement(tag);
    if (text !== undefined) element.textContent = text;
    if (className) element.className = className;
    return element;
  };
  const link = (label, url) => {
    const element = make("a", label);
    if (url && /^https:\/\//.test(url)) {
      element.href = url;
      element.target = "_blank";
      element.rel = "noopener noreferrer";
    }
    return element;
  };
  const date = (iso) => iso ? new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai", year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hour12: false
  }).format(new Date(iso)) : "待公布";
  const age = (iso) => Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);

  function renderConferences(section) {
    update.textContent = `数据抓取：${date(section.updated_at)}（北京时间）；截止时间以会议官网为准。`;
    for (const group of ["AI", "CV", "NLP"]) {
      const block = make("section", undefined, "dashboard-group");
      block.append(make("h2", `${group} 三大会`));
      const list = make("div", undefined, "conference-grid");
      for (const item of section.items.filter((entry) => entry.group === group)) {
        const card = make("article", undefined, "dashboard-card");
        const edition = item.next || item.last;
        const title = make("h3");
        title.append(link(edition ? `${item.name} ${edition.year}` : item.name, edition?.url || item.source));
        card.append(title);
        if (edition) {
          if (item.last) card.append(make("p", "上次截稿 · 已过期；下一届时间待公布", "dashboard-stale"));
          if (edition.abstract) {
            const abstract = make("p");
            abstract.append(make("span", "摘要截止 · ", "label"), make("strong", date(edition.abstract)));
            card.append(abstract);
          }
          const paper = make("p");
          paper.append(make("span", "全文截止 · ", "label"), make("strong", date(edition.paper)));
          card.append(paper);
          if (item.next) {
            const days = Math.ceil((new Date(edition.paper) - Date.now()) / 86400000);
            card.append(make("p", days > 0 ? `约 ${days} 天后 · 原始时区 ${edition.timezone}` : `即将截止 · 原始时区 ${edition.timezone}`, "dashboard-note"));
          } else {
            card.append(make("p", `原始时区 ${edition.timezone}`, "dashboard-note"));
          }
        } else {
          card.append(make("p", `下一届截稿时间待公布${item.latest_year ? `（已收录至 ${item.latest_year}）` : ""}`, "dashboard-note"));
        }
        card.append(link("数据来源 ↗", item.source));
        list.append(card);
      }
      block.append(list);
      content.append(block);
    }
  }

  function renderBoards(data) {
    update.textContent = "榜单每 6 小时检查一次更新；切换榜单可查看各自的数据日期。";
    const boards = [["artificial_analysis", "Artificial Analysis"], ["arena", "Arena"], ["livebench", "LiveBench"]];
    const tabs = make("div", undefined, "board-tabs");
    tabs.setAttribute("role", "tablist");
    tabs.setAttribute("aria-label", "LLM 榜单");
    const buttons = [];
    const panels = [];
    const activate = (index, focus = false) => {
      buttons.forEach((button, i) => {
        button.setAttribute("aria-selected", String(i === index));
        button.tabIndex = i === index ? 0 : -1;
        panels[i].hidden = i !== index;
      });
      if (focus) buttons[index].focus();
    };
    for (const [index, [key, title]] of boards.entries()) {
      const button = make("button", title, "board-tab");
      button.type = "button";
      button.id = `tab-${key}`;
      button.setAttribute("role", "tab");
      button.setAttribute("aria-controls", `panel-${key}`);
      button.addEventListener("click", () => activate(index));
      button.addEventListener("keydown", (event) => {
        if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
          event.preventDefault();
          activate((index + (event.key === "ArrowRight" ? 1 : boards.length - 1)) % boards.length, true);
        }
      });
      tabs.append(button);
      buttons.push(button);
    }
    update.before(tabs);
    for (const [index, [key, title]] of boards.entries()) {
      const board = data[key];
      const block = make("section", undefined, "dashboard-group leaderboard-group");
      block.id = `panel-${key}`;
      block.setAttribute("role", "tabpanel");
      block.setAttribute("aria-labelledby", `tab-${key}`);
      const heading = make("h2");
      heading.append(link(title, board?.url));
      block.append(heading);
      if (!board?.items?.length) {
        block.append(make("p", "暂时没有可用的榜单快照，请到来源网站查看。"));
        content.append(block);
        panels.push(block);
        continue;
      }
      const old = board.source_date && age(`${board.source_date}T00:00:00Z`) > (key === "arena" ? 7 : 30);
      const note = board.source_date
        ? `数据版本：${board.source_date} · 本站抓取：${date(board.updated_at)}`
        : `本站抓取：${date(board.updated_at)}`;
      block.append(make("p", `${note} · 指标：${board.metric} · ${board.items.length} 个模型${old ? " · 数据可能已过期" : ""}`, old ? "dashboard-stale" : "dashboard-note"));
      const control = make("label", undefined, "board-filter");
      const checkbox = make("input");
      checkbox.type = "checkbox";
      control.append(checkbox, make("span", "每家公司仅显示最强模型"));
      block.append(control);
      const sizeControl = make("label", undefined, "board-page-size");
      const pageSize = make("select");
      pageSize.setAttribute("aria-label", `${title} 每页显示条数`);
      for (const [value, label] of [["10", "10"], ["25", "25"], ["50", "50"], ["100", "100"], ["all", "全部"]]) {
        const option = make("option", label);
        option.value = value;
        pageSize.append(option);
      }
      sizeControl.append(make("span", "每页显示"), pageSize, make("span", "条"));
      block.append(sizeControl);
      const count = make("p", undefined, "dashboard-note");
      block.append(count);
      const table = make("table", undefined, "leaderboard-table");
      const head = make("thead");
      const headerRow = make("tr");
      for (const label of ["原始排名", "模型", "公司 / 机构", board.metric]) headerRow.append(make("th", label));
      head.append(headerRow);
      table.append(head);
      const body = make("tbody");
      table.append(body);
      const pager = make("nav", undefined, "board-pager");
      pager.setAttribute("aria-label", `${title} 翻页`);
      const previous = make("button", "上一页");
      previous.type = "button";
      const pageStatus = make("span");
      pageStatus.setAttribute("aria-live", "polite");
      const next = make("button", "下一页");
      next.type = "button";
      pager.append(previous, pageStatus, next);
      let page = 0;
      const fill = () => {
        const seen = new Set();
        const rows = board.items.filter((row) => {
          if (!checkbox.checked) return true;
          const company = row.company?.trim();
          if (!company) return false;
          const key = company.toLocaleLowerCase();
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        });
        const size = pageSize.value === "all" ? Math.max(rows.length, 1) : Number(pageSize.value);
        const pages = Math.max(1, Math.ceil(rows.length / size));
        page = Math.min(page, pages - 1);
        const start = page * size;
        const visible = rows.slice(start, start + size);
        body.replaceChildren();
        for (const row of visible) {
          const tr = make("tr");
          tr.append(make("td", String(row.rank)));
          const name = make("td");
          name.append(link(row.name, row.url));
          tr.append(name, make("td", row.company || "—"), make("td", String(row.score)));
          body.append(tr);
        }
        count.textContent = `显示 ${rows.length ? start + 1 : 0}–${start + visible.length} / ${rows.length} 条${checkbox.checked ? `（原榜单 ${board.items.length} 条；每家公司最高分，未标注公司的模型已隐藏）` : ""}`;
        pageStatus.textContent = `第 ${page + 1} / ${pages} 页`;
        previous.disabled = page === 0;
        next.disabled = page >= pages - 1;
      };
      checkbox.addEventListener("change", () => { page = 0; fill(); });
      pageSize.addEventListener("change", () => { page = 0; fill(); });
      previous.addEventListener("click", () => { page -= 1; fill(); });
      next.addEventListener("click", () => { page += 1; fill(); });
      fill();
      const scroller = make("div", undefined, "table-scroll");
      scroller.append(table);
      block.append(scroller, pager);
      content.append(block);
      panels.push(block);
    }
    activate(0);
  }

  try {
    const response = await fetch("/data/dashboards.json", { cache: "no-cache" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    if (page.dataset.dashboard === "conferences" && data.conferences) renderConferences(data.conferences);
    else if (page.dataset.dashboard === "leaderboards") renderBoards(data);
    else throw new Error("没有可用的数据");
  } catch (error) {
    update.textContent = "数据暂时无法加载。";
    content.append(make("p", "请稍后重试，或通过各来源网站查看最新信息。"));
  }
})();
