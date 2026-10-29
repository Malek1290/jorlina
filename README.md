# Malek — Portfolio

An editorial, monochrome portfolio for **Malek**, inspired by the supplied GAZU fashion-store reference.

## Selected work

| Project | Live site |
| --- | --- |
| **CLOTHINA** — featured streetwear e-commerce project | https://malek1290.github.io/CLOTHINA/index.html |
| **Jorlina** — quiet-luxury fashion storefront | https://jorlina-quiet-luxury.vercel.app/ |

## What’s included

- Responsive portfolio homepage with oversized typography and a warm neutral palette.
- Featured CLOTHINA section, two project cards, and direct live-site links.
- Searchable project index and detailed case-study dialogs.
- About, approach, and contact sections.
- Keyboard-accessible native dialogs, reduced-motion support, and local fonts.
- The original CLOTHINA storefront preserved under [`clothina/`](clothina/index.html).

## Run locally

This is a static site. No build step or package install is required.

```bash
python3 -m http.server 8080 --bind 0.0.0.0
```

Open `http://localhost:8080`.

The preserved storefront is available at `http://localhost:8080/clothina/`.

## Deploy

Deploy the repository root as a static site on GitHub Pages, Vercel, Netlify, or Cloudflare Pages.

- **Build command:** none
- **Output / publish directory:** repository root (`.`)
- **Entry point:** `index.html`

## Structure

```text
index.html                    Portfolio homepage
assets/portfolio/             Portfolio CSS, JS, fonts, favicon, and project imagery
clothina/                     Preserved CLOTHINA storefront and original documentation
_headers                      Static-host cache and security headers
.htaccess                     Apache cache/compression rules
```

## Customizing

- Edit copy and project links in `index.html`.
- Edit case-study content in `assets/portfolio/portfolio.js`.
- Edit layout, colors, and typography in `assets/portfolio/portfolio.css`.
- Contact currently links to Malek’s GitHub profile: https://github.com/Malek1290. Add a direct email or booking link when one is available.

Project imagery is stored locally. CLOTHINA previews were captured from the preserved storefront; Jorlina editorial imagery comes from the original project assets.
