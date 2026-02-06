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
    packetSpeed: 0.2, // Progress per second (reduced by 50%)
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

    // Quadcopter Drone - only 3D element kept
    const quadcopter = createQuadcopter();
    quadcopter.position.set(-70, 0, -40);
    quadcopter.userData.originalPosition = quadcopter.position.clone();
    // Slight diagonal tilt for better viewing angle
    quadcopter.rotation.x = 0.4;  // Tilt forward
    quadcopter.rotation.z = 0.15; // Slight roll
    quadcopter.userData.baseTilt = { x: 0.4, z: 0.15 };
    scene.add(quadcopter);
    structures.push(quadcopter);

    // Flight path that covers the page while avoiding title, logo, and cards
    // Layout: Title/subtitle at top-center, medallion at center, 4 panels in corners
    // Drone flies around the perimeter and through open gaps

    const z = -40; // Depth for visibility

    // Waypoints trace around the open areas of the screen
    // Avoiding: center (logo), top-center (title), and corner areas (panels)
    const waypoints = [
        // Start left edge, middle height
        new THREE.Vector3(-70, 0, z),
        // Bottom-left corner area (between panels)
        new THREE.Vector3(-55, -35, z - 5),
        // Bottom edge center
        new THREE.Vector3(0, -45, z),
        // Bottom-right corner area
        new THREE.Vector3(55, -35, z - 5),
        // Right edge, middle height
        new THREE.Vector3(70, 0, z),
        // Top-right area (below title, between elements)
        new THREE.Vector3(55, 25, z - 5),
        // Top edge (far right, avoiding title)
        new THREE.Vector3(70, 40, z),
        // Top edge (far left, avoiding title)
        new THREE.Vector3(-70, 40, z),
        // Top-left area
        new THREE.Vector3(-55, 25, z - 5),
        // Back to start
        new THREE.Vector3(-70, 0, z),
    ];

    waypoints.forEach(wp => quadcopter.userData.waypoints.push(wp));

    // Slower speed for smooth full-page traversal
    quadcopter.userData.waypointSpeed = 0.12;

    log('Created ' + structures.length + ' engineering structures');
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
// TRULY ORGANIC HUMAN HAND - Natural Relaxed Pose
// ============================================
// ANATOMICALLY ACCURATE LEFT HAND
// Wireframe aesthetic with proper joint hierarchy
// ============================================

function createSwimmerHand() {
    const group = new THREE.Group();
    const isDark = document.body.getAttribute('data-theme') === 'dark';

    // ============================================
    // CONSTANTS - Hand proportions
    // ============================================
    const SCALE = 0.5;
    const PALM_LENGTH = 8.0;
    const PALM_WIDTH = 7.5;
    const PALM_THICKNESS = 2.5;

    // Finger lengths
    const FINGER_LENGTHS = {
        thumb: 5.5,
        index: 7.5,
        middle: 8.5,
        ring: 7.8,
        pinky: 6.0
    };

    // Phalanx ratios (proximal, middle, distal)
    const PHALANX_RATIOS = {
        thumb: [0.58, 0, 0.42],
        finger: [0.50, 0.28, 0.22]
    };

    // MCP positions (knuckles) - where fingers attach to palm
    const MCP_POSITIONS = {
        index:  { x:  2.2, y: PALM_LENGTH * 0.95, z: 0.2 },
        middle: { x:  0.7, y: PALM_LENGTH * 1.0,  z: 0.15 },
        ring:   { x: -0.8, y: PALM_LENGTH * 0.95, z: 0.1 },
        pinky:  { x: -2.2, y: PALM_LENGTH * 0.88, z: 0.0 }
    };

    // Thumb CMC position
    const THUMB_CMC = { x: 3.2, y: PALM_LENGTH * 0.32, z: 0.8 };

    // Natural resting angles (degrees) - relaxed, slightly curved
    const REST_ANGLES = {
        thumb:  { mcp: 15, pip: 0,  dip: 8 },
        index:  { mcp: 12, pip: 15, dip: 8 },
        middle: { mcp: 15, pip: 18, dip: 10 },
        ring:   { mcp: 18, pip: 22, dip: 12 },
        pinky:  { mcp: 22, pip: 28, dip: 15 }
    };

    // Finger widths (base width, taper to tip)
    const FINGER_WIDTHS = {
        thumb:  { base: 1.6, tip: 1.0 },
        index:  { base: 1.3, tip: 0.75 },
        middle: { base: 1.4, tip: 0.8 },
        ring:   { base: 1.3, tip: 0.72 },
        pinky:  { base: 1.0, tip: 0.55 }
    };

    // ============================================
    // MATERIALS - Wireframe aesthetic
    // ============================================
    const COL = {
        main: isDark ? 0x6EC8E0 : 0x58B0C8,
        light: isDark ? 0x8CE0F8 : 0x7CD0E8,
        dim: isDark ? 0x489098 : 0x388080,
        glow: isDark ? 0x5CC0D8 : 0x4CB0C8
    };

    const matMain = new THREE.MeshBasicMaterial({
        color: COL.main, wireframe: true, transparent: true, opacity: 0.85
    });
    const matLight = new THREE.MeshBasicMaterial({
        color: COL.light, wireframe: true, transparent: true, opacity: 0.5
    });
    const matDim = new THREE.MeshBasicMaterial({
        color: COL.dim, wireframe: true, transparent: true, opacity: 0.35
    });
    const matGlow = new THREE.MeshBasicMaterial({
        color: COL.glow, transparent: true, opacity: 0.12,
        blending: THREE.AdditiveBlending
    });
    const matWeb = new THREE.MeshBasicMaterial({
        color: COL.dim, wireframe: true, transparent: true, opacity: 0.25,
        side: THREE.DoubleSide
    });

    const allMaterials = [matMain, matLight, matDim, matGlow, matWeb];

    // ============================================
    // HELPER: Create realistic finger segment
    // ============================================
    function createPhalanx(length, baseWidth, tipWidth) {
        const phalanxGroup = new THREE.Group();
        const len = length * SCALE;
        const bw = baseWidth * SCALE;
        const tw = tipWidth * SCALE;

        // Main finger segment - capsule-like shape
        const segments = 16;
        const radialSegs = 12;
        const verts = [];
        const indices = [];

        for (let i = 0; i <= segments; i++) {
            const t = i / segments;
            const y = t * len;

            // Width tapers from base to tip
            const width = bw + (tw - bw) * t;
            // Depth is slightly less than width (fingers are oval, not round)
            const depth = width * 0.75;

            // Joint bulge at base
            const baseBulge = i < 3 ? 1 + (3 - i) / 3 * 0.15 : 1;
            // Slight bulge at knuckle area (around 30% up)
            const knuckleBulge = Math.abs(t - 0.3) < 0.15 ? 1 + (1 - Math.abs(t - 0.3) / 0.15) * 0.08 : 1;

            const finalWidth = width * baseBulge * knuckleBulge;
            const finalDepth = depth * baseBulge * knuckleBulge;

            for (let j = 0; j <= radialSegs; j++) {
                const theta = (j / radialSegs) * Math.PI * 2;
                // Elliptical cross-section, flattened on palm side
                let x = Math.cos(theta) * finalWidth * 0.5;
                let z = Math.sin(theta) * finalDepth * 0.5;

                // Flatten palm side slightly
                if (z > 0) z *= 0.85;

                verts.push(x, y, z);
            }
        }

        // Generate indices
        for (let i = 0; i < segments; i++) {
            for (let j = 0; j < radialSegs; j++) {
                const a = i * (radialSegs + 1) + j;
                const b = a + 1;
                const c = a + radialSegs + 1;
                const d = c + 1;
                indices.push(a, b, c, b, d, c);
            }
        }

        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
        geo.setIndex(indices);
        geo.computeVertexNormals();

        const mesh = new THREE.Mesh(geo, matMain);
        phalanxGroup.add(mesh);

        // Add inner wireframe layer for depth
        const innerMesh = new THREE.Mesh(geo.clone(), matDim);
        innerMesh.scale.set(0.7, 0.98, 0.7);
        phalanxGroup.add(innerMesh);

        return phalanxGroup;
    }

    // ============================================
    // HELPER: Create finger with joint hierarchy
    // ============================================
    function createFinger(name, config) {
        const { length, baseWidth, tipWidth, mcpPos, restAngles } = config;
        const isThumb = name === 'thumb';
        const ratios = isThumb ? PHALANX_RATIOS.thumb : PHALANX_RATIOS.finger;

        // Calculate phalanx lengths
        const proximalLen = length * ratios[0];
        const middleLen = isThumb ? 0 : length * ratios[1];
        const distalLen = length * (isThumb ? ratios[2] : ratios[2]);

        // Calculate widths at each joint (taper profile)
        const widthAtPIP = baseWidth * 0.88;
        const widthAtDIP = baseWidth * 0.75;

        // Root group positioned at MCP (or CMC for thumb)
        const fingerGroup = new THREE.Group();
        fingerGroup.position.set(mcpPos.x * SCALE, mcpPos.y * SCALE, mcpPos.z * SCALE);

        // Store rest angles for animation
        fingerGroup.userData.restAngles = restAngles;
        fingerGroup.userData.name = name;

        // PROXIMAL PHALANX (rotates at MCP)
        const proximalGroup = new THREE.Group();
        const proximal = createPhalanx(proximalLen, baseWidth, widthAtPIP);
        // Geometry starts at y=0, no centering needed
        proximalGroup.add(proximal);

        // Apply MCP rest angle (convert degrees to radians)
        proximalGroup.rotation.x = -restAngles.mcp * Math.PI / 180;
        fingerGroup.add(proximalGroup);

        if (isThumb) {
            // THUMB: Only has 2 phalanges (proximal + distal)
            const distalGroup = new THREE.Group();
            distalGroup.position.y = proximalLen * SCALE;  // At end of proximal

            const distal = createPhalanx(distalLen, widthAtPIP, tipWidth);
            distalGroup.add(distal);

            // Fingertip
            const tipPad = new THREE.Mesh(
                new THREE.SphereGeometry(tipWidth * SCALE * 0.45, 8, 8),
                matMain
            );
            tipPad.position.y = distalLen * SCALE;
            tipPad.scale.set(1.1, 0.5, 0.8);
            distalGroup.add(tipPad);

            distalGroup.rotation.x = -restAngles.dip * Math.PI / 180;
            proximalGroup.add(distalGroup);

            fingerGroup.userData.proximal = proximalGroup;
            fingerGroup.userData.distal = distalGroup;
        } else {
            // REGULAR FINGER: 3 phalanges

            // MIDDLE PHALANX (rotates at PIP)
            const middleGroup = new THREE.Group();
            middleGroup.position.y = proximalLen * SCALE;  // At end of proximal

            const middle = createPhalanx(middleLen, widthAtPIP, widthAtDIP);
            middleGroup.add(middle);

            middleGroup.rotation.x = -restAngles.pip * Math.PI / 180;
            proximalGroup.add(middleGroup);

            // DISTAL PHALANX (rotates at DIP)
            const distalGroup = new THREE.Group();
            distalGroup.position.y = middleLen * SCALE;  // At end of middle

            const distal = createPhalanx(distalLen, widthAtDIP, tipWidth);
            distalGroup.add(distal);

            // Fingertip pad
            const tipPad = new THREE.Mesh(
                new THREE.SphereGeometry(tipWidth * SCALE * 0.5, 8, 6),
                matLight
            );
            tipPad.position.y = distalLen * SCALE;
            tipPad.scale.set(1, 0.5, 0.85);
            distalGroup.add(tipPad);

            distalGroup.rotation.x = -restAngles.dip * Math.PI / 180;
            middleGroup.add(distalGroup);

            fingerGroup.userData.proximal = proximalGroup;
            fingerGroup.userData.middle = middleGroup;
            fingerGroup.userData.distal = distalGroup;
        }

        return fingerGroup;
    }

    // ============================================
    // CREATE THUMB - Fully anatomical human thumb
    // ============================================
    function createThumb() {
        const thumbGroup = new THREE.Group();
        const S = SCALE;

        // Real thumb proportions (in units, will be scaled)
        const METACARPAL_LEN = 2.8;
        const PROXIMAL_LEN = 2.2;
        const DISTAL_LEN = 1.8;

        // Generate organic cross-section outline at a given height
        // Returns array of {x, z} points
        function getThumbCrossSection(segmentType, t, baseW, baseD) {
            const points = [];
            const numPts = 32;

            for (let i = 0; i <= numPts; i++) {
                const angle = (i / numPts) * Math.PI * 2;
                const cosA = Math.cos(angle);
                const sinA = Math.sin(angle);

                let x, z;

                if (segmentType === 'metacarpal') {
                    // Metacarpal: Rounded triangular cross-section
                    // Wider at back (dorsal), narrower toward palm
                    const dorsalBulge = sinA < 0 ? 1.15 : 0.9;
                    const lateralSquash = 1 - Math.abs(cosA) * 0.1;

                    // Base ellipse with modifications
                    x = cosA * baseW * 0.5 * lateralSquash;
                    z = sinA * baseD * 0.5 * dorsalBulge;

                    // Thenar muscle attachment bulge on radial side (thumb-side of metacarpal)
                    if (cosA > 0.3 && sinA > -0.5 && t < 0.6) {
                        const thenarStrength = (1 - t / 0.6) * Math.pow(Math.max(0, cosA - 0.3) / 0.7, 0.6) * 0.35;
                        x += thenarStrength * baseW * 0.3;
                        z += thenarStrength * baseD * 0.15 * Math.max(0, sinA + 0.5);
                    }

                } else if (segmentType === 'proximal') {
                    // Proximal phalanx: Barrel-shaped, wider in middle
                    const barrelBulge = 1 + Math.sin(t * Math.PI) * 0.12;

                    // Flattened on palm side, rounded on back
                    const palmFlat = sinA > 0.2 ? 0.75 + 0.25 * (1 - sinA) : 1;
                    const backRound = sinA < -0.3 ? 1.1 : 1;

                    x = cosA * baseW * 0.5 * barrelBulge;
                    z = sinA * baseD * 0.5 * palmFlat * backRound * barrelBulge;

                    // Lateral ridges where tendons run
                    if (Math.abs(cosA) > 0.8) {
                        const ridgeStrength = (Math.abs(cosA) - 0.8) / 0.2 * 0.08;
                        z -= ridgeStrength * baseD * Math.abs(sinA);
                    }

                    // Flexor crease hint on palm side
                    if (sinA > 0.7 && t > 0.1 && t < 0.3) {
                        const creaseDepth = Math.sin((t - 0.1) / 0.2 * Math.PI) * 0.05;
                        z -= creaseDepth * baseD;
                    }

                } else if (segmentType === 'distal') {
                    // Distal phalanx: Spatula/paddle shape - VERY distinctive
                    // Wider and flatter toward tip, with prominent pad

                    // Width expands then tapers at very tip
                    const widthProfile = t < 0.7 ? 1 + t * 0.3 : 1.3 - (t - 0.7) / 0.3 * 0.5;

                    // Thickness: thin at base, bulbous pad in middle, tapers at tip
                    let thickProfile;
                    if (t < 0.2) {
                        thickProfile = 0.9 + t / 0.2 * 0.3;
                    } else if (t < 0.75) {
                        thickProfile = 1.2 + Math.sin((t - 0.2) / 0.55 * Math.PI) * 0.25;
                    } else {
                        thickProfile = 1.2 - (t - 0.75) / 0.25 * 0.6;
                    }

                    // Base shape
                    x = cosA * baseW * 0.5 * widthProfile;
                    z = sinA * baseD * 0.5 * thickProfile;

                    // THUMB PAD - Very prominent fleshy bulge on palm side
                    if (sinA > 0 && t > 0.15 && t < 0.9) {
                        const padT = (t - 0.15) / 0.75;
                        const padStrength = Math.sin(padT * Math.PI) * Math.pow(sinA, 0.6);
                        const padBulge = padStrength * 0.5 * baseD;
                        z += padBulge;

                        // Pad is also wider
                        if (Math.abs(cosA) < 0.7) {
                            x *= 1 + padStrength * 0.15;
                        }
                    }

                    // NAIL BED - Flattened area on dorsal side
                    if (sinA < -0.3 && t > 0.25) {
                        const nailT = (t - 0.25) / 0.75;
                        // Flatten for nail
                        const flatStrength = Math.pow(nailT, 0.5) * Math.pow(Math.abs(sinA + 0.3) / 1.3, 0.8);
                        z = z * (1 - flatStrength * 0.3) - flatStrength * 0.1 * baseD;

                        // Nail edges slightly raised
                        if (Math.abs(cosA) > 0.5 && Math.abs(cosA) < 0.85) {
                            z -= 0.03 * baseD * nailT;
                        }
                    }

                    // TIP ROUNDING
                    if (t > 0.85) {
                        const tipT = (t - 0.85) / 0.15;
                        const roundFactor = Math.sqrt(1 - tipT * tipT * 0.8);
                        x *= roundFactor;
                        z *= roundFactor;
                    }

                    // Lateral nail folds
                    if (Math.abs(cosA) > 0.75 && sinA < 0 && t > 0.3) {
                        const foldStrength = (Math.abs(cosA) - 0.75) / 0.25 * (t - 0.3) / 0.7 * 0.06;
                        z += foldStrength * baseD;
                    }
                }

                // Add organic micro-variation
                const noise = Math.sin(angle * 7 + t * 13) * Math.cos(angle * 11 - t * 7) * 0.012;
                x += noise * baseW;
                z += noise * baseD * 0.5;

                points.push({ x: x * S, z: z * S });
            }

            return points;
        }

        // Build a thumb segment mesh from cross-sections
        function buildSegmentMesh(segmentType, length, baseWidth, baseDepth, tipWidth, tipDepth) {
            const len = length * S;
            const ySegs = 24;
            const verts = [];
            const indices = [];

            for (let yi = 0; yi <= ySegs; yi++) {
                const t = yi / ySegs;
                const y = t * len;

                // Interpolate width and depth
                const w = baseWidth + (tipWidth - baseWidth) * t;
                const d = baseDepth + (tipDepth - baseDepth) * t;

                const outline = getThumbCrossSection(segmentType, t, w, d);

                for (const pt of outline) {
                    verts.push(pt.x, y, pt.z);
                }
            }

            // Generate indices
            const ptsPerLevel = 33;  // numPts + 1
            for (let yi = 0; yi < ySegs; yi++) {
                for (let pi = 0; pi < ptsPerLevel - 1; pi++) {
                    const a = yi * ptsPerLevel + pi;
                    const b = a + 1;
                    const c = a + ptsPerLevel;
                    const d = c + 1;
                    indices.push(a, c, b, b, c, d);
                }
            }

            // End caps
            const baseCenterIdx = verts.length / 3;
            verts.push(0, 0, 0);
            for (let pi = 0; pi < ptsPerLevel - 1; pi++) {
                indices.push(baseCenterIdx, pi + 1, pi);
            }

            const topStart = ySegs * ptsPerLevel;
            const topCenterIdx = verts.length / 3;
            verts.push(0, len, 0);
            for (let pi = 0; pi < ptsPerLevel - 1; pi++) {
                indices.push(topCenterIdx, topStart + pi, topStart + pi + 1);
            }

            const geo = new THREE.BufferGeometry();
            geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
            geo.setIndex(indices);
            geo.computeVertexNormals();

            const group = new THREE.Group();
            group.add(new THREE.Mesh(geo, matMain));

            // Inner wireframe
            const inner = new THREE.Mesh(geo.clone(), matDim);
            inner.scale.set(0.72, 0.97, 0.72);
            group.add(inner);

            return group;
        }

        // Create skin crease rings at joints
        function createJointCreases(width, depth, numCreases) {
            const creaseGroup = new THREE.Group();
            const w = width * S;
            const d = depth * S;

            for (let i = 0; i < numCreases; i++) {
                const yOffset = (i - (numCreases - 1) / 2) * 0.06 * S;
                const creaseRadius = (w + d) * 0.24;

                // Create crease as deformed torus
                const creaseGeo = new THREE.TorusGeometry(creaseRadius, 0.015 * S, 6, 24);
                const pos = creaseGeo.attributes.position;

                for (let j = 0; j < pos.count; j++) {
                    const x = pos.getX(j);
                    const y = pos.getY(j);
                    let z = pos.getZ(j);

                    // Flatten to match thumb shape
                    const angle = Math.atan2(z, x);
                    const cosAngle = Math.cos(angle);
                    const sinAngle = Math.sin(angle);

                    // Elliptical deformation
                    const newX = x * (w / creaseRadius / 2);
                    const newZ = z * (d / creaseRadius / 2) * 0.85;

                    pos.setXYZ(j, newX, y + yOffset, newZ);
                }
                creaseGeo.computeVertexNormals();

                const crease = new THREE.Mesh(creaseGeo, matLight);
                crease.rotation.x = Math.PI / 2;
                creaseGroup.add(crease);
            }

            return creaseGroup;
        }

        // === ASSEMBLE THUMB ===

        // METACARPAL
        const metacarpalGroup = new THREE.Group();
        const metacarpal = buildSegmentMesh('metacarpal',
            METACARPAL_LEN, 1.6, 1.2, 1.4, 1.1
        );
        metacarpalGroup.add(metacarpal);
        thumbGroup.add(metacarpalGroup);

        // MCP JOINT AREA (creases between metacarpal and proximal)
        const mcpCreases = createJointCreases(1.5, 1.15, 2);
        mcpCreases.position.y = METACARPAL_LEN * S;
        metacarpalGroup.add(mcpCreases);

        // PROXIMAL PHALANX
        const proximalGroup = new THREE.Group();
        proximalGroup.position.y = METACARPAL_LEN * S;

        const proximal = buildSegmentMesh('proximal',
            PROXIMAL_LEN, 1.5, 1.15, 1.35, 1.0
        );
        proximalGroup.add(proximal);

        // IP JOINT CREASES
        const ipCreases = createJointCreases(1.35, 1.0, 3);
        ipCreases.position.y = PROXIMAL_LEN * S;
        proximalGroup.add(ipCreases);

        // Natural MCP flexion - significant curl inward
        proximalGroup.rotation.x = -35 * Math.PI / 180;
        metacarpalGroup.add(proximalGroup);

        // DISTAL PHALANX (with integrated nail and pad)
        const distalGroup = new THREE.Group();
        distalGroup.position.y = PROXIMAL_LEN * S;

        const distal = buildSegmentMesh('distal',
            DISTAL_LEN, 1.35, 1.0, 0.9, 0.7
        );
        distalGroup.add(distal);

        // THUMBNAIL - Curved 3D nail shape
        const nailGroup = new THREE.Group();
        const nailW = 0.7 * S;
        const nailL = DISTAL_LEN * 0.55 * S;
        const nailSegsX = 8;
        const nailSegsY = 12;
        const nailVerts = [];
        const nailIndices = [];

        for (let yi = 0; yi <= nailSegsY; yi++) {
            const yt = yi / nailSegsY;
            for (let xi = 0; xi <= nailSegsX; xi++) {
                const xt = xi / nailSegsX;

                // Position along nail
                const x = (xt - 0.5) * nailW;
                const y = yt * nailL;

                // Nail curvature: curved across width, slightly along length
                const curveCross = Math.pow(Math.abs(xt - 0.5) * 2, 2) * 0.12 * S;
                const curveLong = Math.pow(yt, 1.5) * 0.06 * S;
                const z = -0.42 * S - curveCross - curveLong;

                // Nail edge thickness at sides
                const edgeThick = Math.abs(xt - 0.5) > 0.4 ? 0.02 * S : 0;

                nailVerts.push(x, y, z - edgeThick);
            }
        }

        for (let yi = 0; yi < nailSegsY; yi++) {
            for (let xi = 0; xi < nailSegsX; xi++) {
                const a = yi * (nailSegsX + 1) + xi;
                const b = a + 1;
                const c = a + nailSegsX + 1;
                const d = c + 1;
                nailIndices.push(a, c, b, b, c, d);
            }
        }

        const nailGeo = new THREE.BufferGeometry();
        nailGeo.setAttribute('position', new THREE.Float32BufferAttribute(nailVerts, 3));
        nailGeo.setIndex(nailIndices);
        nailGeo.computeVertexNormals();

        const nail = new THREE.Mesh(nailGeo, matLight);
        nail.position.y = DISTAL_LEN * 0.35 * S;
        nailGroup.add(nail);

        // Cuticle (lunula area)
        const cuticle = new THREE.Mesh(
            new THREE.RingGeometry(nailW * 0.15, nailW * 0.45, 16, 1, 0, Math.PI),
            matDim
        );
        cuticle.rotation.x = Math.PI / 2 + 0.1;
        cuticle.position.set(0, DISTAL_LEN * 0.38 * S, -0.44 * S);
        nailGroup.add(cuticle);

        distalGroup.add(nailGroup);

        // Natural IP flexion - curl the tip inward
        distalGroup.rotation.x = -25 * Math.PI / 180;
        proximalGroup.add(distalGroup);

        // Position thumb at CMC joint
        thumbGroup.position.set(
            THUMB_CMC.x * S,
            THUMB_CMC.y * S,
            THUMB_CMC.z * S
        );

        // Store references
        thumbGroup.userData.name = 'thumb';
        thumbGroup.userData.metacarpal = metacarpalGroup;
        thumbGroup.userData.proximal = proximalGroup;
        thumbGroup.userData.distal = distalGroup;
        thumbGroup.userData.restAngles = REST_ANGLES.thumb;

        return thumbGroup;
    }

    // ============================================
    // CREATE PALM - Anatomically accurate hand shape
    // ============================================
    function createPalm() {
        const palmGroup = new THREE.Group();
        const S = SCALE;

        // Derive palm dimensions from actual finger attachment positions
        // Fingers attach at: index x=2.2, middle x=0.7, ring x=-0.8, pinky x=-2.2
        // Palm should be ~0.15 units wider than outermost fingers
        const fingerMinX = MCP_POSITIONS.pinky.x;   // -2.2
        const fingerMaxX = MCP_POSITIONS.index.x;   // 2.2
        const knuckleHalfWidth = Math.max(Math.abs(fingerMinX), Math.abs(fingerMaxX)) + 0.15;  // ~2.35
        const wristHalfWidth = knuckleHalfWidth * 0.65;  // ~1.53

        // Actual hand anatomy: 5 metacarpal bones fan out from wrist to knuckles
        // Thumb metacarpal is offset and rotated
        // Palm is NOT a simple shape - it's a complex 3D surface

        // Key anatomical landmarks:
        // - Thenar eminence: fleshy mound at base of thumb (palm side)
        // - Hypothenar eminence: smaller mound on pinky side (palm side)
        // - Metacarpal heads: knuckle bumps at top
        // - Palm hollow: slight depression in center of palm
        // - Carpal arch: concave across width at wrist

        const numAngles = 48;  // High resolution around perimeter
        const yLevels = 32;    // High resolution along length

        // Create anatomical cross-section at height yt (0=wrist, 1=knuckles)
        function getAnatomicalOutline(yt) {
            const points = [];

            for (let i = 0; i <= numAngles; i++) {
                const t = i / numAngles;
                // Map t to angle: start at palm center (+z), go counterclockwise
                const angle = (t * 2 - 0.5) * Math.PI;  // -0.5π to 1.5π

                // === BASE SHAPE: Asymmetric pentagon-like with curves ===
                // Real palms are wider on thumb side, narrower on pinky side

                // Width at this height (non-linear expansion from wrist to knuckles)
                const widthCurve = Math.pow(yt, 0.6);  // Faster expansion near wrist
                const halfWidth = wristHalfWidth + (knuckleHalfWidth - wristHalfWidth) * widthCurve;

                // Asymmetry: thumb side slightly wider
                const asymmetry = 1 + 0.08 * Math.max(0, Math.cos(angle));  // Wider on thumb side

                // Thickness varies: thicker at wrist, thinner at knuckles
                const baseThickness = PALM_THICKNESS * 0.5 * (1.1 - yt * 0.25);

                // Base ellipse with asymmetry
                let x = Math.cos(angle) * halfWidth * asymmetry;
                let z = Math.sin(angle) * baseThickness;

                // === ANATOMICAL MODIFICATIONS ===

                // 1. THENAR EMINENCE - Large fleshy mound on thumb side (palm side, +x, +z)
                // Peaks around yt=0.25-0.45, extends from thumb CMC toward index MCP
                const thenarCenterY = 0.35;
                const thenarRadiusY = 0.3;
                const inThenarY = Math.abs(yt - thenarCenterY) < thenarRadiusY;

                if (inThenarY && angle > -0.3 && angle < 1.2) {
                    const yFactor = 1 - Math.abs(yt - thenarCenterY) / thenarRadiusY;
                    const ySmooth = Math.pow(yFactor, 0.7);  // Smooth falloff

                    // Thenar shape: more pronounced toward thumb, fades toward center
                    const angleFactor = Math.sin((angle + 0.3) / 1.5 * Math.PI);
                    const angleSmooth = Math.pow(Math.max(0, angleFactor), 0.8);

                    const thenarStrength = ySmooth * angleSmooth;

                    // Bulge outward (+x) and forward (+z)
                    x += thenarStrength * 0.65 * Math.max(0.2, Math.cos(angle));
                    z += thenarStrength * 0.55 * Math.max(0, Math.sin(angle));
                }

                // 2. HYPOTHENAR EMINENCE - Smaller mound on pinky side (palm side, -x, +z)
                // Peaks around yt=0.3-0.5
                const hypoCenterY = 0.4;
                const hypoRadiusY = 0.25;
                const inHypoY = Math.abs(yt - hypoCenterY) < hypoRadiusY;

                if (inHypoY && (angle > 1.8 || angle < -1.5)) {
                    const yFactor = 1 - Math.abs(yt - hypoCenterY) / hypoRadiusY;
                    const ySmooth = Math.pow(yFactor, 0.8);

                    const normalizedAngle = angle > 1.8 ? angle - Math.PI : angle + Math.PI;
                    const angleFactor = Math.cos(normalizedAngle * 0.8);
                    const angleSmooth = Math.max(0, angleFactor);

                    const hypoStrength = ySmooth * angleSmooth * 0.4;

                    x -= hypoStrength * 0.35;
                    z += hypoStrength * 0.4 * Math.max(0, Math.sin(angle));
                }

                // 3. PALM HOLLOW - Concave depression in center of palm
                // Real palms have a natural cup shape
                if (angle > 0.2 && angle < 2.5 && yt > 0.15 && yt < 0.85) {
                    const centeredness = 1 - Math.abs(x / (halfWidth * 0.5));  // Most centered = strongest
                    const yFactor = Math.sin((yt - 0.15) / 0.7 * Math.PI);
                    const isFacingPalm = Math.sin(angle) > 0.3;

                    if (isFacingPalm && centeredness > 0.3) {
                        const hollowStrength = Math.pow(centeredness, 1.5) * yFactor * 0.15;
                        z -= hollowStrength;
                    }
                }

                // 4. METACARPAL RIDGES - Bones visible on back of hand
                // 4 metacarpals for fingers (thumb metacarpal handled separately)
                if ((angle < -0.5 || angle > 2.5) && yt > 0.2) {
                    const metacarpalXs = [
                        MCP_POSITIONS.index.x,
                        MCP_POSITIONS.middle.x,
                        MCP_POSITIONS.ring.x,
                        MCP_POSITIONS.pinky.x
                    ];

                    for (const mcpX of metacarpalXs) {
                        const distFromMC = Math.abs(x - mcpX);
                        if (distFromMC < 0.5) {
                            // Ridge strength increases toward knuckles
                            const ridgeStrength = (1 - distFromMC / 0.5) * Math.pow(yt - 0.2, 0.8) * 0.12;
                            z -= ridgeStrength;
                        }
                    }

                    // Valleys between metacarpals
                    for (let m = 0; m < 3; m++) {
                        const valleyX = (metacarpalXs[m] + metacarpalXs[m + 1]) / 2;
                        const distFromValley = Math.abs(x - valleyX);
                        if (distFromValley < 0.35) {
                            const valleyStrength = (1 - distFromValley / 0.35) * Math.pow(yt - 0.2, 0.6) * 0.06;
                            z += valleyStrength;  // Inward valley
                        }
                    }
                }

                // 5. KNUCKLE BUMPS - Metacarpal heads protrude at top
                if (yt > 0.88) {
                    const knuckleProgress = (yt - 0.88) / 0.12;
                    const mcpXs = [
                        MCP_POSITIONS.index.x,
                        MCP_POSITIONS.middle.x,
                        MCP_POSITIONS.ring.x,
                        MCP_POSITIONS.pinky.x
                    ];

                    for (const mcpX of mcpXs) {
                        const distFromKnuckle = Math.abs(x - mcpX);
                        if (distFromKnuckle < 0.4) {
                            const bumpStrength = (1 - distFromKnuckle / 0.4) * knuckleProgress;
                            // Knuckles protrude on back of hand
                            if (angle < -0.3 || angle > 2.8) {
                                z -= bumpStrength * 0.18;
                            }
                            // Slight protrusion on palm side too
                            if (angle > 0.3 && angle < 2.5) {
                                z += bumpStrength * 0.06;
                            }
                        }
                    }
                }

                // 6. CARPAL ARCH - Wrist has concave palm side (carpal tunnel area)
                if (yt < 0.12 && angle > 0.3 && angle < 2.5) {
                    const archStrength = (1 - yt / 0.12) * 0.12;
                    const centeredness = 1 - Math.abs(Math.cos(angle));
                    z -= archStrength * centeredness * Math.sin(angle);
                }

                // 7. EDGE TAPERING - Real palms have smooth, rounded edges
                // The edge where palm meets back is not sharp
                const edgeAngle = Math.abs(angle - Math.PI / 2);  // Distance from pure side
                if (edgeAngle > 1.2) {
                    // Smooth transition from palm to back
                    const edgeSoftness = Math.pow((edgeAngle - 1.2) / (Math.PI / 2 - 1.2), 0.5) * 0.1;
                    x *= (1 - edgeSoftness * 0.1);
                }

                // 8. ORGANIC MICRO-VARIATION - Natural irregularity
                const seed1 = Math.sin(t * 37 + yt * 19);
                const seed2 = Math.cos(t * 23 - yt * 31);
                const seed3 = Math.sin((t + 0.5) * 17 + yt * 13);
                const microNoise = (seed1 * seed2 * 0.015 + seed3 * 0.008);
                x += microNoise * halfWidth;
                z += microNoise * baseThickness * 0.3;

                points.push({ x: x * S, z: z * S });
            }

            return points;
        }

        // Build the palm mesh with high detail
        const verts = [];
        const indices = [];

        // Generate vertices for each Y level
        for (let yi = 0; yi <= yLevels; yi++) {
            const yt = yi / yLevels;
            const y = yt * PALM_LENGTH * S;
            const outline = getAnatomicalOutline(yt);

            for (const pt of outline) {
                verts.push(pt.x, y, pt.z);
            }
        }

        // Generate triangle indices
        const ptsPerLevel = numAngles + 1;
        for (let yi = 0; yi < yLevels; yi++) {
            for (let pi = 0; pi < numAngles; pi++) {
                const a = yi * ptsPerLevel + pi;
                const b = a + 1;
                const c = a + ptsPerLevel;
                const d = c + 1;
                indices.push(a, c, b, b, c, d);
            }
        }

        // Wrist end cap
        const wristCenterIdx = verts.length / 3;
        verts.push(0, 0, 0);
        for (let pi = 0; pi < numAngles; pi++) {
            indices.push(wristCenterIdx, pi + 1, pi);
        }

        // Knuckle end cap
        const topStart = yLevels * ptsPerLevel;
        const topCenterIdx = verts.length / 3;
        verts.push(0, PALM_LENGTH * S, 0);
        for (let pi = 0; pi < numAngles; pi++) {
            indices.push(topCenterIdx, topStart + pi, topStart + pi + 1);
        }

        const palmGeo = new THREE.BufferGeometry();
        palmGeo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
        palmGeo.setIndex(indices);
        palmGeo.computeVertexNormals();

        const palm = new THREE.Mesh(palmGeo, matMain);
        palmGroup.add(palm);

        // Inner structural layer for wireframe depth
        const innerPalm = new THREE.Mesh(palmGeo.clone(), matDim);
        innerPalm.scale.set(0.82, 0.97, 0.82);
        palmGroup.add(innerPalm);

        return palmGroup;
    }

    // ============================================
    // CREATE WRIST
    // ============================================
    function createWrist() {
        const wristGroup = new THREE.Group();
        // Match wrist to palm's bottom dimensions
        const fingerMaxX = Math.max(Math.abs(MCP_POSITIONS.index.x), Math.abs(MCP_POSITIONS.pinky.x));
        const knuckleHalfWidth = fingerMaxX + 0.15;
        const wristHalfWidth = knuckleHalfWidth * 0.65;  // Same as palm bottom
        const wristWidth = wristHalfWidth * 2 * SCALE;  // Full width, scaled
        const wristDepth = PALM_THICKNESS * SCALE * 0.85;
        const wristLength = PALM_LENGTH * SCALE * 0.3;

        // Build wrist as tapered elliptical cylinder
        const uSegs = 16;
        const vSegs = 8;
        const verts = [];
        const indices = [];

        for (let v = 0; v <= vSegs; v++) {
            const vt = v / vSegs;
            const y = -vt * wristLength;  // Goes downward from y=0

            // Taper toward forearm
            const taper = 1 - vt * 0.15;
            const w = wristWidth * taper;
            const d = wristDepth * taper;

            for (let u = 0; u <= uSegs; u++) {
                const theta = (u / uSegs) * Math.PI * 2;
                const x = Math.cos(theta) * w * 0.5;
                let z = Math.sin(theta) * d * 0.5;

                // Slight bone bumps on sides (ulna/radius styloids)
                if (Math.abs(Math.cos(theta)) > 0.7 && vt < 0.4) {
                    const bump = (1 - vt / 0.4) * 0.15 * wristDepth;
                    z += Math.sin(theta) > 0 ? bump : bump * 0.5;
                }

                verts.push(x, y, z);
            }
        }

        for (let v = 0; v < vSegs; v++) {
            for (let u = 0; u < uSegs; u++) {
                const a = v * (uSegs + 1) + u;
                const b = a + 1;
                const c = a + uSegs + 1;
                const d = c + 1;
                indices.push(a, b, c, b, d, c);
            }
        }

        const wristGeo = new THREE.BufferGeometry();
        wristGeo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
        wristGeo.setIndex(indices);
        wristGeo.computeVertexNormals();

        const wrist = new THREE.Mesh(wristGeo, matMain);
        wristGroup.add(wrist);

        // Inner layer
        const innerWrist = new THREE.Mesh(wristGeo.clone(), matDim);
        innerWrist.scale.set(0.75, 0.98, 0.75);
        wristGroup.add(innerWrist);

        return wristGroup;
    }

    // ============================================
    // CREATE WEBBING BETWEEN FINGERS
    // ============================================
    function createWebbing(finger1Pos, finger2Pos, depth) {
        const webGeo = new THREE.PlaneGeometry(
            Math.abs(finger2Pos.x - finger1Pos.x) * SCALE * 1.1,
            depth * SCALE,
            4, 6
        );

        // Curve the webbing
        const pos = webGeo.attributes.position;
        for (let i = 0; i < pos.count; i++) {
            const y = pos.getY(i);
            const normalizedY = y / (depth * SCALE * 0.5);
            // Curve down in middle
            const curve = (1 - normalizedY * normalizedY) * depth * SCALE * 0.15;
            pos.setZ(i, curve);
        }
        webGeo.computeVertexNormals();

        const web = new THREE.Mesh(webGeo, matWeb);
        web.position.set(
            (finger1Pos.x + finger2Pos.x) * 0.5 * SCALE,
            (finger1Pos.y - depth * 0.3) * SCALE,
            (finger1Pos.z + finger2Pos.z) * 0.5 * SCALE + 0.1
        );
        web.rotation.x = -0.2;
        return web;
    }

    // ============================================
    // ASSEMBLE THE HAND
    // ============================================

    // Palm
    const palm = createPalm();
    group.add(palm);

    // Wrist
    const wrist = createWrist();
    group.add(wrist);

    // Fingers dictionary for animation
    const fingers = {};

    // Create anatomically accurate thumb
    const thumb = createThumb();
    // Thumb orientation for left hand - sticks out to the side
    thumb.rotation.set(0.2, 0.4, 1.0);
    thumb.userData.baseRotX = 0.2;
    thumb.userData.baseRotY = 0.4;
    thumb.userData.baseRotZ = 1.0;
    fingers.thumb = thumb;
    group.add(thumb);

    // Create index finger
    const index = createFinger('index', {
        length: FINGER_LENGTHS.index,
        baseWidth: FINGER_WIDTHS.index.base,
        tipWidth: FINGER_WIDTHS.index.tip,
        mcpPos: MCP_POSITIONS.index,
        restAngles: REST_ANGLES.index
    });
    index.rotation.z = 0.05;  // Slight spread
    index.userData.baseRotZ = 0.05;
    fingers.index = index;
    group.add(index);

    // Create middle finger
    const middle = createFinger('middle', {
        length: FINGER_LENGTHS.middle,
        baseWidth: FINGER_WIDTHS.middle.base,
        tipWidth: FINGER_WIDTHS.middle.tip,
        mcpPos: MCP_POSITIONS.middle,
        restAngles: REST_ANGLES.middle
    });
    middle.userData.baseRotZ = 0;
    fingers.middle = middle;
    group.add(middle);

    // Create ring finger
    const ring = createFinger('ring', {
        length: FINGER_LENGTHS.ring,
        baseWidth: FINGER_WIDTHS.ring.base,
        tipWidth: FINGER_WIDTHS.ring.tip,
        mcpPos: MCP_POSITIONS.ring,
        restAngles: REST_ANGLES.ring
    });
    ring.rotation.z = -0.04;
    ring.userData.baseRotZ = -0.04;
    fingers.ring = ring;
    group.add(ring);

    // Create pinky finger
    const pinky = createFinger('pinky', {
        length: FINGER_LENGTHS.pinky,
        baseWidth: FINGER_WIDTHS.pinky.base,
        tipWidth: FINGER_WIDTHS.pinky.tip,
        mcpPos: MCP_POSITIONS.pinky,
        restAngles: REST_ANGLES.pinky
    });
    pinky.rotation.z = -0.1;
    pinky.userData.baseRotZ = -0.1;
    fingers.pinky = pinky;
    group.add(pinky);

    // Webbing between fingers
    const webIndexMiddle = createWebbing(MCP_POSITIONS.index, MCP_POSITIONS.middle, FINGER_LENGTHS.index * 0.18);
    group.add(webIndexMiddle);

    const webMiddleRing = createWebbing(MCP_POSITIONS.middle, MCP_POSITIONS.ring, FINGER_LENGTHS.middle * 0.18);
    group.add(webMiddleRing);

    const webRingPinky = createWebbing(MCP_POSITIONS.ring, MCP_POSITIONS.pinky, FINGER_LENGTHS.ring * 0.20);
    group.add(webRingPinky);

    // Thumb webbing (larger)
    const thumbWeb = new THREE.Mesh(
        new THREE.PlaneGeometry(PALM_WIDTH * SCALE * 0.35, PALM_LENGTH * SCALE * 0.25, 4, 4),
        matWeb
    );
    thumbWeb.position.set(PALM_WIDTH * SCALE * 0.32, PALM_LENGTH * SCALE * 0.45, PALM_THICKNESS * SCALE * 0.1);
    thumbWeb.rotation.set(-0.3, 0.4, 0.3);
    group.add(thumbWeb);

    // ============================================
    // DECORATIVE ELEMENTS
    // ============================================

    // Energy particles
    const particles = [];
    for (let i = 0; i < 4; i++) {
        const particle = new THREE.Mesh(
            new THREE.SphereGeometry(0.15 * SCALE, 6, 6),
            matGlow
        );
        particle.userData.orbit = {
            radiusX: 1.5 + Math.random() * 1.5,
            radiusY: 1 + Math.random(),
            radiusZ: 1 + Math.random(),
            speed: 0.5 + Math.random() * 0.5,
            phase: Math.random() * Math.PI * 2,
            offsetY: PALM_LENGTH * SCALE * 0.4
        };
        particles.push(particle);
        group.add(particle);
    }


    // ============================================
    // FINAL SETUP
    // ============================================

    // Position hand in natural pose
    group.rotation.set(0.1, -0.05, 0.08);

    // Store references for animation
    group.userData.type = 'swimmer_hand';
    group.userData.fingers = fingers;
    group.userData.particles = particles;
    group.userData.swimPhase = 0;
    group.userData.PALM_LENGTH = PALM_LENGTH * SCALE;

    // Store materials for theme switching
    group.userData.materials = allMaterials;
    group.userData.colors = {
        primary: COL.main,
        wire: COL.light,
        glow: COL.glow,
        accent: COL.light
    };

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

function createQuadcopter() {
    const group = new THREE.Group();

    // Central body - compact sphere
    const bodyGeo = new THREE.SphereGeometry(1.2, 16, 16);
    const bodyMat = createIridescentMaterial(0.5);
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    group.add(body);

    // Camera/sensor dome on bottom
    const domeGeo = new THREE.SphereGeometry(0.5, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2);
    const domeMat = new THREE.MeshPhysicalMaterial({
        color: 0x111122,
        metalness: 0.9,
        roughness: 0.1,
        clearcoat: 1.0
    });
    const dome = new THREE.Mesh(domeGeo, domeMat);
    dome.position.y = -0.8;
    dome.rotation.x = Math.PI;
    group.add(dome);

    const propellers = [];
    const armMat = createIridescentMaterial(0.6);

    // 4 arms + propellers at 45, 135, 225, 315 degrees (X pattern)
    for (let i = 0; i < 4; i++) {
        const angle = (i / 4) * Math.PI * 2 + Math.PI / 4; // Offset by 45 degrees

        // Arm - thin elongated box
        const armGeo = new THREE.BoxGeometry(5, 0.3, 0.5);
        const arm = new THREE.Mesh(armGeo, armMat);
        arm.position.x = Math.cos(angle) * 2.5;
        arm.position.z = Math.sin(angle) * 2.5;
        arm.position.y = 0.2;
        arm.rotation.y = -angle;
        group.add(arm);

        // Motor housing at arm end
        const motorGeo = new THREE.CylinderGeometry(0.4, 0.5, 0.6, 12);
        const motor = new THREE.Mesh(motorGeo, bodyMat);
        motor.position.x = Math.cos(angle) * 5;
        motor.position.z = Math.sin(angle) * 5;
        motor.position.y = 0.5;
        group.add(motor);

        // Propeller - 2-blade design using thin boxes
        const propGroup = new THREE.Group();
        const propMat = createWireframeMaterial(0x88ccff);
        propMat.wireframe = false;
        propMat.opacity = 0.7;

        // Blade 1
        const blade1Geo = new THREE.BoxGeometry(3.5, 0.08, 0.4);
        const blade1 = new THREE.Mesh(blade1Geo, propMat);
        propGroup.add(blade1);

        // Blade 2 (perpendicular)
        const blade2Geo = new THREE.BoxGeometry(0.4, 0.08, 3.5);
        const blade2 = new THREE.Mesh(blade2Geo, propMat);
        propGroup.add(blade2);

        propGroup.position.x = Math.cos(angle) * 5;
        propGroup.position.z = Math.sin(angle) * 5;
        propGroup.position.y = 0.9;

        // Alternate spin direction for realism
        propGroup.userData.spinDirection = i % 2 === 0 ? 1 : -1;

        group.add(propGroup);
        propellers.push(propGroup);
    }

    // Landing skids
    const skidMat = new THREE.MeshPhysicalMaterial({
        color: 0x333344,
        metalness: 0.8,
        roughness: 0.3
    });

    for (let side = -1; side <= 1; side += 2) {
        const skidGeo = new THREE.CylinderGeometry(0.1, 0.1, 6, 8);
        skidGeo.rotateZ(Math.PI / 2);
        const skid = new THREE.Mesh(skidGeo, skidMat);
        skid.position.set(0, -1.5, side * 2);
        group.add(skid);

        // Skid supports
        for (let x = -1; x <= 1; x += 2) {
            const supportGeo = new THREE.CylinderGeometry(0.08, 0.08, 1, 6);
            const support = new THREE.Mesh(supportGeo, skidMat);
            support.position.set(x * 1.5, -1, side * 2);
            group.add(support);
        }
    }

    group.userData.type = 'quadcopter';
    group.userData.propellers = propellers;
    group.userData.waypoints = [];
    group.userData.currentWaypoint = 0;
    group.userData.waypointProgress = 0;
    group.userData.waypointSpeed = 0.3; // ~3.3 seconds per waypoint
    group.userData.rotationSpeed = 0; // Disable default rotation (quadcopter has custom rotation)

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

            case 'quadcopter':
                // ===================================================
                // SECTION 1: Propeller Animation
                // ===================================================
                if (structure.userData.propellers) {
                    structure.userData.propellers.forEach(prop => {
                        prop.rotation.y += deltaTime * 30 * prop.userData.spinDirection;
                    });
                }

                // ===================================================
                // SECTION 2: Waypoint Navigation
                // ===================================================
                if (structure.userData.waypoints && structure.userData.waypoints.length > 1) {
                    const waypoints = structure.userData.waypoints;

                    // Initialize base position storage (once)
                    if (!structure.userData.basePosition) {
                        structure.userData.basePosition = new THREE.Vector3();
                    }

                    // Advance progress along current segment (frame-rate independent)
                    structure.userData.waypointProgress = (structure.userData.waypointProgress || 0) + deltaTime * structure.userData.waypointSpeed;

                    // Advance to next waypoint when segment complete
                    if (structure.userData.waypointProgress >= 1) {
                        structure.userData.waypointProgress -= 1; // Keep overflow for smooth transition
                        structure.userData.currentWaypoint = (structure.userData.currentWaypoint + 1) % waypoints.length;
                    }

                    // Get indices AFTER potential advancement to avoid 1-frame teleport
                    const currentIdx = structure.userData.currentWaypoint || 0;
                    const nextIdx = (currentIdx + 1) % waypoints.length;

                    // Smooth easing function (ease-in-out quadratic)
                    const t = structure.userData.waypointProgress;
                    const easeT = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;

                    // Calculate interpolated position between waypoints
                    const startPos = waypoints[currentIdx];
                    const endPos = waypoints[nextIdx];
                    structure.userData.basePosition.lerpVectors(startPos, endPos, easeT);

                    // ===================================================
                    // SECTION 3: Orientation Smoothing
                    // ===================================================
                    const dirVec = new THREE.Vector3().subVectors(endPos, startPos);
                    const dirLen = dirVec.length();

                    if (dirLen > 0.01) {
                        dirVec.divideScalar(dirLen); // Safe normalize

                        // Initialize smoothed direction on first frame
                        if (!structure.userData.smoothDir) {
                            structure.userData.smoothDir = { x: dirVec.x, z: dirVec.z };
                        }

                        // Frame-rate independent exponential smoothing
                        const smoothFactor = 1 - Math.pow(1 - 0.03, deltaTime * 60);
                        structure.userData.smoothDir.x += (dirVec.x - structure.userData.smoothDir.x) * smoothFactor;
                        structure.userData.smoothDir.z += (dirVec.z - structure.userData.smoothDir.z) * smoothFactor;

                        const sd = structure.userData.smoothDir;

                        // Calculate target rotations based on movement direction
                        // Add base tilt for diagonal viewing angle
                        const baseTilt = structure.userData.baseTilt || { x: 0, z: 0 };
                        const targetRoll = -sd.x * 0.25 + baseTilt.z;
                        const targetPitch = sd.z * 0.15 + baseTilt.x;
                        const targetYaw = Math.atan2(sd.x, sd.z);

                        // Frame-rate independent rotation smoothing
                        const rotSmoothFactor = 1 - Math.pow(1 - 0.02, deltaTime * 60);
                        structure.rotation.z += (targetRoll - structure.rotation.z) * rotSmoothFactor;
                        structure.rotation.x += (targetPitch - structure.rotation.x) * rotSmoothFactor;

                        // Smooth yaw with angle wrapping
                        let yawDiff = targetYaw - structure.rotation.y;
                        while (yawDiff > Math.PI) yawDiff -= Math.PI * 2;
                        while (yawDiff < -Math.PI) yawDiff += Math.PI * 2;
                        structure.rotation.y += yawDiff * rotSmoothFactor;
                    }

                    // ===================================================
                    // SECTION 4: Apply Position with Hover Bob
                    // ===================================================
                    const hoverOffset = Math.sin(time * 6) * 0.01;
                    structure.position.copy(structure.userData.basePosition);
                    structure.position.y += hoverOffset;
                }
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
    const projects = [
        {
            title: 'Real-World 3D Environments',
            description: 'In collaboration with Religious Studies, we have been doing 3D reconstruction of sites in Nepal. By combining LiDAR data with terrestrial and aerial photogrammetry we can produce highly accurate 3D models of real-world locations.',
            tags: ['3D Modeling', 'LiDAR', 'Photogrammetry']
        },
        {
            title: 'Magnetohydrodynamic Drive',
            description: 'In collaboration with Applied Math, undergraduate Tate Semone is designing a device that harnesses the conductive properties of salt water to produce a propulsion system with no moving parts, using a combination of electric and magnetic fields.',
            tags: ['Propulsion', 'Applied Math', 'Physics']
        },
        {
            title: 'Swarm Robots',
            description: 'Undergraduate Sanskriti Negi is working on two separate projects utilizing swarm robots. The first is a manta ray based robot for seafloor mapping. The second uses deformable graspers for picking up unusually shaped objects.',
            tags: ['Robotics', 'Swarm Intelligence', 'Marine']
        },
        {
            title: 'Virtual Reality Experiences',
            description: 'We are using game engines like Unity to create VR applications that revolutionize classroom learning. We are exploring techniques that would allow users to experience large VR environments in classroom-sized locations.',
            tags: ['VR', 'Unity', 'Education']
        },
        {
            title: 'Optimizing Hand Position for Swimming',
            description: 'In collaboration with Applied Math, EXSS, and the U.S. Olympic swim team, we are researching ways to increase swimmer speed by perfecting hand position. In parallel, we are engineering a glove that can track hand position in real time.',
            tags: ['Biomechanics', 'Olympics', 'Wearables']
        },
        {
            title: 'Autonomous Vehicles',
            description: 'In our version of an autonomous vehicle, instead of pointing our sensor array outward, we focus inward on the occupant of our vehicle—a goldfish. We track the goldfish inside the tank and move the vehicle based on its position.',
            tags: ['Autonomous', 'Computer Vision', 'Robotics']
        },
        {
            title: 'Augmented Aurality',
            description: 'In collaboration with VCAIL, we are developing a listening enhancement device that uses an array of microphones to allow users to filter out ambient noises and focus on one single sound source with increased clarity.',
            tags: ['Audio', 'Signal Processing', 'Accessibility']
        },
        {
            title: 'Smart Irrigation System',
            description: 'Undergraduate Darwin Lemus is designing a system to optimize irrigation in greenhouses. His system monitors soil moisture for each plant, consistently adding just the right amount of water to maintain plant health.',
            tags: ['IoT', 'Agriculture', 'Sustainability']
        }
    ];

    let html = '<h1 class="expanded-title">Research Projects</h1><div class="projects-grid">';

    projects.forEach(project => {
        html += '<div class="project-card">';
        html += '<div class="project-image">[Project Image]</div>';
        html += '<h3 class="project-title">' + project.title + '</h3>';
        html += '<p class="project-description">' + project.description + '</p>';
        html += '<div class="project-tags">';
        project.tags.forEach(tag => {
            html += '<span class="project-tag">' + tag + '</span>';
        });
        html += '</div></div>';
    });

    html += '</div>';
    return html;
}

function getPeopleContent() {
    // LinkedIn SVG icon function - creates clickable link if URL provided
    function linkedinLink(url) {
        if (!url) return '';
        return '<a href="' + url + '" class="linkedin-link" target="_blank" rel="noopener noreferrer" aria-label="LinkedIn Profile"><svg class="linkedin-icon" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg></a>';
    }

    // Lab Director
    const labDirector = { name: 'Jim Mahaney', role: 'Director of Engineering and Research' };

    // Featured team members with full profiles
    const featuredMembers = [
        {
            name: 'Markandeya Yalamanchi',
            major: 'Computer Science',
            status: 'Freshman',
            graduation: 'May 2028',
            project: 'Developing redirected walking (RDW) techniques for Meta Quest 3 VR, enabling users to navigate large virtual environments within smaller physical spaces. Currently building predictive models to anticipate reset frequency based on virtual environment topology, moving beyond implementing existing algorithms to discovering novel relationships between environment design and RDW effectiveness.',
            headshot: 'headshots/markandeya-yalamanchi.jpg',
            linkedin: 'https://www.linkedin.com/in/markyala'
        },
        {
            name: 'Hengli Wang',
            major: 'Computer Science',
            status: 'Sophomore',
            graduation: 'December 2027',
            project: 'The Swimmer Hand Project.',
            headshot: 'headshots/hengli-wang.jpg',
            linkedin: 'https://www.linkedin.com/in/hengliwang3300'
        },
        {
            name: 'Tate Semone',
            major: 'Physics',
            status: 'Sophomore',
            graduation: 'May 2028',
            project: 'My project tests magnetic-field orientations to maximize flow efficiency in a magnetohydrodynamic drive. Model 1 uses a circularly oriented B-field with a radially outward electric field; Model 2 utilizes a Halbach array to concentrate flux in the channel. Efficiency is evaluated using Particle Image Velocimetry (PIV) flow measurements.',
            headshot: 'headshots/tate-semone.jpeg',
            linkedin: 'https://www.linkedin.com/in/tate-semone-105905268'
        },
        {
            name: 'Sofia Morais',
            major: 'Biomedical Engineering',
            status: 'Junior',
            graduation: 'May 2027',
            project: 'Designing a glove to track finger position for sports and physical therapy applications by integrating flex sensors with Arduino microcontrollers to measure finger bending and separation, while showing real-time hand movement on a hand model in Unity. She also enjoys learning fabrication skills such as welding and milling.',
            headshot: 'headshots/sofia-morais.jpeg',
            linkedin: 'https://www.linkedin.com/in/sofia-morais-486ba3277'
        },
        {
            name: 'Fletcher Stuart',
            major: 'Computer Science',
            status: 'Senior',
            graduation: 'May 2026',
            project: 'I am developing an Unreal Engine application to visualize the Swayambhu temple in Kathmandu, Nepal. The application is intended to educate and immerse people in the site.',
            headshot: 'headshots/fletcher-stuart.jpg',
            linkedin: 'https://www.linkedin.com/in/fletchstu'
        },
        {
            name: 'Elyssa Snively',
            major: 'Biomedical Engineering',
            status: 'Junior',
            graduation: 'May 2027',
            project: 'My project reprograms the Boston Dynamics Spot robot to operate as an autonomous guide dog, using AI-driven navigation, mapping, localization, obstacle detection, and voice-based destination commands. The system integrates perception, decision-making, and a custom physical handle interface to provide safe, timely guidance for visually impaired users on campus.',
            headshot: 'headshots/elyssa-snively.jpg',
            linkedin: 'https://www.linkedin.com/in/elyssa-snively'
        },
        {
            name: 'Ishi Varshney',
            major: 'Computer Science',
            status: 'Sophomore',
            graduation: 'May 2028',
            project: 'My current project reprograms the Boston Dynamics Spot robot to act as an autonomous guide dog, enabling safe, intuitive navigation for visually impaired users. Initially focused on the UNC campus, the system uses AI-driven perception and voice commands to support scalable, location-independent mobility beyond environments where traditional guide dogs can be trained.',
            headshot: 'headshots/ishi-varshney.jpeg',
            linkedin: 'https://www.linkedin.com/in/ishi-varshney'
        },
        {
            name: 'Alexa Tinajero',
            major: 'Computer Science',
            status: 'Sophomore',
            graduation: 'May 2028',
            project: 'This project involves developing the software that allows the Boston Dynamics Spot robot to navigate a campus environment independently as a guide for visually impaired users. I focus on how the robot interprets its surroundings through mapping, localization, and obstacle detection, makes navigation decisions using AI-based planning, and responds to voice-based destination commands. These components work together with a physical guidance handle to support safe, timely movement through real-world campus spaces.',
            headshot: 'headshots/alexa-tinajero.jpeg',
            linkedin: 'https://www.linkedin.com/in/alexatinajero'
        },
        {
            name: 'Lily Foo',
            major: 'Physics',
            status: 'Sophomore',
            graduation: 'June 2028',
            project: 'Studying the dynamics of drag on hand position in fluids for swimmers.',
            headshot: 'headshots/lily-foo.png',
            linkedin: null
        },
        {
            name: 'Riley Goodwin',
            major: 'Biomedical Engineering',
            status: 'Freshman',
            graduation: 'May 2029',
            project: 'I\'m currently helping code a Fish operated vehicle that uses a camera to track the movement of a fish, allowing it to both accelerate and change directions. I\'m on a team working on creating a waterproof movement tracking glove that is used to find the optimal hand positioning for swimmers.',
            headshot: 'headshots/riley-goodwin.jpg',
            linkedin: 'https://www.linkedin.com/in/riley-goodwinq'
        },
        {
            name: 'Ethan DeRosa',
            major: 'Biomedical Engineering',
            status: 'Junior',
            graduation: 'May 2027',
            project: 'Assisting with the hardware components of the fish driving car.',
            headshot: null,
            linkedin: 'https://www.linkedin.com/in/ethandre'
        }
    ];

    // Build Lab Director section
    let html = '<h1 class="expanded-title">Our Team</h1>';
    html += '<div class="people-section">';
    html += '<h2 class="people-section-title">Lab Director</h2>';
    html += '<div class="people-grid director-grid">';
    html += '<div class="person-card director-card">';
    html += '<div class="person-image placeholder-image"><span>JM</span></div>';
    html += '<h3 class="person-name">' + labDirector.name + '</h3>';
    html += '<p class="person-role">' + labDirector.role + '</p>';
    html += '</div>';
    html += '</div></div>';

    // Build Featured Team Members section
    html += '<div class="people-section">';
    html += '<h2 class="people-section-title">Research Team</h2>';
    html += '<div class="people-grid featured-grid">';

    // Other team members without full profiles yet
    const otherMembers = [
        'Matthew Alexander',
        'Ansh Aryan',
        'Noah Butler',
        'Andy Choe',
        'Matthew Czar',
        'Siera Gashi',
        'Ethan Hernandez',
        'Toluwani Ilesanmi',
        'Cameron Johnson',
        'Darwin Lemus',
        'Matias Magallanes',
        'David Majernik',
        'Eba Moreda',
        'Sanskriti Negi',
        'Coleman Stephens',
        'Meghan Parker',
        'Allen Solomon',
        'Mihika Tyagi',
        'Alexander Yevchenko',
        'Sidharth Yeramaddu',
        'William Keffer'
    ];

    // Render featured members with full profiles
    featuredMembers.forEach(function(member) {
        html += '<div class="person-card featured-card">';
        if (member.headshot) {
            html += '<img class="person-image person-headshot" src="' + member.headshot + '" alt="' + member.name + '" loading="lazy">';
        } else {
            var initials = member.name.split(' ').map(function(n) { return n[0]; }).join('');
            html += '<div class="person-image placeholder-image"><span>' + initials + '</span></div>';
        }
        html += '<div class="person-info">';
        html += '<h3 class="person-name">' + member.name + '</h3>';
        html += '<p class="person-details">' + member.major + ' · ' + member.status + '</p>';
        html += '<p class="person-graduation">Expected Graduation: ' + member.graduation + '</p>';
        html += '<p class="person-bio">' + member.project + '</p>';
        html += linkedinLink(member.linkedin);
        html += '</div>';
        html += '</div>';
    });

    // Render other members with placeholder cards
    otherMembers.forEach(function(name) {
        var initials = name.split(' ').map(function(n) { return n[0]; }).join('');
        html += '<div class="person-card">';
        html += '<div class="person-image placeholder-image"><span>' + initials + '</span></div>';
        html += '<h3 class="person-name">' + name + '</h3>';
        html += '<p class="person-role">Research Team</p>';
        html += '</div>';
    });

    html += '</div></div>';

    return html;
}

function getAboutContent() {
    return '<h1 class="expanded-title">About EEL</h1><div class="content-section"><p class="about-text">Content coming soon.</p></div>';
}

function getJoinContent() {
    return '<h1 class="expanded-title">Join Our Lab</h1><div class="content-section"><p class="about-text">Content coming soon.</p></div>';
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
console.log('%c\u2726 13 Engineering Structures with Realistic Organic Human Hand', 'color: #a8d5e8; font-size: 12px;');
console.log('%c\u25C8 Circuit Grid Matrix Connection System', 'color: #7ec8e3; font-size: 12px;');