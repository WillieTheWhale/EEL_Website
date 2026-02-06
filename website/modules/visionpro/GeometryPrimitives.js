/**
 * Geometry Primitives for Vision Pro
 * CLEAN ski-goggle surface with consistent math across all pieces
 *
 * Base formula: Cylindrical horizontal wrap + vertical dome curvature
 * All housing pieces use the SAME parametric surface, just offset
 */

window.GeometryPrimitives = {
    /**
     * Creates a ski-goggle shaped surface (the core Vision Pro shape)
     * Uses pure cylindrical wrap horizontally + dome factor vertically
     *
     * @param {Object} params Configuration parameters
     * @returns {THREE.BufferGeometry}
     */
    createSkiGoggleSurface: function(params) {
        const {
            width,
            height,
            wrapRadius,      // Radius of horizontal cylindrical wrap
            wrapAngle,       // Total angle of wrap (e.g., Math.PI * 0.5 = 90 degrees)
            domeDepth,       // How far the dome bulges forward at center
            cornerRadius,    // Rounded rectangle silhouette corners
            zOffset = 0,     // Z position offset (for layering pieces)
            scaleX = 1,      // X scale factor
            scaleY = 1,      // Y scale factor
            flipNormals = false,
            segmentsU = 200,
            segmentsV = 100
        } = params;

        const geometry = new THREE.BufferGeometry();
        const vertices = [];
        const normals = [];
        const uvs = [];
        const indices = [];

        const halfW = width / 2;
        const halfH = height / 2;

        for (let j = 0; j <= segmentsV; j++) {
            const vRatio = j / segmentsV;
            const v = (vRatio - 0.5) * 2; // -1 to 1

            for (let i = 0; i <= segmentsU; i++) {
                const uRatio = i / segmentsU;
                const u = (uRatio - 0.5) * 2; // -1 to 1

                // Calculate flat position for SDF masking
                const flatX = u * halfW;
                const flatY = v * halfH;

                // SDF for rounded rectangle silhouette
                const sdf = this._roundedRectSDF(flatX, flatY, halfW, halfH, cornerRadius);

                // Smooth mask: 1 inside, 0 outside, smooth transition at edge
                const edgeBlend = 0.015;
                const mask = 1 - this._smoothstep(0, edgeBlend, sdf);

                // Skip vertices completely outside the silhouette (optimization)
                // But keep a small border for clean edges
                if (sdf > edgeBlend * 3) {
                    // Push degenerate vertex to maintain grid structure
                    vertices.push(0, 0, -10);
                    normals.push(0, 0, 1);
                    uvs.push(uRatio, vRatio);
                    continue;
                }

                // === THE CORE SKI-GOGGLE FORMULA ===

                // 1. Horizontal cylindrical wrap
                const theta = u * wrapAngle;
                const cylX = Math.sin(theta) * wrapRadius * scaleX;
                const cylZ = Math.cos(theta) * wrapRadius - wrapRadius;

                // 2. Vertical position (simple linear mapping)
                const posY = flatY * scaleY;

                // 3. Dome bulge: maximum at center, zero at edges
                // Uses smooth falloff from center
                const centerDistSq = u * u + v * v;
                const domeFactor = Math.max(0, 1 - centerDistSq);
                const domeZ = domeFactor * domeDepth;

                // 4. Edge rounding: smooth the transition at silhouette edges
                const edgeDepthReduction = (1 - mask) * 0.02;

                // Final position
                const x = cylX;
                const y = posY;
                const z = cylZ + domeZ - edgeDepthReduction + zOffset;

                vertices.push(x, y, z);

                // === ANALYTICAL NORMALS ===
                // Normal from cylindrical surface + dome contribution

                // Cylindrical normal component
                let nx = Math.sin(theta);
                let ny = 0;
                let nz = Math.cos(theta);

                // Dome normal contribution (gradient of dome function)
                // d/dx of (1 - x² - y²) = -2x, d/dy = -2y
                const domeNx = -u * 2 * domeDepth * 0.5;
                const domeNy = -v * 2 * domeDepth * 0.5;
                const domeNz = 1;

                // Blend based on dome influence
                const domeInfluence = domeFactor * 0.4;
                nx = nx * (1 - domeInfluence) + domeNx * domeInfluence;
                ny = ny * (1 - domeInfluence) + domeNy * domeInfluence;
                nz = nz * (1 - domeInfluence) + domeNz * domeInfluence;

                // Normalize
                const len = Math.sqrt(nx * nx + ny * ny + nz * nz);
                if (len > 0.0001) {
                    nx /= len;
                    ny /= len;
                    nz /= len;
                } else {
                    nx = 0;
                    ny = 0;
                    nz = 1;
                }

                if (flipNormals) {
                    nx = -nx;
                    ny = -ny;
                    nz = -nz;
                }

                normals.push(nx, ny, nz);
                uvs.push(uRatio, vRatio);
            }
        }

        // Generate indices (skip degenerate triangles)
        for (let j = 0; j < segmentsV; j++) {
            for (let i = 0; i < segmentsU; i++) {
                const a = j * (segmentsU + 1) + i;
                const b = a + 1;
                const c = a + (segmentsU + 1);
                const d = c + 1;

                // Get vertex positions to check for degenerate triangles
                const az = vertices[a * 3 + 2];
                const bz = vertices[b * 3 + 2];
                const cz = vertices[c * 3 + 2];
                const dz = vertices[d * 3 + 2];

                // Skip triangles with degenerate vertices
                if (az < -5 || bz < -5 || cz < -5) continue;
                indices.push(a, b, c);

                if (bz < -5 || dz < -5 || cz < -5) continue;
                indices.push(b, d, c);
            }
        }

        geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
        geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
        geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
        geometry.setIndex(indices);

        return geometry;
    },

    /**
     * Creates a connecting strip between two surfaces
     * Used for housing sides (top/bottom/left/right walls)
     *
     * @param {Object} params Configuration parameters
     * @returns {THREE.BufferGeometry}
     */
    createConnectingStrip: function(params) {
        const {
            width,
            height,
            wrapRadius,
            wrapAngle,
            domeDepth,
            cornerRadius,
            frontZ,          // Z offset of front surface
            backZ,           // Z offset of back surface
            frontScale = 1,  // Scale of front surface
            backScale = 1,   // Scale of back surface
            edge,            // 'top', 'bottom', 'left', 'right'
            segments = 60,
            depthSegments = 4
        } = params;

        const geometry = new THREE.BufferGeometry();
        const vertices = [];
        const normals = [];
        const uvs = [];
        const indices = [];

        const halfW = width / 2;
        const halfH = height / 2;

        for (let d = 0; d <= depthSegments; d++) {
            const dRatio = d / depthSegments;
            const scale = frontScale + (backScale - frontScale) * dRatio;
            const zOff = frontZ + (backZ - frontZ) * dRatio;

            for (let i = 0; i <= segments; i++) {
                const tRatio = i / segments;
                let u, v;

                // Parametrize along the specified edge
                if (edge === 'top') {
                    u = (tRatio - 0.5) * 2;  // -1 to 1
                    v = 1;
                } else if (edge === 'bottom') {
                    u = (tRatio - 0.5) * 2;
                    v = -1;
                } else if (edge === 'right') {
                    u = 1;
                    v = (tRatio - 0.5) * 2;
                } else { // left
                    u = -1;
                    v = (tRatio - 0.5) * 2;
                }

                // Calculate surface position using same formula as main surface
                const theta = u * wrapAngle;
                const cylX = Math.sin(theta) * wrapRadius * scale;
                const cylZ = Math.cos(theta) * wrapRadius - wrapRadius;
                const posY = v * halfH * scale;

                const centerDistSq = u * u + v * v;
                const domeFactor = Math.max(0, 1 - centerDistSq);
                const domeZ = domeFactor * domeDepth * scale;

                const x = cylX;
                const y = posY;
                const z = cylZ + domeZ + zOff;

                vertices.push(x, y, z);

                // Normal points outward from the edge
                let nx, ny, nz;
                if (edge === 'top') {
                    nx = 0;
                    ny = 1;
                    nz = 0;
                } else if (edge === 'bottom') {
                    nx = 0;
                    ny = -1;
                    nz = 0;
                } else if (edge === 'right') {
                    nx = Math.sin(theta);
                    ny = 0;
                    nz = Math.cos(theta);
                } else {
                    nx = Math.sin(theta);
                    ny = 0;
                    nz = Math.cos(theta);
                }

                normals.push(nx, ny, nz);
                uvs.push(tRatio, dRatio);
            }
        }

        // Generate indices
        for (let d = 0; d < depthSegments; d++) {
            for (let i = 0; i < segments; i++) {
                const a = d * (segments + 1) + i;
                const b = a + 1;
                const c = a + (segments + 1);
                const dd = c + 1;

                // Winding order depends on edge to face outward
                if (edge === 'top' || edge === 'right') {
                    indices.push(a, c, b);
                    indices.push(b, c, dd);
                } else {
                    indices.push(a, b, c);
                    indices.push(b, dd, c);
                }
            }
        }

        geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
        geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
        geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
        geometry.setIndex(indices);
        geometry.computeVertexNormals();

        return geometry;
    },

    /**
     * Creates a bezel ring that follows the silhouette edge
     * Uses the same surface math but traced along the rounded rect perimeter
     *
     * @param {Object} params Configuration parameters
     * @returns {THREE.BufferGeometry}
     */
    createBezelRing: function(params) {
        const {
            width,
            height,
            wrapRadius,
            wrapAngle,
            domeDepth,
            cornerRadius,
            tubeRadius,
            zOffset = 0,
            numPoints = 300
        } = params;

        const halfW = width / 2;
        const halfH = height / 2;
        const cr = cornerRadius;

        // Generate points along rounded rectangle perimeter
        const points = [];

        for (let i = 0; i <= numPoints; i++) {
            const t = i / numPoints;
            const { x: flatX, y: flatY } = this._roundedRectPoint(t, halfW, halfH, cr);

            // Convert to normalized coordinates
            const u = flatX / halfW;  // -1 to 1
            const v = flatY / halfH;  // -1 to 1

            // Apply ski-goggle surface formula
            const theta = u * wrapAngle;
            const cylX = Math.sin(theta) * wrapRadius;
            const cylZ = Math.cos(theta) * wrapRadius - wrapRadius;

            const centerDistSq = u * u + v * v;
            const domeFactor = Math.max(0, 1 - centerDistSq);
            const domeZ = domeFactor * domeDepth;

            const x = cylX;
            const y = flatY;
            const z = cylZ + domeZ + zOffset;

            points.push(new THREE.Vector3(x, y, z));
        }

        const curve = new THREE.CatmullRomCurve3(points, true);
        return new THREE.TubeGeometry(curve, numPoints, tubeRadius, 8, true);
    },

    /**
     * Creates an elliptical tube (for Light Seal cushion)
     */
    createEllipticalTube: function(params) {
        const {
            width,
            height,
            tubeRadius,
            zOffset,
            numPoints = 180
        } = params;

        const points = [];

        for (let i = 0; i <= numPoints; i++) {
            const t = (i / numPoints) * Math.PI * 2;
            const x = Math.cos(t) * width / 2;
            const y = Math.sin(t) * height / 2;
            points.push(new THREE.Vector3(x, y, zOffset));
        }

        const curve = new THREE.CatmullRomCurve3(points, true);
        return new THREE.TubeGeometry(curve, numPoints, tubeRadius, 12, true);
    },

    /**
     * Creates a parametric arc curve (for headband)
     */
    createArcCurve: function(params) {
        const {
            width,
            height,
            depth,
            startZ,
            numPoints = 60
        } = params;

        const points = [];

        for (let i = 0; i <= numPoints; i++) {
            const t = i / numPoints;
            const x = (t - 0.5) * width;
            const heightFactor = 1 - Math.pow(2 * t - 1, 2);
            const y = heightFactor * height;
            const z = startZ - heightFactor * depth;
            points.push(new THREE.Vector3(x, y, z));
        }

        return new THREE.CatmullRomCurve3(points);
    },

    /**
     * Smoothstep interpolation
     */
    _smoothstep: function(edge0, edge1, x) {
        const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
        return t * t * (3 - 2 * t);
    },

    /**
     * Signed distance function for rounded rectangle
     */
    _roundedRectSDF: function(x, y, halfW, halfH, r) {
        const qx = Math.abs(x) - halfW + r;
        const qy = Math.abs(y) - halfH + r;
        const outsideDist = Math.sqrt(Math.max(qx, 0) ** 2 + Math.max(qy, 0) ** 2);
        const insideDist = Math.min(Math.max(qx, qy), 0);
        return outsideDist + insideDist - r;
    },

    /**
     * Get point on rounded rectangle perimeter
     * @param {number} t Parameter 0-1 around perimeter
     * @returns {{x: number, y: number}}
     */
    _roundedRectPoint: function(t, halfW, halfH, r) {
        // Straight edge lengths
        const straightW = halfW - r;
        const straightH = halfH - r;

        // Perimeter segments: bottom, right corner, right, top-right corner, top, top-left corner, left, bottom-left corner
        const segLengths = [
            straightW * 2,           // bottom
            Math.PI * r / 2,         // bottom-right corner
            straightH * 2,           // right
            Math.PI * r / 2,         // top-right corner
            straightW * 2,           // top
            Math.PI * r / 2,         // top-left corner
            straightH * 2,           // left
            Math.PI * r / 2          // bottom-left corner
        ];

        const totalPerim = segLengths.reduce((a, b) => a + b, 0);
        let dist = t * totalPerim;

        let x, y;

        // Bottom edge
        if (dist < segLengths[0]) {
            x = -straightW + dist;
            y = -halfH;
        }
        // Bottom-right corner
        else if (dist < segLengths[0] + segLengths[1]) {
            const a = (dist - segLengths[0]) / r;
            x = straightW + Math.sin(a) * r;
            y = -straightH - Math.cos(a) * r + r;
        }
        // Right edge
        else if (dist < segLengths[0] + segLengths[1] + segLengths[2]) {
            const d = dist - segLengths[0] - segLengths[1];
            x = halfW;
            y = -straightH + d;
        }
        // Top-right corner
        else if (dist < segLengths[0] + segLengths[1] + segLengths[2] + segLengths[3]) {
            const a = (dist - segLengths[0] - segLengths[1] - segLengths[2]) / r;
            x = straightW + Math.cos(a) * r;
            y = straightH + Math.sin(a) * r;
        }
        // Top edge
        else if (dist < segLengths[0] + segLengths[1] + segLengths[2] + segLengths[3] + segLengths[4]) {
            const d = dist - segLengths[0] - segLengths[1] - segLengths[2] - segLengths[3];
            x = straightW - d;
            y = halfH;
        }
        // Top-left corner
        else if (dist < segLengths[0] + segLengths[1] + segLengths[2] + segLengths[3] + segLengths[4] + segLengths[5]) {
            const a = (dist - segLengths[0] - segLengths[1] - segLengths[2] - segLengths[3] - segLengths[4]) / r;
            x = -straightW - Math.sin(a) * r;
            y = straightH + Math.cos(a) * r;
        }
        // Left edge
        else if (dist < segLengths[0] + segLengths[1] + segLengths[2] + segLengths[3] + segLengths[4] + segLengths[5] + segLengths[6]) {
            const d = dist - segLengths[0] - segLengths[1] - segLengths[2] - segLengths[3] - segLengths[4] - segLengths[5];
            x = -halfW;
            y = straightH - d;
        }
        // Bottom-left corner
        else {
            const a = (dist - segLengths[0] - segLengths[1] - segLengths[2] - segLengths[3] - segLengths[4] - segLengths[5] - segLengths[6]) / r;
            x = -straightW - Math.cos(a) * r;
            y = -straightH - Math.sin(a) * r;
        }

        return { x, y };
    }
};
