# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

EEL (Experimental Engineering Lab) is a single-page interactive website featuring a futuristic "cybercore" design with physics-based UI elements, Three.js 3D rendering, and sophisticated glassmorphism effects. It includes a backend application portal with form submission, file uploads, email notifications, and an admin dashboard.

## Development Commands

```bash
# Install all dependencies (backend + dev tools)
cd EEL_Website
npm install

# Start backend server (serves frontend + API)
npm start
# Server runs at http://localhost:8080

# Or for static frontend only (no form submission)
# Open EEL_Website/index.html directly in a browser
```

## Architecture

### Main Files (in EEL_Website/)

- `index.html` - Entry point with inlined critical CSS and deferred script loading
- `script.js` - Core application with all major systems
- `ambient.js` - Pre-rendered background renderer (nebula, medallion glow, gears, circuits, drone); runs in a Web Worker
- `styles.css` (~2,250 lines) - Theming, glassmorphism, and responsive breakpoints
- `mobile.js` - Mobile device detection and portrait mode handling
- `application.html` - Application form page (Portal 2 aesthetic)
- `application.js` - Form submission logic (posts to `/api/applications`)
- `application.css` - Application form styling
- `vision-pro.html` - Vision Pro demo page

### Backend (in EEL_Website/backend/)

- `server.js` - Express server, serves static frontend + API routes
- `routes/applications.js` - POST/GET/DELETE `/api/applications` endpoints
- `routes/admin.js` - Admin dashboard route
- `views/admin.html` - Admin dashboard UI (password-protected)
- `data/applications.json` - Application submissions storage
- `uploads/` - Resume PDF file storage

### Modules (in EEL_Website/modules/)

- `anatomy/FingerKinematics.js` - 3D finger animation
- `animation/AnimationConfig.js`, `SwimAnimationController.js` - Animation systems
- `visionpro/` - Vision Pro assembly, geometry, materials, lighting, post-processing

### Core Systems in script.js

| System | Description |
|--------|-------------|
| `ThemeManager` | Light/dark theme persistence, respects system preferences |
| `AmbientHost` | Main-thread side of the ambient renderer: reads geometry, colours and keyframes from the live CSS and feeds `ambient.js` (in a Web Worker via OffscreenCanvas when supported, else on the main thread) |
| `MedallionSystem` | Central logo positioning |
| `CircuitGridMatrix` | Computes the circuit routes from panel positions; static grid + trace glows stay SVG, animated traces/nodes/packets are drawn by `ambient.js` |
| `RadialPanelPhysics` | Physics engine for draggable nav panels with collision detection; the scene loop sleeps while nothing moves |
| `PagePrerender` | Builds and lays out the four expanded pages at idle time, parks them with `content-visibility: hidden`, and pre-paints the hovered/visible panel's page |
| `PanelExpansion` | Morphing animation when panels expand to full-screen overlays |

### Ambient renderer (ambient.js)

The decorative background is replayed from pre-rendered sprites instead of being recomputed live. Nothing here touches the DOM, so it runs in a worker:

- **Nebula** – each CSS-blurred blob is pre-rendered once into a float sprite (exact Gaussian of its gradient disc) and the five are composited into one small canvas that the compositor upscales. The `.nebula-blob` elements stay in the DOM only so their styles/keyframes can be read.
- **Medallion glow** – the animated part of `medallion-glow-pulse` is drawn on a canvas above the glass; the static shadows remain a native box-shadow.
- **Gear icons**, **drone** (the original Three.js scene, unchanged) and the **circuit animation** (dash flow, packets, pulse transitions emulated with CSS timing).

`styles.css` stays the source of truth: change a blob/keyframe/colour there and the renderer picks it up. `?ambient=main` forces main-thread mode; `window.__EEL_TEST__` (set by the test harness) does too, with a deterministic clock.

### Visual parity and frame-rate tests

- `npm run test:parity -- --a=<reference url> --b=<candidate url>` – deterministic side-by-side screenshot diff (virtual clock for rAF, timers, random and every CSS animation).
- `npm run test:fps -- --cpu=20 --scenario=all` – FPS under CPU throttling (`--gpu=off` emulates a weak GPU via software compositing).

### 3D Rendering (Three.js)

The quadcopter drone is the only 3D element. Three.js r128 is loaded from cdnjs inside the ambient worker (or on the main thread as a fallback).

## Backend API

### Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/applications` | None | Submit new application (multipart form-data) |
| GET | `/api/applications` | Bearer token | List all applications |
| GET | `/api/applications/:id/resume` | Bearer token | Download resume PDF |
| DELETE | `/api/applications/:id` | Bearer token | Delete application |
| GET | `/admin` | None (login page) | Admin dashboard |

### Environment Variables (.env)

```
PORT=8080
ADMIN_PASSWORD=eel-admin-2024
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your-app-password
NOTIFY_EMAILS=wilk05@unc.edu,markyala@unc.edu
SITE_URL=http://localhost:8080
```

### Dependencies

- `express` - Web server
- `multer` - File upload handling
- `nodemailer` - Email notifications
- `dotenv` - Environment variables
- `puppeteer` (dev) - Browser automation/testing

## Key Patterns

### Golden Ratio Mathematics

CSS variables: `--phi`, `--phi-inv`, `--fib-1` through `--fib-55`
Golden positions: `--golden-x1: 38.2%`, `--golden-x2: 61.8%`
Theme colors use a "Titanium Horizon" palette with CSS custom properties.

### Physics System

Panel interactions use spring physics with velocity tracking, collision detection, damping, and viewport boundary constraints.

### Theme System

Three localStorage keys:
- `eel-has-visited` - First visit tracking
- `eel-theme` - Saved preference ('light' or 'dark')
- `eel-theme-manually-set` - Manual override flag

Custom `themechange` event fires when theme updates.

### Mobile Handling

Mobile portrait mode detected via touch capability, pointer type, and viewport width (<=768px). Physics disabled in portrait mode; alternative scrollable layout used.

## Naming Conventions

- **JavaScript:** camelCase for variables/functions, PascalCase for classes
- **CSS classes:** hyphenated (`.nav-panel`, `.panel-glass-container`)
- **CSS variables:** `--accent-cyan` for primary accent color
- **Data attributes:** `data-angle`, `data-content-type`

## Navigation Structure

Four radial panels at fixed angles:
- **Projects** (315°) - Research initiatives
- **People** (45°) - Team member showcase with LinkedIn integration
- **About** (135°) - Lab information
- **Join Us** (225°) - Application portal with "Apply Now" button

## Deployment

Docker and OpenShift deployment configs included:
- `Dockerfile` - Node.js Alpine container
- `docker-compose.yml` - Local Docker deployment with persistent volumes
- `openshift-deploy.yaml` - Red Hat OpenShift deployment with PVCs and secrets

## Extra Resources

- `copy/eel_team_responses.json` - Team survey response data
- `headshots/` - Processed team member photos (used by website)
- `headshots-raw/` - Original unprocessed team photos
- `EEL_Logo.ai` - Logo source file (Adobe Illustrator)
.
