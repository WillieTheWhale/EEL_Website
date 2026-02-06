/**
 * Vision Pro Materials
 * PBR materials with proper TRANSMISSION glass and edge shader
 */

window.VisionProMaterials = class VisionProMaterials {
    constructor(config, envMap) {
        this.config = config;
        this.envMap = envMap;
        this.materials = {};
        this._buildMaterials();
    }

    _buildMaterials() {
        const m = this.config.materials;
        const edgeSharpness = this.config.dimensions.visor.edgeSharpness || 0.012;

        // Glass visor - PROPER TRANSMISSION GLASS with edge masking
        this.materials.glass = new THREE.MeshPhysicalMaterial({
            color: m.glass.color,
            metalness: m.glass.metalness,
            roughness: m.glass.roughness,
            clearcoat: m.glass.clearcoat,
            clearcoatRoughness: m.glass.clearcoatRoughness,

            // TRANSMISSION PROPERTIES (the key fix)
            transmission: m.glass.transmission,
            thickness: m.glass.thickness,
            ior: m.glass.ior,
            attenuationDistance: m.glass.attenuationDistance,
            attenuationColor: new THREE.Color(m.glass.attenuationColor),

            // ENVIRONMENT
            envMap: this.envMap,
            envMapIntensity: m.glass.envMapIntensity,

            // RENDERING
            side: THREE.DoubleSide,
            transparent: true,
            opacity: 1.0,
            depthWrite: true
        });

        // Inject custom shader for SDF-based edge masking
        this.materials.glass.onBeforeCompile = (shader) => {
            // Add edgeSDF attribute to vertex shader
            shader.vertexShader = shader.vertexShader.replace(
                '#include <common>',
                `#include <common>
                attribute float edgeSDF;
                varying float vEdgeSDF;`
            );

            shader.vertexShader = shader.vertexShader.replace(
                '#include <begin_vertex>',
                `#include <begin_vertex>
                vEdgeSDF = edgeSDF;`
            );

            // Add alpha cutoff in fragment shader
            shader.fragmentShader = shader.fragmentShader.replace(
                '#include <common>',
                `#include <common>
                varying float vEdgeSDF;
                uniform float edgeSharpness;`
            );

            shader.fragmentShader = shader.fragmentShader.replace(
                '#include <dithering_fragment>',
                `#include <dithering_fragment>

                // Smooth edge cutoff using SDF
                float edgeFactor = 1.0 - smoothstep(-edgeSharpness, edgeSharpness * 0.5, vEdgeSDF);
                gl_FragColor.a *= edgeFactor;

                // Discard fully transparent fragments
                if (gl_FragColor.a < 0.02) discard;`
            );

            // Add uniform
            shader.uniforms.edgeSharpness = { value: edgeSharpness };
        };

        // Aluminum - Apple's signature brushed silver
        this.materials.aluminum = new THREE.MeshPhysicalMaterial({
            color: m.aluminum.color,
            metalness: m.aluminum.metalness,
            roughness: m.aluminum.roughness,
            clearcoat: m.aluminum.clearcoat,
            clearcoatRoughness: m.aluminum.clearcoatRoughness,
            envMap: this.envMap,
            envMapIntensity: m.aluminum.envMapIntensity
        });

        // Dark aluminum for controls and accents
        this.materials.darkAluminum = new THREE.MeshPhysicalMaterial({
            color: m.darkAluminum.color,
            metalness: m.darkAluminum.metalness,
            roughness: m.darkAluminum.roughness,
            envMap: this.envMap,
            envMapIntensity: m.darkAluminum.envMapIntensity
        });

        // Fabric for headband strap
        this.materials.fabric = new THREE.MeshStandardMaterial({
            color: m.fabric.color,
            metalness: m.fabric.metalness,
            roughness: m.fabric.roughness,
            envMap: this.envMap,
            envMapIntensity: m.fabric.envMapIntensity
        });

        // Cushion for Light Seal
        this.materials.cushion = new THREE.MeshStandardMaterial({
            color: m.cushion.color,
            metalness: m.cushion.metalness,
            roughness: m.cushion.roughness,
            envMap: this.envMap,
            envMapIntensity: m.cushion.envMapIntensity
        });
    }

    /**
     * Get a material by name
     * @param {string} name Material name
     * @returns {THREE.Material}
     */
    getMaterial(name) {
        return this.materials[name] || this.materials.aluminum;
    }

    /**
     * Apply materials to a group's children based on userData.material
     * @param {THREE.Group} group
     */
    applyMaterialsToGroup(group) {
        group.traverse(node => {
            if (node.isMesh) {
                const matName = node.userData.material || 'aluminum';
                node.material = this.getMaterial(matName);
            }
        });
    }

    /**
     * Update environment map on all materials
     * @param {THREE.Texture} envMap
     */
    updateEnvMap(envMap) {
        this.envMap = envMap;
        Object.values(this.materials).forEach(mat => {
            if (mat.envMap !== undefined) {
                mat.envMap = envMap;
                mat.needsUpdate = true;
            }
        });
    }

    /**
     * Dispose all materials
     */
    dispose() {
        Object.values(this.materials).forEach(mat => mat.dispose());
    }
};
