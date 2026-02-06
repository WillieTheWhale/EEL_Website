/**
 * Vision Pro Geometry Builders
 * All components use the SAME ski-goggle surface formula for proper connection
 */

window.VisionProGeometry = class VisionProGeometry {
    constructor(config) {
        this.config = config;
        this.d = config.dimensions;
    }

    /**
     * Common surface parameters used by all housing pieces
     * This ensures everything connects properly
     */
    _getSurfaceParams() {
        const h = this.d.housing;
        const v = this.d.visor;
        return {
            width: h.width,
            height: h.height,
            wrapRadius: v.wrapRadius,
            wrapAngle: v.wrapAngle,
            domeDepth: v.domeDepth,
            cornerRadius: v.cornerRadius
        };
    }

    /**
     * Creates the glass visor with ski-goggle shape
     * @returns {THREE.BufferGeometry}
     */
    createGlassVisor() {
        const params = this._getSurfaceParams();
        const v = this.d.visor;

        return GeometryPrimitives.createSkiGoggleSurface({
            ...params,
            zOffset: v.glassOffset,
            segmentsU: v.segmentsU,
            segmentsV: v.segmentsV
        });
    }

    /**
     * Creates the aluminum housing as a unified shell
     * All pieces use the same surface formula with offsets
     * @returns {THREE.Group}
     */
    createAluminumHousing() {
        const group = new THREE.Group();
        const h = this.d.housing;
        const v = this.d.visor;
        const f = this.d.frame;
        const params = this._getSurfaceParams();

        // 1. Front bezel ring (thin tube around glass edge)
        const bezelGeom = GeometryPrimitives.createBezelRing({
            ...params,
            tubeRadius: f.thickness,
            zOffset: v.glassOffset + f.thickness * 0.5,
            numPoints: 280
        });
        const bezelMesh = new THREE.Mesh(bezelGeom, null);
        bezelMesh.userData.material = 'aluminum';
        group.add(bezelMesh);

        // 2. Back shell (same surface, offset backward)
        const backShellGeom = GeometryPrimitives.createSkiGoggleSurface({
            ...params,
            zOffset: -h.depth,
            scaleX: 0.96,
            scaleY: 0.96,
            flipNormals: true,  // Normals face inward (back of shell faces camera)
            segmentsU: 100,
            segmentsV: 50
        });
        const backShellMesh = new THREE.Mesh(backShellGeom, null);
        backShellMesh.userData.material = 'aluminum';
        group.add(backShellMesh);

        // 3. Connecting surfaces (top, bottom, left, right walls)
        const wallParams = {
            ...params,
            frontZ: 0,
            backZ: -h.depth,
            frontScale: 1,
            backScale: 0.96,
            segments: 80,
            depthSegments: 6
        };

        // Top wall
        const topWallGeom = GeometryPrimitives.createConnectingStrip({
            ...wallParams,
            edge: 'top'
        });
        const topWallMesh = new THREE.Mesh(topWallGeom, null);
        topWallMesh.userData.material = 'aluminum';
        group.add(topWallMesh);

        // Bottom wall
        const bottomWallGeom = GeometryPrimitives.createConnectingStrip({
            ...wallParams,
            edge: 'bottom'
        });
        const bottomWallMesh = new THREE.Mesh(bottomWallGeom, null);
        bottomWallMesh.userData.material = 'aluminum';
        group.add(bottomWallMesh);

        // Side walls are handled by the cylindrical wrap naturally
        // The back shell + top/bottom walls close the enclosure

        return group;
    }

    /**
     * Creates the Light Seal cushion
     * @returns {THREE.Group}
     */
    createLightSeal() {
        const group = new THREE.Group();
        const ls = this.d.lightSeal;
        const h = this.d.housing;

        const sealWidth = h.width * ls.widthScale;
        const sealHeight = h.height * ls.heightScale;

        // Cushion ring (tube following ellipse)
        const cushionGeom = GeometryPrimitives.createEllipticalTube({
            width: sealWidth,
            height: sealHeight,
            tubeRadius: ls.cushionRadius,
            zOffset: -ls.depth,
            numPoints: 140
        });
        const cushionMesh = new THREE.Mesh(cushionGeom, null);
        cushionMesh.userData.material = 'cushion';
        group.add(cushionMesh);

        // Inner fabric surface
        const fabricGeom = this._createFabricSurface(sealWidth, sealHeight, ls.depth, ls.cushionRadius);
        const fabricMesh = new THREE.Mesh(fabricGeom, null);
        fabricMesh.userData.material = 'fabric';
        group.add(fabricMesh);

        return group;
    }

    /**
     * Creates inner fabric surface for Light Seal
     * @private
     */
    _createFabricSurface(width, height, depth, cushionRadius) {
        const geometry = new THREE.BufferGeometry();
        const vertices = [];
        const normals = [];
        const uvs = [];
        const indices = [];

        const segs = 40;

        for (let j = 0; j <= segs; j++) {
            const v = j / segs;
            const vAngle = (v - 0.5) * Math.PI;
            const y = Math.sin(vAngle) * height / 2 * 0.85;
            const yFactor = Math.cos(vAngle);

            for (let i = 0; i <= segs; i++) {
                const u = i / segs;
                const uAngle = (u - 0.5) * Math.PI * 1.6;
                const x = Math.sin(uAngle) * width / 2 * yFactor * 0.85;
                const z = -depth + cushionRadius * 0.3;

                vertices.push(x, y, z);
                normals.push(0, 0, -1);
                uvs.push(u, v);
            }
        }

        for (let j = 0; j < segs; j++) {
            for (let i = 0; i < segs; i++) {
                const a = j * (segs + 1) + i;
                const b = a + 1;
                const c = a + (segs + 1);
                const dd = c + 1;
                indices.push(a, c, b);
                indices.push(b, c, dd);
            }
        }

        geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
        geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
        geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
        geometry.setIndex(indices);
        geometry.computeVertexNormals();

        return geometry;
    }

    /**
     * Helper to get position on the ski-goggle surface
     * Used for placing controls in the correct position
     */
    _getSurfacePosition(u, v, zOffset = 0) {
        const params = this._getSurfaceParams();
        const theta = u * params.wrapAngle;

        const x = Math.sin(theta) * params.wrapRadius;
        const y = v * params.height / 2;
        const cylZ = Math.cos(theta) * params.wrapRadius - params.wrapRadius;

        const centerDistSq = u * u + (v * v);
        const domeFactor = Math.max(0, 1 - centerDistSq);
        const domeZ = domeFactor * params.domeDepth;

        return {
            x: x,
            y: y,
            z: cylZ + domeZ + zOffset
        };
    }

    /**
     * Creates the Digital Crown control
     * @returns {THREE.Group}
     */
    createDigitalCrown() {
        const group = new THREE.Group();
        const c = this.d.crown;
        const h = this.d.housing;

        // Main body (cylinder)
        const bodyGeom = new THREE.CylinderGeometry(c.radius, c.radius, c.depth, 24);
        const body = new THREE.Mesh(bodyGeom, null);
        body.rotation.z = Math.PI / 2;
        body.userData.material = 'aluminum';
        group.add(body);

        // Textured ring (torus)
        const ringGeom = new THREE.TorusGeometry(c.radius * 0.75, 0.003, 8, 28);
        const ring = new THREE.Mesh(ringGeom, null);
        ring.rotation.y = Math.PI / 2;
        ring.position.x = c.depth * 0.35;
        ring.userData.material = 'darkAluminum';
        group.add(ring);

        // Top cap
        const capGeom = new THREE.CircleGeometry(c.radius * 0.65, 20);
        const cap = new THREE.Mesh(capGeom, null);
        cap.rotation.y = Math.PI / 2;
        cap.position.x = c.depth / 2 + 0.001;
        cap.userData.material = 'aluminum';
        group.add(cap);

        // Position on top-right of housing using surface formula
        const surfacePos = this._getSurfacePosition(0.78, c.positionY * 2 - 0.5, c.positionZ);
        group.position.set(surfacePos.x + 0.01, h.height * c.positionY, surfacePos.z);
        group.rotation.y = -0.15;
        group.rotation.z = -0.10;

        return group;
    }

    /**
     * Creates the camera/shutter button
     * @returns {THREE.Group}
     */
    createCameraButton() {
        const group = new THREE.Group();
        const b = this.d.button;
        const h = this.d.housing;

        // Pill shape: cylinder + sphere caps
        const bodyGeom = new THREE.CylinderGeometry(b.radius, b.radius, b.length - b.radius * 2, 12);
        const body = new THREE.Mesh(bodyGeom, null);
        body.rotation.z = Math.PI / 2;
        body.userData.material = 'aluminum';
        group.add(body);

        const endGeom = new THREE.SphereGeometry(b.radius, 8, 6);

        const leftEnd = new THREE.Mesh(endGeom, null);
        leftEnd.position.x = -(b.length / 2 - b.radius);
        leftEnd.userData.material = 'aluminum';
        group.add(leftEnd);

        const rightEnd = new THREE.Mesh(endGeom, null);
        rightEnd.position.x = (b.length / 2 - b.radius);
        rightEnd.userData.material = 'aluminum';
        group.add(rightEnd);

        // Position on top-left of housing using surface formula
        const surfacePos = this._getSurfacePosition(-0.78, b.positionY * 2 - 0.5, b.positionZ);
        group.position.set(surfacePos.x - 0.006, h.height * b.positionY, surfacePos.z);
        group.rotation.y = 0.15;
        group.rotation.z = 0.10;

        return group;
    }

    /**
     * Creates the audio strap pods
     * @returns {THREE.Group}
     */
    createAudioStraps() {
        const group = new THREE.Group();
        const ap = this.d.audioPods;
        const h = this.d.housing;

        ['left', 'right'].forEach(side => {
            const sideGroup = new THREE.Group();
            const sign = side === 'right' ? 1 : -1;

            // Create rounded rectangle pod
            const shape = new THREE.Shape();
            const r = ap.cornerRadius;
            shape.moveTo(-ap.width / 2 + r, -ap.height / 2);
            shape.lineTo(ap.width / 2 - r, -ap.height / 2);
            shape.quadraticCurveTo(ap.width / 2, -ap.height / 2, ap.width / 2, -ap.height / 2 + r);
            shape.lineTo(ap.width / 2, ap.height / 2 - r);
            shape.quadraticCurveTo(ap.width / 2, ap.height / 2, ap.width / 2 - r, ap.height / 2);
            shape.lineTo(-ap.width / 2 + r, ap.height / 2);
            shape.quadraticCurveTo(-ap.width / 2, ap.height / 2, -ap.width / 2, ap.height / 2 - r);
            shape.lineTo(-ap.width / 2, -ap.height / 2 + r);
            shape.quadraticCurveTo(-ap.width / 2, -ap.height / 2, -ap.width / 2 + r, -ap.height / 2);

            const podGeom = new THREE.ExtrudeGeometry(shape, {
                depth: ap.depth,
                bevelEnabled: true,
                bevelThickness: 0.002,
                bevelSize: 0.002,
                bevelSegments: 2
            });
            const pod = new THREE.Mesh(podGeom, null);
            pod.rotation.x = Math.PI / 2;
            pod.rotation.z = sign * 0.04;
            pod.userData.material = 'aluminum';
            sideGroup.add(pod);

            // Speaker grille (small dots)
            for (let row = 0; row < 2; row++) {
                for (let col = 0; col < 4; col++) {
                    const dot = new THREE.Mesh(
                        new THREE.CircleGeometry(0.001, 5),
                        null
                    );
                    dot.position.set(
                        (col - 1.5) * 0.0045,
                        (row - 0.5) * 0.005,
                        ap.depth + 0.003
                    );
                    dot.rotation.z = -sign * 0.04;
                    dot.userData.material = 'darkAluminum';
                    sideGroup.add(dot);
                }
            }

            // Connector to housing
            const connGeom = new THREE.BoxGeometry(ap.connectorWidth, ap.connectorHeight, ap.connectorDepth);
            const conn = new THREE.Mesh(connGeom, null);
            conn.position.set(-sign * 0.028, 0, -0.008);
            conn.userData.material = 'aluminum';
            sideGroup.add(conn);

            // Position using surface formula
            const surfacePos = this._getSurfacePosition(sign * 0.95, 0, -h.depth * 0.5);
            sideGroup.position.set(
                surfacePos.x + sign * ap.offsetX,
                0,
                surfacePos.z - 0.02
            );
            sideGroup.rotation.y = -sign * 0.08;

            group.add(sideGroup);
        });

        return group;
    }

    /**
     * Creates the full headband system
     * @returns {THREE.Group}
     */
    createHeadband() {
        const group = new THREE.Group();
        const hb = this.d.headband;
        const h = this.d.housing;

        // Starting Z position (back of housing)
        const startZ = -h.depth - 0.015;

        // Main strap curve
        const strapCurve = GeometryPrimitives.createArcCurve({
            width: hb.strapWidth,
            height: hb.strapHeight,
            depth: hb.strapDepth,
            startZ: startZ,
            numPoints: 50
        });

        // Create tube along curve
        const strapGeom = new THREE.TubeGeometry(strapCurve, 70, hb.strapRadius, 12, false);
        const strap = new THREE.Mesh(strapGeom, null);
        strap.userData.material = 'fabric';
        group.add(strap);

        // Back dial/adjustment mechanism
        const dialGroup = new THREE.Group();

        const dialHousingGeom = new THREE.CylinderGeometry(hb.dialRadius, hb.dialRadius, hb.dialDepth, 22);
        const dialHousing = new THREE.Mesh(dialHousingGeom, null);
        dialHousing.rotation.x = Math.PI / 2;
        dialHousing.userData.material = 'aluminum';
        dialGroup.add(dialHousing);

        const dialKnobGeom = new THREE.CylinderGeometry(hb.dialRadius * 0.85, hb.dialRadius * 0.85, 0.008, 22);
        const dialKnob = new THREE.Mesh(dialKnobGeom, null);
        dialKnob.rotation.x = Math.PI / 2;
        dialKnob.position.z = hb.dialDepth / 2 + 0.002;
        dialKnob.userData.material = 'darkAluminum';
        dialGroup.add(dialKnob);

        // Position dial at back center of strap arc
        dialGroup.position.set(0, hb.strapHeight * 0.92, startZ - hb.strapDepth * 0.88);
        group.add(dialGroup);

        // Mount connectors on each side
        ['left', 'right'].forEach(side => {
            const sign = side === 'right' ? 1 : -1;

            const mountGeom = new THREE.BoxGeometry(hb.mountWidth, hb.mountHeight, hb.mountDepth);
            const mount = new THREE.Mesh(mountGeom, null);
            mount.userData.material = 'aluminum';

            // Position at side of housing where strap connects
            const surfacePos = this._getSurfacePosition(sign * 0.92, 0, startZ + 0.008);
            mount.position.set(
                surfacePos.x + sign * 0.012,
                0.035,
                surfacePos.z
            );
            mount.rotation.y = -sign * 0.22;

            group.add(mount);
        });

        return group;
    }
};
