# Dibakar Roy Sarkar — Portfolio

An app-style personal site — five full-screen views (Overview · Research · Live Lab ·
Publications · About) switched from the top nav, so there is little scrolling — with **five live, interactive scientific simulations**
running entirely in the browser (no build step, no dependencies, plain HTML/CSS/JS):

| Simulation | What it actually computes |
|---|---|
| **Hero operator** | Drifting input field `a(x)` → solution of `(I − α∇²)u = a` (SOR, every frame); hover to perturb |
| **Wave equation** | Finite-difference `∂²u/∂t² = c²∇²u` rendered as a live 3D wireframe |
| **Allen–Cahn** | Phase separation `uₜ = ε²∇²u + u − u³` (spinodal decomposition + coarsening) |
| **Turbulence** | Jos Stam's incompressible **stable-fluids** solver — interactive smoke |
| **PDE control** | Feedback control of the heat equation tracking a moving target |

## Run locally

Because it uses only classic scripts, you can just open `index.html`.
For a clean local server:

```bash
cd Portfolio
python3 -m http.server 8000
# then visit http://localhost:8000
```

## Host on GitHub Pages

1. Create a repo (e.g. `dibakar-roy-sarkar.github.io` for a user site, or any repo for a project site).
2. Push these files to the repo root:
   ```bash
   git init
   git add .
   git commit -m "Launch portfolio"
   git branch -M main
   git remote add origin https://github.com/<you>/<repo>.git
   git push -u origin main
   ```
3. On GitHub → **Settings → Pages** → Source: `Deploy from a branch` → `main` / `root`.
4. Your site goes live at `https://<you>.github.io/<repo>/`.

## Make it yours

- **Photos** → drop images into `assets/img/` and edit the list in `js/gallery.js`
  (see `assets/img/README.md`). Missing images show a tasteful placeholder automatically.
- **Links** → update GitHub / LinkedIn / Scholar URLs in `index.html` (search for `href="https://github.com/"`).
- **Colours** → tweak the CSS variables at the top of `css/style.css` (`--accent`, etc.).
- **Content** → all copy lives in `index.html`, one `<section class="view">` per tab.
  Add a research project by adding a `.sw-item` button and a matching `.project` panel.

## Structure

```
Portfolio/
├─ index.html          # all content + section markup
├─ css/style.css       # theme + layout
├─ js/
│  ├─ main.js          # hash router for views, tab switchers, lazy media, viz lifecycle
│  ├─ gallery.js       # photo strip (+ placeholders)
│  └─ viz/             # the five simulations
├─ assets/img/         # your photos go here
└─ assets/pdf/         # CV
```

Built with equations and a little JavaScript.
