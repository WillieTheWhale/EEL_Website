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
- `script.js` (~3,150 lines) - Core application with all major systems
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
| `MedallionSystem` | Central logo positioning |
| `CircuitGridMatrix` | SVG-based animated circuit board connecting panels to medallion |
| `RadialPanelPhysics` | Physics engine for draggable nav panels with collision detection and tethering |
| `HarmonicMotion` | Subtle breathing animations using golden ratio timing |
| `ThreeJSSystem` | Three.js particle field and chromatic effects |
| `EngineeringStructures` | Decorative animated SVG elements |
| `PanelExpansion` | Morphing animation when panels expand to full-screen overlays |

### 3D Rendering (Three.js)

WebGL scene with multiple engineering structures. Custom iridescent shader materials and wireframe rendering. Pure vanilla JS with Three.js as the only external library.

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
NOTIFY_EMAIL=wilk05@unc.edu
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
