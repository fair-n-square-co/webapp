# webapp — agent instructions

React + TanStack Start (SSR) frontend that also serves as the BFF (ADR-4/ADR-5).
Runtime/package manager: **Bun**. See `README.md` for how to run.

## PR explainers (required for every PR)

The maintainer is learning React and TanStack, so **every PR gets a plain-language
explainer** describing what the PR did and why.

- **Location:** `~/workspace/fairnsquare/temp/react-explainers/` (personal, NOT committed
  to any repo).
- **One directory per PR**, namespaced by repo: `<repo>/PR-<number>/index.html`.
  For this repo that's `webapp/PR-<number>/index.html` (e.g. `webapp/PR-1/index.html`).
- **Format:** a self-contained HTML file. Link the shared stylesheet with the correct
  relative path (`../../styles.css` from a `<repo>/PR-<n>/` folder). Write for a reader
  new to React/TanStack: explain the concepts, not just the diff.
- **Required `<meta>` tags** (the home-page generator reads these):
  `explainer:repo`, `explainer:pr`, `explainer:title`, `explainer:date`,
  `explainer:summary`, `explainer:pr_url`.
- **After adding/editing an explainer, rebuild the home page:**
  `cd ~/workspace/fairnsquare/temp/react-explainers && node generate.mjs`.
  `index.html` there auto-populates from every explainer's meta tags — never hand-edit it.

Copy an existing explainer (e.g. `webapp/PR-1/index.html`) as the template for structure
and styling.
