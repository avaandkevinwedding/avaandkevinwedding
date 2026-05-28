# Ava & Kevin Wedding Website

A static Vite wedding website for Ava and Kevin, built for GitHub Pages.

## Local Development

```bash
npm install
npm run dev
```

The dev command generates optimized photo assets from `Photos/` before starting Vite.

## Build

```bash
npm run build
```

The build command:

- converts HEIC/JPEG/JFIF source photos into WebP gallery assets
- writes `src/data/photoManifest.js`
- builds the production site into `dist/`

Original photos in `Photos/` are not modified.

## GitHub Pages

The repository includes `.github/workflows/deploy.yml`. In the GitHub repository settings, set Pages to deploy from GitHub Actions. On pushes to `main`, the workflow installs dependencies, runs `npm run build:pages`, and deploys `dist/`.

The intended public URL is:

```text
https://avaandkevinwedding.github.io/avaandkevinwedding/
```

Only optimized gallery assets in `public/photos/` should be committed. The original `Photos/` folder is ignored so private source images and metadata are not published to GitHub.

The Leave a Note form submits through FormSubmit and sends notes to `avaandkevin8@gmail.com`. On the first real submission, FormSubmit may send an activation email to that inbox before forwarding notes.
