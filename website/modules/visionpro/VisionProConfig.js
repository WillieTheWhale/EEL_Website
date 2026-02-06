/**
 * Apple Vision Pro Configuration
 * Real-world dimensions and material properties
 *
 * Scale: 1 scene unit = 100mm (so 1.6 units = 160mm)
 */

window.VISION_PRO_CONFIG = {
    // Real Vision Pro dimensions: ~200mm W × 100mm H × 80mm D (including wrap)
    dimensions: {
        // Main housing dimensions (in scene units, 1 unit = 100mm)
        housing: {
            width: 1.8,      // 180mm total width (ski goggle shape)
            height: 0.9,     // 90mm total height
            depth: 0.35     // 35mm housing depth (front to back)
        },

        // Glass visor ski-goggle surface parameters
        visor: {
            // Cylindrical wrap parameters
            wrapRadius: 1.1,         // Radius of horizontal wrap cylinder
            wrapAngle: Math.PI * 0.42,  // ~75 degrees each side from center
            // Dome parameters
            domeDepth: 0.12,         // How much center bulges forward
            // Silhouette
            cornerRadius: 0.20,      // Rounded corners of the mask
            // Glass offset from bezel
            glassOffset: 0.008,
            // Resolution
            segmentsU: 200,
            segmentsV: 100
        },

        // Light Seal cushion
        lightSeal: {
            widthScale: 0.80,
            heightScale: 0.78,
            depth: 0.22,
            cushionRadius: 0.038
        },

        // Digital Crown (top-right)
        crown: {
            radius: 0.026,
            depth: 0.020,
            positionX: 0.65,
            positionY: 0.42,
            positionZ: -0.04
        },

        // Camera button (top-left)
        button: {
            length: 0.038,
            radius: 0.009,
            positionX: -0.62,
            positionY: 0.44,
            positionZ: -0.03
        },

        // Audio straps/pods
        audioPods: {
            width: 0.052,
            height: 0.032,
            depth: 0.012,
            cornerRadius: 0.005,
            offsetX: 0.035,
            connectorWidth: 0.016,
            connectorHeight: 0.020,
            connectorDepth: 0.028
        },

        // Headband system
        headband: {
            strapRadius: 0.022,
            strapWidth: 1.7,
            strapHeight: 0.36,
            strapDepth: 0.14,
            dialRadius: 0.038,
            dialDepth: 0.020,
            mountWidth: 0.028,
            mountHeight: 0.042,
            mountDepth: 0.016
        },

        // Frame/bezel
        frame: {
            thickness: 0.006,    // Very thin bezel
            inset: 0.003
        }
    },

    // Material colors and properties
    materials: {
        glass: {
            color: 0x020204,           // Very dark glass
            metalness: 0.0,
            roughness: 0.03,
            clearcoat: 1.0,
            clearcoatRoughness: 0.01,
            transmission: 0.35,
            thickness: 0.015,
            ior: 1.52,
            attenuationDistance: 0.5,
            attenuationColor: 0x010102,
            envMapIntensity: 1.4
        },

        aluminum: {
            color: 0xe0e0e4,
            metalness: 0.95,
            roughness: 0.14,
            clearcoat: 0.12,
            clearcoatRoughness: 0.20,
            envMapIntensity: 1.4
        },

        darkAluminum: {
            color: 0x484850,
            metalness: 0.90,
            roughness: 0.28,
            envMapIntensity: 0.85
        },

        fabric: {
            color: 0x121218,
            metalness: 0.0,
            roughness: 0.90,
            envMapIntensity: 0.22
        },

        cushion: {
            color: 0x0a0a0e,
            metalness: 0.0,
            roughness: 0.85,
            envMapIntensity: 0.15
        }
    },

    // HDRI Environment Configuration
    hdri: {
        enabled: true,
        path: null,
        fallbackProcedural: true,
        resolution: 2048
    },

    // Shadow Configuration
    shadows: {
        enabled: true,
        mapSize: 2048,
        bias: -0.0001,
        normalBias: 0.002
    },

    // Post-Processing Configuration
    postProcessing: {
        enabled: true,
        bloom: {
            enabled: true,
            strength: 0.28,
            radius: 0.5,
            threshold: 0.85
        },
        ssao: {
            enabled: true,
            kernelRadius: 12,
            minDistance: 0.0006,
            maxDistance: 0.035
        }
    },

    // Lighting configuration
    lighting: {
        ambient: {
            color: 0xffffff,
            intensity: 0.16
        },

        keyLight: {
            color: 0xffffff,
            intensity: 0.68,
            position: [4, 5, 7]
        },

        fillLight: {
            color: 0xd0d6e4,
            intensity: 0.26,
            position: [-4, 1, 4]
        },

        rimLight: {
            color: 0xffffff,
            intensity: 0.45,
            position: [0, 3, -5]
        },

        bottomFill: {
            color: 0x888898,
            intensity: 0.12,
            position: [0, -4, 2]
        },

        toneMapping: 'ACESFilmic',
        toneMappingExposure: 1.05
    },

    // Camera/view settings
    camera: {
        fov: 24,
        position: [0, 0.05, 4.0],
        marketingAngle: {
            rotationY: Math.PI * 0.14,
            rotationX: Math.PI * 0.03
        }
    }
};
