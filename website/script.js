// EEL - Experimental Engineering Lab
// Golden Ratio Cybercore System with Radial Panel Layout

const PHI = 1.618033988749;
const PHI_INV = 0.618033988749;

// Mobile portrait CSS hides the WebGL canvas and circuit network completely.
// Keep their state available for orientation changes, but do not spend every
// frame rendering elements that cannot contribute a pixel to the page.
const _initialTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
const _initialNarrowViewport = window.innerWidth <= 768;
const _initialMobileDevice =
    (_initialTouchDevice && window.matchMedia('(pointer: coarse)').matches &&
        window.matchMedia('(hover: none)').matches) ||
    (_initialTouchDevice && _initialNarrowViewport);

const RuntimeVisibility = {
    // Match MobileHandler's existing device test synchronously so hidden work
    // never starts during the handler's short initialization delay.
    mobilePortrait: _initialMobileDevice && window.innerHeight > window.innerWidth,

    setMobilePortrait: function(isMobilePortrait) {
        const wasHidden = this.mobilePortrait;
        this.mobilePortrait = isMobilePortrait;

        // The circuit network is skipped during an initial mobile-portrait
        // load. Create it lazily if an orientation change makes it visible.
        if (wasHidden && !isMobilePortrait &&
            radialPanelPhysics && radialPanelPhysics.initialized &&
            !CircuitGridMatrix.initialized) {
            TetherSystem.init();
            TetherSystem.update();
        }

        if (wasHidden && !isMobilePortrait) startVisualRuntime();
        if (!wasHidden && isMobilePortrait && !renderer) startMobileGearLoop();
    }
};

// The mobile handler loads after this file and uses this narrow hook to keep
// the render loop in sync with its already-existing layout decision.
window.EELRuntime = RuntimeVisibility;

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
        
               console.log('%cTheme initialized: ' + initialTheme + ' mode',
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
        return this.position;
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
    cachedMedallionEl: null,
    cachedMedallionRadius: 100,
    
    // Grid configuration
    gridSize: 40, // Grid cell size in pixels
    gridOpacity: 0.08,
    
    // Connection data
    connections: new Map(),
    connectionList: [],
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
            const connection = {
                panelId: 'panel-' + id,
                path: null,
                pathElement: null,
                pathGlowElement: null,
                junctions: [],
                packets: [],
                pathPoints: [],
                segmentLengths: [],
                totalLength: 0
            };
            this.connections.set(connection.panelId, connection);
            this.connectionList.push(connection);
            
            // Create multiple packets per connection for visual richness
            for (let p = 0; p < 2; p++) {
                this.packets.push({
                    connectionId: 'panel-' + id,
                    connection: connection,
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

        // Cache medallion radius
        this.cachedMedallionEl = document.getElementById('centralMedallion');
        if (this.cachedMedallionEl) {
            this.cachedMedallionRadius = this.cachedMedallionEl.offsetWidth / 2;
        }
        
                console.log('%cCircuit Grid Matrix initialized', 'color: #7ec8e3; font-weight: bold;');
    },
    
    createDefs: function() {
        const ns = 'http://www.w3.org/2000/svg';
        const defs = document.createElementNS(ns, 'defs');
        
        // Helper to create SVG filter with Gaussian blur + merge
        function createGlowFilter(id, x, y, w, h, blurConfigs) {
            const filter = document.createElementNS(ns, 'filter');
            filter.setAttribute('id', id);
            filter.setAttribute('x', x);
            filter.setAttribute('y', y);
            filter.setAttribute('width', w);
            filter.setAttribute('height', h);
            
            const merge = document.createElementNS(ns, 'feMerge');
            for (let i = 0; i < blurConfigs.length; i++) {
                const blur = document.createElementNS(ns, 'feGaussianBlur');
                blur.setAttribute('stdDeviation', blurConfigs[i].dev);
                blur.setAttribute('result', blurConfigs[i].result);
                filter.appendChild(blur);
                const mergeNode = document.createElementNS(ns, 'feMergeNode');
                mergeNode.setAttribute('in', blurConfigs[i].result);
                merge.appendChild(mergeNode);
            }
            // Add SourceGraphic as final merge node
            const srcNode = document.createElementNS(ns, 'feMergeNode');
            srcNode.setAttribute('in', 'SourceGraphic');
            merge.appendChild(srcNode);
            filter.appendChild(merge);
            return filter;
        }
        
        // Trace glow filter (reduced stdDeviation for performance)
        defs.appendChild(createGlowFilter('traceGlow', '-50%', '-50%', '200%', '200%',
            [{ dev: '2', result: 'coloredBlur' }]));
        
        // Packet glow filter
        defs.appendChild(createGlowFilter('packetGlow', '-100%', '-100%', '300%', '300%',
            [{ dev: '3', result: 'blur1' }]));
        
        // Node glow filter
        defs.appendChild(createGlowFilter('nodeGlow', '-100%', '-100%', '300%', '300%',
            [{ dev: '1.5', result: 'coloredBlur' }]));
        
        // Trace gradient
        const traceGradient = document.createElementNS(ns, 'linearGradient');
        traceGradient.setAttribute('id', 'traceGradient');
        const stops = [
            { offset: '0%', cls: 'trace-gradient-start' },
            { offset: '50%', cls: 'trace-gradient-mid' },
            { offset: '100%', cls: 'trace-gradient-end' }
        ];
        for (let i = 0; i < stops.length; i++) {
            const stop = document.createElementNS(ns, 'stop');
            stop.setAttribute('offset', stops[i].offset);
            stop.setAttribute('class', stops[i].cls);
            traceGradient.appendChild(stop);
        }
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
        const ns = 'http://www.w3.org/2000/svg';
        
        // Use SVG <pattern> instead of individual lines — reduces DOM nodes from ~75+ to 3
        // Ensure pattern defs exist in our SVG
        let defs = this.svg.querySelector('defs');
        
        // Remove old grid pattern if present
        const oldPattern = defs.querySelector('#circuitGridPattern');
        if (oldPattern) oldPattern.remove();
        
        const pattern = document.createElementNS(ns, 'pattern');
        pattern.setAttribute('id', 'circuitGridPattern');
        pattern.setAttribute('width', gridSize);
        pattern.setAttribute('height', gridSize);
        pattern.setAttribute('patternUnits', 'userSpaceOnUse');
        
        // Single cell: right edge + bottom edge lines
        const pathD = 'M ' + gridSize + ' 0 L ' + gridSize + ' ' + gridSize + ' M 0 ' + gridSize + ' L ' + gridSize + ' ' + gridSize;
        const pathEl = document.createElementNS(ns, 'path');
        pathEl.setAttribute('d', pathD);
        pathEl.setAttribute('class', 'circuit-grid-line');
        pathEl.setAttribute('fill', 'none');
        pattern.appendChild(pathEl);
        defs.appendChild(pattern);
        
        // Single rect covers entire viewport using the pattern
        const rect = document.createElementNS(ns, 'rect');
        rect.setAttribute('width', width);
        rect.setAttribute('height', height);
        rect.setAttribute('fill', 'url(#circuitGridPattern)');
        this.gridGroup.appendChild(rect);
    },
    
    createPacketElements: function() {
        this.packets.forEach((packet) => {
            // Move both packet layers as one compositor-friendly SVG group.
            // The old implementation changed four geometry attributes for
            // every packet, forcing repeated SVG layout on every update.
            const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
            group.setAttribute('class', 'circuit-packet-group');
            this.packetsGroup.appendChild(group);
            packet.groupElement = group;

            // Create glow element (larger, behind)
            const glow = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
            glow.setAttribute('class', 'circuit-packet-glow');
            glow.setAttribute('x', '-6');
            glow.setAttribute('y', '-6');
            glow.setAttribute('width', '12');
            glow.setAttribute('height', '12');
            glow.setAttribute('rx', '2');
            glow.setAttribute('filter', 'url(#packetGlow)');
            group.appendChild(glow);
            packet.glowElement = glow;
            
            // Create main packet element (diamond shape)
            const el = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
            el.setAttribute('class', 'circuit-packet');
            el.setAttribute('x', '-4');
            el.setAttribute('y', '-4');
            el.setAttribute('width', '8');
            el.setAttribute('height', '8');
            el.setAttribute('rx', '1');
            el.style.transform = 'rotate(45deg)';
            group.appendChild(el);
            packet.element = el;
        });
    },
    
    // Snap a coordinate value to the nearest grid intersection
    _snapVal: function(v) {
        const gs = this.gridSize;
        return Math.round(v / gs) * gs;
    },
    // Snap a point to the nearest grid intersection
    snapToGrid: function(x, y) {
        return {
            x: this._snapVal(x),
            y: this._snapVal(y)
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
            const xSign = isRightOfCenter ? 1 : -1;
            const turn1X = this._snapVal(leadOut.x + xSign * gridSize * 2);
            const yForTurn2 = isAboveCenter ? Math.min(leadOut.y, preEnd.y) - gridSize : Math.max(leadOut.y, preEnd.y) + gridSize;
            const turn2Y = this._snapVal(yForTurn2);
            points.push({ x: turn1X, y: leadOut.y });
            points.push({ x: turn1X, y: turn2Y });
            points.push({ x: preEnd.x, y: turn2Y });
            points.push({ x: preEnd.x, y: end.y });
        } else {
            // Vertical connection (to top/bottom edge)
            const ySign = isAboveCenter ? -1 : 1;
            const turn1Y = this._snapVal(leadOut.y + ySign * gridSize * 2);
            const xForTurn2 = isRightOfCenter ? Math.max(leadOut.x, preEnd.x) + gridSize : Math.min(leadOut.x, preEnd.x) - gridSize;
            const turn2X = this._snapVal(xForTurn2);
            points.push({ x: leadOut.x, y: turn1Y });
            points.push({ x: turn2X, y: turn1Y });
            points.push({ x: turn2X, y: preEnd.y });
            points.push({ x: end.x, y: preEnd.y });
        }
        
        // Final point exactly at panel edge
        points.push(end);
        
        return points;
    },
    
    // Create SVG path from points — uses array join for performance
    createPathFromPoints: function(points) {
        if (points.length < 2) return '';
        
        const parts = ['M', points[0].x, points[0].y];
        for (let i = 1; i < points.length; i++) {
            parts.push('L', points[i].x, points[i].y);
        }
        return parts.join(' ');
    },
    
    // Calculate total length of a path — optimized with local variable access
    calculatePathLength: function(points, segmentLengths) {
        let length = 0;
        let prevX = points[0].x, prevY = points[0].y;
        for (let i = 1, len = points.length; i < len; i++) {
            const px = points[i].x, py = points[i].y;
            const dx = px - prevX, dy = py - prevY;
            const segmentLength = Math.sqrt(dx * dx + dy * dy);
            if (segmentLengths) segmentLengths[i - 1] = segmentLength;
            length += segmentLength;
            prevX = px;
            prevY = py;
        }
        return length;
    },
    
    // Reusable point object to avoid GC pressure in hot path
    _tempPoint: { x: 0, y: 0 },
    
    // Get point along path at given progress (0-1)
    getPointAtProgress: function(points, segmentLengths, progress, precomputedLength) {
        if (points.length < 2) {
            const p = points[0] || this._tempPoint;
            this._tempPoint.x = p.x;
            this._tempPoint.y = p.y;
            return this._tempPoint;
        }

        const totalLength = precomputedLength || this.calculatePathLength(points);
        const targetLength = progress * totalLength;
        
        let currentLength = 0;
        for (let i = 1; i < points.length; i++) {
            const dx = points[i].x - points[i-1].x;
            const dy = points[i].y - points[i-1].y;
            const segmentLength = segmentLengths[i - 1];
            
            if (currentLength + segmentLength >= targetLength) {
                const t = segmentLength > 0 ? (targetLength - currentLength) / segmentLength : 0;
                this._tempPoint.x = points[i-1].x + dx * t;
                this._tempPoint.y = points[i-1].y + dy * t;
                return this._tempPoint;
            }
            currentLength += segmentLength;
        }
        
        const last = points[points.length - 1];
        this._tempPoint.x = last.x;
        this._tempPoint.y = last.y;
        return this._tempPoint;
    },
    
    // Reusable rect object to avoid GC pressure
    _tempRect: { x: 0, y: 0, width: 0, height: 0 },
    
    _frameSkip: 0,
    
    update: function() {
        if (!this.initialized || !radialPanelPhysics) return;
        
        // Run every 2nd frame (30fps is sufficient for SVG packet animations)
        this._frameSkip++;
        if (this._frameSkip & 1) return;
        
        const now = performance.now();
        const deltaTime = (now - this.lastUpdateTime) / 1000;
        this.lastUpdateTime = now;
        
        const center = MedallionSystem.getCenter();
        const medallionRadius = this.cachedMedallionRadius;
        const tempRect = this._tempRect;
        
        // Update each connection without allocating per-frame iterator callbacks.
        for (let connectionIndex = 0; connectionIndex < this.connectionList.length; connectionIndex++) {
            const conn = this.connectionList[connectionIndex];
            const panelData = radialPanelPhysics.panels.get(conn.panelId);
            if (!panelData) continue;
            
            // Reuse rect object instead of creating new one each frame
            tempRect.x = panelData.position.x;
            tempRect.y = panelData.position.y;
            tempRect.width = panelData.width || 180;
            tempRect.height = panelData.height || 240;
            
            // Only recalculate route if panel has moved since last frame
            const posKey = tempRect.x | 0;
            const posKeyY = tempRect.y | 0;
            if (conn._lastPosX === posKey && conn._lastPosY === posKeyY && conn.pathPoints.length > 0) {
                // Panel hasn't moved (integer precision) — skip expensive route recalculation
            } else {
                conn._lastPosX = posKey;
                conn._lastPosY = posKeyY;
                
                // Get panel angle from data attribute (cache it)
                if (conn._cachedAngle === undefined) {
                    conn._cachedAngle = parseFloat(panelData.element.dataset.angle) || 0;
                }
                
                // Calculate route
                const points = this.calculateRoute(center, medallionRadius, tempRect, conn._cachedAngle);
                conn.pathPoints = points;
                conn.segmentLengths.length = points.length - 1;
                conn.totalLength = this.calculatePathLength(points, conn.segmentLengths);
                
                // Create/update path elements
                const pathD = this.createPathFromPoints(points);
                
                if (!conn.pathGlowElement) {
                    conn.pathGlowElement = document.createElementNS('http://www.w3.org/2000/svg', 'path');
                    conn.pathGlowElement.setAttribute('class', 'circuit-trace-glow');
                    // Glow simulated via wider stroke + opacity instead of expensive SVG blur filter
                    this.tracesGroup.appendChild(conn.pathGlowElement);
                }
                conn.pathGlowElement.setAttribute('d', pathD);
                
                if (!conn.pathElement) {
                    conn.pathElement = document.createElementNS('http://www.w3.org/2000/svg', 'path');
                    conn.pathElement.setAttribute('class', 'circuit-trace');
                    this.tracesGroup.appendChild(conn.pathElement);
                }
                conn.pathElement.setAttribute('d', pathD);
                
                // Create/update junction nodes at turns
                this.updateJunctionNodes(conn, points);
            }
        }
        
        // Animate packets
        for (let packetIndex = 0; packetIndex < this.packets.length; packetIndex++) {
            const packet = this.packets[packetIndex];
            const conn = packet.connection;
            if (!conn || conn.pathPoints.length < 2) continue;
            
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
            const pos = this.getPointAtProgress(
                conn.pathPoints, conn.segmentLengths, packet.progress, conn.totalLength
            );
            
            // A single transform replaces four SVG geometry mutations. The
            // root SVG has no viewBox, so one user unit remains one CSS pixel.
            if (packet.groupElement) {
                packet.groupElement.style.transform =
                    'translate(' + pos.x + 'px, ' + pos.y + 'px)';
            }
            
            // Pulse nearby junction nodes
            this.pulseNearbyJunctions(pos, conn.junctions);
        }
    },
    
    updateJunctionNodes: function(conn, points) {
        // Expected junction count: 1 start + (points.length - 2) midpoints + 1 end = points.length
        const expectedCount = points.length;

        // If junction count matches, reuse existing elements and just update positions
        if (conn.junctions.length === expectedCount && expectedCount > 0) {
            // Update start node position
            const startPoint = points[0];
            const startJunction = conn.junctions[0];
            startJunction.x = startPoint.x;
            startJunction.y = startPoint.y;
            if (startJunction.element) {
                startJunction.element.setAttribute('cx', startPoint.x);
                startJunction.element.setAttribute('cy', startPoint.y);
            }

            // Update mid junction positions
            for (let i = 1; i < points.length - 1; i++) {
                const junction = conn.junctions[i];
                junction.x = points[i].x;
                junction.y = points[i].y;
                if (junction.element) {
                    junction.element.setAttribute('x', points[i].x - 5);
                    junction.element.setAttribute('y', points[i].y - 5);
                }
            }

            // Update end node position
            const endPoint = points[points.length - 1];
            const endJunction = conn.junctions[conn.junctions.length - 1];
            endJunction.x = endPoint.x;
            endJunction.y = endPoint.y;
            if (endJunction.element) {
                endJunction.element.setAttribute('cx', endPoint.x);
                endJunction.element.setAttribute('cy', endPoint.y);
            }

            return;
        }

        // Full rebuild: count changed (rare — route gained/lost a turn point)
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

            // Create diamond-shaped junction node (no SVG filter — saves GPU)
            const el = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
            el.setAttribute('class', 'circuit-junction');
            el.setAttribute('x', points[i].x - 5);
            el.setAttribute('y', points[i].y - 5);
            el.setAttribute('width', '10');
            el.setAttribute('height', '10');
            el.setAttribute('rx', '2');
            el.style.transform = 'rotate(45deg)';
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
        const pulseRadiusSq = 900; // 30 * 30

        for (let i = 0, len = junctions.length; i < len; i++) {
            const junction = junctions[i];
            const dx = packetPos.x - junction.x;
            const dy = packetPos.y - junction.y;
            const distSq = dx * dx + dy * dy;

            if (distSq < pulseRadiusSq) {
                // Only compute sqrt when needed (inside radius)
                const intensity = 1 - (Math.sqrt(distSq) * 0.033333); // 1/30
                if (intensity > junction.pulseIntensity) {
                    junction.pulseIntensity = intensity;
                    if (junction.element && !junction._pulsing) {
                        junction.element.classList.add('pulsing');
                        junction._pulsing = true;
                    }
                }
            } else {
                junction.pulseIntensity *= 0.9;
                if (junction.pulseIntensity < 0.1 && junction._pulsing && junction.element) {
                    junction.element.classList.remove('pulsing');
                    junction._pulsing = false;
                }
            }
        }
    },
    
    onResize: function() {
        if (!this.initialized) return;
        this.createGridBackground();
        if (this.cachedMedallionEl) {
            this.cachedMedallionRadius = this.cachedMedallionEl.offsetWidth / 2;
        }
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
        // Flag to batch tether updates into the next rAF instead of per-mousemove
        let _dragTetherDirty = false;
        
        document.addEventListener('mousemove', (e) => {
            if (!this.draggedPanel) return;
            const panelData = this.panels.get(this.draggedPanel);
            if (!panelData || !panelData.isDragging) return;
            
            const dx = e.clientX - this.dragState.mouseDownX;
            const dy = e.clientY - this.dragState.mouseDownY;
            if (dx * dx + dy * dy > 25) this.dragState.hasMoved = true; // avoid sqrt
            
            const newX = e.clientX - this.dragState.offsetX;
            const newY = e.clientY - this.dragState.offsetY;
            
            this.dragState.velocityTracking.push({ x: newX - panelData.position.x, y: newY - panelData.position.y });
            if (this.dragState.velocityTracking.length > 5) this.dragState.velocityTracking.shift();
            
            panelData.position.x = newX;
            panelData.position.y = newY;
            panelData.element.style.transform = 'translate3d(' + newX + 'px, ' + newY + 'px, 0) rotateZ(' + panelData.angle + 'deg)';
            
            // Batch tether update to rAF (avoids multiple SVG reflows per frame during drag)
            if (!_dragTetherDirty) {
                _dragTetherDirty = true;
                requestAnimationFrame(() => {
                    _dragTetherDirty = false;
                    TetherSystem.update();
                });
            }
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
        if (!RuntimeVisibility.mobilePortrait) EngineeringNetwork.init();
        
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
                      if (!RuntimeVisibility.mobilePortrait) {
            TetherSystem.init();
            TetherSystem.update();
        }

        this.revealPositionedElements();
        EELRouteManager.init();
    }
    
    revealPositionedElements() {
        document.querySelectorAll('.js-positioned').forEach(el => el.classList.add('ready'));
               console.log('%cElements positioned and revealed', 'color: #7ec8e3; font-weight: bold;');
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
        
        // Rebuild cached array only when panel count changes (rare)
        if (!this._panelArray || this._panelArray.length !== this.panels.size) {
            this._panelArray = Array.from(this.panels.values());
        }
        const panelArray = this._panelArray;

        // Skip if no panels are moving
        let anyMoving = false;
        for (let i = 0; i < panelArray.length; i++) {
            if (panelArray[i].isMoving && !panelArray[i].isDragging && !panelArray[i].physicsDisabled) {
                anyMoving = true;
                break;
            }
        }
        if (!anyMoving) return;

        for (let iteration = 0; iteration < this.collisionSettings.iterations; iteration++) {
            for (let i = 0; i < panelArray.length; i++) {
                for (let j = i + 1; j < panelArray.length; j++) {
                    const panelA = panelArray[i];
                    const panelB = panelArray[j];
                    
                    if (panelA.isDragging || panelB.isDragging || panelA.physicsDisabled || panelB.physicsDisabled) continue;
                    
                    const ax = panelA.position.x, ay = panelA.position.y;
                    const aw = panelA.width;
                    const ah = panelA.height;
                    const bx = panelB.position.x, by = panelB.position.y;
                    const bw = panelB.width;
                    const bh = panelB.height;
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

        if (!this._panelArray || this._panelArray.length !== this.panels.size) {
            this._panelArray = Array.from(this.panels.values());
        }
        const panelArray = this._panelArray;
        let needsPhysics = false;
        for (let i = 0; i < panelArray.length; i++) {
            const panelData = panelArray[i];
            if (!panelData.physicsDisabled && (panelData.isDragging || panelData.isMoving)) {
                needsPhysics = true;
                break;
            }
        }

        if (needsPhysics) this.detectAndResolveCollisions();

        for (let i = 0; needsPhysics && i < panelArray.length; i++) {
            const panelData = panelArray[i];
            if (panelData.isDragging || panelData.physicsDisabled || !panelData.isMoving) continue;
            
            // Use stored anchor positions (these are updated when user drags panels)
            let anchorX = panelData.anchorX;
            let anchorY = panelData.anchorY;
            
            // Boundary checking for anchor positions
            const padding = 10;
            const panelWidth = panelData.width;
            const panelHeight = panelData.height;
            anchorX = Math.max(padding, Math.min(anchorX, window.innerWidth - panelWidth - padding));
            anchorY = Math.max(padding, Math.min(anchorY, window.innerHeight - panelHeight - padding));
            
            const dx = anchorX - panelData.position.x;
            const dy = anchorY - panelData.position.y;
            
            if (dx * dx + dy * dy > 25) {
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
                continue;
            }
            
            panelData.position.x += panelData.velocity.x;
            panelData.position.y += panelData.velocity.y;
            panelData.angularVelocity *= PHI_INV;
            panelData.angle += panelData.angularVelocity;
            panelData.angle *= (1 + PHI_INV) / 2;
            
            panelData.element.style.transform = 'translate3d(' + panelData.position.x + 'px, ' + panelData.position.y + 'px, 0) rotateZ(' + panelData.angle + 'deg)';
        }
        
        TetherSystem.update();
    }
    
    updateBounds() {
        const center = MedallionSystem.getCenter();
        const distances = this.calculateDistances();
        const padding = 10;
        const vw = window.innerWidth;
        const vh = window.innerHeight;
        
        // Phase 1: Read all layout properties (no DOM writes — avoids layout thrashing)
        this.panels.forEach((panelData) => {
            panelData.anchorDistanceX = distances.x;
            panelData.anchorDistanceY = distances.y;
            panelData.width = panelData.element.offsetWidth;
            panelData.height = panelData.element.offsetHeight;
        });
        
        // Phase 2: Calculate positions and write transforms (all writes batched)
        this.panels.forEach((panelData) => {
            if (panelData.hasBeenMoved) {
                panelData.anchorX = Math.max(padding, Math.min(panelData.anchorX, vw - panelData.width - padding));
                panelData.anchorY = Math.max(padding, Math.min(panelData.anchorY, vh - panelData.height - padding));
                
                if (!panelData.isDragging) {
                    panelData.position.x = panelData.anchorX;
                    panelData.position.y = panelData.anchorY;
                    panelData.element.style.transform = 'translate3d(' + panelData.position.x + 'px, ' + panelData.position.y + 'px, 0) rotateZ(' + panelData.angle + 'deg)';
                }
            } else {
                const angleRad = (panelData.anchorAngle * Math.PI) / 180;
                let anchorX = center.x + Math.cos(angleRad) * distances.x - panelData.width / 2;
                let anchorY = center.y + Math.sin(angleRad) * distances.y - panelData.height / 2;
                
                anchorX = Math.max(padding, Math.min(anchorX, vw - panelData.width - padding));
                anchorY = Math.max(padding, Math.min(anchorY, vh - panelData.height - padding));
                
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


// ============================================
// THREE.JS SYSTEM
// ============================================

let scene, camera, renderer, clock;
let structures = [];
let _threeInitRequested = false;
let _mobileGearLoopRunning = false;

function checkThreeJS() {
    if (_threeInitRequested || renderer || RuntimeVisibility.mobilePortrait) return;

    if (typeof THREE !== 'undefined') {
        _threeInitRequested = true;
        requestAnimationFrame(() => initThreeJS());
    } else {
        setTimeout(checkThreeJS, 100);
    }
}

function startMobileGearLoop() {
    if (_mobileGearLoopRunning || renderer || !RuntimeVisibility.mobilePortrait) return;
    _mobileGearLoopRunning = true;

    function animateVisibleMobileElements() {
        if (!RuntimeVisibility.mobilePortrait || renderer) {
            _mobileGearLoopRunning = false;
            return;
        }

        requestAnimationFrame(animateVisibleMobileElements);
        if (!document.hidden && !_bgSystemsPaused && _gearAnimRunning) updatePanelGears();
    }

    requestAnimationFrame(animateVisibleMobileElements);
}

function startVisualRuntime() {
    if (RuntimeVisibility.mobilePortrait) startMobileGearLoop();
    else {
        if (typeof THREE === 'undefined' && window.EELLoadThree) {
            window.EELLoadThree();
        }
        checkThreeJS();
    }
}

function initThreeJS() {
    if (renderer || RuntimeVisibility.mobilePortrait) {
        _threeInitRequested = false;
        if (RuntimeVisibility.mobilePortrait) startMobileGearLoop();
        return;
    }

    try {
        clock = new THREE.Clock();
        scene = new THREE.Scene();
        const isDark = document.body.getAttribute('data-theme') === 'dark';
        scene.fog = new THREE.Fog(isDark ? 0x0a0b0f : 0xd0d2d4, 50, 200);
        
        camera = new THREE.PerspectiveCamera(PHI * 45, window.innerWidth / window.innerHeight, PHI_INV, 1000);
        camera.position.set(0, 0, PHI * 30);
        
        const canvas = document.getElementById('three-canvas');
        renderer = new THREE.WebGLRenderer({ 
            canvas: canvas, alpha: true, antialias: window.devicePixelRatio === 1,
            powerPreference: "high-performance", stencil: false, depth: true,
            premultipliedAlpha: false
        });
        renderer.setSize(window.innerWidth, window.innerHeight);
        // Cap pixel ratio at 1.5 — saves 44% fill-rate vs 2x with negligible visual difference
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
        // Disable auto-clear — we use alpha: true with a single scene, so clearing is redundant
        renderer.autoClear = true;
        
        const ambientLight = new THREE.AmbientLight(0xffffff, PHI_INV);
        scene.add(ambientLight);
        
        const dirLight = new THREE.DirectionalLight(0x7ec8e3, 1);
        dirLight.position.set(PHI * 5, PHI * 5, PHI * 5);
        scene.add(dirLight);
        
        const pointLight = new THREE.PointLight(0xa8d5e8, 0.8, 100);
        pointLight.position.set(-30, -30, 30);
        scene.add(pointLight);
        
        createEngineeringStructures();
        
        document.addEventListener('mousemove', onMouseMove, { passive: true });
        window.addEventListener('resize', onWindowResize, { passive: true });
        window.addEventListener('themechange', (e) => updateStructureMaterials(e.detail.theme === 'dark'));
        
        animateThreeJS();
    } catch(error) {
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


// ============================================
// ENGINEERING STRUCTURES
// ============================================

function createEngineeringStructures() {
    // Quadcopter Drone - only 3D element kept
    const quadcopter = createQuadcopter();
    quadcopter.position.set(-70, 0, -40);
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

}



// ============================================
// TRULY ORGANIC HUMAN HAND - Natural Relaxed Pose
// ============================================
// ANATOMICALLY ACCURATE LEFT HAND
// Wireframe aesthetic with proper joint hierarchy
// ============================================





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
    const armGeo = new THREE.BoxGeometry(5, 0.3, 0.5);
    const motorGeo = new THREE.CylinderGeometry(0.4, 0.5, 0.6, 12);
    const propMat = createWireframeMaterial(0x88ccff);
    const blade1Geo = new THREE.BoxGeometry(3.5, 0.08, 0.4);
    const blade2Geo = new THREE.BoxGeometry(0.4, 0.08, 3.5);
    propMat.wireframe = false;
    propMat.opacity = 0.7;

    // 4 arms + propellers at 45, 135, 225, 315 degrees (X pattern)
    for (let i = 0; i < 4; i++) {
        const angle = (i / 4) * Math.PI * 2 + Math.PI / 4; // Offset by 45 degrees

        // Arm - thin elongated box
        const arm = new THREE.Mesh(armGeo, armMat);
        arm.position.x = Math.cos(angle) * 2.5;
        arm.position.z = Math.sin(angle) * 2.5;
        arm.position.y = 0.2;
        arm.rotation.y = -angle;
        group.add(arm);

        // Motor housing at arm end
        const motor = new THREE.Mesh(motorGeo, bodyMat);
        motor.position.x = Math.cos(angle) * 5;
        motor.position.z = Math.sin(angle) * 5;
        motor.position.y = 0.5;
        group.add(motor);

        // Propeller - 2-blade design using thin boxes
        const propGroup = new THREE.Group();

        // Blade 1
        const blade1 = new THREE.Mesh(blade1Geo, propMat);
        propGroup.add(blade1);

        // Blade 2 (perpendicular)
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
    const skidGeo = new THREE.CylinderGeometry(0.1, 0.1, 6, 8);
    const supportGeo = new THREE.CylinderGeometry(0.08, 0.08, 1, 6);
    skidGeo.rotateZ(Math.PI / 2);

    for (let side = -1; side <= 1; side += 2) {
        const skid = new THREE.Mesh(skidGeo, skidMat);
        skid.position.set(0, -1.5, side * 2);
        group.add(skid);

        // Skid supports
        for (let x = -1; x <= 1; x += 2) {
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

    // Fade state for panel expansion hide/show
    group.userData.fadeOpacity = 1;
    group.userData.fadeTarget = 1;

    // Collect all materials and enable transparency for fade support
    const uniqueMaterials = new Set();
    group.traverse(child => {
        if (child.isMesh && child.material) {
            child.material.transparent = true;
            // Preserve original opacity for materials that aren't fully opaque (e.g. propeller blades)
            child.material.userData.baseOpacity = child.material.opacity;
            uniqueMaterials.add(child.material);
        }
    });
    group.userData.allMaterials = Array.from(uniqueMaterials);

    return group;
}





// ============================================
// ANIMATION AND UPDATES
// ============================================

function updateStructureMaterials(isDark) {
    structures.forEach((structure) => {
        structure.traverse((child) => {
            const material = child.material;
            if (!material || !material.userData || material.userData.hueOffset === undefined) return;

            const hueShift = isDark ? 0.7 : 0;
            const hueOffset = (material.userData.hueOffset + hueShift) % 1;
            if (material.color) material.color.setHSL(hueOffset, 0.8, 0.6);
            if (material.emissive) {
                material.emissive.setHSL((hueOffset + 0.5) % 1, 1, 0.2);
                material.emissiveIntensity = isDark ? 0.4 : 0.3;
            }
            material.needsUpdate = true;
        });
    });
    
    // Update fog
    if (scene && scene.fog) scene.fog.color.set(isDark ? 0x0a0b0f : 0xd0d2d4);
}

let cachedCursorEl = null;
let _cursorRafPending = false;
let _cursorX = 0, _cursorY = 0;

function onMouseMove(event) {
    _cursorX = event.clientX;
    _cursorY = event.clientY;

    // Batch cursor DOM write to next animation frame to avoid multiple writes per frame
    if (!_cursorRafPending) {
        _cursorRafPending = true;
        requestAnimationFrame(_updateCursorPosition);
    }
}

function _updateCursorPosition() {
    _cursorRafPending = false;
    if (!cachedCursorEl) cachedCursorEl = document.getElementById('chromeCursor');
    if (cachedCursorEl) {
        cachedCursorEl.style.transform = 'translate(' + _cursorX + 'px, ' + _cursorY + 'px)';
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

    if (document.hidden) {
        clock.getDelta(); // Prevent large delta spike on resume
        return;
    }

    const deltaTime = clock.getDelta();

    // On mobile portrait the canvas and SVG network are display:none. The
    // panel gears remain visible, so keep only their existing animation alive.
    if (RuntimeVisibility.mobilePortrait) {
        if (!_bgSystemsPaused && _gearAnimRunning) updatePanelGears();
        return;
    }

    const time = clock.getElapsedTime();

    // Skip expensive updates when a panel is expanded or collapsing
    // The Three.js scene, physics, harmonic motion, and circuit grid are all hidden
    if (_bgSystemsPaused) {
        // Continue rendering only while the drone is fading, so the user
        // sees a smooth opacity transition instead of a frozen frame
        let droneStillFading = false;
        for (let _si = 0; _si < structures.length; _si++) {
            const s = structures[_si];
            if (s.userData.type === 'quadcopter') {
                const target = s.userData.fadeTarget;
                const current = s.userData.fadeOpacity;
                if (target === undefined) continue;
                const diff = target - current;
                if (Math.abs(diff) > 0.005) {
                    droneStillFading = true;
                    // Smoothly approach target opacity
                    const fadeSmoothFactor = 1 - Math.pow(0.00001, deltaTime);
                    s.userData.fadeOpacity = current + diff * fadeSmoothFactor;
                    const mats = s.userData.allMaterials;
                    const opacity = s.userData.fadeOpacity;
                    for (let mi = 0; mi < mats.length; mi++) {
                        const mat = mats[mi];
                        mat.opacity = mat.userData.baseOpacity !== undefined
                            ? mat.userData.baseOpacity * opacity : opacity;
                    }
                    // Keep propellers spinning and drone moving during fade
                    if (s.userData.propellers) {
                        s.userData.propellers.forEach(prop => {
                            prop.rotation.y += deltaTime * 30 * prop.userData.spinDirection;
                        });
                    }
                    // Continue waypoint navigation so the drone doesn't freeze mid-air
                    if (s.userData.waypoints && s.userData.waypoints.length > 1) {
                        if (!s.userData.basePosition) {
                            s.userData.basePosition = new THREE.Vector3();
                        }
                        s.userData.waypointProgress = (s.userData.waypointProgress || 0) + deltaTime * s.userData.waypointSpeed;
                        if (s.userData.waypointProgress >= 1) {
                            s.userData.waypointProgress -= 1;
                            s.userData.currentWaypoint = (s.userData.currentWaypoint + 1) % s.userData.waypoints.length;
                        }
                        const currentIdx = s.userData.currentWaypoint || 0;
                        const nextIdx = (currentIdx + 1) % s.userData.waypoints.length;
                        const t = s.userData.waypointProgress;
                        const easeT = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
                        s.userData.basePosition.lerpVectors(s.userData.waypoints[currentIdx], s.userData.waypoints[nextIdx], easeT);
                        const hoverOffset = Math.sin(time * 6) * 0.01;
                        s.position.copy(s.userData.basePosition);
                        s.position.y += hoverOffset;
                    }
                } else if (current !== target) {
                    // Snap to exact target
                    s.userData.fadeOpacity = target;
                    const mats = s.userData.allMaterials;
                    for (let mi = 0; mi < mats.length; mi++) {
                        const mat = mats[mi];
                        mat.opacity = mat.userData.baseOpacity !== undefined
                            ? mat.userData.baseOpacity * target : target;
                    }
                    droneStillFading = true; // one final render to show snapped opacity
                }
            }
        }
        // Render one more frame if the drone is fading so the change is visible
        if (droneStillFading) {
            renderer.render(scene, camera);
        }
        return;
    }

    if (radialPanelPhysics) radialPanelPhysics.update(deltaTime);
    
    for (let _si = 0; _si < structures.length; _si++) {
        const structure = structures[_si];
        if (!structure.visible) continue;
        
        // Default rotation (skip for types that handle their own)
        const sType = structure.userData.type;
        if (sType !== 'quadcopter' && sType !== 'swimmer_hand' && sType !== 'parametric_surface') {
            if (structure.userData.rotationSpeed) {
                structure.rotation.z += structure.userData.rotationSpeed;
            } else {
                structure.rotation.x += deltaTime * PHI_INV * 0.1;
                structure.rotation.y += deltaTime * PHI_INV * 0.2;
            }
        }
        
        // Structure-specific animations
        switch(sType) {
            case 'cog_cluster':
                for (let ci = 0; ci < structure.children.length; ci++) {
                    const child = structure.children[ci];
                    if (child.userData.rotationSpeed) child.rotation.z += child.userData.rotationSpeed;
                }
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
                    
                    // Cache finger keys once
                    if (!structure.userData._fingerKeys) {
                        structure.userData._fingerKeys = Object.keys(fingers);
                    }
                    const fKeys = structure.userData._fingerKeys;
                    for (let fi = 0; fi < fKeys.length; fi++) {
                        const name = fKeys[fi];
                        const finger = fingers[name];
                        if (!finger || !finger.userData) continue;
                        
                        if (name === 'thumb') {
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
                            const fingerOffset = fi - 2;
                            const phaseOffset = fi * 0.10;
                            const fingerCurl = baseCurl + Math.sin(swimPhase + phaseOffset) * 0.025;
                            
                            const baseRotX = finger.userData.baseRotX || -0.05;
                            const baseRotY = finger.userData.baseRotY || 0;
                            const baseRotZ = finger.userData.baseRotZ || 0;
                            
                            finger.rotation.x = baseRotX + fingerCurl;
                            finger.rotation.z = baseRotZ + fingerOffset * spreadAmount;
                            finger.rotation.y = baseRotY + Math.sin(swimPhase * 0.9 + fi) * 0.008;
                        }
                    }
                }
                
                // Particle animation - subtle
                if (particles) {
                    for (let pi = 0; pi < particles.length; pi++) {
                        const particle = particles[pi];
                        const orbit = particle.userData.orbit;
                        if (orbit) {
                            const t = swimPhase * orbit.speed + orbit.phase;
                            particle.position.x = Math.cos(t) * orbit.radiusX;
                            particle.position.y = orbit.offsetY + Math.sin(t * 0.5) * orbit.radiusY * 0.2;
                            particle.position.z = Math.sin(t) * orbit.radiusZ;
                            
                            const pulse = 0.12 + Math.sin(swimPhase * 2 + pi * 0.5) * 0.08;
                            if (particle.material) {
                                particle.material.opacity = pulse;
                            }
                            particle.scale.setScalar(0.8 + pulse * 0.3);
                        }
                    }
                }
                
                // Ring animation - subtle
                if (rings) {
                    for (let ri = 0; ri < rings.length; ri++) {
                        const ring = rings[ri];
                        ring.rotation.z += ring.userData.orbitSpeed * 0.008;
                        ring.rotation.x = Math.PI / 2 + Math.sin(swimPhase * 0.3 + ring.userData.wobblePhase) * 0.03;
                        if (ring.material) {
                            ring.material.opacity = 0.05 + Math.sin(swimPhase * 1.5 + ri) * 0.025;
                        }
                    }
                }
                
                // Very gentle overall rotation
                structure.rotation.y = Math.sin(time * 0.18) * 0.04;
                structure.rotation.x = Math.cos(time * 0.12) * 0.02;
                break;
                
            case 'circuit_trace':
                if (structure.userData.pulses) {
                    const pulses = structure.userData.pulses;
                    const tracePaths = structure.userData.tracePaths;
                    for (let pi = 0; pi < pulses.length; pi++) {
                        const pulse = pulses[pi];
                        pulse.userData.progress += deltaTime * 0.3;
                        if (pulse.userData.progress > 1) {
                            pulse.userData.progress = 0;
                            pulse.userData.pathIndex = (pulse.userData.pathIndex + 1) % tracePaths.length;
                        }
                        const path = tracePaths[pulse.userData.pathIndex];
                        const t = pulse.userData.progress;
                        const idx = Math.floor(t * (path.length - 1));
                        const p0 = path[idx];
                        const p1 = path[Math.min(idx + 1, path.length - 1)];
                        const localT = (t * (path.length - 1)) % 1;
                        pulse.position.lerpVectors(p0, p1, localT);
                    }
                }
                if (structure.userData.nodes) {
                    const nodes = structure.userData.nodes;
                    for (let ni = 0; ni < nodes.length; ni++) {
                        nodes[ni].material.opacity = 0.5 + Math.sin(time * 3 + ni) * 0.3;
                    }
                }
                break;
                
            case 'spring_helix':
                structure.userData.springPhase += deltaTime * PHI;
                structure.scale.y = 0.8 + Math.sin(structure.userData.springPhase) * 0.2;
                break;
                
            case 'atomic_model':
                if (structure.userData.electrons) {
                    const electrons = structure.userData.electrons;
                    for (let ei = 0; ei < electrons.length; ei++) {
                        const electron = electrons[ei];
                        electron.userData.orbitalAngle += electron.userData.orbitalSpeed;
                        const r = electron.userData.orbitalRadius;
                        const a = electron.userData.orbitalAngle;
                        electron.position.x = Math.cos(a) * r;
                        electron.position.y = Math.sin(a) * r * Math.cos(electron.userData.tiltX);
                        electron.position.z = Math.sin(a) * r * Math.sin(electron.userData.tiltX);
                    }
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
                    const segs = structure.userData.beamSegments;
                    const segCount = segs.length - 1;
                    const sinFlex = Math.sin(structure.userData.flexPhase);
                    for (let si = 0; si < segs.length; si++) {
                        const t = si / segCount;
                        segs[si].rotation.z = t * t * maxDeflection * sinFlex;
                    }
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
                    const props = structure.userData.propellers;
                    const propSpeed = deltaTime * 30;
                    for (let pi = 0; pi < props.length; pi++) {
                        props[pi].rotation.y += propSpeed * props[pi].userData.spinDirection;
                    }
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
                    if (!structure.userData._dirVec) structure.userData._dirVec = new THREE.Vector3();
                    const dirVec = structure.userData._dirVec.subVectors(endPos, startPos);
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

                // ===================================================
                // SECTION 5: Fade Opacity (panel expansion hide/show)
                // ===================================================
                if (structure.userData.fadeTarget !== undefined) {
                    const target = structure.userData.fadeTarget;
                    const current = structure.userData.fadeOpacity;
                    const diff = target - current;
                    if (Math.abs(diff) > 0.001) {
                        const fadeSmoothFactor = 1 - Math.pow(0.00001, deltaTime);
                        structure.userData.fadeOpacity = current + diff * fadeSmoothFactor;
                        const mats = structure.userData.allMaterials;
                        const opacity = structure.userData.fadeOpacity;
                        for (let mi = 0; mi < mats.length; mi++) {
                            const m = mats[mi];
                            m.opacity = m.userData.baseOpacity !== undefined
                                ? m.userData.baseOpacity * opacity : opacity;
                        }
                    } else if (current !== target) {
                        structure.userData.fadeOpacity = target;
                        const mats = structure.userData.allMaterials;
                        for (let mi = 0; mi < mats.length; mi++) {
                            const m = mats[mi];
                            m.opacity = m.userData.baseOpacity !== undefined
                                ? m.userData.baseOpacity * target : target;
                        }
                    }
                }
                break;
        }
    }

    // Camera motion
    const camTime = time * PHI_INV * 0.1;
    camera.position.x = Math.sin(camTime) * PHI * 2;
    camera.position.y = Math.cos(camTime * 0.8) * PHI + 2;
    camera.position.z = PHI * 30 + Math.sin(camTime * 0.5) * PHI * 3;
    camera.lookAt(0, 0, 0);
    
    renderer.render(scene, camera);
    
    // Update panel gear icons (consolidated into main loop instead of separate rAF)
    if (_gearAnimRunning) updatePanelGears();
}

// ============================================
// DRONE FADE HELPER
// ============================================

function fadeDrone(targetOpacity) {
    structures.forEach(s => {
        if (s.userData.type === 'quadcopter') {
            s.userData.fadeTarget = targetOpacity;
        }
    });
}

// ============================================
// PANEL EXPANSION SYSTEM
// ============================================

let currentExpandedPanel = null;
let isExpanded = false;
let isCollapsing = false;
let previousFocus = null;

// ============================================
// DIRECT URL + PAGE METADATA ROUTING
// ============================================

const EELRouteManager = {
    initialized: false,

    pages: {
        home: {
            title: 'EEL - Experimental Engineering Lab',
            description: 'The Experimental Engineering Lab at UNC-Chapel Hill connects undergraduate research, applied engineering, fabrication, immersive technology, and cross-campus collaboration.'
        },

        projects: {
            panelId: 'panel-projects',
            contentType: 'projects',
            route: 'research-teaching',
            title: 'Research & Teaching | EEL',
            description: 'Explore current EEL research projects, developing ideas, courses, and past work at UNC-Chapel Hill.'
        },

        people: {
            panelId: 'panel-people',
            contentType: 'people',
            route: 'members-collaborators',
            title: 'Members & Collaborators | EEL',
            description: 'Meet the EEL undergraduate researchers, alumni, academic partners, and collaborators at UNC-Chapel Hill.'
        },

        about: {
            panelId: 'panel-about',
            contentType: 'about',
            route: 'eel-at-a-glance',
            title: 'EEL at a Glance | Experimental Engineering Lab',
            description: 'See the Experimental Engineering Lab’s impact, capabilities, history, and campus-wide research-engineering role at UNC-Chapel Hill.'
        },

        join: {
            panelId: 'panel-join',
            contentType: 'join',
            route: 'join-our-lab',
            title: 'Join Our Lab | EEL',
           description: 'Learn how UNC undergraduates can join the Experimental Engineering Lab and contribute to hands-on research and engineering projects.'
        },

        currentProjects: {
            panelId: 'panel-projects',
            contentType: 'projects',
            title: 'Current Projects | EEL',
            description: 'Explore current undergraduate research and engineering projects in the Experimental Engineering Lab at UNC-Chapel Hill.'
        },

        developingProjects: {
            panelId: 'panel-projects',
            contentType: 'projects',
            title: 'Projects in Development | EEL',
            description: 'Explore research and engineering projects currently being developed in the Experimental Engineering Lab at UNC-Chapel Hill.'
        },

        courses: {
            panelId: 'panel-projects',
            contentType: 'projects',
            title: 'Courses & Academic Opportunities | EEL',
            description: 'Explore EEL courses and academic opportunities connecting hands-on engineering, undergraduate research, and research leadership at UNC-Chapel Hill.'
        },

        pastWork: {
            panelId: 'panel-projects',
            contentType: 'projects',
            title: 'Selected Past Work | EEL',
            description: 'Explore selected past research, engineering, and teaching projects from the Experimental Engineering Lab at UNC-Chapel Hill.'
        }
    },

    hashToPage: {
        'research-teaching': 'projects',
        'projects': 'projects',

        'current-projects': 'currentProjects',
        'projects-in-development': 'developingProjects',
        'courses': 'courses',
        'past-work': 'pastWork',

        'members-collaborators': 'people',
        'people': 'people',

        'eel-at-a-glance': 'about',
        'about': 'about',

        'join-our-lab': 'join',
        'join': 'join'
    },

    panelToHash: {
        'panel-projects': 'research-teaching',
        'panel-people': 'members-collaborators',
        'panel-about': 'eel-at-a-glance',
        'panel-join': 'join-our-lab'
    },

             init: function() {
        if (this.initialized) return;

        this.initialized = true;

        // Research & Teaching jump links navigate only inside the already-open
        // Projects panel. They should not go through the full panel router.
        document.addEventListener('click', (event) => {
            var link = event.target.closest('.research-jump-nav a[href^="#"]');

            if (!link) return;

            var hash = link.getAttribute('href').replace(/^#/, '').toLowerCase();
            var pageKey = this.getPageKeyForHash(hash);

            if (!pageKey) return;

            event.preventDefault();

            if (this.getHash() !== hash) {
                history.pushState(
                    { eelSection: hash },
                    '',
                    '#' + hash
                );
            }

            this.updateMetadata(pageKey);
            this.scrollToCurrentHash(hash);
        });

        // Handle browser Back/Forward navigation.
        window.addEventListener('popstate', () => this.handleLocation());

        this.handleLocation();
    },
    getHash: function() {
        return decodeURIComponent(
            window.location.hash.replace(/^#/, '')
        ).toLowerCase();
    },

    getPageKeyForHash: function(hash) {
        return this.hashToPage[hash] || null;
    },

    setMetaContent: function(selector, value) {
        var element = document.querySelector(selector);

        if (element) {
            element.setAttribute('content', value);
        }
    },

    updateMetadata: function(pageKey) {
        var page = this.pages[pageKey] || this.pages.home;

        document.title = page.title;

        this.setMetaContent(
            'meta[name="description"]',
            page.description
        );

        this.setMetaContent(
            'meta[property="og:title"]',
            page.title
        );

        this.setMetaContent(
            'meta[property="og:description"]',
            page.description
        );

        this.setMetaContent(
            'meta[property="og:url"]',
            window.location.href
        );

        this.setMetaContent(
            'meta[name="twitter:title"]',
            page.title
        );

        this.setMetaContent(
            'meta[name="twitter:description"]',
            page.description
        );
    },

    updateMetadataForCurrentHash: function() {
        var hash = this.getHash();
        var pageKey = this.getPageKeyForHash(hash);

        this.updateMetadata(pageKey || 'home');
    },

    setPanelRoute: function(panelId) {
        var hash = this.panelToHash[panelId];

        if (!hash) return;

        if (this.getHash() !== hash) {
            history.pushState(
                { eelPanel: panelId },
                '',
                '#' + hash
            );
        }

        this.updateMetadata(
            this.getPageKeyForHash(hash)
        );
    },

    clearRoute: function() {
        history.replaceState(
            { eelPanel: null },
            '',
            window.location.pathname + window.location.search
        );

        this.updateMetadata('home');
    },

           scrollToCurrentHash: function(hash) {
        hash = hash || this.getHash();

        requestAnimationFrame(function() {
            _getExpandedEls();

            if (!_cachedExpandedContent) return;

            // Main Research & Teaching route returns to the top.
            if (!hash || hash === 'research-teaching' || hash === 'projects') {
                _cachedExpandedContent.scrollTop = 0;
                return;
            }

            var target = document.getElementById(hash);

            if (!target || !_cachedExpandedContent.contains(target)) return;

            // Calculate the target position inside #expandedContent without
            // scrollIntoView(), which can also move outer ancestors/viewport.
            var targetTop = 0;
            var node = target;

            while (node && node !== _cachedExpandedContent) {
                targetTop += node.offsetTop || 0;
                node = node.offsetParent;
            }

            // Fallback if the offsetParent chain does not reach the scroll box.
            if (node !== _cachedExpandedContent) {
                var contentRect = _cachedExpandedContent.getBoundingClientRect();
                var targetRect = target.getBoundingClientRect();

                targetTop =
                    _cachedExpandedContent.scrollTop +
                    targetRect.top -
                    contentRect.top;
            }

            var jumpNav =
                _cachedExpandedContent.querySelector('.research-jump-nav');

            var stickyOffset =
                jumpNav ? jumpNav.offsetHeight + 16 : 16;

            _cachedExpandedContent.scrollTo({
                top: Math.max(0, targetTop - stickyOffset),
                behavior: 'auto'
            });
        });
    },


    handleLocation: function() {
        var hash = this.getHash();
        var pageKey = this.getPageKeyForHash(hash);

        if (!pageKey) {
            this.updateMetadata('home');

            if (isExpanded && !isCollapsing) {
                collapsePanel(true);
            }

            return;
        }

        var page = this.pages[pageKey];

        this.updateMetadata(pageKey);

        if (isCollapsing) {
            setTimeout(
                () => this.handleLocation(),
                950
            );

            return;
        }

        if (!isExpanded) {
            expandPanel(
                page.panelId,
                page.contentType,
                { fromRoute: true }
            );

            this.scrollToCurrentHash();

            return;
        }

        if (currentExpandedPanel === page.panelId) {
            this.scrollToCurrentHash();
            return;
        }

        collapsePanel(true);

        setTimeout(
            () => this.handleLocation(),
            950
        );
    }
};

// Content cache — generate HTML once, reuse on subsequent opens
const _contentCache = {};

// Cached nav panel NodeList (set once after DOM ready)
let _cachedNavPanels = null;
function getCachedNavPanels() {
    if (!_cachedNavPanels) _cachedNavPanels = document.querySelectorAll('.nav-panel');
    return _cachedNavPanels;
}

// Cache expanded panel DOM elements
let _cachedExpandedOverlay = null;
let _cachedExpandedContainer = null;
let _cachedExpandedContent = null;
let _cachedGlassContainer = null;
let _cachedCloseBtn = null;

function _getExpandedEls() {
    if (!_cachedExpandedOverlay) {
        _cachedExpandedOverlay = document.getElementById('expandedOverlay');
        _cachedExpandedContainer = document.getElementById('expandedContainer');
        _cachedExpandedContent = document.getElementById('expandedContent');
        _cachedGlassContainer = _cachedExpandedContainer.querySelector('.expanded-glass-container');
        _cachedCloseBtn = document.getElementById('closeBtn');
    }
}

// Pause/resume background animation systems during panel expansion
// to free up CPU/GPU for the morph transition
let _bgSystemsPaused = false;
let _cachedBgAnimEls = null;

function _getBgAnimEls() {
    if (!_cachedBgAnimEls) {
        _cachedBgAnimEls = document.querySelectorAll('.chrome-title, .subtitle, .tagline, .central-medallion, .blob-primary, .blob-secondary, .blob-tertiary, .blob-accent-1, .blob-accent-2, .chrome-grid');
    }
    return _cachedBgAnimEls;
}

function _pauseBackgroundSystems() {
    _bgSystemsPaused = true;
    var bgEls = _getBgAnimEls();
    for (var i = 0; i < bgEls.length; i++) bgEls[i].style.animationPlayState = 'paused';
}

function _resumeBackgroundSystems() {
    _bgSystemsPaused = false;
    var bgEls = _getBgAnimEls();
    for (var i = 0; i < bgEls.length; i++) bgEls[i].style.animationPlayState = '';
}

// Compute the target expanded rect based on viewport and device
function _getExpandedTargetRect() {
    var vw = window.innerWidth;
    var vh = window.innerHeight;
    // Mobile portrait or small viewport: use larger area
    var isMobile = document.body.classList.contains('mobile-portrait') || vw <= 768;
    var pctW = isMobile ? 0.95 : 0.89;
    var pctH = isMobile ? 0.92 : 0.89;
    var marginL = isMobile ? 0.025 : 0.055;
    var marginT = isMobile ? 0.04 : 0.055;
    return {
        left: vw * marginL,
        top: vh * marginT,
        width: vw * pctW,
        height: vh * pctH
    };
}

function expandPanel(panelId, contentType, routeOptions) {
    if (isExpanded || isCollapsing) return;

    routeOptions = routeOptions || {};

    isExpanded = true;
    currentExpandedPanel = panelId;
    previousFocus = document.activeElement;

    if (!routeOptions.fromRoute) {
        EELRouteManager.setPanelRoute(panelId);
    } else {
        EELRouteManager.updateMetadataForCurrentHash();
    }

    _getExpandedEls();
    var panel = document.getElementById(panelId);
    var expandedOverlay = _cachedExpandedOverlay;
    var expandedContainer = _cachedExpandedContainer;
    var expandedContent = _cachedExpandedContent;
    var glassContainer = _cachedGlassContainer;

    var panelRect = panel.getBoundingClientRect();
    var panelData = radialPanelPhysics.panels.get(panelId);
    if (panelData) panelData.physicsDisabled = true;

    // FLIP technique: compute target rect, then use transform to animate
    var target = _getExpandedTargetRect();

    // Set the container to the target final size/position (no transition yet)
    expandedContainer.style.left = target.left + 'px';
    expandedContainer.style.top = target.top + 'px';
    expandedContainer.style.width = target.width + 'px';
    expandedContainer.style.height = target.height + 'px';
    expandedContainer.style.opacity = '1';

    // Compute the FLIP inversion: transform from target back to panel origin
    var scaleX = panelRect.width / target.width;
    var scaleY = panelRect.height / target.height;
    var translateX = panelRect.left - target.left;
    var translateY = panelRect.top - target.top;

    // Apply the inversion (container visually appears at the panel's position)
    expandedContainer.style.transform = 'translate3d(' + translateX + 'px, ' + translateY + 'px, 0) scale(' + scaleX + ', ' + scaleY + ')';

    // Load content (hidden via .expanded-content opacity:0)
    loadContent(contentType, expandedContent);

    TetherSystem.fadeOut();
    fadeDrone(0);

    expandedOverlay.style.pointerEvents = '';
    expandedOverlay.classList.add('active');
    expandedContainer.style.pointerEvents = '';

    // Pause background CSS animations to free CPU/GPU during morph
    _pauseBackgroundSystems();

    // Commit the inverted position so the browser has a "from" state
    expandedContainer.offsetHeight;

    // Enable transform transition
    expandedContainer.classList.add('morphing');

    requestAnimationFrame(function() {
        // Animate to identity transform (the final expanded position)
        expandedContainer.style.transform = 'translate3d(0, 0, 0) scale(1, 1)';
        expandedContainer.classList.add('expanded');

        // Fade out background elements simultaneously with the morph
        fadeOutElements();
        panel.classList.add('hidden');
        panel.setAttribute('aria-expanded', 'true');
    });

    // Use transitionend for reliable timing instead of setTimeout
    var _expandCleanedUp = false;
    function _onExpandEnd(e) {
        if (_expandCleanedUp || e.target !== expandedContainer) return;
        _expandCleanedUp = true;
        expandedContainer.removeEventListener('transitionend', _onExpandEnd);
        if (_cachedCloseBtn) _cachedCloseBtn.focus();
        glassContainer.classList.add('blur-active');
    }
    expandedContainer.addEventListener('transitionend', _onExpandEnd);
    // Fallback timeout in case transitionend doesn't fire (e.g. tab hidden)
    setTimeout(function() {
        if (!_expandCleanedUp) {
            _expandCleanedUp = true;
            expandedContainer.removeEventListener('transitionend', _onExpandEnd);
            if (_cachedCloseBtn) _cachedCloseBtn.focus();
            glassContainer.classList.add('blur-active');
        }
    }, 900);

    getCachedNavPanels().forEach(function(p) { p.style.pointerEvents = 'none'; });
}

function collapsePanel(fromRoute) {
    if (!isExpanded || isCollapsing) return;
    isCollapsing = true;

    // A user-initiated close returns the URL to the homepage.
    // Router-initiated collapses keep the destination hash intact.
    if (!fromRoute) {
        EELRouteManager.clearRoute();
    }

    _getExpandedEls();
    var expandedOverlay = _cachedExpandedOverlay;
    var expandedContainer = _cachedExpandedContainer;
    var panel = document.getElementById(currentExpandedPanel);
    var glassContainer = _cachedGlassContainer;

    if (!panel || !expandedOverlay || !expandedContainer) {
        isExpanded = false;
        isCollapsing = false;
        currentExpandedPanel = null;
        getCachedNavPanels().forEach(function(p) {
            p.style.pointerEvents = '';
            p.classList.remove('hidden');
        });
        return;
    }

    var collapsedPanelId = currentExpandedPanel;

    if (radialPanelPhysics && radialPanelPhysics.panels) {
        radialPanelPhysics.panels.forEach(function(panelData, panelId) {
            if (radialPanelPhysics.draggedPanel !== panelId) panelData.isDragging = false;
        });
        radialPanelPhysics.draggedPanel = null;
    }

    // Remove blur immediately — don't run backdrop-filter during collapse morph
    glassContainer.classList.remove('blur-active');

    // FLIP reverse: compute the panel's current position, then transform to it
    var panelRect = panel.getBoundingClientRect();
    var containerRect = expandedContainer.getBoundingClientRect();

    // The container is at its expanded position. Compute transform to shrink to panel.
    var scaleX = panelRect.width / containerRect.width;
    var scaleY = panelRect.height / containerRect.height;
    var translateX = panelRect.left - containerRect.left;
    var translateY = panelRect.top - containerRect.top;

    expandedContainer.classList.remove('expanded');

    requestAnimationFrame(function() {
        // Animate transform from identity to the panel's position
        expandedContainer.style.transform = 'translate3d(' + translateX + 'px, ' + translateY + 'px, 0) scale(' + scaleX + ', ' + scaleY + ')';

        // Resume background systems so Three.js renders during fade-in
        _resumeBackgroundSystems();

        fadeInElements();
        panel.classList.remove('hidden');
        panel.setAttribute('aria-expanded', 'false');
        TetherSystem.fadeIn();
        fadeDrone(1);

        setTimeout(function() {
            getCachedNavPanels().forEach(function(p) { p.style.pointerEvents = ''; });
        }, 50);
    });

    // Cleanup after transition completes
    var _collapseCleanedUp = false;
    function _onCollapseEnd(e) {
        if (_collapseCleanedUp || e.target !== expandedContainer) return;
        _collapseCleanedUp = true;
        expandedContainer.removeEventListener('transitionend', _onCollapseEnd);
        _collapseCleanup();
    }
    expandedContainer.addEventListener('transitionend', _onCollapseEnd);

    function _collapseCleanup() {
        expandedOverlay.classList.remove('active');
        expandedContainer.classList.remove('morphing');
        expandedContainer.style.opacity = '0';
        expandedContainer.style.transform = '';
        expandedOverlay.style.pointerEvents = 'none';
        expandedContainer.style.pointerEvents = 'none';
        expandedContainer.style.left = '-9999px';
        expandedContainer.style.top = '-9999px';
        expandedContainer.style.width = '';
        expandedContainer.style.height = '';

        // Clear injected content to free memory
        _cachedExpandedContent.innerHTML = '';

        var panelData = radialPanelPhysics.panels.get(collapsedPanelId);
        if (panelData) {
            panelData.physicsDisabled = false;
            panelData.isDragging = false;
        }

        if (previousFocus && previousFocus.focus) previousFocus.focus();
        previousFocus = null;

        isExpanded = false;
        isCollapsing = false;
        currentExpandedPanel = null;
    }

    // Fallback timeout in case transitionend doesn't fire
    setTimeout(function() {
        if (!_collapseCleanedUp) {
            _collapseCleanedUp = true;
            expandedContainer.removeEventListener('transitionend', _onCollapseEnd);
            _collapseCleanup();
        }
    }, 900);
}

// Cache frequently accessed elements for fade operations
let _cachedSiteTitle = null;
let _cachedSiteSubtitle = null;
let _cachedSiteTagline = null;
let _cachedMedallion = null;
let _cachedThreeCanvas = null;
let _cachedNebula = null;
let _cachedChromeGrid = null;

function _getFadeEls() {
    if (!_cachedSiteTitle) {
        _cachedSiteTitle = document.getElementById('siteTitle');
        _cachedSiteSubtitle = document.getElementById('siteSubtitle');
        _cachedSiteTagline = document.getElementById('siteTagline');
        _cachedMedallion = document.getElementById('centralMedallion');
        _cachedThreeCanvas = document.getElementById('three-canvas');
        _cachedNebula = document.querySelector('.organic-nebula');
        _cachedChromeGrid = document.querySelector('.chrome-grid');
    }
}

function fadeOutElements() {
    _getFadeEls();
    // Fade out the UI elements (title, subtitle, tagline, medallion, panels)
    _cachedSiteTitle.classList.add('hidden');
    _cachedSiteSubtitle.classList.add('hidden');
    if (_cachedSiteTagline) _cachedSiteTagline.classList.add('hidden');
    _cachedMedallion.classList.add('hidden');
    getCachedNavPanels().forEach(panel => {
        if (panel.id !== currentExpandedPanel) panel.classList.add('hidden');
    });
    // Fade out the full background scene (canvas, nebula blobs, chrome grid)
    if (_cachedThreeCanvas) _cachedThreeCanvas.classList.add('bg-hidden');
    if (_cachedNebula) _cachedNebula.classList.add('bg-hidden');
    if (_cachedChromeGrid) _cachedChromeGrid.classList.add('bg-hidden');
}

function fadeInElements() {
    _getFadeEls();
    _cachedSiteTitle.classList.remove('hidden');
    _cachedSiteSubtitle.classList.remove('hidden');
    if (_cachedSiteTagline) _cachedSiteTagline.classList.remove('hidden');
    _cachedMedallion.classList.remove('hidden');
    getCachedNavPanels().forEach(panel => {
        panel.style.opacity = '';
        panel.style.pointerEvents = '';
        panel.classList.remove('hidden');
    });
    // Restore background scene
    if (_cachedThreeCanvas) _cachedThreeCanvas.classList.remove('bg-hidden');
    if (_cachedNebula) _cachedNebula.classList.remove('bg-hidden');
    if (_cachedChromeGrid) _cachedChromeGrid.classList.remove('bg-hidden');
}

function loadContent(contentType, container) {
    if (!_contentCache[contentType]) {
        switch(contentType) {
            case 'projects': _contentCache[contentType] = getProjectsContent(); break;
            case 'people': _contentCache[contentType] = getPeopleContent(); break;
            case 'about': _contentCache[contentType] = getAboutContent(); break;
            case 'join': _contentCache[contentType] = getJoinContent(); break;
            default: _contentCache[contentType] = '<p>Content coming soon...</p>';
        }
    }
    container.innerHTML = _contentCache[contentType];
}

function getProjectsContent() {
    const currentProjects = [
        {
            title: 'Boundary-Aware Redirected Walking in Virtual Reality',
            image: 'images/VirtualReality.png',
            imageAlt: 'Student using the EEL virtual reality system',
            body: [
                `Redirected walking allows someone to explore a virtual environment larger than the physical room around them. The EEL system uses translation, rotation, and curvature gains to subtly adjust a participant’s virtual path while boundary-aware software keeps the participant safely inside the laboratory.`,
                `Students have implemented redirected-walking systems in Unity and Unreal Engine for the Meta Quest 3. Initial testing allowed participants to explore a roughly 50-meter virtual temple environment while remaining within a physical space approximately two meters wide. The next phase will improve path planning, obstacle avoidance, and the integration of multiple large-scale environments captured in Nepal.`
            ],
            collaboration: 'Religious Studies'
        },
        {
            title: 'Scalable 3D Environment Optimization',
            image: 'images/Real-World3DEnvironments.png',
            imageAlt: 'Large-scale three-dimensional environment captured in Nepal',
            body: [
                `Fieldwork at Swayambhu in Nepal produced more than 500 gigabytes of photographs, laser-scanned point clouds, and aerial imagery. The resulting photogrammetry model contains approximately 2.7 billion triangles, making it far too large for conventional computers or VR headsets to display directly.`,
                `Students are comparing photogrammetry, Neural Radiance Fields, and 3D Gaussian Splatting to determine how very large environments can be represented efficiently without losing their essential visual detail. Preliminary results suggest that a hybrid workflow may provide the best combination of image quality, real-time performance, and portability across VR and conventional computing platforms.`
            ],
            collaboration: 'Religious Studies',
            link: 'https://research.unc.edu/story/blueprints-for-preservation/',
            linkText: 'Read the UNC Research feature, “Blueprints for Preservation”'
        },
        {
            title: 'Interactive 3D Heritage Explorer',
            body: [
                `This project is developing an Unreal Engine application that allows students, researchers, and the public to explore the EEL’s detailed 3D models of Swayambhu and other culturally significant locations in Nepal. The viewer will bring together optimized models, contextual information, photographs, and other field data in an accessible interactive environment.`,
                `The goal is to make these extensive datasets useful beyond the VR laboratory while preserving the spatial relationships that are difficult to communicate through conventional photographs, maps, and videos.`
            ],
            collaboration: 'Religious Studies'
        },
        {
            title: 'PAWS: SPOT Assistive Navigation Robot',
            body: [
                `PAWS, or Personal Autonomous Walking Support, explores how a Boston Dynamics SPOT robot could assist people who need additional support while walking. The current system combines spoken commands, GPS-independent GraphNav localization, LiDAR sensing, stored waypoints, and a specially designed support handle.`,
                `The robot can guide a user to a selected location, monitor its surroundings, and stop automatically if the user releases the handle. Future work will explore capacitive sensing, improved user controls, and integration with more detailed building maps.`
            ]
        },
        {
            title: 'Recreating Fred Brooks’s Office in Virtual Reality',
            body: [
                `This project is preserving the office of pioneering computer scientist Frederick P. Brooks Jr. as an interactive virtual environment. Students created a detailed photogrammetry model from photographs, processed the resulting geometry through RealityScan, Instant Meshes, and Blender, and brought the optimized environment into Unity for VR.`,
                `The work has reduced the geometric complexity of individual objects by approximately 89 to nearly 100 percent while maintaining the recognizable appearance of the original office. Continuing research will investigate automated model-processing tools, standardized photography methods, and level-of-detail systems that adjust model complexity according to the viewer’s location.`
            ]
        },
        {
            title: 'Finger-Position Optimization for Swimming',
            image: 'images/OptimizingHandPostionForSwimming.jpg',
            imageAlt: 'Experimental hand models used to study swimming performance',
            body: [
                `Small changes in finger spacing and hand position can affect the forces produced by a swimmer moving through the water. Students are using 3D-printed hand models, pressure measurements, pitot tubes, and flow visualization to study how finger spacing, wrist angle, and hand orientation influence useful propulsive force.`,
                `The project combines experimental design, fabrication, instrumentation, and data analysis with the goal of producing findings that can be translated into practical guidance for competitive swimmers.`
            ],
            collaboration: 'Applied Mathematics, Exercise and Sport Science, and the U.S. Olympic Swim Team',
            link: 'https://www.unc.edu/posts/2024/08/06/tar-heel-experts-unlock-science-behind-swimming/',
            linkText: 'Read the Carolina story about the science behind swimming'
        },
        {
            title: 'Hand-Position Tracking Glove',
            body: [
                `Originally developed as a second phase of the swimming project, this low-cost sensing glove measures the positions of a user’s fingers and displays a corresponding hand model in Unity. The system uses flex sensors, an Arduino Nano 33, a multiplexed circuit, and MATLAB-based calibration to translate physical hand movements into a live digital representation.`,
                `The glove could eventually provide real-time feedback that helps swimmers maintain an optimal hand position. Its broader potential includes physical therapy, rehabilitation, and guided home-exercise applications. Current work is focused on improving calibration, reducing sensor drift, adding more complete thumb tracking, and developing a custom circuit board.`
            ],
            collaboration: 'Applied Mathematics, Exercise and Sport Science, and the U.S. Olympic Swim Team'
        },
        {
            title: 'Biologically Driven Autonomous Vehicle Research',
            image: 'images/AutonomousVehicles.JPG',
            imageAlt: 'Biologically controlled autonomous vehicle developed in the EEL',
            body: [
                `This project investigates how biological movement and other human or animal signals can be used to control autonomous systems. In the initial prototype, a camera and computer-vision system track the movement of a goldfish within different regions of its tank. Those movements are translated into steering and throttle commands for a small robotic vehicle.`,
                `LiDAR and infrared sensors provide independent safety overrides to prevent collisions. Although the prototype uses a fish, the underlying control architecture could be adapted to eye movement, muscle signals, gestures, or other biological inputs.`
            ]
        },
        {
            title: 'Acoustic Communication for an Underwater Manta Ray Robot Swarm',
            image: 'images/SwarmRobots.JPG',
            imageAlt: 'Underwater manta ray swarm robot prototype',
            body: [
                `Students are developing low-cost underwater robots inspired by manta rays that could eventually work together to map the seafloor or collect environmental measurements. The current research focuses on underwater acoustic communication using piezoelectric transducers and communication protocols designed for a swarm of robots.`,
                `The project also includes the design and fabrication of PETG bodies, flexible TPU fins, servo-driven propulsion, adjustable buoyancy systems, and waterproof electronics. Future versions could carry cameras, water-quality sensors, or other scientific instruments.`
            ]
        },
        {
            title: 'Mixed-Reality Motorcycle Assembly Training',
            body: [
                `This project explores how mixed reality can guide someone through a complex mechanical assembly task. Built in Unity for the Meta Quest 3, the system uses reference markers, environmental depth sensing, and context-aware overlays to show users which tools and components are needed and where each part belongs.`,
                `Users can confirm steps through hand gestures while the system provides instructions in the order required to complete the task. Initial testing demonstrated accurate alignment between virtual instructions and physical motorcycle components while reducing uncertainty during assembly.`
            ]
        },
        {
            title: 'Augmented Aurality',
            image: 'images/AugmentedAurality.JPG',
            imageAlt: 'Wearable augmented-hearing prototype developed in the EEL',
            body: [
                `Augmented Aurality explores whether wearable technology can help users focus on a particular speaker in a noisy environment. The prototype uses an array of eight microphones, a Teensy processor, beamforming, and a signal-processing method called imaginary boosting to isolate and amplify sound coming from a selected direction.`,
                `Students designed custom glasses, electronics, and circuit boards to create a compact wearable prototype. The work addresses the familiar “cocktail party problem” and could contribute to future assistive-listening and augmented-hearing systems.`
            ],
            collaboration: 'Visual Computing and Augmented Intelligence Lab, Computer Science'
        },
        {
            title: '30-Channel Wavemaker Control Interface',
            body: [
                `The EEL previously designed and constructed a 30-channel wavemaker for fluid-dynamics research. The current student project is creating a new software interface that allows researchers to control the individual wave channels, construct repeatable wave patterns, and coordinate more complex experimental sequences.`,
                `The interface will make the existing system easier to operate while allowing researchers to design experiments that would be difficult to conduct through manual control.`
            ],
            collaboration: 'Applied Mathematics'
        }
    ];

    const developmentProjects = [
        {
            title: 'Dorsiflexion and Corticomuscular Coherence Measurement System',
            body: [
                `This project will study the connection between brain activity and lower-extremity muscle activity during a dorsiflexion task. Neural oscillations will be measured through electroencephalography while electromyography records the corresponding muscle activity.`,
                `Students will design and fabricate an adjustable device that safely secures a participant’s foot during a sustained dorsiflexion hold while supporting reliable EMG data collection.`
            ],
            collaboration: 'Physical Therapy'
        },
        {
            title: 'Virtual Chemistry Lab',
            body: [
                `The Virtual Chemistry project will combine physical laboratory containers with virtual chemicals in augmented reality. Students could handle real beakers, test tubes, and other laboratory equipment while inexpensive and comparatively safe substances such as water stand in for dangerous, rare, or costly chemicals.`,
                `Augmented reality would provide the expected colors, reactions, measurements, and other visual effects. The project could expand access to laboratory experiences while allowing students to repeat experiments that would otherwise be unsafe or impractical.`
            ],
            collaboration: 'Visual Computing and Augmented Intelligence Lab, Computer Science'
        },
        {
            title: 'Floating Holographic Display',
            body: [
                `This project will combine a mirascope with a spatial light modulator to create an interactive floating-image display. The work will require optical experimentation, mechanical design, fabrication, software development, and system calibration.`,
                `Students will also investigate whether a machine-learning model can adjust the spatial light modulator’s output to compensate for warping, blur, and other distortions produced by the optical system.`
            ],
            collaboration: 'Visual Computing and Augmented Intelligence Lab, Computer Science'
        },
        {
            title: 'Generative AI for Immersive 360° Environments',
            body: [
                `This project will investigate generative AI systems capable of creating immersive environments from text prompts. Rather than producing a single flat image or conventional video, the long-term goal is to generate a three-dimensional experience through which a user can move, view the scene from different directions, and interact with objects.`,
                `The first phase will focus on creating a large training dataset using synchronized 360-degree video, high-resolution narrow-field imagery, LiDAR, and other available sensors.`
            ],
            collaboration: 'Visual Computing and Augmented Intelligence Lab, Computer Science'
        },
        {
            title: 'Remote PIV System for Measuring Iceberg Melt',
            body: [
                `This project will develop a remotely operated system that can attach itself rigidly to an iceberg using remotely controlled ice drills. Once secured, the system will use particle-image velocimetry to measure fluid motion at the boundary between cold meltwater and the surrounding seawater.`,
                `The research will require the integration of underwater robotics, mechanical design, fabrication, cameras, lighting, instrumentation, and remote-control systems capable of operating in a difficult environment.`
            ],
            collaboration: 'Earth, Marine and Environmental Sciences'
        },
        {
            title: 'Low-Cost CTD Sensors for Oceanography',
            body: [
                `Conductivity, temperature, and depth sensors are essential tools in oceanographic research, but commercial CTD systems can be expensive. This project will use OpenCTD, a low-cost, open-source platform whose software, circuit boards, and 3D-printable components are publicly available under an MIT license.`,
                `Students will fabricate, assemble, calibrate, and test OpenCTD instruments while exploring modifications for specific research applications.`
            ],
            collaboration: 'Earth, Marine and Environmental Sciences'
        }
    ];

    const courses = [
        {
            title: 'COMP 290: Introduction to Applied Engineering',
            body: [
                `Introduction to Applied Engineering is a hands-on course taught by Jim Mahaney in the Computer Science machine shop. Students personally operate metal lathes, milling machines, welding equipment, and related tools while learning traditional fabrication methods, shop safety, materials, tolerances, and mechanical design.`,
                `One of the course’s central themes is the use of applied engineering to support research. Student projects are connected to research in Computer Science and in collaborating departments across campus. Based on a review of UNC’s published course offerings, this appears to be the University’s first undergraduate credit-bearing course centered on students operating this range of traditional machine-shop equipment.`
            ]
        },
        {
            title: 'COMP 293: Internship in Computer Science',
            body: [
                `In the EEL, COMP 293 is taught by Jim Mahaney and gives experienced undergraduate researchers the opportunity to lead a research team. Student leaders help define project goals, organize the team’s work, mentor newer researchers, guide technical decisions, and address problems as they arise.`,
                `The course allows students to develop leadership, project-management, communication, and mentoring skills while continuing to contribute directly to active research.`
            ]
        },
        {
            title: 'COMP 495: Mentored Research in Computer Science',
            body: [
                `In the EEL, COMP 495 is taught by Jim Mahaney and allows students to pursue focused research projects using the lab’s facilities, equipment, and technical resources. Each section is tailored to the individual student and project, so the research topic, methods, and deliverables vary.`,
                `Students take greater responsibility for defining the problem, selecting appropriate methods, designing and conducting experiments, documenting their work, and presenting their results.`
            ]
        },
        {
            title: 'RELI 283: The Buddhist Tradition: India, Nepal, and Tibet',
            body: [
                `RELI 283 is taught by Lauren Leve in Religious Studies. Working with Leve, Jim Mahaney and EEL undergraduate researchers have developed the 3D models, optimized datasets, VR environments, and redirected-walking system used in the course.`,
                `During VR labs, students explore accurately scaled models of Swayambhu and other locations discussed in class. Redirected walking allows them to move naturally through a life-size virtual environment much larger than the physical laboratory, giving them a stronger understanding of scale, spatial relationships, and the embodied experience of a religious site.`,
                `More than a dozen undergraduate researchers have contributed to the models and VR system. The course demonstrates a direct connection between field research and teaching while bringing together Computer Science and the humanities in a way that would not be possible through conventional two-dimensional classroom materials alone.`
            ],
            collaboration: 'Religious Studies',
            link: 'https://www.unc.edu/discover/tar-heel-team-begins-preservation-of-ancient-nepal-temple/',
            linkText: 'Read the Carolina story about the Nepal fieldwork'
        }
    ];

    const pastProjects = [
        {
            title: 'Magnetohydrodynamic Drive',
            image: 'images/MagnetohydrodynamicDrive.png',
            imageAlt: 'Magnetohydrodynamic drive developed and tested in the EEL',
            body: [
                `This project investigated propulsion systems that use magnetic and electric fields to move electrically conductive seawater without conventional propellers. Students designed and fabricated both circular and Halbach-array magnetohydrodynamic drives and evaluated them using high-speed 4K video and particle-image velocimetry.`,
                `Testing showed that the Halbach-array design produced a higher exhaust velocity and approximately 50 percent greater normalized efficiency than the circular configuration.`
            ],
            collaboration: 'Applied Mathematics'
        },
        {
            title: 'Smart Irrigation System',
            image: 'images/SmartIrrigationSystem.png',
            imageAlt: 'Sensor-based smart irrigation system developed in the EEL',
            body: [
                `Students developed a sensor-based irrigation system designed to monitor environmental conditions and provide water only when needed. The project integrated sensors, control electronics, software, and a physical watering system into a working prototype.`,
                `The project demonstrated how relatively inexpensive hardware and intelligent control could reduce unnecessary water use while giving students experience with a complete system spanning measurement, computation, and mechanical design.`
            ]
        },
        {
            title: 'Modular WebAR Experiences',
            body: [
                `This project developed a reusable toolkit for creating browser-based augmented-reality experiences without requiring users to install a specialized application. The system uses natural images as tracking targets rather than QR codes or AprilTags and was built with A-Frame and MindAR.`,
                `An administrative dashboard and configuration files allow new experiences to be created and updated without rewriting the underlying software. The system was deployed through GitHub Pages for projects in the EEL and the SN020 makerspace, demonstrating a scalable approach to delivering accessible augmented-reality content.`
            ]
        }
    ];

    function renderBody(item) {
        return item.body.map(paragraph => `<p>${paragraph}</p>`).join('');
    }

    function renderDetails(item) {
        const parts = [];

        if (item.collaboration) {
            parts.push(`<p class="research-collaboration"><strong>Collaboration:</strong> ${item.collaboration}</p>`);
        }

        if (item.link) {
            parts.push(`<a class="research-link" href="${item.link}" target="_blank" rel="noopener noreferrer">${item.linkText}</a>`);
        }

        return parts.join('');
    }

    function renderFeatureEntry(item) {
        const entryClass = item.image
            ? 'research-entry research-entry--with-image'
            : 'research-entry research-entry--text-only';

        const parts = [`<article class="${entryClass}">`];

        if (item.image) {
            parts.push(
                '<div class="research-entry-media">',
                `<img src="${item.image}" alt="${item.imageAlt || item.title}" loading="lazy" decoding="async">`,
                '</div>'
            );
        }

        parts.push(
            '<div class="research-entry-content">',
            `<h3>${item.title}</h3>`,
            '<div class="research-entry-copy">',
            renderBody(item),
            '</div>',
            renderDetails(item),
            '</div>',
            '</article>'
        );

        return parts.join('');
    }

    function renderTextEntry(item) {
        return [
            '<article class="research-text-entry">',
            `<h3>${item.title}</h3>`,
            '<div class="research-text-entry-content">',
            '<div class="research-entry-copy">',
            renderBody(item),
            '</div>',
            renderDetails(item),
            '</div>',
            '</article>'
        ].join('');
    }

    function renderSection(id, title, items, layout) {
        const renderer = layout === 'feature'
            ? renderFeatureEntry
            : renderTextEntry;

        const listClass = layout === 'feature'
            ? 'research-feature-list'
            : 'research-text-list';

        return [
            `<section class="research-section" id="${id}">`,
            `<h2 class="research-section-title">${title}</h2>`,
            `<div class="${listClass}">`,
            items.map(renderer).join(''),
            '</div>',
            '</section>'
        ].join('');
    }

    return [
        '<div class="research-page">',
        '<h1 class="expanded-title">Research &amp; Teaching</h1>',
        '<p class="research-intro">The EEL gives undergraduate students opportunities to participate in research that crosses traditional departmental boundaries and connects computing, engineering, fabrication, immersive technology, and scientific inquiry. Projects range from student-generated ideas to collaborations with faculty across campus. The lab also brings this work into credit-bearing courses in which students learn specialized technical skills, conduct mentored research, and lead research teams.</p>',
        '<nav class="research-jump-nav" aria-label="Research and teaching sections">',
        '<a href="#current-projects">Current Projects</a>',
        '<span aria-hidden="true">·</span>',
        '<a href="#projects-in-development">In Development</a>',
        '<span aria-hidden="true">·</span>',
        '<a href="#courses">Courses</a>',
        '<span aria-hidden="true">·</span>',
        '<a href="#past-work">Past Work</a>',
        '</nav>',
        renderSection('current-projects', 'Current Projects', currentProjects, 'feature'),
        renderSection('projects-in-development', 'Projects in Development', developmentProjects, 'text'),
        renderSection('courses', 'Courses and Academic Opportunities', courses, 'text'),
        renderSection('past-work', 'Selected Past Projects and Courses', pastProjects, 'feature'),
        '</div>'
    ].join('');
}

function getPeopleContent() {
    function linkedinLink(url) {
        if (!url) return '';

        return '<a href="' + url + '" class="linkedin-link" target="_blank" ' +
            'rel="noopener noreferrer" aria-label="LinkedIn Profile">' +
            '<svg class="linkedin-icon" viewBox="0 0 24 24" ' +
            'xmlns="http://www.w3.org/2000/svg">' +
            '<path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-' +
            '3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667' +
            'H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 ' +
            '3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 ' +
            '2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 ' +
            '13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 ' +
            '0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 ' +
            '24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>' +
            '</svg></a>';
    }

    const labDirector = {
        name: 'Jim Mahaney',
        role: 'Director of Engineering and Research'
    };

    const foundingEngineers = new Set([
        'Ethan DeRosa',
        'Siera Gashi',
        'Darwin Lemus',
        'Matias Magallanes',
        'Sofia Morais',
        'Sanskriti Negi',
        'Tate Semone',
        'Elyssa Snively',
        'Alexander Yevchenko',
        'Andy Choe',
        'Meghan Parker'
    ]);

    var boltSVG =
        '<svg class="founding-bolt" viewBox="0 0 72 90" ' +
        'xmlns="http://www.w3.org/2000/svg">' +
        '<path d="M 36.34375 45.226562 L 45.222656 41.386719 ' +
        'L 38.742188 80.746094 L 38.261719 80.390625 ' +
        'L 35.863281 51.945312 C 32.554688 52.140625 ' +
        '29.253906 55.304688 26.019531 55.664062 ' +
        'L 33.941406 21.824219 C 33.671875 21.53125 ' +
        '28.269531 24.589844 27.945312 24.707031 ' +
        'L 36.582031 8.746094 L 39.941406 27.464844 ' +
        'L 36.699219 24.347656 L 36.34375 25.1875 Z" ' +
        'fill="currentColor"/></svg>';

    function foundingBadge(name) {
        if (!foundingEngineers.has(name)) return '';

        return '<div class="founding-badge">' +
            boltSVG +
            '<span>Founding Engineer</span></div>' +
            '<p class="founding-subtitle">' +
            'Member of the first EEL Undergraduate Cohort</p>';
    }

    const specialAccolades = {
        'Lily Foo': {
            badge: 'Best Aluminum TIG Welder',
                        subtitle: 'Fall 2025 & Spring 2026'
        }
    };

    function accoladeBadge(name) {
        var accolade = specialAccolades[name];

        if (!accolade) return '';

        return '<div class="accolade-badge">' +
            boltSVG +
            '<span>' + accolade.badge + '</span></div>' +
            '<p class="accolade-subtitle">' +
            accolade.subtitle + '</p>';
    }

    const featuredMembers = [
        {
            name: 'Markandeya Yalamanchi',
            major: 'Computer Science',
            status: 'Sophomore',
            graduation: 'May 2028',
            project: 'Developing redirected walking (RDW) techniques for Meta Quest 3 VR, enabling users to navigate large virtual environments within smaller physical spaces. Currently building predictive models to anticipate reset frequency based on virtual environment topology, moving beyond implementing existing algorithms to discovering novel relationships between environment design and RDW effectiveness.',
            headshot: 'headshots/markandeya-yalamanchi.jpg',
            linkedin: 'https://www.linkedin.com/in/markyala'
        },
        {
            name: 'Tate Semone',
            major: 'Physics',
            status: 'Junior',
            graduation: 'May 2028',
            project: 'My project tests magnetic-field orientations to maximize flow efficiency in a magnetohydrodynamic drive. Model 1 uses a circularly oriented B-field with a radially outward electric field; Model 2 utilizes a Halbach array to concentrate flux in the channel. Efficiency is evaluated using Particle Image Velocimetry (PIV) flow measurements.',
            headshot: 'headshots/tate-semone.jpeg',
            linkedin: 'https://www.linkedin.com/in/tate-semone-105905268'
        },
        {
            name: 'Sofia Morais',
            major: 'Biomedical Engineering',
            status: 'Senior',
            graduation: 'May 2027',
            project: 'Designing a glove to track finger position for sports and physical therapy applications by integrating flex sensors with Arduino microcontrollers to measure finger bending and separation, while showing real-time hand movement on a hand model in Unity. She also enjoys learning fabrication skills such as welding and milling.',
            headshot: 'headshots/sofia-morais.jpeg',
            linkedin: 'https://www.linkedin.com/in/sofia-morais-486ba3277'
        },
        {
            name: 'Elyssa Snively',
            major: 'Biomedical Engineering',
            status: 'Senior',
            graduation: 'May 2027',
            project: 'My project reprograms the Boston Dynamics Spot robot to operate as an autonomous guide dog, using AI-driven navigation, mapping, localization, obstacle detection, and voice-based destination commands. The system integrates perception, decision-making, and a custom physical handle interface to provide safe, timely guidance for visually impaired users on campus.',
            headshot: 'headshots/elyssa-snively.jpg',
            linkedin: 'https://www.linkedin.com/in/elyssa-snively'
        },
        {
            name: 'Ishi Varshney',
            major: 'Computer Science',
            status: 'Junior',
            graduation: 'May 2028',
            project: 'My current project reprograms the Boston Dynamics Spot robot to act as an autonomous guide dog, enabling safe, intuitive navigation for visually impaired users. Initially focused on the UNC campus, the system uses AI-driven perception and voice commands to support scalable, location-independent mobility beyond environments where traditional guide dogs can be trained.',
            headshot: 'headshots/ishi-varshney.jpeg',
            linkedin: 'https://www.linkedin.com/in/ishi-varshney'
        },
        {
            name: 'Alexa Tinajero',
            major: 'Computer Science',
            status: 'Junior',
            graduation: 'May 2028',
            project: 'This project involves developing the software that allows the Boston Dynamics Spot robot to navigate a campus environment independently as a guide for visually impaired users. I focus on how the robot interprets its surroundings through mapping, localization, and obstacle detection, makes navigation decisions using AI-based planning, and responds to voice-based destination commands. These components work together with a physical guidance handle to support safe, timely movement through real-world campus spaces.',
            headshot: 'headshots/alexa-tinajero.jpeg',
            linkedin: 'https://www.linkedin.com/in/alexatinajero'
        },
        {
            name: 'Lily Foo',
            major: 'Physics',
            status: 'Junior',
            graduation: 'June 2028',
            project: 'Studying the dynamics of drag on hand position in fluids for swimmers.',
            headshot: 'headshots/lily-foo.png',
            linkedin: null
        },
        {
            name: 'Riley Goodwin',
            major: 'Biomedical Engineering',
            status: 'Sophomore',
            graduation: 'May 2029',
            project: 'I\'m currently helping code a fish-operated vehicle that uses a camera to track the movement of a fish, allowing it to accelerate and change directions. I\'m also working on a waterproof movement-tracking glove used to find the optimal hand positioning for swimmers.',
            headshot: 'headshots/riley-goodwin.jpg',
            linkedin: 'https://www.linkedin.com/in/riley-goodwinq'
        },
        {
            name: 'Ethan DeRosa',
            major: 'Biomedical Engineering',
            status: 'Senior',
            graduation: 'May 2027',
            project: 'Assisting with the hardware components of the fish-operated vehicle.',
            headshot: 'headshots/ethan-derosa.jpg',
            linkedin: 'https://www.linkedin.com/in/ethandre'
        },
        {
            name: 'Coleman Stephens',
            major: 'Biomedical Engineering',
            status: 'Senior',
            graduation: 'May 2027',
            project: 'My project involves utilizing a Boston Dynamics Spot robot to act as a seeing-eye dog. AI-driven navigation, mapping, localization, collision avoidance, and voice commands are implemented to use Spot as a guide. The system combines perception, decision-making, and a custom physical handle interface to deliver safe, timely guidance for visually impaired users navigating campus.',
            headshot: 'headshots/coleman-stephens.jfif',
            linkedin: 'https://www.linkedin.com/in/coleman-stephens'
        },
        {
            name: 'Mihika Tyagi',
            major: 'Data Science & Computer Science',
            status: 'Senior',
            graduation: 'May 2027',
            project: 'My current focus is the Nepal VR project, in which we are implementing redirected walking to create a better experience navigating the temple model.',
            headshot: 'headshots/mihika-tyagi.jpg',
            linkedin: 'https://www.linkedin.com/in/mihika-tyagi'
        },
        {
            name: 'Siera Gashi',
            major: 'Biomedical Engineering',
            status: 'Junior',
            graduation: 'May 2028',
            project: 'I have assisted in analyzing swimmer hand models to study fluid dynamics and optimization, as well as supporting a Parkinson\'s disease project that utilizes motion-sensing data to analyze movement patterns and quantify motor symptoms.',
            headshot: 'headshots/siera-gashi.jpeg',
            linkedin: 'https://www.linkedin.com/in/siera-gashi-2a991422b'
        },
        {
            name: 'William Keffer',
            major: 'Computer Science & Math',
            status: 'Junior',
            graduation: 'May 2028',
            project: 'Developed and deployed the EEL website frontend and backend.',
            headshot: 'headshots/william-keffer.jpg',
            linkedin: 'https://www.linkedin.com/in/williamkeffer'
        },
        {
            name: 'Alexander Yevchenko',
            major: 'Computer Science, Business & Physics',
            status: 'Junior',
            graduation: 'December 2027',
            project: 'Alexander co-developed a real-time flex-sensor glove with Sofia Morais to study swimmer hand positioning, with applications in sports, rehabilitation, and virtual reality.',
            headshot: 'headshots/alexander-yevchenko.png',
            linkedin: 'https://www.linkedin.com/in/alexanderyevchenko'
        },
        {
            name: 'Darwin Lemus',
            major: 'Computer Science & Physics',
            status: 'Junior',
            graduation: 'December 2027',
            project: 'Darwin is an Honors Carolina computer science and physics student at UNC and a Gates and Williamson Scholar.',
            headshot: 'headshots/darwin-lemus.jpeg',
            linkedin: 'https://www.linkedin.com/in/dlemus89'
        },
        {
            name: 'Toluwani Ilesanmi',
            major: 'Computer Science',
            status: 'Sophomore',
            graduation: 'May 2029',
            project: 'Toluwani contributes to swarm robotics research through robot construction, testing, prototyping, schematic design, wiring, and hardware integration.',
            headshot: 'headshots/toluwani-ilesanmi.jpeg',
            linkedin: 'https://www.linkedin.com/in/toluwaniile'
        },
        {
            name: 'David Majernik',
            major: 'Computer Science',
            status: 'Senior',
            graduation: 'May 2027',
            project: 'David is a computer science student at UNC and a software engineering intern at Wells Fargo.',
            headshot: 'headshots/david-majernik.png',
            linkedin: 'https://www.linkedin.com/in/davidmajernik'
        },
        {
            name: 'Matthew Czar',
            major: 'Biochemistry & Statistics',
            status: 'Sophomore',
            graduation: 'May 2029',
            project: 'Matthew researches swimming hydrodynamics in the Applied Engineering Lab and Joint Mathematics and Marine Science Fluid Laboratories to optimize body position for elite athletes.',
            headshot: 'headshots/matthew-czar.png',
            linkedin: 'https://www.linkedin.com/in/meczar'
        },
        {
            name: 'Noah Butler',
            major: 'Computer Science',
            status: 'Undergraduate',
            graduation: null,
            project: 'Noah is a computer science student at UNC working on XR, computer graphics, redirected walking, and mixed-reality simulation systems.',
            headshot: 'headshots/noah-butler.png',
            linkedin: 'https://www.linkedin.com/in/n-rock'
        },
        {
            name: 'Matias Magallanes',
            major: 'UNC Undergraduate',
            status: 'Junior',
            graduation: 'December 2027',
            project: 'Matias is a UNC undergraduate and a member of the EEL research team.',
            headshot: 'headshots/matias-magallanes.jpeg',
            linkedin: 'https://www.linkedin.com/in/matias-magallanes-8194872a9'
        },
        {
            name: 'Sanskriti Negi',
            major: 'Biomedical Engineering & Computer Science',
            status: 'Junior',
            graduation: 'December 2027',
            project: 'Sanskriti is a biomedical engineering and computer science student at UNC pursuing a career in robotics.',
            headshot: 'headshots/sanskriti-negi.jpeg',
            linkedin: 'https://www.linkedin.com/in/sanskriti-negi-unc'
        },
        {
            name: 'Sidharth Yeramaddu',
            major: 'Applied Mathematics & Computer Science',
            status: 'Undergraduate',
            graduation: null,
            project: 'Sidharth is an applied mathematics and computer science student at UNC.',
            headshot: 'headshots/sidharth-yeramaddu.jpeg',
            linkedin: 'https://www.linkedin.com/in/sidharth-yeramaddu'
        }
    ];

    const otherMembers = [
        {
            name: 'Matthew Alexander',
            linkedin: null
        },
        {
            name: 'Adrian Hito',
            linkedin: 'https://www.linkedin.com/in/adrian-hito'
        },
        {
            name: 'Adam Qaimari',
            linkedin: 'https://www.linkedin.com/in/adamqaimari'
        },
        {
            name: 'Alex Salinas',
            linkedin: 'https://www.linkedin.com/in/alex-a-salinas'
        },
        {
            name: 'Alexander Bryan',
            linkedin: null
        },
        {
            name: 'Allen Solomon',
            linkedin: null
        },
        {
            name: 'Brandon Ge',
            linkedin: 'https://www.linkedin.com/in/brandonyge'
        },
        {
            name: 'Joaquim D\'Silva',
            linkedin: 'https://www.linkedin.com/in/joaquimdsilva'
        },
        {
            name: 'Joseph Sabo',
            linkedin: 'https://www.linkedin.com/in/josephsabo29'
        },
        {
            name: 'Karthik Dundigalla',
            linkedin: 'https://www.linkedin.com/in/karthik-dundigalla-a92332251'
        },
        {
            name: 'Lillian Gann',
            linkedin: 'https://www.linkedin.com/in/lillian-gann-unc'
        },
        {
            name: 'Luke Hyatt',
            linkedin: 'https://www.linkedin.com/in/luke-hyatt-49a168288'
        },
        {
            name: 'Nichola Wells',
            linkedin: 'https://www.linkedin.com/in/nichola-wells-872178262'
        }
    ];

    const projectCatalog = {
        redirectedWalking: 'Boundary-Aware Redirected Walking in Virtual Reality',
        magnetohydrodynamic: 'Magnetohydrodynamic Drive',
        handTracking: 'Hand-Position Tracking Glove',
        spot: 'PAWS: SPOT Assistive Navigation Robot',
        swimmerHand: 'Finger-Position Optimization for Swimming',
        fishCar: 'Biologically Driven Autonomous Vehicle Research',
        mantaRay: 'Acoustic Communication for an Underwater Manta Ray Robot Swarm',
        modularWebAR: 'Modular WebAR Experiences',
        motorcycleAR: 'Mixed-Reality Motorcycle Assembly Training',
        brooksVR: 'Recreating Fred Brooks’s Office in Virtual Reality',
        wavemaker: '30-Channel Wavemaker Control Interface',
        icePIV: 'Remote PIV System for Measuring Iceberg Melt',
        openCTD: 'Low-Cost CTD Sensors for Oceanography',
        hologram: 'Floating Holographic Display',
        immersive360AI: 'Generative AI for Immersive 360° Environments',
        dorsiflexion: 'Dorsiflexion and Corticomuscular Coherence Measurement System',
        nepalModel: 'Scalable 3D Environment Optimization',
        eelWebsite: 'EEL Website Development'
    };

    const projectPosters = {
        redirectedWalking: 'images/NepalVR.pdf',
        magnetohydrodynamic: 'images/Magnetohydrodynamic.pdf',
        handTracking: 'images/HandTracking.pdf',
        spot: 'images/SPOT.pdf',
        swimmerHand: 'images/SwimmerHand.pdf',
        fishCar: 'images/AutonomousVehicle.pdf',
        mantaRay: 'images/MantaRay.pdf',
        modularWebAR: 'images/ModularWebAR.pdf',
        motorcycleAR: 'images/MotorcycleAR.pdf',
        brooksVR: 'images/BrooksVR.pdf'
    };

    const memberProjects = {
        'Markandeya Yalamanchi': [
            { key: 'redirectedWalking', poster: true }
        ],
        'Tate Semone': [
            { key: 'magnetohydrodynamic', poster: true }
        ],
        'Sofia Morais': [
            { key: 'handTracking', poster: true },
            { key: 'dorsiflexion' }
        ],
        'Elyssa Snively': [
            { key: 'spot', poster: true }
        ],
        'Ishi Varshney': [
            { key: 'spot', poster: true },
            { key: 'immersive360AI' }
        ],
        'Alexa Tinajero': [
            { key: 'spot', poster: true }
        ],
        'Lily Foo': [
            { key: 'swimmerHand', poster: true }
        ],
        'Riley Goodwin': [
            { key: 'fishCar', poster: true },
            { key: 'handTracking', poster: true },
            { key: 'dorsiflexion' }
        ],
        'Ethan DeRosa': [
            { key: 'fishCar', poster: true }
        ],
        'Coleman Stephens': [
            { key: 'spot', poster: true }
        ],
        'Mihika Tyagi': [
            { key: 'redirectedWalking', poster: true },
            { key: 'immersive360AI' }
        ],
        'Siera Gashi': [
            { key: 'handTracking', poster: true },
            { key: 'dorsiflexion' }
        ],
        'William Keffer': [
            { key: 'eelWebsite' }
        ],
        'Alexander Yevchenko': [
            { key: 'handTracking', poster: true },
            { key: 'dorsiflexion' }
        ],
        'Darwin Lemus': [
            { key: 'modularWebAR', poster: true }
        ],
        'Toluwani Ilesanmi': [
            { key: 'mantaRay', poster: true }
        ],
        'David Majernik': [
            { key: 'redirectedWalking', poster: true }
        ],
        'Matthew Czar': [
            { key: 'swimmerHand', poster: true }
        ],
        'Noah Butler': [
            { key: 'motorcycleAR', poster: true },
            { key: 'redirectedWalking', poster: true }
        ],
        'Matias Magallanes': [
            { key: 'fishCar', poster: true }
        ],
        'Sanskriti Negi': [
            { key: 'mantaRay', poster: true },
            { key: 'icePIV' }
        ],
        'Sidharth Yeramaddu': [
            { key: 'brooksVR', poster: true }
        ],
        'Matthew Alexander': [
            { key: 'fishCar' },
            { key: 'openCTD' }
        ],
        'Adrian Hito': [
            { key: 'wavemaker' }
        ],
        'Adam Qaimari': [
            { key: 'fishCar' },
            { key: 'dorsiflexion' }
        ],
        'Alex Salinas': [
            { key: 'hologram' },
            { key: 'brooksVR', poster: true }
        ],
        'Alexander Bryan': [
            { key: 'wavemaker' }
        ],
        'Allen Solomon': [
            { key: 'hologram' },
            { key: 'brooksVR', poster: true }
        ],
        'Joseph Sabo': [
            { key: 'fishCar', poster: true }
        ],
        'Lillian Gann': [
            { key: 'icePIV' }
        ],
        'Luke Hyatt': [
            { key: 'spot', poster: true },
            { key: 'nepalModel' }
        ]
    };

    function renderMemberProjects(name) {
        const assignments = memberProjects[name];

        if (!assignments || assignments.length === 0) return '';

        const output = [
            '<div class="member-projects">',
            '<p class="person-role">Projects</p>'
        ];

        assignments.forEach(function(assignment) {
            const title = projectCatalog[assignment.key];

            if (!title) return;

            output.push(
                '<div class="member-project-entry">',
                '<p class="person-bio">', title, '</p>'
            );

            if (assignment.poster && projectPosters[assignment.key]) {
                output.push(
                    '<a class="research-link" href="',
                    projectPosters[assignment.key],
                    '" target="_blank" rel="noopener noreferrer">',
                    '2026 Celebration of Undergraduate Research Poster',
                    '</a>'
                );
            }

            output.push('</div>');
        });

        output.push('</div>');
        return output.join('');
    }

    const alumni = [
        {
            name: 'Andy Choe',
            major: 'Biomedical Engineering',
            graduation: 'Spring 2026',
            project: 'Augmented Aurality',
            headshot: 'headshots/andy-choe.jpg',
            linkedin: 'https://www.linkedin.com/in/seungchoe'
        },
        {
            name: 'Meghan Parker',
            major: 'Biomedical Engineering',
            graduation: 'Spring 2026',
            project: 'Augmented Aurality',
            headshot: 'headshots/meghan-parker.jpg',
            linkedin: 'https://www.linkedin.com/in/meghan-parker-2746ba303'
        },
        {
            name: 'Fletcher Stuart',
            major: 'Computer Science',
            graduation: 'Spring 2026',
            project: '',
            headshot: 'headshots/fletcher-stuart.jpg',
            linkedin: 'https://www.linkedin.com/in/fletcher-stuart-931695126'
        },
        {
            name: 'Ethan Hernandez',
            major: 'Computer Science',
            graduation: 'Spring 2026',
            project: 'Recreating Fred Brooks’s Office in Virtual Reality',
            headshot: 'headshots/ethan-hernandez.jpg',
            linkedin: 'https://www.linkedin.com/in/ethan-hernandez-3aa509236'
        },
        {
            name: 'Ansh Aryan',
            major: 'Computer Science',
            graduation: 'Spring 2026',
            project: 'Reliable 3D Reconstruction with Radiance Fields',
            headshot: 'headshots/ansh-aryan.jpeg',
            linkedin: 'https://www.linkedin.com/in/ansh-aryan03'
        }
    ];

       const collaboratingAreas = [
        {
            name: 'Computer Science',
            url: 'https://cs.unc.edu/'
        },
        {
            name: 'Applied Mathematics',
            url: 'https://amath.unc.edu/'
        },
        {
            name: 'Exercise and Sport Science',
            url: 'https://exss.unc.edu/'
        },
        {
            name: 'Earth, Marine and Environmental Sciences',
            url: 'https://emes.unc.edu/'
        },
        {
            name: 'Physical Therapy',
            url: 'https://www.med.unc.edu/healthsciences/physical/'
        },
        {
            name: 'Religious Studies',
            url: 'https://religion.unc.edu/'
        }
    ];

    featuredMembers.sort(function(a, b) {
        return a.name
            .split(' ')
            .pop()
            .toLowerCase()
            .localeCompare(
                b.name.split(' ').pop().toLowerCase()
            );
    });

    otherMembers.sort(function(a, b) {
        return a.name
            .split(' ')
            .pop()
            .toLowerCase()
            .localeCompare(
                b.name.split(' ').pop().toLowerCase()
            );
    });

    alumni.sort(function(a, b) {
        return a.name
            .split(' ')
            .pop()
            .toLowerCase()
            .localeCompare(
                b.name.split(' ').pop().toLowerCase()
            );
    });

    const parts = [];

    parts.push(
        '<h1 class="expanded-title">Members &amp; Collaborators</h1>',
        '<div class="people-section">',
        '<h2 class="people-section-title">Lab Director</h2>',
        '<div class="people-grid director-grid">',
        '<div class="person-card director-card">',
        '<img class="person-image person-headshot" ',
        'src="headshots/Jim_Mahaney_Headshot.jpg" ',
        'alt="Jim Mahaney" loading="lazy" decoding="async">',
        '<h3 class="person-name">', labDirector.name, '</h3>',
        '<p class="person-role">', labDirector.role, '</p>',
        '<p class="person-bio director-bio">',
                '<strong>Jim Mahaney is the Director of Engineering and Research ',
        'for the Department of Computer Science at the University of ',
        'North Carolina at Chapel Hill.</strong> Since first joining ',
        'Carolina as a student assistant in 1997, he has designed and ',
        'fabricated experimental systems across areas including robotics ',
        'and medical devices, augmented and virtual reality, sensing ',
        'technologies, fluid dynamics, and large-scale 3D capture and ',
        'reconstruction. He later returned to lead the facility, bringing ',
        'his career at Carolina full circle. ',
        'In Fall 2025, he launched the EEL’s undergraduate research ',
        'program, creating opportunities that combine faculty ',
        'collaborations, student-led research, specialized technical ',
        'training, and credit-bearing courses. His current work focuses ',
        'on hands-on engineering education and helping undergraduate ',
        'researchers develop practical skills in electronics, machining, ',
        'welding, fabrication, and rapid prototyping while building ',
        'systems for active research projects.',
                    '</p>',
        '<a class="research-link" href="https://research.unc.edu/2025/09/03/rooted-jim-mahaney/" target="_blank" rel="noopener noreferrer">Read the UNC Research profile, “Rooted: Jim Mahaney”</a>',
        '</div>',
        '</div>',
        '</div>'
    );

    parts.push(
        '<div class="people-section">',
        '<h2 class="people-section-title">',
        'Current Undergraduate Researchers',
        '</h2>',
        '<div class="people-grid featured-grid current-researchers-grid">'
    );

    for (let i = 0; i < featuredMembers.length; i++) {
        const member = featuredMembers[i];

        parts.push('<div class="person-card featured-card">');

        if (member.headshot) {
            parts.push(
                '<img class="person-image person-headshot" src="',
                member.headshot,
                '" alt="',
                member.name,
                '" loading="lazy" decoding="async">'
            );
        } else {
            var initials = member.name
                .split(' ')
                .map(function(namePart) {
                    return namePart[0];
                })
                .join('');

            parts.push(
                '<div class="person-image placeholder-image">',
                '<span>',
                initials,
                '</span>',
                '</div>'
            );
        }

        parts.push(
            '<div class="person-name-row">',
            '<h3 class="person-name">', member.name, '</h3>',
            linkedinLink(member.linkedin),
            '</div>',
            '<p class="person-details">',
            member.major,
            ' · ',
            member.status,
            '</p>'
        );

        if (member.graduation) {
            parts.push(
                '<p class="person-graduation">',
                'Expected Graduation: ',
                member.graduation,
                '</p>'
            );
        }

                parts.push(
            accoladeBadge(member.name),
            foundingBadge(member.name),
            renderMemberProjects(member.name),
            '</div>'
        );
    }

    for (let i = 0; i < otherMembers.length; i++) {
        const member = otherMembers[i];
        const initials = member.name
            .split(' ')
            .map(function(namePart) {
                return namePart[0];
            })
            .join('');

        parts.push(
            '<div class="person-card featured-card">',
            '<div class="person-image placeholder-image" aria-hidden="true">',
            '<span>', initials, '</span>',
            '</div>',
            '<div class="person-name-row">',
            '<h3 class="person-name">', member.name, '</h3>',
            linkedinLink(member.linkedin),
            '</div>',
            '<p class="person-role">Research Team</p>',
            foundingBadge(member.name),
            renderMemberProjects(member.name),
            '</div>'
        );
    }

    parts.push('</div>', '</div>');

       parts.push(
        '<div class="people-section collaborators-section">',
        '<h2 class="people-section-title">',
        'Collaborating Academic Areas',
        '</h2>',
        '<div class="collaborator-grid">'
    );

    for (let i = 0; i < collaboratingAreas.length; i++) {
        const area = collaboratingAreas[i];

        parts.push(
            '<a class="person-card collaborator-card" href="',
            area.url,
            '" target="_blank" rel="noopener noreferrer">',
            '<h3 class="person-name">', area.name, '</h3>',
            '<span class="collaborator-link-label">',
            'Visit department website ',
            '<span aria-hidden="true">↗</span>',
            '</span>',
            '</a>'
        );
    }

    parts.push('</div>', '</div>');

    parts.push(
        '<div class="people-section">',
        '<h2 class="people-section-title">EEL Alumni</h2>',
        '<p class="people-section-intro">',
        'Recognizing undergraduate researchers who contributed to the ',
        'EEL and graduated from UNC-Chapel Hill.',
        '</p>',
        '<div class="people-grid featured-grid alumni-grid">'
    );

    for (let i = 0; i < alumni.length; i++) {
        const member = alumni[i];

        parts.push(
            '<div class="person-card featured-card alumni-card">',
            '<img class="person-image person-headshot" src="',
            member.headshot,
            '" alt="',
            member.name,
            '" loading="lazy" decoding="async">',
            '<div class="person-name-row">',
            '<h3 class="person-name">', member.name, '</h3>',
            linkedinLink(member.linkedin),
            '</div>',
            '<p class="person-details">',
            member.major,
            '</p>',
            '<p class="person-graduation">',
            'Graduated: ',
            member.graduation,
            '</p>',
            foundingBadge(member.name)
        );

        if (member.project) {
            parts.push(
                '<p class="person-bio alumni-project">',
                member.project,
                '</p>'
            );
        }

        parts.push('</div>');
    }

    parts.push('</div>', '</div>');

    return parts.join('');
}

function getAboutContent() {
    return `
        <h1 class="expanded-title">EEL at a Glance</h1>
        <div class="content-section">
            <div class="about-stats">
                <div class="about-stat">
                    <strong class="about-stat-number">35</strong>
                    <span class="about-stat-label">Current Undergraduate Researchers</span>
                </div>
                <div class="about-stat">
                                      <strong class="about-stat-number">18</strong>
                    <span class="about-stat-label">Current and Developing Projects</span>
                </div>
                <div class="about-stat">
                    <strong class="about-stat-number">6</strong>
                    <span class="about-stat-label">Collaborating Academic Areas</span>
                </div>
            </div>

            <h2 class="section-title">Research Engineering for Carolina</h2>
            <p class="about-text">The Experimental Engineering Lab provides the engineering expertise, facilities, and technical support needed to turn research ideas into working systems. Based in the Department of Computer Science at UNC-Chapel Hill, the EEL works with faculty and students across campus to design, fabricate, integrate, and test specialized equipment and experimental systems that often cannot be purchased off the shelf.</p>
            <p class="about-text">The lab brings together hardware, software, fabrication, and experimental design in one facility. This allows projects to move quickly from an initial concept to a system that can be tested and used in actual research. It also makes specialized equipment and technical expertise available across projects and departments, extending the value of resources that already exist at Carolina.</p>

            <h2 class="section-title">Undergraduate Research and Engineering Education</h2>
                      <p class="about-text">Under the direction of Jim Mahaney, Director of Engineering and Research, the Experimental Engineering Lab was launched in the fall of 2025, expanding the mission of what had previously been known as the Applied Engineering Lab to include a structured undergraduate research and engineering-training program. By the end of its first two semesters, the program had grown from an idea into a community of 35 undergraduate researchers working across 14 active projects. It now supports 18 current and developing research projects.</p>
            <p class="about-text">Students in the EEL do more than observe research or perform routine laboratory tasks. They help define problems, design components, fabricate parts, develop software, integrate systems, collect data, troubleshoot failures, and present their results. Some projects begin with the needs of faculty researchers, while others originate with students who bring their own ideas to the lab.</p>
            <p class="about-text">This approach gives students experience with the complete process of research engineering: moving from a question or idea to a working system, testing it, learning from what fails, and improving the design. Along the way, students develop practical skills in machining, welding, electronics, rapid prototyping, robotics, sensing, programming, 3D modeling, and immersive technologies.</p>
            <p class="about-text">Research opportunities are complemented by credit-bearing courses and independent studies, allowing students to develop technical skills while contributing to active research. These experiences help prepare students for careers, graduate study, entrepreneurship, and future work in laboratories where progress depends on being able to build something that has never existed before.</p>

            <h2 class="section-title">Collaboration Across Carolina</h2>
            <p class="about-text">The EEL currently supports work involving Computer Science, Applied Mathematics, Earth, Marine and Environmental Sciences, Exercise and Sport Science, Physical Therapy, and Religious Studies.</p>
            <p class="about-text">These collaborations span robotics, accessibility, human movement, rehabilitation, fluid dynamics, environmental sensing, artificial intelligence, virtual and augmented reality, and the documentation and interpretation of cultural sites. By bringing students and researchers from different fields together around a shared problem, the EEL helps create connections that might not develop within the boundaries of a single department.</p>
            <p class="about-text">The lab’s work with Religious Studies is a particularly strong example of this approach. Fieldwork in Nepal has produced detailed 3D records of Buddhist sites, while EEL students have helped develop the models, virtual environments, and redirected-walking technology needed to use that research in immersive educational settings. The collaboration brings together humanities scholarship, computer science, engineering, cultural documentation, and new approaches to teaching.</p>

            <h2 class="section-title">Facilities and Technical Capabilities</h2>
            <p class="about-text">The EEL continues a long tradition of maintaining the ability to design and build specialized research systems within Computer Science. Its facilities include an electronics laboratory, machine shop, rapid-fabrication space, wet lab, and shielded room.</p>
            <p class="about-text">Current capabilities include:</p>
            <ul class="requirements-list">
                <li>Precision machining and metal fabrication</li>
                <li>Welding</li>
                <li>Electronics design and assembly</li>
                <li>Rapid prototyping and 3D printing</li>
                <li>Robotics and autonomous systems</li>
                <li>Sensors and experimental instrumentation</li>
                <li>Virtual and augmented reality</li>
                <li>Redirected walking and immersive simulation</li>
                <li>Large-scale 3D capture and reconstruction</li>
                <li>Custom research-system design and integration</li>
            </ul>
            <p class="about-text">Bringing these capabilities together allows researchers and students to develop complete experimental systems on site rather than distributing the work among unrelated facilities or relying entirely on commercial equipment.</p>

            <h2 class="section-title">Four Decades of Research Engineering</h2>
            <p class="about-text">The EEL continues a four-decade tradition of building innovative research systems within UNC Computer Science. The facility traces its origins to the Microelectronics Systems Laboratory, established in the 1980s to support research requiring specialized computing hardware.</p>
            <p class="about-text">Among the best-known systems developed through this tradition were the Pixel-Planes and PixelFlow graphics engines. These were among the fastest real-time rendering systems of their era and were widely recognized for their innovative, massively parallel architectures. Their designs explored concepts such as per-pixel processing and scalable rendering pipelines that later became central to modern graphics processors.</p>
            <p class="about-text">More recently, the facility was known as the Applied Engineering Lab. In the fall of 2025, Mahaney renamed it the Experimental Engineering Lab to reflect its expanded mission in undergraduate research, hands-on engineering education, and collaboration across campus. The new name also recognizes the lab’s continuing role in designing and building the experimental systems needed to support research at Carolina.</p>
            <p class="about-text">The technology has changed, but the underlying purpose of the lab remains the same: important research often requires the ability to engineer and build new systems in-house. Today, the EEL combines that research-engineering tradition with a growing undergraduate program, giving a new generation of students the opportunity to participate directly in creating the tools and technologies that make discovery possible.</p>

            <h2 class="section-title">Building a Sustainable Campus Resource</h2>
            <p class="about-text">The EEL’s growth demonstrates what can be accomplished by combining existing University facilities with experienced research-engineering leadership, undergraduate talent, faculty collaboration, and outside support.</p>
            <p class="about-text">Fundraising has already provided additional resources for student research and lab development. As the program grows, the EEL will continue expanding collaborations across Carolina while maintaining the close technical mentoring, practical training, and project support that make its work effective.</p>
            <p class="about-text">The goal is not simply to complete more projects. It is to create a sustainable research-engineering resource that helps faculty pursue ambitious ideas, gives students meaningful roles in discovery, and strengthens the connections among research, teaching, engineering, and the liberal arts at Carolina.</p>
        </div>
    `;
}

function getJoinContent() {
    return `
        <h1 class="expanded-title">Join Our Lab</h1>
        <div class="content-section">
            <div class="join-poster">
                <img src="images/jointhelab.png" alt="Join the Experimental Engineering Lab" class="join-poster-img" loading="lazy" decoding="async">
            </div>

            <p class="about-text">
                The Experimental Engineering Lab gives UNC undergraduates the opportunity to contribute directly to active research and engineering projects. Students work on real problems involving areas such as robotics, immersive technology, sensing, fabrication, 3D modeling, and experimental systems while developing practical technical and research skills.
            </p>

            <p class="about-text">
                Previous engineering or shop experience is not required. We are looking for students who are curious, reliable, willing to learn, and prepared to contribute consistently as part of a research team.
            </p>

            <div class="join-requirements">
                <h3 class="requirements-title">What We Ask of Students</h3>
                <ul class="requirements-list">
                    <li>Curiosity and willingness to learn</li>
                    <li>Ability to work collaboratively on a research team</li>
                    <li>Minimum commitment of 5 hours per week</li>
                                       <li>Current UNC undergraduate with a valid UNC email address</li>
                </ul>
            </div>

            <div class="join-cta">
                <a href="application.html" class="apply-now-btn">
                    <span class="btn-text">APPLY NOW</span>
                    <span class="btn-icon">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M5 12h14M12 5l7 7-7 7"/>
                        </svg>
                    </span>
                </a>
            </div>
        </div>
    `;
}

// ============================================
// INTERLOCKING GEARS SVG - Panel Icons
// ============================================
// Three-layer rendering for true mechanical interlocking:
//   Layer 1: Full large gear (behind)
//   Layer 2: Full small gear (in front)
//   Layer 3: Large gear teeth only, clipped to small gear zone (topmost)
// This makes large gear teeth visually enter small gear gaps,
// while small gear teeth (Layer 2) enter large gear gaps (over Layer 1).

const GEAR_CONFIG = (function() {
    // Module m=4, same for both gears so teeth mesh
    const m = 4;
    const lgTeeth = 12, smTeeth = 10;
    const lgPitch = m * lgTeeth / 2;          // 24
    const smPitch = m * smTeeth / 2;          // 20
    const addendum = 0.75 * m;                // 3 — tooth height above pitch
    const dedendum = 1.25 * m;                // 5 — valley depth below pitch
    const centerDist = lgPitch + smPitch;     // 44

    const lgOuterR = lgPitch + addendum;      // 27
    const lgRootR  = lgPitch - dedendum;      // 19
    const smOuterR = smPitch + addendum;      // 23
    const smRootR  = smPitch - dedendum;      // 15

    // Position large gear upper-left, small gear lower-right
    const lgCx = 31, lgCy = 30;
    const meshAngle = Math.atan2(3, 4);       // ~36.87°
    const smCx = lgCx + centerDist * Math.cos(meshAngle);  // ~66.2
    const smCy = lgCy + centerDist * Math.sin(meshAngle);  // ~56.4

    // Phase offsets for proper meshing at t=0:
    // Large gear: GAP faces the small gear at meshAngle
    // Small gear: TOOTH faces the large gear at meshAngle+π
    const lgSector = (2 * Math.PI) / lgTeeth;
    const smSector = (2 * Math.PI) / smTeeth;

    // Large gear — align nearest gap center with meshAngle
    const lgGap0 = -Math.PI / 2 + lgSector / 2;
    const lgGapIdx = Math.round((meshAngle - lgGap0) / lgSector);
    const lgPhase = meshAngle - (lgGap0 + lgGapIdx * lgSector);

    // Small gear — align nearest TOOTH center with opposite mesh angle
    const smMesh = meshAngle + Math.PI;
    const smTooth0 = -Math.PI / 2;  // first tooth center (not gap!)
    const smToothIdx = Math.round((smMesh - smTooth0) / smSector);
    const smPhase = smMesh - (smTooth0 + smToothIdx * smSector);

    // Rotation durations (gear ratio = teeth ratio)
    const lgDur = 20;
    const smDur = lgDur * smTeeth / lgTeeth;  // 16.667

    return {
        lg: { cx: lgCx, cy: lgCy, outerR: lgOuterR, rootR: lgRootR,
              ringR: 16, holeR: 11, teeth: lgTeeth, phase: lgPhase },
        sm: { cx: smCx, cy: smCy, outerR: smOuterR, rootR: smRootR,
              ringR: 12, holeR: 8,  teeth: smTeeth, phase: smPhase },
        lgDur: lgDur, smDur: smDur
    };
})();

function buildGearPaths(g) {
    const sector = (2 * Math.PI) / g.teeth;
    // Tooth profile fractions (of sector) — sized for proper meshing
    const rootHalf = 0.26;  // half-width at root
    const tipHalf  = 0.16;  // half-width at tip

    // Full gear outline (teeth + body) with center hole
    const pts = [];
    for (let i = 0; i < g.teeth; i++) {
        const c = i * sector - Math.PI / 2 + g.phase;
        const a1 = c - rootHalf * sector;
        const a2 = c - tipHalf  * sector;
        const a3 = c + tipHalf  * sector;
        const a4 = c + rootHalf * sector;
        pts.push([g.rootR * Math.cos(a1), g.rootR * Math.sin(a1)]);
        pts.push([g.outerR * Math.cos(a2), g.outerR * Math.sin(a2)]);
        pts.push([g.outerR * Math.cos(a3), g.outerR * Math.sin(a3)]);
        pts.push([g.rootR * Math.cos(a4), g.rootR * Math.sin(a4)]);
    }
    let full = 'M' + pts[0][0].toFixed(2) + ',' + pts[0][1].toFixed(2);
    for (let i = 1; i < pts.length; i++)
        full += ' L' + pts[i][0].toFixed(2) + ',' + pts[i][1].toFixed(2);
    full += ' Z';
    // Center hole (counter-clockwise for evenodd cutout)
    full += ' M' + g.holeR.toFixed(2) + ',0';
    full += ' A' + g.holeR + ',' + g.holeR + ' 0 0 0 ' + (-g.holeR).toFixed(2) + ',0';
    full += ' A' + g.holeR + ',' + g.holeR + ' 0 0 0 ' + g.holeR.toFixed(2) + ',0 Z';

    // Teeth-only path (individual tooth quads, no body/hole)
    let teeth = '';
    for (let i = 0; i < g.teeth; i++) {
        const c = i * sector - Math.PI / 2 + g.phase;
        const a1 = c - rootHalf * sector;
        const a2 = c - tipHalf  * sector;
        const a3 = c + tipHalf  * sector;
        const a4 = c + rootHalf * sector;
        teeth += 'M' + (g.rootR * Math.cos(a1)).toFixed(2) + ',' + (g.rootR * Math.sin(a1)).toFixed(2);
        teeth += ' L' + (g.outerR * Math.cos(a2)).toFixed(2) + ',' + (g.outerR * Math.sin(a2)).toFixed(2);
        teeth += ' L' + (g.outerR * Math.cos(a3)).toFixed(2) + ',' + (g.outerR * Math.sin(a3)).toFixed(2);
        teeth += ' L' + (g.rootR * Math.cos(a4)).toFixed(2) + ',' + (g.rootR * Math.sin(a4)).toFixed(2);
        teeth += ' Z ';
    }

    return { full: full, teeth: teeth.trim() };
}

function createInterlockingGearsSVG(uid) {
    const cfg = GEAR_CONFIG;
    const lg = cfg.lg, sm = cfg.sm;
    const lgPaths = buildGearPaths(lg);
    const smPaths = buildGearPaths(sm);
    const clipId = 'gc' + uid;

    // Viewbox to contain both gears with padding
    const vw = Math.ceil(sm.cx + sm.outerR + 3);
    const vh = Math.ceil(sm.cy + sm.outerR + 3);

    // All paths are relative to gear center (drawn at origin, translated by group)
    return '<svg class="panel-icon-svg" viewBox="0 0 ' + vw + ' ' + vh + '" xmlns="http://www.w3.org/2000/svg">'
        + '<defs><clipPath id="' + clipId + '">'
        + '<circle cx="' + sm.cx.toFixed(2) + '" cy="' + sm.cy.toFixed(2) + '" r="' + (sm.outerR + 1) + '"/>'
        + '</clipPath></defs>'
        // Layer 1: Full large gear
        + '<g class="gear-lg-rotate" data-cx="' + lg.cx + '" data-cy="' + lg.cy + '">'
        + '<path d="' + lgPaths.full + '" fill="#6B7B8D" fill-rule="evenodd" transform="translate(' + lg.cx + ',' + lg.cy + ')"/>'
        + '<circle cx="' + lg.cx + '" cy="' + lg.cy + '" r="' + lg.ringR + '" fill="none" stroke="#A8C5B8" stroke-width="2.5"/>'
        + '</g>'
        // Layer 2: Full small gear
        + '<g class="gear-sm-rotate" data-cx="' + sm.cx.toFixed(2) + '" data-cy="' + sm.cy.toFixed(2) + '">'
        + '<path d="' + smPaths.full + '" fill="#6B7B8D" fill-rule="evenodd" transform="translate(' + sm.cx.toFixed(2) + ',' + sm.cy.toFixed(2) + ')"/>'
        + '<circle cx="' + sm.cx.toFixed(2) + '" cy="' + sm.cy.toFixed(2) + '" r="' + sm.ringR + '" fill="none" stroke="#A8C5B8" stroke-width="2"/>'
        + '</g>'
        // Layer 3: Large gear teeth only, clipped to small gear zone
        + '<g clip-path="url(#' + clipId + ')">'
        + '<g class="gear-lg-rotate" data-cx="' + lg.cx + '" data-cy="' + lg.cy + '">'
        + '<path d="' + lgPaths.teeth + '" fill="#6B7B8D" transform="translate(' + lg.cx + ',' + lg.cy + ')"/>'
        + '</g></g>'
        + '</svg>';
}

// Gear animation state — updated from the main animateThreeJS loop (no separate rAF)
let _gearAnimRunning = false;
let _cachedGearLg = null;
let _cachedGearSm = null;

let _gearFrameSkip = 0;

function updatePanelGears() {
    // Skip when panel is expanded — gears are hidden
    if (_bgSystemsPaused) return;
    
    // Throttle to every 3rd frame (gears rotate slowly, 20fps is sufficient)
    _gearFrameSkip++;
    if (_gearFrameSkip % 3 !== 0) return;

    const t = performance.now() / 1000;
    const cfg = GEAR_CONFIG;
    const lgAngle = (t / cfg.lgDur) * 360;
    const smAngle = -(t / cfg.smDur) * 360;

    if (!_cachedGearLg) _cachedGearLg = document.querySelectorAll('.gear-lg-rotate');
    if (!_cachedGearSm) _cachedGearSm = document.querySelectorAll('.gear-sm-rotate');

    const lgRotation = lgAngle | 0;
    const smRotation = smAngle | 0;
    for (let i = 0; i < _cachedGearLg.length; i++) {
        const el = _cachedGearLg[i];
        el._rotationTransform.setRotate(lgRotation, el._gearCx, el._gearCy);
    }
    for (let i = 0; i < _cachedGearSm.length; i++) {
        const el = _cachedGearSm[i];
        el._rotationTransform.setRotate(smRotation, el._gearCx, el._gearCy);
    }
}

function initPanelGearIcons() {
    document.querySelectorAll('.panel-icon').forEach(function(el, idx) {
        el.innerHTML = createInterlockingGearsSVG(idx);
    });

    _cachedGearLg = document.querySelectorAll('.gear-lg-rotate');
    _cachedGearSm = document.querySelectorAll('.gear-sm-rotate');
    [_cachedGearLg, _cachedGearSm].forEach(function(elements) {
        elements.forEach(function(el) {
            el._gearCx = Number(el.dataset.cx);
            el._gearCy = Number(el.dataset.cy);
            el._rotationTransform = el.ownerSVGElement.createSVGTransform();
            el.transform.baseVal.initialize(el._rotationTransform);
        });
    });
    _gearAnimRunning = true;
}

// ============================================
// INITIALIZATION
// ============================================

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        ThemeManager.init();
        initPanelGearIcons();
        radialPanelPhysics = new RadialPanelPhysics();
        startVisualRuntime();

        setTimeout(() => {
            document.querySelectorAll('.js-positioned:not(.ready)').forEach(el => el.classList.add('ready'));
        }, 2000);
    });
} else {
    ThemeManager.init();
    initPanelGearIcons();
    radialPanelPhysics = new RadialPanelPhysics();
    startVisualRuntime();
}

// Dispose Three.js resources on page unload to free GPU memory
window.addEventListener('beforeunload', function() {
    if (renderer) {
        renderer.dispose();
        renderer.forceContextLoss();
    }
    if (scene) {
        scene.traverse(function(obj) {
            if (obj.geometry) obj.geometry.dispose();
            if (obj.material) {
                if (Array.isArray(obj.material)) {
                    obj.material.forEach(function(mat) { mat.dispose(); });
                } else {
                    obj.material.dispose();
                }
            }
        });
    }
});
