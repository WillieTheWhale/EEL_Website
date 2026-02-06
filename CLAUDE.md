# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

EEL (Experimental Engineering Lab) is a single-page interactive website featuring a futuristic "cybercore" design with physics-based UI elements, Three.js 3D rendering, and sophisticated glassmorphism effects.

## Development Commands

```bash
# Install dependencies (for Puppeteer, used for testing/screenshots)
cd website && npm install

# Local development - open directly in browser
open website/index.html
# Or use any local server (Python, Node, etc.)
python3 -m http.server 8000 --directory website
```

There is no build step - this is a vanilla HTML/CSS/JS project loaded directly in the browser.

## Architecture

### Core Files (`website/`)

- **index.html** - Main page with embedded critical CSS for fast rendering, early theme detection script, and semantic HTML structure
- **script.js** (~3150 lines) - Main JavaScript containing all interactive systems
- **styles.css** (~2250 lines) - Full styling including light/dark themes, glassmorphism, and responsive breakpoints
- **mobile.js** - Mobile portrait mode detection and physics disabling

### JavaScript Systems (in `script.js`)

The codebase uses an object-oriented pattern with singleton modules:

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

### Design System

The site uses golden ratio (PHI = 1.618) and Fibonacci sequences throughout:
- CSS variables: `--phi`, `--phi-inv`, `--fib-1` through `--fib-55`
- Golden positions: `--golden-x1: 38.2%`, `--golden-x2: 61.8%`
- Timing based on Fibonacci numbers

Theme colors use a "Titanium Horizon" palette with CSS custom properties that switch between light and dark modes via `body[data-theme="dark"]`.

### Content Sections

Four navigation panels (Projects, People, About, Join Us) expand into full-screen overlays. Content is defined inline in `script.js` within the `PanelExpansion.getContentForType()` method.

## Key Implementation Details

- **No framework** - Pure vanilla JS with Three.js as the only external library
- **Critical CSS** is inlined in `<head>` to prevent FOUC
- **Theme detection** runs before body renders to prevent flash
- **`.js-positioned` class** hides elements until JavaScript calculates their positions
- **Mobile portrait mode** disables physics and switches to scrollable layout
- **Puppeteer** devDependency is for screenshot/testing purposes only
