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
        const title = make("h3");
        title.append(link(item.next ? `${item.name} ${item.next.year}` : item.name, item.next?.url || item.source));
        card.append(title);
        if (item.next) {
          if (item.next.abstract) {
            const abstract = make("p");
            abstract.append(make("span", "摘要截止 · ", "label"), make("strong", date(item.next.abstract)));
            card.append(abstract);
          }
          const paper = make("p");
          paper.append(make("span", "全文截止 · ", "label"), make("strong", date(item.next.paper)));
          card.append(paper);
          const days = Math.ceil((new Date(item.next.paper) - Date.now()) / 86400000);
          card.append(make("p", days > 0 ? `约 ${days} 天后 · 原始时区 ${item.next.timezone}` : `即将截止 · 原始时区 ${item.next.timezone}`, "dashboard-note"));
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
    update.textContent = "榜单按来源定时抓取；每张卡片显示对应数据的日期。";
    for (const [key, title] of [["artificial_analysis", "Artificial Analysis"], ["arena", "Arena"], ["livebench", "LiveBench"]]) {
      const board = data[key];
      const block = make("section", undefined, "dashboard-group leaderboard-group");
      const heading = make("h2");
      heading.append(link(title, board?.url));
      block.append(heading);
      if (key === "arena" && board?.mode === "official_embed") {
        block.append(make("p", "Arena 官网实时榜单 · 页面由 Arena 提供，加载速度取决于其服务。", "dashboard-note"));
        const frame = make("iframe");
        frame.src = board.embed_url;
        frame.title = "Arena 官方实时榜单";
        frame.loading = "lazy";
        frame.className = "arena-frame";
        block.append(frame);
        block.append(link("打开 Arena 官网 ↗", board.url));
        content.append(block);
        continue;
      }
      if (!board?.items?.length) {
        block.append(make("p", "暂无可用数据，请到来源网站查看。"));
        content.append(block);
        continue;
      }
      const old = board.source_date && age(`${board.source_date}T00:00:00Z`) > 30;
      const note = board.source_date ? `数据版本：${board.source_date}` : `抓取：${date(board.updated_at)}`;
      block.append(make("p", `${note} · 指标：${board.metric}${old ? " · 历史数据" : ""}`, old ? "dashboard-stale" : "dashboard-note"));
      const table = make("table", undefined, "leaderboard-table");
      const head = make("thead");
      const headerRow = make("tr");
      for (const label of ["排名", "模型", board.metric]) headerRow.append(make("th", label));
      head.append(headerRow);
      table.append(head);
      const body = make("tbody");
      for (const row of board.items) {
        const tr = make("tr");
        tr.append(make("td", String(row.rank)));
        const name = make("td");
        name.append(link(row.name, row.url));
        tr.append(name, make("td", String(row.score)));
        body.append(tr);
      }
      table.append(body);
      const scroller = make("div", undefined, "table-scroll");
      scroller.append(table);
      block.append(scroller);
      content.append(block);
    }
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
