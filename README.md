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
