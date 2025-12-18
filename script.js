// EEL - Experimental Engineering Lab
// Golden Ratio Cybercore System with Radial Panel Layout

const PHI = 1.618033988749;
const PHI_INV = 0.618033988749;
const FIBONACCI = [1, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144];

// ============================================
// THEME MANAGER
// ============================================

const ThemeManager = {
    init: function() {
        const hasVisited = localStorage.getItem('eel-has-visited');
        const savedTheme = localStorage.getItem('eel-theme');
        const userHasSetTheme = localStorage.getItem('eel-theme-manually-set') === 'true';
        
        let systemPrefersDark = false;
        if (window.matchMedia) {
            systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        }
        
        let initialTheme;
        
        if (!hasVisited) {
            initialTheme = systemPrefersDark ? 'dark' : 'light';
            localStorage.setItem('eel-has-visited', 'true');
            localStorage.setItem('eel-theme', initialTheme);
            localStorage.setItem('eel-theme-manually-set', 'false');
        } else if (userHasSetTheme && savedTheme) {
            initialTheme = savedTheme;
        } else {
            initialTheme = systemPrefersDark ? 'dark' : (savedTheme || 'light');
            localStorage.setItem('eel-theme', initialTheme);
        }
        
        this.setTheme(initialTheme, false);
        
        const toggleBtn = document.getElementById('themeToggle');
        if (toggleBtn) {
            toggleBtn.addEventListener('click', () => this.toggleTheme());
            toggleBtn.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    this.toggleTheme();
                }
            });
        }
        
        if (window.matchMedia) {
            window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
                const manuallySet = localStorage.getItem('eel-theme-manually-set') === 'true';
                if (!manuallySet) {
                    this.setTheme(e.matches ? 'dark' : 'light', true);
                }
            });
        }
        
        console.log('%cÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â¦ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Â¦ÃƒÂ¢Ã¢â€šÂ¬Ã…â€œÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¨ Theme initialized: ' + initialTheme + ' mode', 
            'color: ' + (initialTheme === 'dark' ? '#9482ff' : '#7ec8e3') + '; font-weight: bold;');
    },
    
    setTheme: function(theme, animate, isManual) {
        animate = animate !== false;
        const body = document.body;
        const toggleBtn = document.getElementById('themeToggle');
        
        if (animate && toggleBtn) {
            toggleBtn.classList.add('toggling');
            setTimeout(() => toggleBtn.classList.remove('toggling'), 600);
        }
        
        body.setAttribute('data-theme', theme);
        localStorage.setItem('eel-theme', theme);
        
        if (isManual) {
            localStorage.setItem('eel-theme-manually-set', 'true');
        }
        
        const metaThemeColor = document.querySelector('meta[name="theme-color"]');
        if (metaThemeColor) {
            metaThemeColor.content = theme === 'dark' ? '#0a0b0f' : '#f0f0f0';
        }
        
        if (toggleBtn) {
            toggleBtn.setAttribute('aria-label', 'Switch to ' + (theme === 'dark' ? 'light' : 'dark') + ' mode');
        }
        
        window.dispatchEvent(new CustomEvent('themechange', { detail: { theme: theme } }));
    },
    
    toggleTheme: function() {
        const currentTheme = document.body.getAttribute('data-theme') || 'light';
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
        this.setTheme(newTheme, true, true);
    },
    
    getCurrentTheme: function() {
        return document.body.getAttribute('data-theme') || 'light';
    }
};

// ============================================
// MEDALLION SYSTEM
// ============================================

const MedallionSystem = {
    element: null,
    position: { x: 0, y: 0 },
    
    init: function() {
        this.element = document.getElementById('centralMedallion');
        this.updatePosition();
        window.addEventListener('resize', () => this.updatePosition());
    },
    
    updatePosition: function() {
        this.position.x = window.innerWidth / 2;
        this.position.y = window.innerHeight / 2;
    },
    
    getCenter: function() {
        return { x: this.position.x, y: this.position.y };
    }
};

// ============================================
// CIRCUIT GRID MATRIX SYSTEM
// ============================================

const CircuitGridMatrix = {
    svg: null,
    gridGroup: null,
    tracesGroup: null,
    nodesGroup: null,
    packetsGroup: null,
    initialized: false,
    
    // Grid configuration
    gridSize: 40, // Grid cell size in pixels
    gridOpacity: 0.08,
    
    // Connection data
    connections: new Map(),
    packets: [],
    junctionNodes: [],
    
    // Animation timing
    packetSpeed: 0.4, // Progress per second
    lastUpdateTime: 0,
    
    init: function() {
        const container = document.getElementById('engineeringNetwork');
        if (!container || this.initialized) return;
        
        // Create main SVG
        this.svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        this.svg.setAttribute('class', 'circuit-grid-svg');
        this.svg.setAttribute('width', '100%');
        this.svg.setAttribute('height', '100%');
        
        // Create defs for gradients and filters
        const defs = this.createDefs();
        this.svg.appendChild(defs);
        
        // Create layer groups (order matters for z-index)
        this.gridGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        this.gridGroup.setAttribute('class', 'circuit-grid-layer');
        this.svg.appendChild(this.gridGroup);
        
        this.tracesGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        this.tracesGroup.setAttribute('class', 'circuit-traces-layer');
        this.svg.appendChild(this.tracesGroup);
        
        this.nodesGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        this.nodesGroup.setAttribute('class', 'circuit-nodes-layer');
        this.svg.appendChild(this.nodesGroup);
        
        this.packetsGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        this.packetsGroup.setAttribute('class', 'circuit-packets-layer');
        this.svg.appendChild(this.packetsGroup);
        
        // Initialize grid background
        this.createGridBackground();
        
        // Initialize connections for each panel
        const panels = ['projects', 'people', 'about', 'join'];
        panels.forEach((id, index) => {
            this.connections.set('panel-' + id, {
                panelId: 'panel-' + id,
                path: null,
                pathElement: null,
                pathGlowElement: null,
                junctions: [],
                packets: [],
                pathPoints: [],
                totalLength: 0
            });
            
            // Create multiple packets per connection for visual richness
            for (let p = 0; p < 2; p++) {
                this.packets.push({
                    connectionId: 'panel-' + id,
                    progress: (p * 0.5) + (index * 0.1), // Stagger packet positions
                    element: null,
                    glowElement: null,
                    direction: 1, // 1 = outward, -1 = inward
                    speed: this.packetSpeed * (0.8 + Math.random() * 0.4)
                });
            }
        });
        
        // Create packet elements
        this.createPacketElements();
        
        container.appendChild(this.svg);
        this.initialized = true;
        this.lastUpdateTime = performance.now();
        
        console.log('%cÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¡ Circuit Grid Matrix initialized', 'color: #7ec8e3; font-weight: bold;');
    },
    
    createDefs: function() {
        const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
        
        // Trace glow filter
        const traceGlow = document.createElementNS('http://www.w3.org/2000/svg', 'filter');
        traceGlow.setAttribute('id', 'traceGlow');
        traceGlow.setAttribute('x', '-50%');
        traceGlow.setAttribute('y', '-50%');
        traceGlow.setAttribute('width', '200%');
        traceGlow.setAttribute('height', '200%');
        traceGlow.innerHTML = `
            <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
            <feMerge>
                <feMergeNode in="coloredBlur"/>
                <feMergeNode in="SourceGraphic"/>
            </feMerge>
        `;
        defs.appendChild(traceGlow);
        
        // Packet glow filter (stronger)
        const packetGlow = document.createElementNS('http://www.w3.org/2000/svg', 'filter');
        packetGlow.setAttribute('id', 'packetGlow');
        packetGlow.setAttribute('x', '-100%');
        packetGlow.setAttribute('y', '-100%');
        packetGlow.setAttribute('width', '300%');
        packetGlow.setAttribute('height', '300%');
        packetGlow.innerHTML = `
            <feGaussianBlur stdDeviation="4" result="blur1"/>
            <feGaussianBlur stdDeviation="8" result="blur2"/>
            <feMerge>
                <feMergeNode in="blur2"/>
                <feMergeNode in="blur1"/>
                <feMergeNode in="SourceGraphic"/>
            </feMerge>
        `;
        defs.appendChild(packetGlow);
        
        // Node glow filter
        const nodeGlow = document.createElementNS('http://www.w3.org/2000/svg', 'filter');
        nodeGlow.setAttribute('id', 'nodeGlow');
        nodeGlow.setAttribute('x', '-100%');
        nodeGlow.setAttribute('y', '-100%');
        nodeGlow.setAttribute('width', '300%');
        nodeGlow.setAttribute('height', '300%');
        nodeGlow.innerHTML = `
            <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
            <feMerge>
                <feMergeNode in="coloredBlur"/>
                <feMergeNode in="SourceGraphic"/>
            </feMerge>
        `;
        defs.appendChild(nodeGlow);
        
        // Trace gradient
        const traceGradient = document.createElementNS('http://www.w3.org/2000/svg', 'linearGradient');
        traceGradient.setAttribute('id', 'traceGradient');
        traceGradient.innerHTML = `
            <stop offset="0%" class="trace-gradient-start"/>
            <stop offset="50%" class="trace-gradient-mid"/>
            <stop offset="100%" class="trace-gradient-end"/>
        `;
        defs.appendChild(traceGradient);
        
        return defs;
    },
    
    createGridBackground: function() {
        // Clear existing grid
        while (this.gridGroup.firstChild) {
            this.gridGroup.removeChild(this.gridGroup.firstChild);
        }
        
        const width = window.innerWidth;
        const height = window.innerHeight;
        const gridSize = this.gridSize;
        
        // Create grid pattern using lines
        // Vertical lines
        for (let x = 0; x <= width; x += gridSize) {
            const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
            line.setAttribute('x1', x);
            line.setAttribute('y1', 0);
            line.setAttribute('x2', x);
            line.setAttribute('y2', height);
            line.setAttribute('class', 'circuit-grid-line');
            this.gridGroup.appendChild(line);
        }
        
        // Horizontal lines
        for (let y = 0; y <= height; y += gridSize) {
            const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
            line.setAttribute('x1', 0);
            line.setAttribute('y1', y);
            line.setAttribute('x2', width);
            line.setAttribute('y2', y);
            line.setAttribute('class', 'circuit-grid-line');
            this.gridGroup.appendChild(line);
        }
    },
    
    createPacketElements: function() {
        this.packets.forEach((packet, index) => {
            // Create glow element (larger, behind)
            const glow = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
            glow.setAttribute('class', 'circuit-packet-glow');
            glow.setAttribute('width', '12');
            glow.setAttribute('height', '12');
            glow.setAttribute('rx', '2');
            glow.setAttribute('filter', 'url(#packetGlow)');
            this.packetsGroup.appendChild(glow);
            packet.glowElement = glow;
            
            // Create main packet element (diamond shape)
            const el = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
            el.setAttribute('class', 'circuit-packet');
            el.setAttribute('width', '8');
            el.setAttribute('height', '8');
            el.setAttribute('rx', '1');
            this.packetsGroup.appendChild(el);
            packet.element = el;
        });
    },
    
    // Snap a point to the nearest grid intersection
    snapToGrid: function(x, y) {
        return {
            x: Math.round(x / this.gridSize) * this.gridSize,
            y: Math.round(y / this.gridSize) * this.gridSize
        };
    },
    
    // Calculate Manhattan/orthogonal route from medallion edge to panel edge
    calculateRoute: function(medallionCenter, medallionRadius, panelRect, panelAngle) {
        const points = [];
        const gridSize = this.gridSize;
        
        // Calculate the panel's center position
        const panelCenterX = panelRect.x + panelRect.width / 2;
        const panelCenterY = panelRect.y + panelRect.height / 2;
        
        // Calculate the ACTUAL angle from medallion center to panel center
        const actualAngle = Math.atan2(panelCenterY - medallionCenter.y, panelCenterX - medallionCenter.x);
        
        // Start point: exactly on the medallion edge, pointing toward the panel
        const startX = medallionCenter.x + Math.cos(actualAngle) * medallionRadius;
        const startY = medallionCenter.y + Math.sin(actualAngle) * medallionRadius;
        const start = { x: startX, y: startY };
        
        // Lead-out point: a short distance from the medallion in the direction of the panel
        const leadOutDistance = gridSize * 1.5;
        const leadOutX = medallionCenter.x + Math.cos(actualAngle) * (medallionRadius + leadOutDistance);
        const leadOutY = medallionCenter.y + Math.sin(actualAngle) * (medallionRadius + leadOutDistance);
        const leadOut = this.snapToGrid(leadOutX, leadOutY);
        
        // Calculate which edge of the panel is closest to the medallion center
        // by finding the intersection point of the line from medallion to panel center with the panel edges
        const dx = panelCenterX - medallionCenter.x;
        const dy = panelCenterY - medallionCenter.y;
        const absDx = Math.abs(dx);
        const absDy = Math.abs(dy);
        
        // Determine the primary direction and which edge to connect to
        let endX, endY;
        const horizontalBias = (absDx / panelRect.width) > (absDy / panelRect.height);
        
        if (horizontalBias) {
            // Connect to left or right edge
            if (dx > 0) {
                // Panel is to the right - connect to left edge
                endX = panelRect.x;
                // Calculate Y position where the line intersects the left edge
                const t = (panelRect.x - medallionCenter.x) / dx;
                endY = medallionCenter.y + t * dy;
                // Clamp to panel bounds
                endY = Math.max(panelRect.y + 10, Math.min(endY, panelRect.y + panelRect.height - 10));
            } else {
                // Panel is to the left - connect to right edge
                endX = panelRect.x + panelRect.width;
                const t = (panelRect.x + panelRect.width - medallionCenter.x) / dx;
                endY = medallionCenter.y + t * dy;
                endY = Math.max(panelRect.y + 10, Math.min(endY, panelRect.y + panelRect.height - 10));
            }
        } else {
            // Connect to top or bottom edge
            if (dy > 0) {
                // Panel is below - connect to top edge
                endY = panelRect.y;
                const t = (panelRect.y - medallionCenter.y) / dy;
                endX = medallionCenter.x + t * dx;
                endX = Math.max(panelRect.x + 10, Math.min(endX, panelRect.x + panelRect.width - 10));
            } else {
                // Panel is above - connect to bottom edge
                endY = panelRect.y + panelRect.height;
                const t = (panelRect.y + panelRect.height - medallionCenter.y) / dy;
                endX = medallionCenter.x + t * dx;
                endX = Math.max(panelRect.x + 10, Math.min(endX, panelRect.x + panelRect.width - 10));
            }
        }
        
        // DON'T snap the final endpoint - keep it exactly at the panel edge
        const end = { x: endX, y: endY };
        
        // Create a pre-endpoint that IS snapped for clean circuit routing
        const preEndX = horizontalBias ? 
            (dx > 0 ? endX - gridSize * 2 : endX + gridSize * 2) : 
            endX;
        const preEndY = horizontalBias ? 
            endY : 
            (dy > 0 ? endY - gridSize * 2 : endY + gridSize * 2);
        const preEnd = this.snapToGrid(preEndX, preEndY);
        
        // Build orthogonal path
        points.push(start);
        points.push(leadOut);
        
        // Determine routing based on relative position
        const isRightOfCenter = dx > 0;
        const isAboveCenter = dy < 0;
        
        if (horizontalBias) {
            // Horizontal connection (to left/right edge)
            if (isRightOfCenter && isAboveCenter) {
                // Top-right
                const turn1X = this.snapToGrid(leadOut.x + gridSize * 2, 0).x;
                const turn2Y = this.snapToGrid(0, Math.min(leadOut.y, preEnd.y) - gridSize).y;
                points.push({ x: turn1X, y: leadOut.y });
                points.push({ x: turn1X, y: turn2Y });
                points.push({ x: preEnd.x, y: turn2Y });
                points.push({ x: preEnd.x, y: end.y });
            } else if (isRightOfCenter && !isAboveCenter) {
                // Bottom-right
                const turn1X = this.snapToGrid(leadOut.x + gridSize * 2, 0).x;
                const turn2Y = this.snapToGrid(0, Math.max(leadOut.y, preEnd.y) + gridSize).y;
                points.push({ x: turn1X, y: leadOut.y });
                points.push({ x: turn1X, y: turn2Y });
                points.push({ x: preEnd.x, y: turn2Y });
                points.push({ x: preEnd.x, y: end.y });
            } else if (!isRightOfCenter && !isAboveCenter) {
                // Bottom-left
                const turn1X = this.snapToGrid(leadOut.x - gridSize * 2, 0).x;
                const turn2Y = this.snapToGrid(0, Math.max(leadOut.y, preEnd.y) + gridSize).y;
                points.push({ x: turn1X, y: leadOut.y });
                points.push({ x: turn1X, y: turn2Y });
                points.push({ x: preEnd.x, y: turn2Y });
                points.push({ x: preEnd.x, y: end.y });
            } else {
                // Top-left
                const turn1X = this.snapToGrid(leadOut.x - gridSize * 2, 0).x;
                const turn2Y = this.snapToGrid(0, Math.min(leadOut.y, preEnd.y) - gridSize).y;
                points.push({ x: turn1X, y: leadOut.y });
                points.push({ x: turn1X, y: turn2Y });
                points.push({ x: preEnd.x, y: turn2Y });
                points.push({ x: preEnd.x, y: end.y });
            }
        } else {
            // Vertical connection (to top/bottom edge)
            if (isRightOfCenter && isAboveCenter) {
                // Top-right
                const turn1Y = this.snapToGrid(0, leadOut.y - gridSize * 2).y;
                const turn2X = this.snapToGrid(Math.max(leadOut.x, preEnd.x) + gridSize, 0).x;
                points.push({ x: leadOut.x, y: turn1Y });
                points.push({ x: turn2X, y: turn1Y });
                points.push({ x: turn2X, y: preEnd.y });
                points.push({ x: end.x, y: preEnd.y });
            } else if (isRightOfCenter && !isAboveCenter) {
                // Bottom-right
                const turn1Y = this.snapToGrid(0, leadOut.y + gridSize * 2).y;
                const turn2X = this.snapToGrid(Math.max(leadOut.x, preEnd.x) + gridSize, 0).x;
                points.push({ x: leadOut.x, y: turn1Y });
                points.push({ x: turn2X, y: turn1Y });
                points.push({ x: turn2X, y: preEnd.y });
                points.push({ x: end.x, y: preEnd.y });
            } else if (!isRightOfCenter && !isAboveCenter) {
                // Bottom-left
                const turn1Y = this.snapToGrid(0, leadOut.y + gridSize * 2).y;
                const turn2X = this.snapToGrid(Math.min(leadOut.x, preEnd.x) - gridSize, 0).x;
                points.push({ x: leadOut.x, y: turn1Y });
                points.push({ x: turn2X, y: turn1Y });
                points.push({ x: turn2X, y: preEnd.y });
                points.push({ x: end.x, y: preEnd.y });
            } else {
                // Top-left
                const turn1Y = this.snapToGrid(0, leadOut.y - gridSize * 2).y;
                const turn2X = this.snapToGrid(Math.min(leadOut.x, preEnd.x) - gridSize, 0).x;
                points.push({ x: leadOut.x, y: turn1Y });
                points.push({ x: turn2X, y: turn1Y });
                points.push({ x: turn2X, y: preEnd.y });
                points.push({ x: end.x, y: preEnd.y });
            }
        }
        
        // Final point exactly at panel edge
        points.push(end);
        
        return points;
    },
    
    // Create SVG path from points
    createPathFromPoints: function(points) {
        if (points.length < 2) return '';
        
        let d = `M ${points[0].x} ${points[0].y}`;
        for (let i = 1; i < points.length; i++) {
            d += ` L ${points[i].x} ${points[i].y}`;
        }
        return d;
    },
    
    // Calculate total length of a path
    calculatePathLength: function(points) {
        let length = 0;
        for (let i = 1; i < points.length; i++) {
            const dx = points[i].x - points[i-1].x;
            const dy = points[i].y - points[i-1].y;
            length += Math.sqrt(dx * dx + dy * dy);
        }
        return length;
    },
    
    // Get point along path at given progress (0-1)
    getPointAtProgress: function(points, progress) {
        if (points.length < 2) return points[0] || { x: 0, y: 0 };
        
        const totalLength = this.calculatePathLength(points);
        const targetLength = progress * totalLength;
        
        let currentLength = 0;
        for (let i = 1; i < points.length; i++) {
            const dx = points[i].x - points[i-1].x;
            const dy = points[i].y - points[i-1].y;
            const segmentLength = Math.sqrt(dx * dx + dy * dy);
            
            if (currentLength + segmentLength >= targetLength) {
                const t = (targetLength - currentLength) / segmentLength;
                return {
                    x: points[i-1].x + dx * t,
                    y: points[i-1].y + dy * t
                };
            }
            currentLength += segmentLength;
        }
        
        return points[points.length - 1];
    },
    
    update: function() {
        if (!this.initialized || !radialPanelPhysics) return;
        
        const now = performance.now();
        const deltaTime = (now - this.lastUpdateTime) / 1000;
        this.lastUpdateTime = now;
        
        const center = MedallionSystem.getCenter();
        const medallionEl = document.getElementById('centralMedallion');
        const medallionRadius = medallionEl ? medallionEl.offsetWidth / 2 : 100;
        
        // Update each connection
        this.connections.forEach((conn, panelId) => {
            const panelData = radialPanelPhysics.panels.get(panelId);
            if (!panelData) return;
            
            const rect = panelData.element.getBoundingClientRect();
            const panelRect = {
                x: panelData.position.x,
                y: panelData.position.y,
                width: rect.width,
                height: rect.height
            };
            
            // Get panel angle from data attribute
            const panelAngle = parseFloat(panelData.element.dataset.angle) || 0;
            
            // Calculate route
            const points = this.calculateRoute(center, medallionRadius, panelRect, panelAngle);
            conn.pathPoints = points;
            conn.totalLength = this.calculatePathLength(points);
            
            // Create/update path elements
            const pathD = this.createPathFromPoints(points);
            
            if (!conn.pathGlowElement) {
                // Create glow path (wider, behind)
                conn.pathGlowElement = document.createElementNS('http://www.w3.org/2000/svg', 'path');
                conn.pathGlowElement.setAttribute('class', 'circuit-trace-glow');
                conn.pathGlowElement.setAttribute('filter', 'url(#traceGlow)');
                this.tracesGroup.appendChild(conn.pathGlowElement);
            }
            conn.pathGlowElement.setAttribute('d', pathD);
            
            if (!conn.pathElement) {
                // Create main trace path
                conn.pathElement = document.createElementNS('http://www.w3.org/2000/svg', 'path');
                conn.pathElement.setAttribute('class', 'circuit-trace');
                this.tracesGroup.appendChild(conn.pathElement);
            }
            conn.pathElement.setAttribute('d', pathD);
            
            // Create/update junction nodes at turns
            this.updateJunctionNodes(conn, points);
        });
        
        // Animate packets
        this.packets.forEach(packet => {
            const conn = this.connections.get(packet.connectionId);
            if (!conn || conn.pathPoints.length < 2) return;
            
            // Update packet progress
            packet.progress += packet.speed * deltaTime * packet.direction;
            
            // Bounce packet back when it reaches ends
            if (packet.progress >= 1) {
                packet.progress = 1;
                packet.direction = -1;
            } else if (packet.progress <= 0) {
                packet.progress = 0;
                packet.direction = 1;
            }
            
            // Get packet position
            const pos = this.getPointAtProgress(conn.pathPoints, packet.progress);
            
            // Update packet element positions
            if (packet.element) {
                packet.element.setAttribute('x', pos.x - 4);
                packet.element.setAttribute('y', pos.y - 4);
                packet.element.style.transform = `rotate(45deg)`;
                packet.element.style.transformOrigin = `${pos.x}px ${pos.y}px`;
            }
            if (packet.glowElement) {
                packet.glowElement.setAttribute('x', pos.x - 6);
                packet.glowElement.setAttribute('y', pos.y - 6);
            }
            
            // Pulse nearby junction nodes
            this.pulseNearbyJunctions(pos, conn.junctions);
        });
    },
    
    updateJunctionNodes: function(conn, points) {
        // Remove old junction nodes
        conn.junctions.forEach(node => {
            if (node.element && node.element.parentNode) {
                node.element.parentNode.removeChild(node.element);
            }
        });
        conn.junctions = [];
        
        // Create start node at medallion edge (first point)
        if (points.length > 0) {
            const startPoint = points[0];
            const startNode = {
                x: startPoint.x,
                y: startPoint.y,
                element: null,
                pulseIntensity: 0
            };
            
            const startEl = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
            startEl.setAttribute('class', 'circuit-medallion-port');
            startEl.setAttribute('cx', startPoint.x);
            startEl.setAttribute('cy', startPoint.y);
            startEl.setAttribute('r', '5');
            startEl.setAttribute('filter', 'url(#nodeGlow)');
            this.nodesGroup.appendChild(startEl);
            
            startNode.element = startEl;
            conn.junctions.push(startNode);
        }
        
        // Create junction nodes at each turn point (skip start and end)
        for (let i = 1; i < points.length - 1; i++) {
            const junction = {
                x: points[i].x,
                y: points[i].y,
                element: null,
                pulseIntensity: 0
            };
            
            // Create diamond-shaped junction node
            const el = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
            el.setAttribute('class', 'circuit-junction');
            el.setAttribute('x', points[i].x - 5);
            el.setAttribute('y', points[i].y - 5);
            el.setAttribute('width', '10');
            el.setAttribute('height', '10');
            el.setAttribute('rx', '2');
            el.setAttribute('filter', 'url(#nodeGlow)');
            el.style.transform = 'rotate(45deg)';
            el.style.transformOrigin = `${points[i].x}px ${points[i].y}px`;
            this.nodesGroup.appendChild(el);
            
            junction.element = el;
            conn.junctions.push(junction);
        }
        
        // Create endpoint nodes (on panel edge)
        if (points.length > 0) {
            const endPoint = points[points.length - 1];
            const endNode = {
                x: endPoint.x,
                y: endPoint.y,
                element: null,
                pulseIntensity: 0
            };
            
            const el = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
            el.setAttribute('class', 'circuit-endpoint');
            el.setAttribute('cx', endPoint.x);
            el.setAttribute('cy', endPoint.y);
            el.setAttribute('r', '6');
            el.setAttribute('filter', 'url(#nodeGlow)');
            this.nodesGroup.appendChild(el);
            
            endNode.element = el;
            conn.junctions.push(endNode);
        }
    },
    
    pulseNearbyJunctions: function(packetPos, junctions) {
        const pulseRadius = 30;
        
        junctions.forEach(junction => {
            const dx = packetPos.x - junction.x;
            const dy = packetPos.y - junction.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            
            if (dist < pulseRadius) {
                const intensity = 1 - (dist / pulseRadius);
                junction.pulseIntensity = Math.max(junction.pulseIntensity, intensity);
                
                if (junction.element) {
                    junction.element.classList.add('pulsing');
                    junction.element.style.setProperty('--pulse-intensity', intensity);
                }
            } else {
                junction.pulseIntensity *= 0.9;
                if (junction.pulseIntensity < 0.1 && junction.element) {
                    junction.element.classList.remove('pulsing');
                }
            }
        });
    },
    
    onResize: function() {
        if (!this.initialized) return;
        this.createGridBackground();
    },
    
    fadeOut: function() {
        if (this.svg) {
            this.svg.style.transition = 'opacity 0.5s ease-out';
            this.svg.style.opacity = '0';
        }
    },
    
    fadeIn: function() {
        if (this.svg) {
            this.svg.style.transition = 'opacity 0.5s ease-in';
            this.svg.style.opacity = '1';
        }
    }
};

// Legacy alias for compatibility
const EngineeringNetwork = CircuitGridMatrix;

// ============================================
// TETHER SYSTEM (Now uses CircuitGridMatrix)
// ============================================

const TetherSystem = {
    initialized: false,
    
    init: function() {
        // Hide the old SVG tethers container - we're using CircuitGridMatrix instead
        const oldContainer = document.getElementById('tethersContainer');
        if (oldContainer) {
            oldContainer.style.display = 'none';
        }
        
        // Initialize the Circuit Grid Matrix
        CircuitGridMatrix.init();
        this.initialized = true;
    },
    
    update: function() {
        // Update the Circuit Grid Matrix
        CircuitGridMatrix.update();
    },
    
    fadeOut: function() {
        CircuitGridMatrix.fadeOut();
    },
    
    fadeIn: function() {
        CircuitGridMatrix.fadeIn();
    }
};

// ============================================
// RADIAL PANEL PHYSICS WITH COLLISION
// ============================================

class RadialPanelPhysics {
    constructor() {
        this.panels = new Map();
        this.draggedPanel = null;
        this.initialized = false;
        this.frameCounter = 0;
        this.updateFrequency = 2;
        
        this.dragState = {
            offsetX: 0, offsetY: 0, velocityTracking: [],
            mouseDownTime: 0, mouseDownX: 0, mouseDownY: 0, hasMoved: false
        };
        
        this.springConstants = {
            stiffness: PHI_INV * 0.08,
            damping: PHI_INV * 0.9,
            minVelocity: 0.01
        };
        
        this.collisionSettings = {
            enabled: true,
            repulsionStrength: 0.5,
            iterations: 3,
            minDistance: 20
        };
        
        this.setupDocumentHandlers();
        
        // Use requestAnimationFrame for better timing to ensure DOM is ready
        requestAnimationFrame(() => {
            requestAnimationFrame(() => this.initializePanels());
        });
    }
    
    // Calculate separate horizontal and vertical distances for elliptical 2x2 grid layout
    calculateDistances() {
        const vw = window.innerWidth;
        const vh = window.innerHeight;
        
        // Get panel dimensions (use CSS values as fallback)
        const panelWidth = Math.max(vw * 0.15, 180);
        const panelHeight = Math.max(vh * 0.30, 240);
        
        // Calculate available space from center to edge (minus panel size and padding)
        const padding = 20;
        const availableX = (vw / 2) - (panelWidth / 2) - padding;
        const availableY = (vh / 2) - (panelHeight / 2) - padding;
        
        // Reserve space for medallion and title
        const medallionClearanceY = vh * 0.14;
        
        // Calculate distances - increased multipliers for more spacing
        // Horizontal distance - use more of the available horizontal space
        const distanceX = Math.min(availableX * 1.0, vw * 0.42);
        // Vertical distance - increased for more vertical separation
        const distanceY = Math.min(availableY * 0.95, vh * 0.38);
        
        return {
            x: Math.max(distanceX, panelWidth * 0.85),
            y: Math.max(distanceY, medallionClearanceY + panelHeight * 0.45)
        };
    }
    
    setupDocumentHandlers() {
        document.addEventListener('mousemove', (e) => {
            if (!this.draggedPanel) return;
            const panelData = this.panels.get(this.draggedPanel);
            if (!panelData || !panelData.isDragging) return;
            
            const dx = e.clientX - this.dragState.mouseDownX;
            const dy = e.clientY - this.dragState.mouseDownY;
            if (Math.sqrt(dx * dx + dy * dy) > 5) this.dragState.hasMoved = true;
            
            const newX = e.clientX - this.dragState.offsetX;
            const newY = e.clientY - this.dragState.offsetY;
            
            this.dragState.velocityTracking.push({ x: newX - panelData.position.x, y: newY - panelData.position.y });
            if (this.dragState.velocityTracking.length > 5) this.dragState.velocityTracking.shift();
            
            panelData.position.x = newX;
            panelData.position.y = newY;
            panelData.element.style.transform = 'translate3d(' + newX + 'px, ' + newY + 'px, 0) rotateZ(' + panelData.angle + 'deg)';
            TetherSystem.update();
        }, { passive: true });
        
        document.addEventListener('mouseup', (e) => {
            if (!this.draggedPanel) return;
            const panelId = this.draggedPanel;
            const panelData = this.panels.get(panelId);
            if (!panelData) return;
            
            panelData.element.classList.remove('dragging');
            panelData.isDragging = false;
            
            const clickDuration = Date.now() - this.dragState.mouseDownTime;
            const isClick = !this.dragState.hasMoved && clickDuration < 200;
            
            if (isClick) {
                const contentType = panelData.element.dataset.contentType;
                if (contentType && !isExpanded && !isCollapsing) {
                    expandPanel(panelId, contentType);
                }
            } else if (this.dragState.hasMoved) {
                // Panel was dragged - update anchor position to current position
                // so it stays where the user placed it
                panelData.anchorX = panelData.position.x;
                panelData.anchorY = panelData.position.y;
                panelData.hasBeenMoved = true;
                
                // Apply throw velocity for natural feel
                if (this.dragState.velocityTracking.length > 0) {
                    const avgVel = this.dragState.velocityTracking.reduce((acc, vel) => ({ x: acc.x + vel.x, y: acc.y + vel.y }), { x: 0, y: 0 });
                    panelData.velocity.x = (avgVel.x / this.dragState.velocityTracking.length) * PHI_INV * 0.3;
                    panelData.velocity.y = (avgVel.y / this.dragState.velocityTracking.length) * PHI_INV * 0.3;
                    panelData.angularVelocity = panelData.velocity.x * (1 / PHI) * 0.05;
                }
            }
            
            this.draggedPanel = null;
            this.dragState.velocityTracking = [];
        }, { passive: true });
        
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && isExpanded) collapsePanel();
        });
    }
    
    initializePanels() {
        if (this.initialized) return;
        this.initialized = true;
        
        MedallionSystem.init();
        EngineeringNetwork.init();
        
        const center = MedallionSystem.getCenter();
        const distances = this.calculateDistances();
        
        document.querySelectorAll('.nav-panel').forEach((panel) => {
            const angle = parseFloat(panel.dataset.angle) || 0;
            const angleRad = (angle * Math.PI) / 180;
            
            // Use separate distances for X and Y (elliptical distribution)
            const panelWidth = panel.offsetWidth || Math.max(window.innerWidth * 0.15, 180);
            const panelHeight = panel.offsetHeight || Math.max(window.innerHeight * 0.30, 240);
            
            let x = center.x + Math.cos(angleRad) * distances.x - panelWidth / 2;
            let y = center.y + Math.sin(angleRad) * distances.y - panelHeight / 2;
            
            // Boundary checking to ensure panels stay within viewport
            const padding = 10;
            x = Math.max(padding, Math.min(x, window.innerWidth - panelWidth - padding));
            y = Math.max(padding, Math.min(y, window.innerHeight - panelHeight - padding));
            
            const panelData = {
                element: panel,
                position: { x: x, y: y },
                velocity: { x: 0, y: 0 },
                anchorAngle: angle,
                anchorDistanceX: distances.x,
                anchorDistanceY: distances.y,
                anchorX: x,  // Explicit anchor position - can be updated when dragged
                anchorY: y,  // Explicit anchor position - can be updated when dragged
                hasBeenMoved: false,  // Track if user has manually repositioned this panel
                angle: 0,
                angularVelocity: 0,
                isDragging: false,
                isMoving: false,
                physicsDisabled: false,
                mass: PHI,
                width: panelWidth,
                height: panelHeight
            };
            
            this.panels.set(panel.id, panelData);
            
            panel.style.left = '0px';
            panel.style.top = '0px';
            panel.style.transform = 'translate3d(' + x + 'px, ' + y + 'px, 0)';
            panel.style.willChange = 'transform';
            
            panel.setAttribute('tabindex', '0');
            panel.setAttribute('role', 'button');
            panel.setAttribute('aria-expanded', 'false');
            const title = panel.querySelector('.panel-title');
            panel.setAttribute('aria-label', (title ? title.textContent : 'Navigation') + ' panel');
            
            this.addPanelListeners(panel);
        });
        
        TetherSystem.init();
        TetherSystem.update();
        this.revealPositionedElements();
    }
    
    revealPositionedElements() {
        document.querySelectorAll('.js-positioned').forEach(el => el.classList.add('ready'));
        console.log('%cÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â¦ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Â¦ÃƒÂ¢Ã¢â€šÂ¬Ã…â€œÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã¢â‚¬Å“ Elements positioned and revealed', 'color: #7ec8e3; font-weight: bold;');
    }
    
    addPanelListeners(panel) {
        panel.addEventListener('mousedown', (e) => {
            const panelData = this.panels.get(panel.id);
            if (!panelData) return;
            
            this.dragState.mouseDownTime = Date.now();
            this.dragState.mouseDownX = e.clientX;
            this.dragState.mouseDownY = e.clientY;
            this.dragState.hasMoved = false;
            
            this.draggedPanel = panel.id;
            panelData.isDragging = true;
            panelData.isMoving = true;
            panel.classList.add('dragging');
            
            const rect = panel.getBoundingClientRect();
            this.dragState.offsetX = e.clientX - rect.left;
            this.dragState.offsetY = e.clientY - rect.top;
            this.dragState.velocityTracking = [];
            
            panelData.velocity.x = 0;
            panelData.velocity.y = 0;
            panelData.angularVelocity = 0;
            e.preventDefault();
        });
        
        panel.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                const contentType = panel.dataset.contentType;
                if (contentType && !isExpanded && !isCollapsing) expandPanel(panel.id, contentType);
            }
        });
    }
    
    detectAndResolveCollisions() {
        if (!this.collisionSettings.enabled) return;
        const panelArray = Array.from(this.panels.values());
        
        for (let iteration = 0; iteration < this.collisionSettings.iterations; iteration++) {
            for (let i = 0; i < panelArray.length; i++) {
                for (let j = i + 1; j < panelArray.length; j++) {
                    const panelA = panelArray[i];
                    const panelB = panelArray[j];
                    
                    if (panelA.isDragging || panelB.isDragging || panelA.physicsDisabled || panelB.physicsDisabled) continue;
                    
                    const ax = panelA.position.x, ay = panelA.position.y;
                    const aw = panelA.width || panelA.element.offsetWidth;
                    const ah = panelA.height || panelA.element.offsetHeight;
                    const bx = panelB.position.x, by = panelB.position.y;
                    const bw = panelB.width || panelB.element.offsetWidth;
                    const bh = panelB.height || panelB.element.offsetHeight;
                    const buffer = this.collisionSettings.minDistance;
                    
                    const overlapX = Math.min(ax + aw + buffer, bx + bw + buffer) - Math.max(ax - buffer, bx - buffer);
                    const overlapY = Math.min(ay + ah + buffer, by + bh + buffer) - Math.max(ay - buffer, by - buffer);
                    
                    if (overlapX > 0 && overlapY > 0) {
                        const dx = (bx + bw / 2) - (ax + aw / 2);
                        const dy = (by + bh / 2) - (ay + ah / 2);
                        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
                        const nx = dx / dist, ny = dy / dist;
                        const repulsion = Math.min(overlapX, overlapY) * this.collisionSettings.repulsionStrength;
                        
                        if (!panelA.isDragging && panelA.isMoving) {
                            panelA.velocity.x -= nx * repulsion / panelA.mass;
                            panelA.velocity.y -= ny * repulsion / panelA.mass;
                        }
                        if (!panelB.isDragging && panelB.isMoving) {
                            panelB.velocity.x += nx * repulsion / panelB.mass;
                            panelB.velocity.y += ny * repulsion / panelB.mass;
                        }
                    }
                }
            }
        }
    }
    
    update(deltaTime) {
        if (!this.initialized) return;
        this.frameCounter++;
        if (this.frameCounter % this.updateFrequency !== 0) return;
        
        deltaTime = Math.min(deltaTime * this.updateFrequency, 1 / 30);
        
        this.detectAndResolveCollisions();
        
        this.panels.forEach((panelData) => {
            if (panelData.isDragging || panelData.physicsDisabled || !panelData.isMoving) return;
            
            // Use stored anchor positions (these are updated when user drags panels)
            let anchorX = panelData.anchorX;
            let anchorY = panelData.anchorY;
            
            // Boundary checking for anchor positions
            const padding = 10;
            const panelWidth = panelData.width || panelData.element.offsetWidth;
            const panelHeight = panelData.height || panelData.element.offsetHeight;
            anchorX = Math.max(padding, Math.min(anchorX, window.innerWidth - panelWidth - padding));
            anchorY = Math.max(padding, Math.min(anchorY, window.innerHeight - panelHeight - padding));
            
            const dx = anchorX - panelData.position.x;
            const dy = anchorY - panelData.position.y;
            
            if (Math.sqrt(dx * dx + dy * dy) > 5) {
                panelData.velocity.x += dx * this.springConstants.stiffness / panelData.mass;
                panelData.velocity.y += dy * this.springConstants.stiffness / panelData.mass;
            }
            
            panelData.velocity.x *= this.springConstants.damping;
            panelData.velocity.y *= this.springConstants.damping;
            
            if (Math.abs(panelData.velocity.x) < this.springConstants.minVelocity && 
                Math.abs(panelData.velocity.y) < this.springConstants.minVelocity) {
                panelData.velocity.x = 0;
                panelData.velocity.y = 0;
                panelData.isMoving = false;
                panelData.angularVelocity = 0;
                panelData.angle = 0;
                return;
            }
            
            panelData.position.x += panelData.velocity.x;
            panelData.position.y += panelData.velocity.y;
            panelData.angularVelocity *= PHI_INV;
            panelData.angle += panelData.angularVelocity;
            panelData.angle *= (1 + PHI_INV) / 2;
            
            panelData.element.style.transform = 'translate3d(' + panelData.position.x + 'px, ' + panelData.position.y + 'px, 0) rotateZ(' + panelData.angle + 'deg)';
        });
        
        TetherSystem.update();
    }
    
    updateBounds() {
        const center = MedallionSystem.getCenter();
        const distances = this.calculateDistances();
        
        this.panels.forEach((panelData) => {
            panelData.anchorDistanceX = distances.x;
            panelData.anchorDistanceY = distances.y;
            panelData.width = panelData.element.offsetWidth;
            panelData.height = panelData.element.offsetHeight;
            
            const padding = 10;
            
            if (panelData.hasBeenMoved) {
                // Panel was manually moved - keep it at its current position
                // but ensure it stays within viewport bounds
                panelData.anchorX = Math.max(padding, Math.min(panelData.anchorX, window.innerWidth - panelData.width - padding));
                panelData.anchorY = Math.max(padding, Math.min(panelData.anchorY, window.innerHeight - panelData.height - padding));
                
                if (!panelData.isDragging) {
                    panelData.position.x = panelData.anchorX;
                    panelData.position.y = panelData.anchorY;
                    panelData.element.style.transform = 'translate3d(' + panelData.position.x + 'px, ' + panelData.position.y + 'px, 0) rotateZ(' + panelData.angle + 'deg)';
                }
            } else {
                // Panel hasn't been moved - recalculate position based on new viewport
                const angleRad = (panelData.anchorAngle * Math.PI) / 180;
                let anchorX = center.x + Math.cos(angleRad) * distances.x - panelData.element.offsetWidth / 2;
                let anchorY = center.y + Math.sin(angleRad) * distances.y - panelData.element.offsetHeight / 2;
                
                // Boundary checking
                anchorX = Math.max(padding, Math.min(anchorX, window.innerWidth - panelData.width - padding));
                anchorY = Math.max(padding, Math.min(anchorY, window.innerHeight - panelData.height - padding));
                
                // Update stored anchor positions
                panelData.anchorX = anchorX;
                panelData.anchorY = anchorY;
                
                if (!panelData.isDragging) {
                    panelData.position.x = anchorX;
                    panelData.position.y = anchorY;
                    panelData.element.style.transform = 'translate3d(' + panelData.position.x + 'px, ' + panelData.position.y + 'px, 0) rotateZ(' + panelData.angle + 'deg)';
                }
            }
        });
        TetherSystem.update();
    }
}

let radialPanelPhysics;

// ============================================
// HARMONIC MOTION SYSTEM
// ============================================

class HarmonicMotionSystem {
    constructor() {
        this.time = 0;
        this.elements = new Map();
        this.frameCounter = 0;
        this.updateFrequency = 2;
    }
    
    registerElement(element, config) {
        this.elements.set(element, {
            amplitude: config.amplitude || PHI * 10,
            frequency: config.frequency || 1 / (PHI * 10),
            phase: config.phase || Math.random() * Math.PI * 2,
            axis: config.axis || 'y',
            pattern: config.pattern || 'sine'
        });
    }
    
    update(deltaTime) {
        this.time += deltaTime;
        this.frameCounter++;
        if (this.frameCounter % this.updateFrequency !== 0) return;
        
        this.elements.forEach((config, element) => {
            if (!element.visible) return;
            const t = this.time * config.frequency + config.phase;
            let displacement = 0;
            
            switch(config.pattern) {
                case 'sine':
                    displacement = Math.sin(t) * config.amplitude;
                    break;
                case 'lissajous':
                    displacement = Math.sin(3 * t) * config.amplitude;
                    break;
                case 'perlin':
                    displacement = (Math.sin(t) + Math.sin(t * PHI) * 0.5 + Math.sin(t * PHI * PHI) * 0.25) * config.amplitude / 1.75;
                    break;
            }
            
            if (element.position && element.userData.originalPosition) {
                element.position[config.axis] = element.userData.originalPosition[config.axis] + displacement;
            }
        });
    }
}

// ============================================
// THREE.JS SYSTEM
// ============================================

let scene, camera, renderer, clock;
let structures = [];
let harmonicMotion;
let mouseX = 0, mouseY = 0;
let customShaderMaterials = [];

const debug = document.getElementById('debug');
function log(msg) {
    if (debug && debug.style.display !== 'none') debug.innerHTML = msg + '<br>' + debug.innerHTML;
    console.log(msg);
}

function checkThreeJS() {
    if (typeof THREE !== 'undefined') {
        log('Three.js loaded successfully');
        requestAnimationFrame(() => initThreeJS());
    } else {
        log('Waiting for Three.js...');
        setTimeout(checkThreeJS, 100);
    }
}

function initThreeJS() {
    try {
        log('Initializing Three.js...');
        
        clock = new THREE.Clock();
        scene = new THREE.Scene();
        const isDark = document.body.getAttribute('data-theme') === 'dark';
        scene.fog = new THREE.Fog(isDark ? 0x0a0b0f : 0xf0f8ff, 50, 200);
        
        camera = new THREE.PerspectiveCamera(PHI * 45, window.innerWidth / window.innerHeight, PHI_INV, 1000);
        camera.position.set(0, 0, PHI * 30);
        
        const canvas = document.getElementById('three-canvas');
        renderer = new THREE.WebGLRenderer({ 
            canvas: canvas, alpha: true, antialias: window.devicePixelRatio === 1,
            powerPreference: "high-performance", stencil: false, depth: true
        });
        renderer.setSize(window.innerWidth, window.innerHeight);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        
        const ambientLight = new THREE.AmbientLight(0xffffff, PHI_INV);
        scene.add(ambientLight);
        
        const dirLight = new THREE.DirectionalLight(0x7ec8e3, 1);
        dirLight.position.set(PHI * 5, PHI * 5, PHI * 5);
        scene.add(dirLight);
        
        const pointLight = new THREE.PointLight(0xa8d5e8, 0.8, 100);
        pointLight.position.set(-30, -30, 30);
        scene.add(pointLight);
        
        harmonicMotion = new HarmonicMotionSystem();
        createEngineeringStructures();
        
        document.addEventListener('mousemove', onMouseMove, { passive: true });
        window.addEventListener('resize', onWindowResize, { passive: true });
        window.addEventListener('themechange', (e) => updateStructureMaterials(e.detail.theme === 'dark'));
        
        log('Starting Animation...');
        animateThreeJS();
    } catch(error) {
        log('Error: ' + error.message);
        console.error(error);
    }
}

function createIridescentMaterial(hueOffset) {
    hueOffset = hueOffset || 0;
    const isDark = document.body.getAttribute('data-theme') === 'dark';
    const themeHueShift = isDark ? 0.7 : 0;
    const adjustedHue = (hueOffset + themeHueShift) % 1;
    
    const material = new THREE.MeshPhysicalMaterial({
        color: new THREE.Color().setHSL(adjustedHue, 0.8, 0.6),
        metalness: 0.6, roughness: 0.15, clearcoat: 1.0, clearcoatRoughness: 0.0, reflectivity: 0.8,
        emissive: new THREE.Color().setHSL((adjustedHue + 0.5) % 1, 1, 0.2),
        emissiveIntensity: isDark ? 0.4 : 0.3, side: THREE.DoubleSide
    });
    material.userData = { hueOffset: hueOffset };
    return material;
}

function createWireframeMaterial(color) {
    return new THREE.MeshBasicMaterial({
        color: color || 0x7ec8e3, wireframe: true, transparent: true, opacity: 0.4, blending: THREE.AdditiveBlending
    });
}

function createCustomIridescentShader(hueOffset) {
    const isDark = document.body.getAttribute('data-theme') === 'dark';
    return new THREE.ShaderMaterial({
        uniforms: {
            time: { value: 0 },
            hueOffset: { value: hueOffset || 0 },
            isDark: { value: isDark },
            baseColor: { value: new THREE.Color(isDark ? 0x9482ff : 0x7ec8e3) }
        },
        vertexShader: `
            varying vec3 vNormal;
            varying vec3 vViewPosition;
            varying vec2 vUv;
            void main() {
                vUv = uv;
                vNormal = normalize(normalMatrix * normal);
                vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
                vViewPosition = -mvPosition.xyz;
                gl_Position = projectionMatrix * mvPosition;
            }
        `,
        fragmentShader: `
            uniform float time;
            uniform float hueOffset;
            uniform bool isDark;
            uniform vec3 baseColor;
            varying vec3 vNormal;
            varying vec3 vViewPosition;
            varying vec2 vUv;
            
            vec3 hsv2rgb(vec3 c) {
                vec4 K = vec4(1.0, 2.0/3.0, 1.0/3.0, 3.0);
                vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
                return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
            }
            
            void main() {
                vec3 viewDir = normalize(vViewPosition);
                float fresnel = pow(1.0 - abs(dot(vNormal, viewDir)), 3.0);
                float hue = fract(hueOffset + fresnel * 0.5 + time * 0.1);
                vec3 iridescentColor = hsv2rgb(vec3(hue, 0.8, 0.9));
                vec3 finalColor = mix(baseColor, iridescentColor, fresnel * 0.7 + 0.3);
                float glow = isDark ? 0.3 : 0.15;
                finalColor += iridescentColor * glow;
                gl_FragColor = vec4(finalColor, 0.9);
            }
        `,
        transparent: true, side: THREE.DoubleSide
    });
}

// ============================================
// ENGINEERING STRUCTURES
// ============================================

function createEngineeringStructures() {
    log('Creating Engineering Structures...');
    
    const positions = [
        { x: 61.8, y: 38.2, z: -20 }, { x: -38.2, y: -61.8, z: -40 },
        { x: 33.3, y: 66.7, z: -30 }, { x: -66.7, y: 33.3, z: -25 },
        { x: 85.4, y: 85.4, z: -45 }, { x: -85.4, y: -85.4, z: -35 },
        { x: -85.4, y: 85.4, z: -50 }, { x: 85.4, y: -85.4, z: -40 },
        { x: 0, y: 76.4, z: -60 }, { x: -76.4, y: 0, z: -55 },
        { x: 76.4, y: 0, z: -65 }, { x: 0, y: -76.4, z: -70 }, { x: 50, y: -50, z: -80 }
    ];
    
    // 1. Wireframe Gear
    const gearGroup = createWireframeGear();
    gearGroup.position.set(positions[0].x, positions[0].y, positions[0].z);
    gearGroup.userData.originalPosition = gearGroup.position.clone();
    gearGroup.userData.rotationSpeed = 0.02;
    scene.add(gearGroup);
    structures.push(gearGroup);
    harmonicMotion.registerElement(gearGroup, { amplitude: FIBONACCI[4] * 0.5, frequency: 1 / (FIBONACCI[5] * PHI), axis: 'y', pattern: 'sine' });
    
    // 2. Cog Cluster
    const cogCluster = createCogCluster();
    cogCluster.position.set(positions[1].x, positions[1].y, positions[1].z);
    cogCluster.userData.originalPosition = cogCluster.position.clone();
    scene.add(cogCluster);
    structures.push(cogCluster);
    harmonicMotion.registerElement(cogCluster, { amplitude: FIBONACCI[3], frequency: 1 / (FIBONACCI[6] * PHI), axis: 'x', pattern: 'lissajous' });
    
    // 3. Hexagonal Lattice
    const hexLattice = createHexagonalLattice();
    hexLattice.position.set(positions[2].x, positions[2].y, positions[2].z);
    hexLattice.userData.originalPosition = hexLattice.position.clone();
    scene.add(hexLattice);
    structures.push(hexLattice);
    harmonicMotion.registerElement(hexLattice, { amplitude: FIBONACCI[4], frequency: 1 / (FIBONACCI[7] * PHI), axis: 'z', pattern: 'perlin' });
    
    // 4. Swimmer Hand - Realistic scale, closer position
    const swimmerHand = createSwimmerHand();
    swimmerHand.position.set(-35, 20, -10);
    swimmerHand.userData.originalPosition = swimmerHand.position.clone();
    scene.add(swimmerHand);
    structures.push(swimmerHand);
    harmonicMotion.registerElement(swimmerHand, { amplitude: FIBONACCI[2], frequency: 1 / (FIBONACCI[6] * PHI), axis: 'y', pattern: 'sine' });
    
    // 5. Geodesic Sphere
    const geodesic = createGeodesicSphere();
    geodesic.position.set(positions[4].x, positions[4].y, positions[4].z);
    geodesic.userData.originalPosition = geodesic.position.clone();
    scene.add(geodesic);
    structures.push(geodesic);
    harmonicMotion.registerElement(geodesic, { amplitude: FIBONACCI[3], frequency: 1 / (FIBONACCI[5] * PHI), axis: 'y', pattern: 'sine' });
    
    // 6. Circuit Trace (NEW)
    const circuit = createCircuitTrace();
    circuit.position.set(positions[5].x, positions[5].y, positions[5].z);
    circuit.userData.originalPosition = circuit.position.clone();
    scene.add(circuit);
    structures.push(circuit);
    harmonicMotion.registerElement(circuit, { amplitude: FIBONACCI[2], frequency: 1 / (FIBONACCI[6] * PHI), axis: 'z', pattern: 'perlin' });
    
    // 7. Spring Helix
    const spring = createSpringHelix();
    spring.position.set(positions[6].x, positions[6].y, positions[6].z);
    spring.userData.originalPosition = spring.position.clone();
    scene.add(spring);
    structures.push(spring);
    harmonicMotion.registerElement(spring, { amplitude: FIBONACCI[5], frequency: 1 / (FIBONACCI[4] * PHI), axis: 'y', pattern: 'sine' });
    
    // 8. Truss Bridge
    const truss = createTrussBridge();
    truss.position.set(positions[7].x, positions[7].y, positions[7].z);
    truss.userData.originalPosition = truss.position.clone();
    scene.add(truss);
    structures.push(truss);
    harmonicMotion.registerElement(truss, { amplitude: FIBONACCI[3], frequency: 1 / (FIBONACCI[8] * PHI), axis: 'y', pattern: 'sine' });
    
    // 9. Turbine Blade
    const turbine = createTurbineBlade();
    turbine.position.set(positions[8].x, positions[8].y, positions[8].z);
    turbine.userData.originalPosition = turbine.position.clone();
    turbine.userData.rotationSpeed = 0.05;
    scene.add(turbine);
    structures.push(turbine);
    harmonicMotion.registerElement(turbine, { amplitude: FIBONACCI[2], frequency: 1 / (FIBONACCI[6] * PHI), axis: 'x', pattern: 'lissajous' });
    
    // 10. Atomic Model
    const atom = createAtomicModel();
    atom.position.set(positions[9].x, positions[9].y, positions[9].z);
    atom.userData.originalPosition = atom.position.clone();
    scene.add(atom);
    structures.push(atom);
    harmonicMotion.registerElement(atom, { amplitude: FIBONACCI[4], frequency: 1 / (FIBONACCI[7] * PHI), axis: 'z', pattern: 'perlin' });
    
    // 11. Fluid Dynamics (NEW)
    const fluid = createFluidDynamics();
    fluid.position.set(positions[10].x, positions[10].y, positions[10].z);
    fluid.userData.originalPosition = fluid.position.clone();
    scene.add(fluid);
    structures.push(fluid);
    harmonicMotion.registerElement(fluid, { amplitude: FIBONACCI[3], frequency: 1 / (FIBONACCI[5] * PHI), axis: 'x', pattern: 'sine' });
    
    // 12. Cantilever Beam (NEW)
    const cantilever = createCantileverBeam();
    cantilever.position.set(positions[11].x, positions[11].y, positions[11].z);
    cantilever.userData.originalPosition = cantilever.position.clone();
    scene.add(cantilever);
    structures.push(cantilever);
    harmonicMotion.registerElement(cantilever, { amplitude: FIBONACCI[2], frequency: 1 / (FIBONACCI[6] * PHI), axis: 'y', pattern: 'sine' });
    
    // 13. Parametric Surface (NEW)
    const parametric = createParametricSurface();
    parametric.position.set(positions[12].x, positions[12].y, positions[12].z);
    parametric.userData.originalPosition = parametric.position.clone();
    scene.add(parametric);
    structures.push(parametric);
    harmonicMotion.registerElement(parametric, { amplitude: FIBONACCI[4], frequency: 1 / (FIBONACCI[7] * PHI), axis: 'z', pattern: 'perlin' });
    
    log('Created ' + structures.length + ' engineering structures');
}

function createWireframeGear() {
    const group = new THREE.Group();
    const torusGeo = new THREE.TorusGeometry(8, 1.5, 16, 32);
    const torusMat = createWireframeMaterial(0x7ec8e3);
    const torus = new THREE.Mesh(torusGeo, torusMat);
    group.add(torus);
    
    for (let i = 0; i < 12; i++) {
        const angle = (i / 12) * Math.PI * 2;
        const toothGeo = new THREE.BoxGeometry(2, 3, 1.5);
        const tooth = new THREE.Mesh(toothGeo, torusMat);
        tooth.position.x = Math.cos(angle) * 9.5;
        tooth.position.y = Math.sin(angle) * 9.5;
        tooth.rotation.z = angle;
        group.add(tooth);
    }
    
    const hubGeo = new THREE.CylinderGeometry(3, 3, 2, 6);
    const hub = new THREE.Mesh(hubGeo, torusMat);
    hub.rotation.x = Math.PI / 2;
    group.add(hub);
    
    for (let i = 0; i < 6; i++) {
        const angle = (i / 6) * Math.PI * 2;
        const spokeGeo = new THREE.CylinderGeometry(0.3, 0.3, 5, 8);
        const spoke = new THREE.Mesh(spokeGeo, torusMat);
        spoke.position.x = Math.cos(angle) * 4;
        spoke.position.y = Math.sin(angle) * 4;
        spoke.rotation.z = angle + Math.PI / 2;
        group.add(spoke);
    }
    group.userData.type = 'wireframe_gear';
    return group;
}

function createCogCluster() {
    const group = new THREE.Group();
    const gearSizes = [
        { radius: 6, teeth: 8, x: 0, y: 0, speed: 1 },
        { radius: 4, teeth: 6, x: 10, y: 0, speed: -8/6 },
        { radius: 3, teeth: 5, x: 5, y: 7, speed: 8/5 }
    ];
    
    gearSizes.forEach((gear, index) => {
        const gearGroup = new THREE.Group();
        const torusGeo = new THREE.TorusGeometry(gear.radius, gear.radius * 0.2, 12, 24);
        const material = createIridescentMaterial(index / 3);
        const torus = new THREE.Mesh(torusGeo, material);
        gearGroup.add(torus);
        
        for (let i = 0; i < gear.teeth; i++) {
            const angle = (i / gear.teeth) * Math.PI * 2;
            const toothGeo = new THREE.BoxGeometry(1.5, 2, gear.radius * 0.2);
            const tooth = new THREE.Mesh(toothGeo, material);
            tooth.position.x = Math.cos(angle) * (gear.radius + 1);
            tooth.position.y = Math.sin(angle) * (gear.radius + 1);
            tooth.rotation.z = angle;
            gearGroup.add(tooth);
        }
        gearGroup.position.set(gear.x, gear.y, 0);
        gearGroup.userData.rotationSpeed = 0.01 * gear.speed;
        group.add(gearGroup);
    });
    group.userData.type = 'cog_cluster';
    return group;
}

function createHexagonalLattice() {
    const group = new THREE.Group();
    const material = createWireframeMaterial(0xa8d5e8);
    const positions = [
        { x: 0, y: 0 }, { x: 4, y: 0 }, { x: -4, y: 0 },
        { x: 2, y: 3.5 }, { x: -2, y: 3.5 }, { x: 2, y: -3.5 }, { x: -2, y: -3.5 }
    ];
    positions.forEach(pos => {
        const hexGeo = new THREE.CylinderGeometry(2, 2, 3, 6);
        const hex = new THREE.Mesh(hexGeo, material);
        hex.position.set(pos.x, pos.y, 0);
        hex.rotation.x = Math.PI / 2;
        group.add(hex);
    });
    group.userData.type = 'hexagonal_lattice';
    return group;
}

// ============================================
// SWIMMER HAND - LARGE ORGANIC WIREFRAME MODEL
// Anatomically accurate with flowing organic geometry
// ============================================

function createSwimmerHand() {
    const group = new THREE.Group();
    const isDark = document.body.getAttribute('data-theme') === 'dark';
    
    // ============================================
    // SCALE - Realistic human hand proportions
    // ============================================
    
    const S = 0.72; // Moderate scale - realistic size
    
    // Anatomical measurements - true human proportions
    // Average adult hand: palm ~10cm long, ~8.5cm wide
    const PALM = {
        width: 6.5 * S,      // ~4.7 units wide
        length: 7.5 * S,     // ~5.4 units long
        thickness: 2.0 * S   // ~1.4 units thick (realistic)
    };
    
    const WRIST = {
        width: 4.5 * S,
        depth: 2.4 * S,
        length: 2.2 * S
    };
    
    // Finger data: realistic human proportions
    // Proximal:middle:distal ratio roughly 1.0:0.6:0.45
    const FINGER_DATA = {
        index:  { len: [2.8, 1.7, 1.3], w: 0.95, ax: -0.30, ay: 0.48, spr: 0.05 },
        middle: { len: [3.2, 1.9, 1.4], w: 1.0,  ax: -0.04, ay: 0.50, spr: 0.0 },
        ring:   { len: [3.0, 1.8, 1.35], w: 0.95, ax: 0.20, ay: 0.47, spr: -0.04 },
        pinky:  { len: [2.2, 1.3, 1.0], w: 0.78, ax: 0.42, ay: 0.38, spr: -0.09 }
    };
    
    const THUMB_DATA = {
        metacarpal: 2.0,
        proximal: 2.2,
        distal: 1.7,
        width: 1.15,
        pos: [-0.48, -0.15],
        rot: [0.32, -0.48, 0.82]
    };
    
    // ============================================
    // MATERIALS - Clean, subtle wireframe aesthetic
    // ============================================
    
    const COL = {
        main: isDark ? 0x6AB8D0 : 0x5AA8C0,
        light: isDark ? 0x8AD0E8 : 0x7AC0D8,
        dim: isDark ? 0x4A9098 : 0x3A8088,
        glow: isDark ? 0x5AA8B8 : 0x4A98A8,
        accent: isDark ? 0x9AE0F0 : 0x8AD0E0
    };
    
    // Primary wireframe
    const matMain = new THREE.MeshBasicMaterial({
        color: COL.main, wireframe: true, transparent: true, opacity: 0.85
    });
    
    // Secondary wireframe - accent details
    const matLight = new THREE.MeshBasicMaterial({
        color: COL.light, wireframe: true, transparent: true, opacity: 0.65
    });
    
    // Dim wireframe for subtle features
    const matDim = new THREE.MeshBasicMaterial({
        color: COL.dim, wireframe: true, transparent: true, opacity: 0.40
    });
    
    // Subtle glow material for accents
    const matGlow = new THREE.MeshBasicMaterial({
        color: COL.glow, transparent: true, opacity: 0.18,
        blending: THREE.AdditiveBlending
    });
    
    // Semi-solid for organic feel - very subtle
    const matFlesh = new THREE.MeshPhysicalMaterial({
        color: COL.main,
        metalness: 0.1,
        roughness: 0.7,
        transparent: true,
        opacity: 0.22,
        emissive: new THREE.Color(COL.glow),
        emissiveIntensity: isDark ? 0.08 : 0.04
    });
    
    const allMaterials = [matMain, matLight, matDim, matGlow, matFlesh];
    
    // ============================================
    // ORGANIC GEOMETRY FUNCTIONS - High polygon count
    // ============================================
    
    // Smooth organic cross-section using superellipse
    function superellipse(angle, rx, rz, n) {
        n = n || 2.2;
        const c = Math.cos(angle);
        const s = Math.sin(angle);
        const sc = Math.sign(c) * Math.pow(Math.abs(c), 2/n);
        const ss = Math.sign(s) * Math.pow(Math.abs(s), 2/n);
        return { x: rx * sc, z: rz * ss };
    }
    
    // Smooth interpolation
    function smoothstep(x) {
        return x * x * (3 - 2 * x);
    }
    
    // Create organic finger bone with flowing curves - HIGH POLY
    function createBone(length, wBase, wTip, isDistal) {
        const radSegs = 16; // More segments for smoother curves
        const hSegs = 14;   // More height segments
        const verts = [], inds = [], uvs = [];
        
        for (let h = 0; h <= hSegs; h++) {
            const t = h / hSegs;
            const y = t * length;
            
            // Organic width interpolation with natural curve
            const tSmooth = smoothstep(t);
            const w = wBase + (wTip - wBase) * tSmooth;
            
            // Natural joint bulges - organic swelling at ends
            let bulge = 1.0;
            if (t < 0.18) {
                const bT = 1 - t / 0.18;
                bulge = 1.0 + Math.pow(bT, 1.8) * 0.18;
            } else if (t > 0.82 && !isDistal) {
                const bT = (t - 0.82) / 0.18;
                bulge = 1.0 + Math.pow(bT, 1.8) * 0.14;
            }
            
            // Natural tapering curve
            const taperCurve = 1.0 - Math.pow(t, 2.5) * 0.08;
            
            for (let s = 0; s <= radSegs; s++) {
                const u = s / radSegs;
                const ang = u * Math.PI * 2;
                const sin = Math.sin(ang);
                const cos = Math.cos(ang);
                
                // Organic radii - wider than deep
                let rx = w * 0.52 * bulge * taperCurve;
                let rz = w * 0.44 * bulge * taperCurve;
                
                // Palm-side flattening (organic flesh compression)
                if (sin > 0.15) {
                    const flat = Math.pow(sin - 0.15, 1.2) * 0.22;
                    rz *= 1.0 - flat;
                }
                
                // Dorsal convexity (back of finger rounds out)
                if (sin < -0.15) {
                    const curve = Math.pow(-sin - 0.15, 1.5) * 0.18;
                    rz *= 1.0 + curve;
                }
                
                // Lateral organic compression
                if (Math.abs(cos) > 0.65) {
                    const squeeze = (Math.abs(cos) - 0.65) * 0.14;
                    rx *= 1.0 - squeeze;
                }
                
                // Natural twist along length
                const twist = t * 0.05 * sin;
                
                const pt = superellipse(ang, rx, rz, 2.3);
                verts.push(pt.x + twist, y, pt.z);
                uvs.push(u, t);
            }
        }
        
        // Generate smooth triangle indices
        for (let h = 0; h < hSegs; h++) {
            for (let s = 0; s < radSegs; s++) {
                const a = h * (radSegs + 1) + s;
                const b = a + 1;
                const c = a + radSegs + 1;
                const d = c + 1;
                inds.push(a, b, c, b, d, c);
            }
        }
        
        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
        geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
        geo.setIndex(inds);
        geo.computeVertexNormals();
        return geo;
    }
    
    // Organic fingertip with natural rounded nail bed - HIGH POLY
    function createTip(length, width) {
        const radSegs = 16;
        const hSegs = 16; // Extra segments for smooth tip
        const verts = [], inds = [], uvs = [];
        
        for (let h = 0; h <= hSegs; h++) {
            const t = h / hSegs;
            const y = t * length;
            
            // Organic taper with hemispherical end
            let taper = 1.0 - t * 0.28;
            if (t > 0.55) {
                const tipT = (t - 0.55) / 0.45;
                // Smooth hemisphere transition
                taper *= Math.sqrt(Math.max(0.01, 1 - tipT * tipT * 0.92));
            }
            
            const w = width * Math.max(0.12, taper);
            
            for (let s = 0; s <= radSegs; s++) {
                const u = s / radSegs;
                const ang = u * Math.PI * 2;
                const sin = Math.sin(ang);
                const cos = Math.cos(ang);
                
                let rx = w * 0.50;
                let rz = w * 0.42;
                
                // Palm side compression
                if (sin > 0.12) {
                    rz *= 1.0 - (sin - 0.12) * 0.20;
                }
                
                // Nail bed - flatter on dorsal side near tip
                if (sin < -0.3 && t > 0.15 && t < 0.80) {
                    rz *= 0.90;
                    // Slight ridge for nail
                    if (t > 0.25 && t < 0.70) {
                        rz *= 0.95;
                    }
                }
                
                // Dorsal convexity
                if (sin < -0.15) {
                    rz *= 1.0 + (-sin - 0.15) * 0.14;
                }
                
                // Tip rounds in all directions
                if (t > 0.75) {
                    const roundT = (t - 0.75) / 0.25;
                    rx *= 1.0 - roundT * 0.3;
                    rz *= 1.0 - roundT * 0.25;
                }
                
                const pt = superellipse(ang, rx, rz, 2.2);
                verts.push(pt.x, y, pt.z);
                uvs.push(u, t);
            }
        }
        
        for (let h = 0; h < hSegs; h++) {
            for (let s = 0; s < radSegs; s++) {
                const a = h * (radSegs + 1) + s;
                const b = a + 1;
                const c = a + radSegs + 1;
                const d = c + 1;
                inds.push(a, b, c, b, d, c);
            }
        }
        
        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
        geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
        geo.setIndex(inds);
        geo.computeVertexNormals();
        return geo;
    }
    
    // Organic ellipsoid joint - more anatomical
    function createJoint(radius) {
        const geo = new THREE.SphereGeometry(radius, 14, 12);
        const pos = geo.attributes.position;
        for (let i = 0; i < pos.count; i++) {
            const x = pos.getX(i);
            const y = pos.getY(i);
            const z = pos.getZ(i);
            // Anatomical joint shape - wider, compressed vertically
            pos.setX(i, x * 1.28);
            pos.setY(i, y * 0.55);
            pos.setZ(i, z * 0.92);
        }
        geo.computeVertexNormals();
        return geo;
    }
    
    // Organic fingernail with natural curvature
    function createNail(width, length) {
        const wS = 10, lS = 8;
        const verts = [], inds = [], uvs = [];
        
        for (let l = 0; l <= lS; l++) {
            const v = l / lS;
            const y = v * length;
            // Natural nail width taper
            const wMod = v < 0.3 ? 0.92 + v * 0.27 : 1.0 - (v - 0.3) * 0.22;
            const w = width * wMod;
            
            for (let ws = 0; ws <= wS; ws++) {
                const u = ws / wS;
                const x = (u - 0.5) * w;
                // Natural nail curvature - wraps around finger
                const curve = Math.cos(u * Math.PI) * 0.14 * width;
                // Slight lift at edges
                const lift = Math.pow(Math.abs(u - 0.5) * 2, 2) * 0.03 * width;
                verts.push(x, y, -curve - lift - 0.02 * width);
                uvs.push(u, v);
            }
        }
        
        for (let l = 0; l < lS; l++) {
            for (let ws = 0; ws < wS; ws++) {
                const a = l * (wS + 1) + ws;
                const b = a + 1;
                const c = a + wS + 1;
                const d = c + 1;
                inds.push(a, b, c, b, d, c);
            }
        }
        
        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
        geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
        geo.setIndex(inds);
        geo.computeVertexNormals();
        return geo;
    }
    
    // ============================================
    // BUILD FINGER - Organic flowing construction
    // ============================================
    
    function buildFinger(data, name) {
        const fg = new THREE.Group();
        const lens = data.len.map(l => l * S);
        const w = data.w * S;
        
        let y = 0;
        
        // Proximal phalanx - base of finger
        const proxGeo = createBone(lens[0], w, w * 0.88, false);
        const proxMain = new THREE.Mesh(proxGeo, matMain.clone());
        fg.add(proxMain);
        
        // Secondary wireframe layer for depth
        const proxWire = new THREE.Mesh(proxGeo.clone(), matLight.clone());
        proxWire.scale.set(1.02, 1, 1.02);
        fg.add(proxWire);
        
        // Inner flesh glow
        const proxFlesh = new THREE.Mesh(proxGeo.clone(), matFlesh.clone());
        proxFlesh.scale.set(0.92, 0.98, 0.92);
        fg.add(proxFlesh);
        
        y += lens[0];
        
        // PIP joint - larger, more organic
        const pipGeo = createJoint(w * 0.42);
        const pip = new THREE.Mesh(pipGeo, matLight.clone());
        pip.position.y = y;
        fg.add(pip);
        
        // Joint glow
        const pipGlow = new THREE.Mesh(pipGeo.clone(), matGlow.clone());
        pipGlow.position.y = y;
        pipGlow.scale.set(1.15, 1.1, 1.15);
        fg.add(pipGlow);
        
        y += w * 0.22;
        
        // Middle phalanx
        const midGeo = createBone(lens[1], w * 0.88, w * 0.80, false);
        const mid = new THREE.Mesh(midGeo, matMain.clone());
        mid.position.y = y;
        fg.add(mid);
        
        const midWire = new THREE.Mesh(midGeo.clone(), matLight.clone());
        midWire.position.y = y;
        midWire.scale.set(1.02, 1, 1.02);
        fg.add(midWire);
        
        const midFlesh = new THREE.Mesh(midGeo.clone(), matFlesh.clone());
        midFlesh.position.y = y;
        midFlesh.scale.set(0.92, 0.98, 0.92);
        fg.add(midFlesh);
        
        y += lens[1];
        
        // DIP joint
        const dipGeo = createJoint(w * 0.36);
        const dip = new THREE.Mesh(dipGeo, matLight.clone());
        dip.position.y = y;
        fg.add(dip);
        
        const dipGlow = new THREE.Mesh(dipGeo.clone(), matGlow.clone());
        dipGlow.position.y = y;
        dipGlow.scale.set(1.15, 1.1, 1.15);
        fg.add(dipGlow);
        
        y += w * 0.18;
        
        // Distal phalanx (fingertip) - uses tip geometry
        const tipGeo = createTip(lens[2], w * 0.80);
        const tip = new THREE.Mesh(tipGeo, matMain.clone());
        tip.position.y = y;
        fg.add(tip);
        
        const tipWire = new THREE.Mesh(tipGeo.clone(), matLight.clone());
        tipWire.position.y = y;
        tipWire.scale.set(1.02, 1, 1.02);
        fg.add(tipWire);
        
        const tipFlesh = new THREE.Mesh(tipGeo.clone(), matFlesh.clone());
        tipFlesh.position.y = y;
        tipFlesh.scale.set(0.92, 0.98, 0.92);
        fg.add(tipFlesh);
        
        // Fingernail
        const nailGeo = createNail(w * 0.55, lens[2] * 0.58);
        const nail = new THREE.Mesh(nailGeo, matLight.clone());
        nail.position.set(0, y + lens[2] * 0.26, -w * 0.32);
        fg.add(nail);
        
        // Dorsal tendon - visible through skin
        const tenPts = [];
        const totalL = lens[0] + lens[1] + lens[2] + w * 0.40;
        for (let i = 0; i <= 16; i++) {
            const t = i / 16;
            const wave = Math.sin(t * Math.PI * 2) * 0.02 * w;
            tenPts.push(new THREE.Vector3(wave, t * totalL, -w * (0.40 - t * 0.08)));
        }
        const tenCurve = new THREE.CatmullRomCurve3(tenPts);
        const tenGeo = new THREE.TubeGeometry(tenCurve, 20, w * 0.032, 6, false);
        fg.add(new THREE.Mesh(tenGeo, matDim.clone()));
        
        // Skin creases at joints - more natural
        const creaseY = [lens[0] * 0.94, lens[0] + w * 0.22 + lens[1] * 0.94];
        creaseY.forEach((cy, idx) => {
            // Double crease for realism
            for (let c = 0; c < 2; c++) {
                const creaseGeo = new THREE.TorusGeometry(w * 0.44, S * 0.022, 5, 20, Math.PI * 0.85);
                const crease = new THREE.Mesh(creaseGeo, matDim.clone());
                crease.position.set(0, cy - c * S * 0.08, w * 0.28);
                crease.rotation.x = Math.PI / 2;
                crease.rotation.z = (c - 0.5) * 0.1;
                fg.add(crease);
            }
        });
        
        // Side skin folds at joints
        creaseY.forEach(cy => {
            [-1, 1].forEach(side => {
                const foldGeo = new THREE.TorusGeometry(w * 0.25, S * 0.018, 4, 12, Math.PI * 0.6);
                const fold = new THREE.Mesh(foldGeo, matDim.clone());
                fold.position.set(side * w * 0.35, cy, w * 0.08);
                fold.rotation.y = side * Math.PI / 2;
                fold.rotation.x = Math.PI / 3;
                fg.add(fold);
            });
        });
        
        fg.userData = { name: name, totalLength: totalL, baseWidth: w };
        return fg;
    }
    
    // ============================================
    // BUILD THUMB - Organic opposing digit
    // ============================================
    
    function buildThumb() {
        const tg = new THREE.Group();
        const TD = THUMB_DATA;
        const meta = TD.metacarpal * S;
        const prox = TD.proximal * S;
        const dist = TD.distal * S;
        const w = TD.width * S;
        
        let y = 0;
        
        // Metacarpal bone
        const metaGeo = createBone(meta, w * 1.15, w * 0.95, false);
        tg.add(new THREE.Mesh(metaGeo, matMain.clone()));
        
        const metaWire = new THREE.Mesh(metaGeo.clone(), matLight.clone());
        metaWire.scale.set(1.02, 1, 1.02);
        tg.add(metaWire);
        
        const metaFlesh = new THREE.Mesh(metaGeo.clone(), matFlesh.clone());
        metaFlesh.scale.set(0.92, 0.98, 0.92);
        tg.add(metaFlesh);
        
        y += meta;
        
        // MCP joint (knuckle)
        const mcpGeo = createJoint(w * 0.48);
        const mcp = new THREE.Mesh(mcpGeo, matLight.clone());
        mcp.position.y = y;
        tg.add(mcp);
        
        const mcpGlow = new THREE.Mesh(mcpGeo.clone(), matGlow.clone());
        mcpGlow.position.y = y;
        mcpGlow.scale.set(1.18, 1.1, 1.18);
        tg.add(mcpGlow);
        
        y += w * 0.24;
        
        // Proximal phalanx
        const proxGeo = createBone(prox, w * 0.95, w * 0.85, false);
        const proxM = new THREE.Mesh(proxGeo, matMain.clone());
        proxM.position.y = y;
        tg.add(proxM);
        
        const proxWire = new THREE.Mesh(proxGeo.clone(), matLight.clone());
        proxWire.position.y = y;
        proxWire.scale.set(1.02, 1, 1.02);
        tg.add(proxWire);
        
        const proxFlesh = new THREE.Mesh(proxGeo.clone(), matFlesh.clone());
        proxFlesh.position.y = y;
        proxFlesh.scale.set(0.92, 0.98, 0.92);
        tg.add(proxFlesh);
        
        y += prox;
        
        // IP joint
        const ipGeo = createJoint(w * 0.40);
        const ip = new THREE.Mesh(ipGeo, matLight.clone());
        ip.position.y = y;
        tg.add(ip);
        
        const ipGlow = new THREE.Mesh(ipGeo.clone(), matGlow.clone());
        ipGlow.position.y = y;
        ipGlow.scale.set(1.15, 1.1, 1.15);
        tg.add(ipGlow);
        
        y += w * 0.20;
        
        // Distal phalanx (thumb tip)
        const tipGeo = createTip(dist, w * 0.85);
        const tipM = new THREE.Mesh(tipGeo, matMain.clone());
        tipM.position.y = y;
        tg.add(tipM);
        
        const tipWire = new THREE.Mesh(tipGeo.clone(), matLight.clone());
        tipWire.position.y = y;
        tipWire.scale.set(1.02, 1, 1.02);
        tg.add(tipWire);
        
        const tipFlesh = new THREE.Mesh(tipGeo.clone(), matFlesh.clone());
        tipFlesh.position.y = y;
        tipFlesh.scale.set(0.92, 0.98, 0.92);
        tg.add(tipFlesh);
        
        // Thumbnail - larger
        const nailGeo = createNail(w * 0.62, dist * 0.58);
        const nail = new THREE.Mesh(nailGeo, matLight.clone());
        nail.position.set(0, y + dist * 0.24, -w * 0.38);
        tg.add(nail);
        
        // Thenar muscle bulge - larger, more organic
        const thenarGeo = new THREE.SphereGeometry(w * 0.72, 14, 12);
        const thenarPos = thenarGeo.attributes.position;
        for (let i = 0; i < thenarPos.count; i++) {
            const x = thenarPos.getX(i);
            const y = thenarPos.getY(i);
            const z = thenarPos.getZ(i);
            // Organic muscle shape
            thenarPos.setX(i, x * 1.65);
            thenarPos.setY(i, y * 0.55);
            thenarPos.setZ(i, z * 1.35);
        }
        thenarGeo.computeVertexNormals();
        
        const thenar = new THREE.Mesh(thenarGeo, matDim.clone());
        thenar.position.set(w * 0.60, w * 0.45, w * 0.38);
        tg.add(thenar);
        
        // Thenar glow
        const thenarGlow = new THREE.Mesh(thenarGeo.clone(), matGlow.clone());
        thenarGlow.position.copy(thenar.position);
        thenarGlow.scale.set(1.1, 1.1, 1.1);
        tg.add(thenarGlow);
        
        // Skin crease at IP joint
        const creaseGeo = new THREE.TorusGeometry(w * 0.48, S * 0.024, 5, 20, Math.PI * 0.85);
        const crease = new THREE.Mesh(creaseGeo, matDim.clone());
        crease.position.set(0, prox + meta + w * 0.24 - S * 0.05, w * 0.30);
        crease.rotation.x = Math.PI / 2;
        tg.add(crease);
        
        return tg;
    }
    
    // ============================================
    // BUILD PALM - High-poly organic palm
    // ============================================
    
    function buildPalm() {
        const pg = new THREE.Group();
        const uS = 32; // High segment count for smooth curves
        const vS = 24;
        const verts = [], inds = [], uvs = [];
        
        for (let v = 0; v <= vS; v++) {
            const vt = v / vS;
            const y = (vt - 0.5) * PALM.length;
            
            // Organic width transition: narrower wrist, wider knuckles
            const wCurve = smoothstep(vt);
            const wFactor = 0.75 + wCurve * 0.25;
            
            for (let u = 0; u <= uS; u++) {
                const ut = u / uS;
                const ang = ut * Math.PI * 2;
                const cos = Math.cos(ang);
                const sin = Math.sin(ang);
                
                let rx = PALM.width * 0.5 * wFactor;
                let rz = PALM.thickness * 0.5;
                
                // === ORGANIC MUSCLE BULGES ===
                
                // Thenar eminence (thumb muscle pad) - large, flowing
                const thCenterU = 0.16;
                const thCenterV = 0.38;
                const thDistU = Math.min(Math.abs(ut - thCenterU), Math.abs(ut - thCenterU + 1), Math.abs(ut - thCenterU - 1));
                const thDistV = Math.abs(vt - thCenterV);
                const thDist = Math.sqrt(thDistU * thDistU * 5 + thDistV * thDistV * 4);
                
                if (thDist < 0.55 && sin > -0.18) {
                    const intensity = Math.pow(1 - thDist / 0.55, 1.6);
                    const bulge = intensity * 0.48 * PALM.thickness;
                    rz += bulge * Math.max(0.12, sin + 0.18);
                    rx += bulge * 0.35 * Math.max(0, -cos);
                }
                
                // Hypothenar eminence (pinky pad) - smaller but prominent
                const hyDistU = Math.min(Math.abs(ut - 0.84), Math.abs(ut - 0.84 + 1));
                const hyDistV = Math.abs(vt - 0.40);
                const hyDist = Math.sqrt(hyDistU * hyDistU * 5 + hyDistV * hyDistV * 4);
                
                if (hyDist < 0.45 && sin > -0.12) {
                    const intensity = Math.pow(1 - hyDist / 0.45, 1.5);
                    const bulge = intensity * 0.35 * PALM.thickness;
                    rz += bulge * Math.max(0.1, sin + 0.12);
                    rx += bulge * 0.25 * Math.max(0, cos);
                }
                
                // Central palm hollow (cup of hand)
                if (sin > 0.30 && vt > 0.22 && vt < 0.75) {
                    const centeredness = Math.pow(1 - Math.abs(cos), 1.3);
                    const lengthFac = 1 - Math.pow(Math.abs(vt - 0.48) / 0.27, 2);
                    const hollow = sin * centeredness * lengthFac * 0.16 * PALM.thickness;
                    rz -= Math.max(0, hollow);
                }
                
                // Metacarpal ridges on back (visible bone structure)
                if (sin < -0.32 && vt > 0.42) {
                    const backness = -sin - 0.32;
                    for (let f = 0; f < 4; f++) {
                        const ridgeU = 0.28 + f * 0.14;
                        const ridgeDist = Math.min(
                            Math.abs(ut - ridgeU),
                            Math.abs(ut - ridgeU + 1),
                            Math.abs(ut - ridgeU - 1)
                        );
                        if (ridgeDist < 0.05) {
                            const ridgeStr = Math.pow(1 - ridgeDist / 0.05, 1.4);
                            rz -= ridgeStr * backness * 0.12 * PALM.thickness * (vt - 0.42) / 0.58;
                        }
                    }
                }
                
                // Knuckle arch at top
                if (vt > 0.88) {
                    const archT = (vt - 0.88) / 0.12;
                    const archShape = Math.sin((ut - 0.28) * Math.PI / 0.44);
                    if (ut > 0.28 && ut < 0.72) {
                        rz -= archT * archShape * 0.08 * PALM.thickness;
                    }
                }
                
                const pt = superellipse(ang, rx, rz, 2.4);
                verts.push(pt.x, y, pt.z);
                uvs.push(ut, vt);
            }
        }
        
        // Generate indices
        for (let v = 0; v < vS; v++) {
            for (let u = 0; u < uS; u++) {
                const a = v * (uS + 1) + u;
                const b = a + 1;
                const c = a + uS + 1;
                const d = c + 1;
                inds.push(a, b, c, b, d, c);
            }
        }
        
        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
        geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
        geo.setIndex(inds);
        geo.computeVertexNormals();
        
        // Primary wireframe
        pg.add(new THREE.Mesh(geo, matMain.clone()));
        
        // Secondary wireframe for depth
        const pgWire = new THREE.Mesh(geo.clone(), matLight.clone());
        pgWire.scale.set(1.018, 1, 1.018);
        pg.add(pgWire);
        
        // Inner flesh glow
        const pgFlesh = new THREE.Mesh(geo.clone(), matFlesh.clone());
        pgFlesh.scale.set(0.94, 0.98, 0.94);
        pg.add(pgFlesh);
        
        // === PALM CREASES - Organic flowing lines ===
        const creases = [
            // Heart line (upper transverse crease)
            [[-.40, .14], [-.22, .22], [.02, .22], [.24, .16], [.38, .08]],
            // Head line (middle crease)
            [[-.42, -.04], [-.18, .04], [.08, .02], [.28, -.04], [.40, -.14]],
            // Life line (curves around thenar)
            [[-.38, .22], [-.35, .08], [-.32, -.12], [-.28, -.32], [-.22, -.46]]
        ];
        
        creases.forEach((cr, idx) => {
            const pts = cr.map(p => new THREE.Vector3(
                p[0] * PALM.width * 0.95,
                p[1] * PALM.length * 0.95,
                PALM.thickness * 0.50
            ));
            const curve = new THREE.CatmullRomCurve3(pts);
            const creaseGeo = new THREE.TubeGeometry(curve, 18, S * 0.028, 5, false);
            pg.add(new THREE.Mesh(creaseGeo, matDim.clone()));
            
            // Double line for deeper creases
            if (idx < 2) {
                const pts2 = cr.map(p => new THREE.Vector3(
                    p[0] * PALM.width * 0.95 + S * 0.03,
                    p[1] * PALM.length * 0.95 - S * 0.02,
                    PALM.thickness * 0.49
                ));
                const curve2 = new THREE.CatmullRomCurve3(pts2);
                const creaseGeo2 = new THREE.TubeGeometry(curve2, 14, S * 0.018, 4, false);
                pg.add(new THREE.Mesh(creaseGeo2, matDim.clone()));
            }
        });
        
        // Finger creases at knuckles
        for (let f = 0; f < 4; f++) {
            const fx = (-0.28 + f * 0.185) * PALM.width;
            const fy = 0.44 * PALM.length;
            const creaseGeo = new THREE.TorusGeometry(S * 0.55, S * 0.022, 5, 16, Math.PI * 0.75);
            const crease = new THREE.Mesh(creaseGeo, matDim.clone());
            crease.position.set(fx, fy, PALM.thickness * 0.48);
            crease.rotation.x = Math.PI / 2;
            pg.add(crease);
        }
        
        return pg;
    }
    
    // ============================================
    // BUILD WRIST
    // ============================================
    
    // ============================================
    // BUILD WRIST - Organic forearm transition
    // ============================================
    
    function buildWrist() {
        const wg = new THREE.Group();
        const uS = 24; // Higher segments for smooth curves
        const vS = 14;
        const verts = [], inds = [], uvs = [];
        
        for (let v = 0; v <= vS; v++) {
            const vt = v / vS;
            const y = -vt * WRIST.length;
            
            // Organic taper from palm to forearm
            const taperCurve = smoothstep(vt);
            const taper = 0.92 + (1 - taperCurve) * 0.08;
            
            for (let u = 0; u <= uS; u++) {
                const ut = u / uS;
                const ang = ut * Math.PI * 2;
                const sin = Math.sin(ang);
                
                let rx = WRIST.width * 0.5 * taper;
                let rz = WRIST.depth * 0.5 * taper;
                
                // Ulnar styloid (pinky side) - prominent bone bump
                const ulnarDist = Math.min(Math.abs(ut - 0.76), Math.abs(ut - 0.76 + 1));
                if (ulnarDist < 0.12 && vt < 0.50) {
                    const bumpStr = Math.pow(1 - ulnarDist / 0.12, 1.5) * Math.pow(1 - vt / 0.50, 1.3);
                    rx += bumpStr * 0.15 * WRIST.width;
                }
                
                // Radial styloid (thumb side)
                const radialDist = Math.min(Math.abs(ut - 0.24), Math.abs(ut - 0.24 + 1));
                if (radialDist < 0.10 && vt < 0.40) {
                    const bumpStr = Math.pow(1 - radialDist / 0.10, 1.4) * Math.pow(1 - vt / 0.40, 1.2);
                    rx += bumpStr * 0.12 * WRIST.width;
                }
                
                // Flexor tendons on palm side
                if (sin > 0.25 && vt > 0.20) {
                    const tendonBulge = (sin - 0.25) * 0.08 * WRIST.depth;
                    rz += tendonBulge;
                }
                
                // Back of wrist - flatter
                if (sin < -0.20) {
                    rz *= 0.95 + sin * 0.05;
                }
                
                const pt = superellipse(ang, rx, rz, 2.35);
                verts.push(pt.x, y, pt.z);
                uvs.push(ut, vt);
            }
        }
        
        for (let v = 0; v < vS; v++) {
            for (let u = 0; u < uS; u++) {
                const a = v * (uS + 1) + u;
                const b = a + 1;
                const c = a + uS + 1;
                const d = c + 1;
                inds.push(a, b, c, b, d, c);
            }
        }
        
        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
        geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
        geo.setIndex(inds);
        geo.computeVertexNormals();
        
        // Primary wireframe
        wg.add(new THREE.Mesh(geo, matMain.clone()));
        
        // Secondary wireframe
        const wgWire = new THREE.Mesh(geo.clone(), matLight.clone());
        wgWire.scale.set(1.02, 1, 1.02);
        wg.add(wgWire);
        
        // Inner flesh
        const wgFlesh = new THREE.Mesh(geo.clone(), matFlesh.clone());
        wgFlesh.scale.set(0.94, 0.98, 0.94);
        wg.add(wgFlesh);
        
        // Wrist creases - more organic
        for (let i = 0; i < 3; i++) {
            const cGeo = new THREE.TorusGeometry(
                WRIST.width * 0.42 + i * S * 0.06,
                S * 0.024, 5, 24, Math.PI * 1.15
            );
            const c = new THREE.Mesh(cGeo, matDim.clone());
            c.position.set(0, -WRIST.length * (0.18 + i * 0.28), WRIST.depth * 0.35);
            c.rotation.x = Math.PI / 2;
            c.rotation.z = -Math.PI * 0.06 + i * 0.02;
            wg.add(c);
        }
        
        // Extensor tendons on back - more visible
        for (let t = 0; t < 4; t++) {
            const pts = [];
            const xOff = (-0.30 + t * 0.20) * WRIST.width;
            for (let i = 0; i <= 10; i++) {
                const vt = i / 10;
                const wave = Math.sin(vt * Math.PI) * S * 0.04;
                pts.push(new THREE.Vector3(
                    xOff + wave * (t % 2 ? 1 : -1),
                    -vt * WRIST.length * 1.08,
                    -WRIST.depth * 0.42
                ));
            }
            const curve = new THREE.CatmullRomCurve3(pts);
            const tenGeo = new THREE.TubeGeometry(curve, 14, S * 0.028, 5, false);
            wg.add(new THREE.Mesh(tenGeo, matDim.clone()));
        }
        
        // Ulna and radius hints on sides
        [-1, 1].forEach((side, idx) => {
            const bonePts = [];
            for (let i = 0; i <= 8; i++) {
                const vt = i / 8;
                bonePts.push(new THREE.Vector3(
                    side * WRIST.width * (0.38 + vt * 0.05),
                    -vt * WRIST.length * 0.95,
                    0
                ));
            }
            const boneCurve = new THREE.CatmullRomCurve3(bonePts);
            const boneGeo = new THREE.TubeGeometry(boneCurve, 12, S * 0.035, 5, false);
            wg.add(new THREE.Mesh(boneGeo, matDim.clone()));
        });
        
        wg.position.y = -PALM.length * 0.5;
        return wg;
    }
    
    // ============================================
    // ASSEMBLE HAND
    // ============================================
    
    // Palm
    const palm = buildPalm();
    group.add(palm);
    
    // Wrist
    const wrist = buildWrist();
    group.add(wrist);
    
    // Fingers
    const fingers = {};
    
    Object.keys(FINGER_DATA).forEach(name => {
        const fd = FINGER_DATA[name];
        const finger = buildFinger(fd, name);
        
        // MCP joint (knuckle) - larger, with glow
        const mcpGeo = createJoint(fd.w * S * 0.48);
        const mcp = new THREE.Mesh(mcpGeo, matLight.clone());
        mcp.position.set(fd.ax * PALM.width, fd.ay * PALM.length, 0);
        group.add(mcp);
        
        // MCP glow
        const mcpGlow = new THREE.Mesh(mcpGeo.clone(), matGlow.clone());
        mcpGlow.position.copy(mcp.position);
        mcpGlow.scale.set(1.2, 1.15, 1.2);
        group.add(mcpGlow);
        
        // Position finger
        finger.position.set(
            fd.ax * PALM.width,
            fd.ay * PALM.length + fd.w * S * 0.25,
            0
        );
        
        // Set initial rotation and store base values for animation
        const baseRotX = -0.06; // Slight natural curl
        const baseRotY = 0;
        const baseRotZ = fd.spr;
        
        finger.rotation.set(baseRotX, baseRotY, baseRotZ);
        finger.userData.baseRotX = baseRotX;
        finger.userData.baseRotY = baseRotY;
        finger.userData.baseRotZ = baseRotZ;
        
        fingers[name] = finger;
        group.add(finger);
    });
    
    // Thumb
    const thumb = buildThumb();
    thumb.position.set(
        THUMB_DATA.pos[0] * PALM.width,
        THUMB_DATA.pos[1] * PALM.length,
        PALM.thickness * 0.18
    );
    
    // Set thumb rotation and store base values
    const thumbRotX = THUMB_DATA.rot[0];
    const thumbRotY = THUMB_DATA.rot[1];
    const thumbRotZ = THUMB_DATA.rot[2];
    
    thumb.rotation.set(thumbRotX, thumbRotY, thumbRotZ);
    thumb.userData.baseRotX = thumbRotX;
    thumb.userData.baseRotY = thumbRotY;
    thumb.userData.baseRotZ = thumbRotZ;
    
    fingers['thumb'] = thumb;
    group.add(thumb);
    
    // Knuckle prominences - larger, more anatomical
    const knuckleX = [-0.28, -0.02, 0.22, 0.44];
    knuckleX.forEach((xf, idx) => {
        const kGeo = createJoint(S * 0.38);
        const k = new THREE.Mesh(kGeo, matLight.clone());
        k.position.set(xf * PALM.width, PALM.length * 0.47, -PALM.thickness * 0.38);
        k.scale.set(1.35, 0.48, 0.85);
        group.add(k);
        
        // Knuckle glow
        const kGlow = new THREE.Mesh(kGeo.clone(), matGlow.clone());
        kGlow.position.copy(k.position);
        kGlow.scale.set(1.45, 0.55, 0.95);
        group.add(kGlow);
    });
    
    // Dorsal veins - more visible, branching
    const veins = [
        [[-0.32, 0.42], [-0.28, 0.14], [-0.25, -0.12], [-0.28, -0.35]],
        [[0.00, 0.46], [-0.04, 0.12], [0.02, -0.08], [-0.02, -0.32]],
        [[0.30, 0.40], [0.28, 0.10], [0.32, -0.14], [0.28, -0.30]]
    ];
    
    veins.forEach(vein => {
        const pts = vein.map(p => new THREE.Vector3(
            p[0] * PALM.width, p[1] * PALM.length, -PALM.thickness * 0.48
        ));
        const curve = new THREE.CatmullRomCurve3(pts);
        const vGeo = new THREE.TubeGeometry(curve, 18, S * 0.032, 5, false);
        group.add(new THREE.Mesh(vGeo, matDim.clone()));
        
        // Secondary thinner vein alongside
        const pts2 = pts.map(p => p.clone().add(new THREE.Vector3(S * 0.08, S * 0.05, 0)));
        const curve2 = new THREE.CatmullRomCurve3(pts2);
        const vGeo2 = new THREE.TubeGeometry(curve2, 12, S * 0.018, 4, false);
        const vMat2 = matDim.clone();
        vMat2.opacity = 0.25;
        group.add(new THREE.Mesh(vGeo2, vMat2));
    });
    
    // Webbing between fingers - more organic
    const webPairs = [
        ['index', 'middle'],
        ['middle', 'ring'],
        ['ring', 'pinky']
    ];
    
    webPairs.forEach(([f1, f2]) => {
        const d1 = FINGER_DATA[f1];
        const d2 = FINGER_DATA[f2];
        const x1 = d1.ax * PALM.width;
        const x2 = d2.ax * PALM.width;
        const y = (d1.ay + d2.ay) / 2 * PALM.length;
        
        // Larger, more visible webbing
        const webGeo = new THREE.PlaneGeometry(Math.abs(x2 - x1) * 0.65, S * 1.2, 8, 6);
        const webPos = webGeo.attributes.position;
        for (let i = 0; i < webPos.count; i++) {
            const px = webPos.getX(i);
            const py = webPos.getY(i);
            // Organic curved web
            const xNorm = px / (Math.abs(x2 - x1) * 0.325);
            const yNorm = py / (S * 0.6);
            const curve = Math.sin((xNorm + 1) * Math.PI * 0.5) * 0.12;
            const taper = 1 - Math.pow(yNorm, 2) * 0.3;
            webPos.setZ(i, curve * S * taper + py * 0.18);
            webPos.setX(i, px * (1 - Math.abs(yNorm) * 0.2));
        }
        webGeo.computeVertexNormals();
        
        const webMat = matDim.clone();
        webMat.side = THREE.DoubleSide;
        webMat.opacity = 0.38;
        const web = new THREE.Mesh(webGeo, webMat);
        web.position.set((x1 + x2) / 2, y + S * 0.4, PALM.thickness * 0.12);
        web.rotation.x = -0.38;
        group.add(web);
        
        // Webbing wireframe
        const webWire = new THREE.Mesh(webGeo.clone(), matLight.clone());
        webWire.position.copy(web.position);
        webWire.rotation.copy(web.rotation);
        webWire.scale.set(1.02, 1.02, 1);
        group.add(webWire);
    });
    
    // Thumb webbing - larger and more organic
    const thumbWebGeo = new THREE.PlaneGeometry(PALM.width * 0.38, PALM.length * 0.32, 10, 8);
    const thumbWebPos = thumbWebGeo.attributes.position;
    for (let i = 0; i < thumbWebPos.count; i++) {
        let x = thumbWebPos.getX(i);
        let y = thumbWebPos.getY(i);
        const nx = x / (PALM.width * 0.19);
        const ny = y / (PALM.length * 0.16);
        // Organic curve
        const z = Math.sin((nx + 1) * Math.PI * 0.5) * Math.sin((ny + 1) * Math.PI * 0.5) * S * 0.5;
        thumbWebPos.setX(i, x * (0.65 + ny * 0.35));
        thumbWebPos.setZ(i, z - (1 - nx) * ny * S * 0.3);
    }
    thumbWebGeo.computeVertexNormals();
    
    const thumbWebMat = matDim.clone();
    thumbWebMat.side = THREE.DoubleSide;
    thumbWebMat.opacity = 0.35;
    const thumbWeb = new THREE.Mesh(thumbWebGeo, thumbWebMat);
    thumbWeb.position.set(-PALM.width * 0.34, -PALM.length * 0.02, PALM.thickness * 0.08);
    thumbWeb.rotation.set(-0.38, 0.32, 0.52);
    group.add(thumbWeb);
    
    // Subtle energy particles
    const particles = [];
    for (let i = 0; i < 4; i++) {
        const pGeo = new THREE.SphereGeometry(S * 0.08, 5, 4);
        const pMat = matGlow.clone();
        pMat.opacity = 0.20;
        const p = new THREE.Mesh(pGeo, pMat);
        p.userData.orbit = {
            radiusX: (1.8 + Math.random() * 1.5) * S,
            radiusY: (2.2 + Math.random() * 1.8) * S,
            radiusZ: (1.5 + Math.random() * 1.0) * S,
            speed: 0.04 + Math.random() * 0.05,
            phase: Math.random() * Math.PI * 2,
            offsetY: (-PALM.length * 0.3 + Math.random() * PALM.length * 0.5)
        };
        particles.push(p);
        group.add(p);
    }
    
    // Subtle energy rings
    const rings = [];
    for (let i = 0; i < 2; i++) {
        const rGeo = new THREE.TorusGeometry(
            (WRIST.width * 0.50 + i * S * 0.2),
            S * 0.022, 5, 28
        );
        const rMat = matGlow.clone();
        rMat.opacity = 0.12 - i * 0.04;
        const r = new THREE.Mesh(rGeo, rMat);
        r.position.y = -PALM.length * 0.5 - WRIST.length * 0.5 - i * S * 0.18;
        r.rotation.x = Math.PI / 2;
        r.userData.orbitSpeed = 0.05 + i * 0.012;
        r.userData.wobblePhase = i * 0.6;
        rings.push(r);
        group.add(r);
    }
    
    // ============================================
    // METADATA
    // ============================================
    
    group.userData.type = 'swimmer_hand';
    group.userData.fingers = fingers;
    group.userData.particles = particles;
    group.userData.rings = rings;
    group.userData.allMaterials = allMaterials;
    group.userData.swimPhase = 0;
    group.userData.SCALE = S;
    group.userData.PALM_LENGTH = PALM.length;
    group.userData.colors = {
        primary: COL.main,
        wire: COL.light,
        glow: COL.glow,
        accent: COL.light
    };
    
    return group;
}

function createGeodesicSphere() {
    const group = new THREE.Group();
    const outerGeo = new THREE.IcosahedronGeometry(8, 1);
    const outerMat = createWireframeMaterial(0x7ec8e3);
    const outer = new THREE.Mesh(outerGeo, outerMat);
    group.add(outer);
    
    const innerGeo = new THREE.OctahedronGeometry(4, 0);
    const innerMat = createIridescentMaterial(0.3);
    const inner = new THREE.Mesh(innerGeo, innerMat);
    inner.userData.rotationSpeed = 0.02;
    group.add(inner);
    
    group.userData.type = 'geodesic_sphere';
    group.userData.inner = inner;
    return group;
}

function createCircuitTrace() {
    const group = new THREE.Group();
    const isDark = document.body.getAttribute('data-theme') === 'dark';
    const traceColor = isDark ? 0xc4a000 : 0xffd700;
    
    // Create PCB traces as tubes
    const tracePaths = [
        [new THREE.Vector3(-8, 0, 0), new THREE.Vector3(-3, 0, 0), new THREE.Vector3(-3, 5, 0), new THREE.Vector3(3, 5, 0)],
        [new THREE.Vector3(8, 0, 0), new THREE.Vector3(3, 0, 0), new THREE.Vector3(3, -5, 0), new THREE.Vector3(-3, -5, 0)],
        [new THREE.Vector3(0, 8, 0), new THREE.Vector3(0, 3, 0), new THREE.Vector3(5, 3, 0), new THREE.Vector3(5, -3, 0)],
        [new THREE.Vector3(0, -8, 0), new THREE.Vector3(0, -3, 0), new THREE.Vector3(-5, -3, 0), new THREE.Vector3(-5, 3, 0)]
    ];
    
    const traceMat = new THREE.MeshBasicMaterial({ color: traceColor, transparent: true, opacity: 0.8 });
    
    tracePaths.forEach((points, idx) => {
        const curve = new THREE.CatmullRomCurve3(points);
        const tubeGeo = new THREE.TubeGeometry(curve, 20, 0.15, 6, false);
        const tube = new THREE.Mesh(tubeGeo, traceMat);
        group.add(tube);
    });
    
    // Add nodes (component pads)
    const nodePositions = [
        { x: -8, y: 0 }, { x: 8, y: 0 }, { x: 0, y: 8 }, { x: 0, y: -8 },
        { x: -3, y: 5 }, { x: 3, y: 5 }, { x: 3, y: -5 }, { x: -3, y: -5 }, { x: 0, y: 0 }
    ];
    
    const nodeMat = new THREE.MeshBasicMaterial({ color: isDark ? 0x9482ff : 0x7ec8e3 });
    const nodes = [];
    nodePositions.forEach(pos => {
        const nodeGeo = new THREE.SphereGeometry(0.5, 8, 8);
        const node = new THREE.Mesh(nodeGeo, nodeMat.clone());
        node.position.set(pos.x, pos.y, 0);
        group.add(node);
        nodes.push(node);
    });
    
    // Data pulse particles
    const pulses = [];
    for (let i = 0; i < 3; i++) {
        const pulseGeo = new THREE.SphereGeometry(0.3, 6, 6);
        const pulseMat = new THREE.MeshBasicMaterial({ color: 0x00ffff, transparent: true, opacity: 0.9 });
        const pulse = new THREE.Mesh(pulseGeo, pulseMat);
        pulse.userData.pathIndex = i % tracePaths.length;
        pulse.userData.progress = i * 0.33;
        pulses.push(pulse);
        group.add(pulse);
    }
    
    group.userData.type = 'circuit_trace';
    group.userData.tracePaths = tracePaths;
    group.userData.pulses = pulses;
    group.userData.nodes = nodes;
    return group;
}

function createSpringHelix() {
    const group = new THREE.Group();
    const points = [];
    for (let i = 0; i <= 100; i++) {
        const t = i / 100;
        const angle = t * Math.PI * 10;
        points.push(new THREE.Vector3(Math.cos(angle) * 4, t * 15 - 7.5, Math.sin(angle) * 4));
    }
    const path = new THREE.CatmullRomCurve3(points);
    const tubeGeo = new THREE.TubeGeometry(path, 100, 0.5, 8, false);
    const material = createIridescentMaterial(0.5);
    const spring = new THREE.Mesh(tubeGeo, material);
    group.add(spring);
    group.userData.type = 'spring_helix';
    group.userData.springPhase = 0;
    return group;
}

function createTrussBridge() {
    const group = new THREE.Group();
    const material = createWireframeMaterial(0x7ec8e3);
    const length = 20, height = 5, segments = 5, segmentLength = length / segments;
    
    const railGeo = new THREE.CylinderGeometry(0.2, 0.2, length, 8);
    const topRail = new THREE.Mesh(railGeo, material);
    topRail.rotation.z = Math.PI / 2;
    topRail.position.y = height;
    group.add(topRail);
    
    const bottomRail = new THREE.Mesh(railGeo, material);
    bottomRail.rotation.z = Math.PI / 2;
    group.add(bottomRail);
    
    for (let i = 0; i <= segments; i++) {
        const x = -length/2 + i * segmentLength;
        const vertGeo = new THREE.CylinderGeometry(0.15, 0.15, height, 8);
        const vert = new THREE.Mesh(vertGeo, material);
        vert.position.set(x, height/2, 0);
        group.add(vert);
        
        if (i < segments) {
            const diagLength = Math.sqrt(segmentLength * segmentLength + height * height);
            const diagGeo = new THREE.CylinderGeometry(0.1, 0.1, diagLength, 8);
            const diag1 = new THREE.Mesh(diagGeo, material);
            diag1.position.set(x + segmentLength/2, height/2, 0);
            diag1.rotation.z = Math.atan2(height, segmentLength);
            group.add(diag1);
            
            const diag2 = new THREE.Mesh(diagGeo, material);
            diag2.position.set(x + segmentLength/2, height/2, 0);
            diag2.rotation.z = -Math.atan2(height, segmentLength);
            group.add(diag2);
        }
    }
    group.userData.type = 'truss_bridge';
    return group;
}

function createTurbineBlade() {
    const group = new THREE.Group();
    const hubGeo = new THREE.SphereGeometry(2, 16, 16);
    const hubMat = createIridescentMaterial(0.7);
    const hub = new THREE.Mesh(hubGeo, hubMat);
    group.add(hub);
    
    for (let i = 0; i < 3; i++) {
        const bladeGeo = new THREE.BoxGeometry(1, 10, 0.3);
        const blade = new THREE.Mesh(bladeGeo, hubMat);
        blade.position.y = 6;
        blade.rotation.x = 0.2;
        const bladeGroup = new THREE.Group();
        bladeGroup.add(blade);
        bladeGroup.rotation.z = (i / 3) * Math.PI * 2;
        group.add(bladeGroup);
    }
    group.userData.type = 'turbine_blade';
    return group;
}

function createAtomicModel() {
    const group = new THREE.Group();
    const nucleusGeo = new THREE.IcosahedronGeometry(2, 1);
    const nucleusMat = new THREE.MeshBasicMaterial({ color: 0x7ec8e3, transparent: true, opacity: 0.8 });
    const nucleus = new THREE.Mesh(nucleusGeo, nucleusMat);
    group.add(nucleus);
    
    const orbitalMat = createWireframeMaterial(0xa8d5e8);
    orbitalMat.opacity = 0.3;
    
    const electrons = [];
    [0, Math.PI / 3, -Math.PI / 3].forEach((angle, i) => {
        const orbitalGeo = new THREE.TorusGeometry(6 + i, 0.1, 8, 64);
        const orbital = new THREE.Mesh(orbitalGeo, orbitalMat);
        orbital.rotation.x = angle;
        orbital.rotation.y = i * 0.5;
        group.add(orbital);
        
        const electronGeo = new THREE.SphereGeometry(0.5, 8, 8);
        const electronMat = new THREE.MeshBasicMaterial({ color: 0x7ec8e3 });
        const electron = new THREE.Mesh(electronGeo, electronMat);
        electron.userData.orbitalRadius = 6 + i;
        electron.userData.orbitalSpeed = 0.02 * (i + 1);
        electron.userData.orbitalAngle = i * 2;
        electron.userData.tiltX = angle;
        electrons.push(electron);
        group.add(electron);
    });
    
    group.userData.type = 'atomic_model';
    group.userData.electrons = electrons;
    return group;
}

function createFluidDynamics() {
    const group = new THREE.Group();
    const isDark = document.body.getAttribute('data-theme') === 'dark';
    
    // Create particle system using BufferGeometry
    const particleCount = 200;
    const positions = new Float32Array(particleCount * 3);
    const colors = new Float32Array(particleCount * 3);
    const velocities = [];
    
    for (let i = 0; i < particleCount; i++) {
        positions[i * 3] = (Math.random() - 0.5) * 30;
        positions[i * 3 + 1] = (Math.random() - 0.5) * 15;
        positions[i * 3 + 2] = (Math.random() - 0.5) * 5;
        
        const color = new THREE.Color();
        color.setHSL(isDark ? 0.7 + Math.random() * 0.1 : 0.55 + Math.random() * 0.1, 0.8, 0.6);
        colors[i * 3] = color.r;
        colors[i * 3 + 1] = color.g;
        colors[i * 3 + 2] = color.b;
        
        velocities.push({ x: 0.5 + Math.random() * 0.5, y: 0, z: 0 });
    }
    
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    
    const material = new THREE.PointsMaterial({ size: 0.4, vertexColors: true, transparent: true, opacity: 0.8 });
    const particles = new THREE.Points(geometry, material);
    group.add(particles);
    
    // Boundary visualization
    const boundaryMat = createWireframeMaterial(isDark ? 0x9482ff : 0x7ec8e3);
    boundaryMat.opacity = 0.2;
    const topBound = new THREE.Mesh(new THREE.TorusGeometry(8, 0.1, 8, 32), boundaryMat);
    topBound.position.y = 7;
    topBound.rotation.x = Math.PI / 2;
    group.add(topBound);
    
    const bottomBound = new THREE.Mesh(new THREE.TorusGeometry(8, 0.1, 8, 32), boundaryMat);
    bottomBound.position.y = -7;
    bottomBound.rotation.x = Math.PI / 2;
    group.add(bottomBound);
    
    group.userData.type = 'fluid_dynamics';
    group.userData.particles = particles;
    group.userData.velocities = velocities;
    return group;
}

function createCantileverBeam() {
    const group = new THREE.Group();
    const segments = 12;
    const segmentLength = 1.5;
    const beamSegments = [];
    
    for (let i = 0; i < segments; i++) {
        const hue = 0.55 + (i / segments) * 0.15;
        const material = new THREE.MeshPhysicalMaterial({
            color: new THREE.Color().setHSL(hue, 0.7, 0.5),
            metalness: 0.3, roughness: 0.4, transparent: true, opacity: 0.9
        });
        const segGeo = new THREE.BoxGeometry(segmentLength, 1, 2);
        const segment = new THREE.Mesh(segGeo, material);
        segment.position.x = i * segmentLength - (segments * segmentLength) / 2 + segmentLength / 2;
        beamSegments.push(segment);
        group.add(segment);
    }
    
    // Fixed support
    const supportGeo = new THREE.BoxGeometry(2, 3, 3);
    const supportMat = createWireframeMaterial(0x7ec8e3);
    const support = new THREE.Mesh(supportGeo, supportMat);
    support.position.x = -(segments * segmentLength) / 2 - 1;
    group.add(support);
    
    // Load indicator
    const loadGeo = new THREE.ConeGeometry(0.5, 1.5, 8);
    const loadMat = new THREE.MeshBasicMaterial({ color: 0xff6666 });
    const load = new THREE.Mesh(loadGeo, loadMat);
    load.position.x = (segments * segmentLength) / 2 - segmentLength / 2;
    load.position.y = 2;
    load.rotation.z = Math.PI;
    group.add(load);
    
    // Stress lines
    const lineMat = new THREE.LineBasicMaterial({ color: 0xff9900, transparent: true, opacity: 0.5 });
    for (let i = 0; i < 3; i++) {
        const points = [];
        for (let j = 0; j <= 20; j++) {
            const x = (j / 20) * segments * segmentLength - (segments * segmentLength) / 2;
            const y = -1.5 + i * 1.5;
            points.push(new THREE.Vector3(x, y, 1.1));
        }
        const lineGeo = new THREE.BufferGeometry().setFromPoints(points);
        const line = new THREE.Line(lineGeo, lineMat);
        group.add(line);
    }
    
    group.userData.type = 'cantilever_beam';
    group.userData.beamSegments = beamSegments;
    group.userData.flexPhase = 0;
    group.userData.load = load;
    return group;
}

function createParametricSurface() {
    const group = new THREE.Group();
    
    // MÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¶bius strip variant
    const parametricFunc = function(u, v, target) {
        u = u * Math.PI * 2;
        v = (v - 0.5) * 2;
        const a = 5;
        const x = (a + v * Math.cos(u / 2)) * Math.cos(u);
        const y = (a + v * Math.cos(u / 2)) * Math.sin(u);
        const z = v * Math.sin(u / 2);
        target.set(x, y, z);
    };
    
    const geometry = new THREE.ParametricGeometry(parametricFunc, 50, 20);
    const shaderMat = createCustomIridescentShader(0.2);
    customShaderMaterials.push(shaderMat);
    
    const surface = new THREE.Mesh(geometry, shaderMat);
    group.add(surface);
    
    // Add wireframe overlay
    const wireGeo = geometry.clone();
    const wireMat = createWireframeMaterial(0x7ec8e3);
    wireMat.opacity = 0.2;
    const wireframe = new THREE.Mesh(wireGeo, wireMat);
    group.add(wireframe);
    
    group.userData.type = 'parametric_surface';
    group.userData.shaderMaterial = shaderMat;
    return group;
}

// ============================================
// ANIMATION AND UPDATES
// ============================================

function updateStructureMaterials(isDark) {
    structures.forEach((structure, i) => {
        structure.traverse((child) => {
            if (child.material) {
                if (child.material.userData && child.material.userData.hueOffset !== undefined) {
                    const hueShift = isDark ? 0.7 : 0;
                    const hueOffset = (child.material.userData.hueOffset + hueShift) % 1;
                    if (child.material.color) child.material.color.setHSL(hueOffset, 0.8, 0.6);
                    if (child.material.emissive) {
                        child.material.emissive.setHSL((hueOffset + 0.5) % 1, 1, 0.2);
                        child.material.emissiveIntensity = isDark ? 0.4 : 0.3;
                    }
                    child.material.needsUpdate = true;
                }
            }
        });
        
        // Update fluid particle colors
        if (structure.userData.type === 'fluid_dynamics' && structure.userData.particles) {
            const colors = structure.userData.particles.geometry.attributes.color.array;
            for (let i = 0; i < colors.length / 3; i++) {
                const color = new THREE.Color();
                color.setHSL(isDark ? 0.7 + Math.random() * 0.1 : 0.55 + Math.random() * 0.1, 0.8, 0.6);
                colors[i * 3] = color.r;
                colors[i * 3 + 1] = color.g;
                colors[i * 3 + 2] = color.b;
            }
            structure.userData.particles.geometry.attributes.color.needsUpdate = true;
        }
        
        // Update swimmer hand colors
        if (structure.userData.type === 'swimmer_hand') {
            // Organic glowing wireframe colors
            const mainColor = isDark ? 0x7ECCE8 : 0x5EB8D8;
            const lightColor = isDark ? 0xA8E8FF : 0x88D8F8;
            const dimColor = isDark ? 0x5AABB8 : 0x4A98A8;
            const glowColor = isDark ? 0x6ECCE8 : 0x5EBBD8;
            
            // Update stored colors
            if (structure.userData.colors) {
                structure.userData.colors.primary = mainColor;
                structure.userData.colors.wire = lightColor;
                structure.userData.colors.accent = lightColor;
                structure.userData.colors.glow = glowColor;
            }
            
            // Update all meshes in the hand structure
            structure.traverse(child => {
                if (child.isMesh && child.material) {
                    const mat = child.material;
                    
                    if (mat.wireframe === true) {
                        // Wireframe materials
                        if (mat.opacity > 0.80) {
                            mat.color.setHex(mainColor);
                            mat.opacity = isDark ? 0.92 : 0.90;
                        } else if (mat.opacity > 0.60) {
                            mat.color.setHex(lightColor);
                            mat.opacity = isDark ? 0.75 : 0.72;
                        } else {
                            mat.color.setHex(dimColor);
                            mat.opacity = isDark ? 0.52 : 0.48;
                        }
                    } else if (mat.blending === THREE.AdditiveBlending) {
                        // Glow materials
                        mat.color.setHex(glowColor);
                    } else if (mat.emissive !== undefined) {
                        // Physical materials (flesh)
                        mat.color.setHex(mainColor);
                        mat.emissive.setHex(glowColor);
                        mat.emissiveIntensity = isDark ? 0.15 : 0.08;
                    } else if (mat.transparent) {
                        // Other transparent materials
                        mat.color.setHex(dimColor);
                    }
                    mat.needsUpdate = true;
                }
            });
            
            // Update particles
            if (structure.userData.particles) {
                structure.userData.particles.forEach(particle => {
                    if (particle.material) {
                        particle.material.color.setHex(glowColor);
                        particle.material.needsUpdate = true;
                    }
                });
            }
            
            // Update rings
            if (structure.userData.rings) {
                structure.userData.rings.forEach(ring => {
                    if (ring.material) {
                        ring.material.color.setHex(glowColor);
                        ring.material.needsUpdate = true;
                    }
                });
            }
        }
    });
    
    // Update custom shader materials
    customShaderMaterials.forEach(mat => {
        mat.uniforms.isDark.value = isDark;
        mat.uniforms.baseColor.value.set(isDark ? 0x9482ff : 0x7ec8e3);
    });
    
    // Update fog
    if (scene && scene.fog) scene.fog.color.set(isDark ? 0x0a0b0f : 0xf0f8ff);
}

function onMouseMove(event) {
    mouseX = (event.clientX / window.innerWidth) * 2 - 1;
    mouseY = -(event.clientY / window.innerHeight) * 2 + 1;
    
    const cursor = document.getElementById('chromeCursor');
    if (cursor) {
        cursor.style.left = event.clientX + 'px';
        cursor.style.top = event.clientY + 'px';
    }
}

let resizeTimeout;
function onWindowResize() {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(() => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
        MedallionSystem.updatePosition();
        if (radialPanelPhysics) radialPanelPhysics.updateBounds();
        if (CircuitGridMatrix.initialized) CircuitGridMatrix.onResize();
    }, 100);
}

function animateThreeJS() {
    requestAnimationFrame(animateThreeJS);
    
    const deltaTime = clock.getDelta();
    const time = clock.getElapsedTime();
    
    if (harmonicMotion) harmonicMotion.update(deltaTime);
    if (radialPanelPhysics) radialPanelPhysics.update(deltaTime);
    
    // Update custom shader uniforms
    customShaderMaterials.forEach(mat => { mat.uniforms.time.value = time; });
    
    structures.forEach((structure) => {
        if (!structure.visible) return;
        
        // Default rotation
        if (structure.userData.rotationSpeed) {
            structure.rotation.z += structure.userData.rotationSpeed;
        } else {
            structure.rotation.x += deltaTime * PHI_INV * 0.1;
            structure.rotation.y += deltaTime * PHI_INV * 0.2;
        }
        
        // Structure-specific animations
        switch(structure.userData.type) {
            case 'cog_cluster':
                structure.children.forEach(child => {
                    if (child.userData.rotationSpeed) child.rotation.z += child.userData.rotationSpeed;
                });
                break;
                
            case 'geodesic_sphere':
                if (structure.userData.inner) {
                    structure.userData.inner.rotation.x += 0.02;
                    structure.userData.inner.rotation.y -= 0.015;
                }
                break;
                
            case 'swimmer_hand':
                // Subtle, realistic hand animation
                structure.userData.swimPhase += deltaTime * PHI * 0.6;
                const swimPhase = structure.userData.swimPhase;
                const fingers = structure.userData.fingers;
                const particles = structure.userData.particles;
                const rings = structure.userData.rings;
                const PALM_LENGTH = structure.userData.PALM_LENGTH || 5.4;
                
                if (fingers) {
                    // Subtle finger movement
                    const strokePhase = Math.sin(swimPhase);
                    const strokeIntensity = Math.abs(strokePhase);
                    
                    const baseCurl = strokePhase > 0 ? strokePhase * 0.10 : strokePhase * 0.03;
                    const spreadAmount = (1 - strokeIntensity) * 0.025;
                    
                    Object.keys(fingers).forEach((name, idx) => {
                        const finger = fingers[name];
                        if (!finger || !finger.userData) return;
                        
                        const isThumb = name === 'thumb';
                        
                        if (isThumb) {
                            const thumbCurl = baseCurl * 0.20;
                            const opposition = Math.sin(swimPhase * 0.6) * 0.04;
                            
                            const baseRotX = finger.userData.baseRotX || 0.32;
                            const baseRotY = finger.userData.baseRotY || -0.48;
                            const baseRotZ = finger.userData.baseRotZ || 0.82;
                            
                            if (finger.rotation) {
                                finger.rotation.x = baseRotX + thumbCurl * 0.18;
                                finger.rotation.y = baseRotY + opposition;
                                finger.rotation.z = baseRotZ + Math.sin(swimPhase * 0.4) * 0.025;
                            }
                        } else {
                            const fingerOffset = idx - 2;
                            const phaseOffset = idx * 0.10;
                            const fingerCurl = baseCurl + Math.sin(swimPhase + phaseOffset) * 0.025;
                            
                            const baseRotX = finger.userData.baseRotX || -0.05;
                            const baseRotY = finger.userData.baseRotY || 0;
                            const baseRotZ = finger.userData.baseRotZ || 0;
                            
                            finger.rotation.x = baseRotX + fingerCurl;
                            finger.rotation.z = baseRotZ + fingerOffset * spreadAmount;
                            finger.rotation.y = baseRotY + Math.sin(swimPhase * 0.9 + idx) * 0.008;
                        }
                    });
                }
                
                // Particle animation - subtle
                if (particles) {
                    particles.forEach((particle, pIdx) => {
                        const orbit = particle.userData.orbit;
                        if (orbit) {
                            const t = swimPhase * orbit.speed + orbit.phase;
                            particle.position.x = Math.cos(t) * orbit.radiusX;
                            particle.position.y = orbit.offsetY + Math.sin(t * 0.5) * orbit.radiusY * 0.2;
                            particle.position.z = Math.sin(t) * orbit.radiusZ;
                            
                            const pulse = 0.12 + Math.sin(swimPhase * 2 + pIdx * 0.5) * 0.08;
                            if (particle.material) {
                                particle.material.opacity = pulse;
                            }
                            particle.scale.setScalar(0.8 + pulse * 0.3);
                        }
                    });
                }
                
                // Ring animation - subtle
                if (rings) {
                    rings.forEach((ring, rIdx) => {
                        ring.rotation.z += ring.userData.orbitSpeed * 0.008;
                        ring.rotation.x = Math.PI / 2 + Math.sin(swimPhase * 0.3 + ring.userData.wobblePhase) * 0.03;
                        if (ring.material) {
                            ring.material.opacity = 0.05 + Math.sin(swimPhase * 1.5 + rIdx) * 0.025;
                        }
                    });
                }
                
                // Very gentle overall rotation
                structure.rotation.y = Math.sin(time * 0.18) * 0.04;
                structure.rotation.x = Math.cos(time * 0.12) * 0.02;
                break;
                
            case 'circuit_trace':
                if (structure.userData.pulses) {
                    structure.userData.pulses.forEach((pulse, idx) => {
                        pulse.userData.progress += deltaTime * 0.3;
                        if (pulse.userData.progress > 1) {
                            pulse.userData.progress = 0;
                            pulse.userData.pathIndex = (pulse.userData.pathIndex + 1) % structure.userData.tracePaths.length;
                        }
                        const path = structure.userData.tracePaths[pulse.userData.pathIndex];
                        const t = pulse.userData.progress;
                        const p0 = path[Math.floor(t * (path.length - 1))];
                        const p1 = path[Math.min(Math.floor(t * (path.length - 1)) + 1, path.length - 1)];
                        const localT = (t * (path.length - 1)) % 1;
                        pulse.position.lerpVectors(p0, p1, localT);
                    });
                }
                if (structure.userData.nodes) {
                    structure.userData.nodes.forEach((node, i) => {
                        node.material.opacity = 0.5 + Math.sin(time * 3 + i) * 0.3;
                    });
                }
                break;
                
            case 'spring_helix':
                structure.userData.springPhase += deltaTime * PHI;
                structure.scale.y = 0.8 + Math.sin(structure.userData.springPhase) * 0.2;
                break;
                
            case 'atomic_model':
                if (structure.userData.electrons) {
                    structure.userData.electrons.forEach(electron => {
                        electron.userData.orbitalAngle += electron.userData.orbitalSpeed;
                        const r = electron.userData.orbitalRadius;
                        const a = electron.userData.orbitalAngle;
                        electron.position.x = Math.cos(a) * r;
                        electron.position.y = Math.sin(a) * r * Math.cos(electron.userData.tiltX);
                        electron.position.z = Math.sin(a) * r * Math.sin(electron.userData.tiltX);
                    });
                }
                break;
                
            case 'fluid_dynamics':
                if (structure.userData.particles && structure.userData.velocities) {
                    const positions = structure.userData.particles.geometry.attributes.position.array;
                    const velocities = structure.userData.velocities;
                    for (let i = 0; i < velocities.length; i++) {
                        const streamY = positions[i * 3 + 1] / 15;
                        velocities[i].y = Math.sin(positions[i * 3] * 0.3 + time) * 0.1;
                        velocities[i].z = Math.cos(positions[i * 3] * 0.2 + time * 0.5) * 0.05;
                        
                        positions[i * 3] += velocities[i].x * deltaTime * 10;
                        positions[i * 3 + 1] += velocities[i].y;
                        positions[i * 3 + 2] += velocities[i].z;
                        
                        if (positions[i * 3] > 15) {
                            positions[i * 3] = -15;
                            positions[i * 3 + 1] = (Math.random() - 0.5) * 14;
                            positions[i * 3 + 2] = (Math.random() - 0.5) * 5;
                        }
                    }
                    structure.userData.particles.geometry.attributes.position.needsUpdate = true;
                }
                break;
                
            case 'cantilever_beam':
                structure.userData.flexPhase += deltaTime * PHI * 0.5;
                const maxDeflection = 0.15;
                if (structure.userData.beamSegments) {
                    structure.userData.beamSegments.forEach((seg, i) => {
                        const t = i / (structure.userData.beamSegments.length - 1);
                        const deflection = t * t * maxDeflection * Math.sin(structure.userData.flexPhase);
                        seg.rotation.z = deflection;
                    });
                }
                if (structure.userData.load) {
                    structure.userData.load.position.y = 2 + Math.sin(structure.userData.flexPhase) * 0.3;
                }
                break;
                
            case 'parametric_surface':
                structure.rotation.x += deltaTime * 0.1;
                structure.rotation.y += deltaTime * 0.15;
                break;
        }
    });
    
    // Camera motion
    const camTime = time * PHI_INV * 0.1;
    camera.position.x = Math.sin(camTime) * PHI * 2;
    camera.position.y = Math.cos(camTime * 0.8) * PHI + 2;
    camera.position.z = PHI * 30 + Math.sin(camTime * 0.5) * PHI * 3;
    camera.lookAt(0, 0, 0);
    
    renderer.render(scene, camera);
}

// ============================================
// PANEL EXPANSION SYSTEM
// ============================================

let currentExpandedPanel = null;
let isExpanded = false;
let isCollapsing = false;
let previousFocus = null;

function expandPanel(panelId, contentType) {
    if (isExpanded || isCollapsing) return;
    isExpanded = true;
    currentExpandedPanel = panelId;
    previousFocus = document.activeElement;
    
    const panel = document.getElementById(panelId);
    const expandedOverlay = document.getElementById('expandedOverlay');
    const expandedContainer = document.getElementById('expandedContainer');
    const expandedContent = document.getElementById('expandedContent');
    
    const panelRect = panel.getBoundingClientRect();
    const panelData = radialPanelPhysics.panels.get(panelId);
    
    expandedContainer.style.left = panelRect.left + 'px';
    expandedContainer.style.top = panelRect.top + 'px';
    expandedContainer.style.width = panelRect.width + 'px';
    expandedContainer.style.height = panelRect.height + 'px';
    expandedContainer.style.opacity = '1';
    
    if (panelData) panelData.physicsDisabled = true;
    
    loadContent(contentType, expandedContent);
    TetherSystem.fadeOut();
    
    expandedOverlay.style.pointerEvents = '';
    expandedOverlay.classList.add('active');
    expandedContainer.style.pointerEvents = '';
    expandedContainer.offsetHeight;
    
    expandedContainer.classList.add('morphing');
    requestAnimationFrame(() => {
        expandedContainer.classList.add('expanded');
        fadeOutElements();
        panel.classList.add('hidden');
        panel.setAttribute('aria-expanded', 'true');
        
        setTimeout(() => {
            const closeBtn = document.getElementById('closeBtn');
            if (closeBtn) closeBtn.focus();
        }, 500);
    });
    
    document.querySelectorAll('.nav-panel').forEach(p => { p.style.pointerEvents = 'none'; });
}

function collapsePanel() {
    if (!isExpanded || isCollapsing) return;
    isCollapsing = true;
    
    const expandedOverlay = document.getElementById('expandedOverlay');
    const expandedContainer = document.getElementById('expandedContainer');
    const panel = document.getElementById(currentExpandedPanel);
    
    if (!panel || !expandedOverlay || !expandedContainer) {
        isExpanded = false;
        isCollapsing = false;
        currentExpandedPanel = null;
        document.querySelectorAll('.nav-panel').forEach(p => {
            p.style.pointerEvents = '';
            p.classList.remove('hidden');
        });
        return;
    }
    
    const collapsedPanelId = currentExpandedPanel;
    
    if (radialPanelPhysics && radialPanelPhysics.panels) {
        radialPanelPhysics.panels.forEach((panelData, panelId) => {
            if (radialPanelPhysics.draggedPanel !== panelId) panelData.isDragging = false;
        });
        radialPanelPhysics.draggedPanel = null;
    }
    
    const panelRect = panel.getBoundingClientRect();
    expandedContainer.classList.remove('expanded');
    
    requestAnimationFrame(() => {
        expandedContainer.style.left = panelRect.left + 'px';
        expandedContainer.style.top = panelRect.top + 'px';
        expandedContainer.style.width = panelRect.width + 'px';
        expandedContainer.style.height = panelRect.height + 'px';
        
        fadeInElements();
        panel.classList.remove('hidden');
        panel.setAttribute('aria-expanded', 'false');
        TetherSystem.fadeIn();
        
        setTimeout(() => {
            document.querySelectorAll('.nav-panel').forEach(p => { p.style.pointerEvents = ''; });
        }, 50);
    });
    
    setTimeout(() => {
        expandedOverlay.classList.remove('active');
        expandedContainer.classList.remove('morphing');
        expandedContainer.style.opacity = '0';
        expandedOverlay.style.pointerEvents = 'none';
        expandedContainer.style.pointerEvents = 'none';
        expandedContainer.style.left = '-9999px';
        expandedContainer.style.top = '-9999px';
        
        const panelData = radialPanelPhysics.panels.get(collapsedPanelId);
        if (panelData) {
            panelData.physicsDisabled = false;
            panelData.isDragging = false;
        }
        
        if (previousFocus && previousFocus.focus) previousFocus.focus();
        
        isExpanded = false;
        isCollapsing = false;
        currentExpandedPanel = null;
    }, 800);
}

function fadeOutElements() {
    document.getElementById('siteTitle').classList.add('hidden');
    document.getElementById('siteSubtitle').classList.add('hidden');
    document.getElementById('centralMedallion').classList.add('hidden');
    document.querySelectorAll('.nav-panel').forEach(panel => {
        if (panel.id !== currentExpandedPanel) panel.classList.add('hidden');
    });
}

function fadeInElements() {
    document.getElementById('siteTitle').classList.remove('hidden');
    document.getElementById('siteSubtitle').classList.remove('hidden');
    document.getElementById('centralMedallion').classList.remove('hidden');
    document.querySelectorAll('.nav-panel').forEach(panel => {
        panel.style.opacity = '';
        panel.style.pointerEvents = '';
        panel.classList.remove('hidden');
    });
}

function loadContent(contentType, container) {
    switch(contentType) {
        case 'projects': container.innerHTML = getProjectsContent(); break;
        case 'people': container.innerHTML = getPeopleContent(); break;
        case 'about': container.innerHTML = getAboutContent(); break;
        case 'join': container.innerHTML = getJoinContent(); break;
        default: container.innerHTML = '<p>Content coming soon...</p>';
    }
}

function getProjectsContent() {
    return '<h1 class="expanded-title">Research Projects</h1><div class="projects-grid"><div class="project-card"><div class="project-image">[Project Image]</div><h3 class="project-title">Autonomous Systems</h3><p class="project-description">Developing next-generation autonomous systems with advanced sensor fusion and real-time decision making capabilities.</p><div class="project-tags"><span class="project-tag">Robotics</span><span class="project-tag">AI/ML</span><span class="project-tag">Active</span></div></div><div class="project-card"><div class="project-image">[Project Image]</div><h3 class="project-title">Smart Materials</h3><p class="project-description">Research into responsive materials that adapt to environmental conditions for applications in aerospace and biomedical engineering.</p><div class="project-tags"><span class="project-tag">Materials</span><span class="project-tag">Nano</span><span class="project-tag">Active</span></div></div><div class="project-card"><div class="project-image">[Project Image]</div><h3 class="project-title">Energy Systems</h3><p class="project-description">Innovative approaches to sustainable energy generation, storage, and distribution systems.</p><div class="project-tags"><span class="project-tag">Energy</span><span class="project-tag">Sustainability</span><span class="project-tag">Active</span></div></div><div class="project-card"><div class="project-image">[Project Image]</div><h3 class="project-title">Biomedical Devices</h3><p class="project-description">Creating cutting-edge medical devices and diagnostic tools using advanced engineering principles.</p><div class="project-tags"><span class="project-tag">Biomedical</span><span class="project-tag">Devices</span><span class="project-tag">Active</span></div></div></div>';
}

function getPeopleContent() {
    // LinkedIn SVG icon template
    const linkedinIcon = '<a href="#" class="linkedin-link" aria-label="LinkedIn Profile" onclick="return false;"><svg class="linkedin-icon" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg></a>';
    
    // Team members data
    const labDirector = { name: 'Dr. Mahaney', role: 'Lab Director' };
    
    const students = [
        'Matthew Alexander',
        'Carmine Anderson-Falconi',
        'Noah Butler',
        'Andy Choe',
        'Matthew Czar',
        'Ethan Derosa',
        'Benjamin Edwards',
        'Lily Foo',
        'Siera Gashi',
        'Ethan Hernandez',
        'Cameron Johnson',
        'Aayush Koradia',
        'Darwin Lemus',
        'Matias Magallanes',
        'David Majernik',
        'Sofia Morais',
        'Sanskriti Negi',
        'Coleman Nicholas',
        'Meghan Parker',
        'Siddhant Saxena',
        'Tate Semone',
        'Elyssa Snively',
        'Allen Solomon',
        'Fletcher Stuart',
        'Mihika Tyagi',
        'Rishabh Vemuri',
        'Markandeya Yalamanchi',
        'Alexander Yevchenko',
        'Sidharth Yeramaddu',
        'William Keffer'
    ];
    
    // Build Lab Director section
    let html = '<h1 class="expanded-title">Our Team</h1>';
    html += '<div class="people-section">';
    html += '<h2 class="people-section-title">Lab Director</h2>';
    html += '<div class="people-grid">';
    html += '<div class="person-card">';
    html += '<div class="person-image">[Photo]</div>';
    html += '<h3 class="person-name">' + labDirector.name + '</h3>';
    html += '<p class="person-role">' + labDirector.role + '</p>';
    html += linkedinIcon;
    html += '</div>';
    html += '</div></div>';
    
    // Build Team Members section
    html += '<div class="people-section">';
    html += '<h2 class="people-section-title">Team Members</h2>';
    html += '<div class="people-grid">';
    
    students.forEach(function(name) {
        html += '<div class="person-card">';
        html += '<div class="person-image">[Photo]</div>';
        html += '<h3 class="person-name">' + name + '</h3>';
        html += '<p class="person-role">Research Team</p>';
        html += linkedinIcon;
        html += '</div>';
    });
    
    html += '</div></div>';
    
    return html;
}

function getAboutContent() {
    return '<h1 class="expanded-title">About EEL</h1><div class="content-section"><h2 class="section-title">Our Mission</h2><p class="about-text">The Experimental Engineering Lab (EEL) is dedicated to pushing the boundaries of engineering through innovative research, interdisciplinary collaboration, and hands-on experimentation. We bridge the gap between theoretical concepts and practical applications, creating solutions that address real-world challenges.</p></div><div class="content-section"><h2 class="section-title">History</h2><p class="about-text">Founded in 2015, EEL began as a small research initiative focused on autonomous systems. Over the years, we have expanded our scope to include smart materials, energy systems, and biomedical engineering. Today, we are recognized as a leading center for experimental engineering research.</p></div><div class="content-section"><h2 class="section-title">Facilities</h2><p class="about-text">Our state-of-the-art facilities include advanced prototyping labs, testing chambers, computational resources, and specialized equipment for materials characterization. We provide our researchers with the tools they need to transform ideas into reality.</p></div><div class="content-section"><h2 class="section-title">Collaborations</h2><p class="about-text">EEL maintains strong partnerships with industry leaders, government agencies, and academic institutions worldwide. These collaborations enhance our research capabilities and ensure that our work has meaningful impact beyond the laboratory.</p></div>';
}

function getJoinContent() {
    return '<h1 class="expanded-title">Join Our Lab</h1><div class="content-section"><p class="about-text">We are always looking for talented and motivated individuals to join our team. Whether you\'re a prospective graduate student, undergraduate researcher, or postdoctoral fellow, EEL offers exciting opportunities to work on cutting-edge engineering challenges.</p></div><div class="opportunities-list"><div class="opportunity-card"><h3 class="opportunity-title">Graduate Positions</h3><p class="opportunity-description">We accept PhD and MS students with backgrounds in mechanical engineering, electrical engineering, materials science, and related fields. Graduate researchers receive full funding, mentorship, and access to world-class facilities.</p></div><div class="opportunity-card"><h3 class="opportunity-title">Undergraduate Research</h3><p class="opportunity-description">Undergraduate students can gain hands-on research experience through our research assistant program. Positions are available year-round with flexible schedules that accommodate academic commitments.</p></div><div class="opportunity-card"><h3 class="opportunity-title">Postdoctoral Positions</h3><p class="opportunity-description">We periodically have openings for postdoctoral researchers with expertise in our core research areas. Postdocs have the opportunity to lead independent projects while collaborating with our diverse team.</p></div></div><div style="text-align: center; margin-top: 40px;"><a href="#" class="apply-button" onclick="return false;">Apply Now</a></div><div class="content-section" style="margin-top: 40px;"><h2 class="section-title">Contact</h2><p class="about-text">For inquiries about joining EEL, please contact us at:<br><br>Email: eel-admissions@university.edu<br>Phone: (555) 123-4567<br>Office: Engineering Building, Room 301</p></div>';
}

// ============================================
// INITIALIZATION
// ============================================

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        ThemeManager.init();
        radialPanelPhysics = new RadialPanelPhysics();
        checkThreeJS();
        
        setTimeout(() => {
            document.querySelectorAll('.js-positioned:not(.ready)').forEach(el => el.classList.add('ready'));
        }, 2000);
    });
} else {
    ThemeManager.init();
    radialPanelPhysics = new RadialPanelPhysics();
    checkThreeJS();
}

console.log('%c\u26A1 EEL - EXPERIMENTAL ENGINEERING LAB', 'color: #7ec8e3; font-size: 24px; font-weight: 100;');
console.log('%c\u03C6 = ' + PHI.toFixed(3), 'color: #a8d5e8; font-size: 12px;');
console.log('%c\u2726 13 Engineering Structures with Anatomical Swimmer Hand', 'color: #a8d5e8; font-size: 12px;');
console.log('%c\u25C8 Circuit Grid Matrix Connection System', 'color: #7ec8e3; font-size: 12px;');