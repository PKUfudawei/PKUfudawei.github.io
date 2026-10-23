# PKUfudawei.github.io

Personal website of Dawei Fu, built with [Hugo](https://gohugo.io/) + [PaperMod](https://github.com/adityatelange/hugo-PaperMod) (same setup as lilianweng.github.io).

## Layout

- Repo root — built static site (served by GitHub Pages from `master`), plus `resume.pdf`.
- `hugo/` — Hugo source project. `hugo/content/posts/` is where blog posts live.

## Add a blog post

```bash
cd hugo
# create a post, e.g.
hugo new posts/my-first-post.md
# edit hugo/content/posts/my-first-post.md ...

# build and publish the output to repo root
hugo --minify
cp -r public/. ..
rm -rf public
cd ..
git add -A && git commit -m "..." && git push
```

## Build requirements

- [Hugo](https://gohugo.io/installation/) (extended edition).
- The PaperMod theme is vendored under `hugo/themes/PaperMod/`.
- `scripts/update_dashboards.py` refreshes conference deadlines and LLM leaderboard snapshots. The scheduled workflow runs every six hours, rebuilds Hugo, and commits the published JSON and pages.

## Dashboard data

- **AI Conference Due:** nine conferences from the [CCF Deadlines](https://github.com/ccfddl/ccf-deadlines) YAML files. Times display in Beijing time; conference sites remain authoritative.
- **Artificial Analysis:** Intelligence Index scores parsed from its public leaderboard page. Its official API requires a key, so page structure changes may interrupt updates.
- **Arena:** the official live leaderboard is embedded directly from [Arena](https://lmarena.ai/leaderboard), since its site blocks automated downloads. A direct link is shown if the embed does not load.
- **LiveBench:** latest release listed by livebench.ai, with an overall score computed from its public category CSV.

The updater keeps each source's last successful snapshot if a fetch fails. To refresh manually, run the **Update conference and LLM dashboards** workflow in GitHub Actions.
