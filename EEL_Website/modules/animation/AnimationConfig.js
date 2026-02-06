/**
 * Animation Configuration for Swimmer Hand
 * Centralized configuration for easy tuning of animation parameters
 */

const SWIM_ANIMATION_CONFIG = {
    // Cycle timing (keep current ~3.3s cycle)
    cycleMultiplier: 0.6,  // Combined with PHI gives ~3.3s full cycle

    // Finger curl amplitudes (radians) - 20-30 degree range
    fingerCurl: {
        index:  { power: 0.40, recovery: 0.15 },   // ~23° power, ~8.5° recovery
        middle: { power: 0.45, recovery: 0.18 },   // ~26° power, ~10° recovery
        ring:   { power: 0.42, recovery: 0.16 },   // ~24° power, ~9° recovery
        pinky:  { power: 0.38, recovery: 0.14 },   // ~22° power, ~8° recovery
        thumb:  { power: 0.20, recovery: 0.08 },   // ~11° power, ~4.5° recovery
        default: { power: 0.40, recovery: 0.15 }
    },

    // Wave propagation settings
    wavePropagation: {
        // Phase delay between joints (radians)
        // Creates ~0.5s delay between joints at 3.3s cycle
        phaseDelay: 0.25,

        // Amplitude distribution across joints (proximal -> middle -> distal)
        // Sum should roughly equal 1.0 for total motion distribution
        amplitudeCurve: [0.45, 0.35, 0.20],

        // Direction of wave (proximalToDistal or distalToProximal)
        direction: 'proximalToDistal'
    },

    // Finger spread during swimming phases
    spread: {
        powerPhase: 0.015,    // Fingers closer together during power
        recoveryPhase: 0.035  // Fingers spread during recovery
    },

    // Secondary motion (subtle twist/sway)
    secondaryMotion: {
        enabled: true,
        yAxisAmplitude: 0.012,   // Subtle side-to-side
        yAxisFrequency: 0.9,     // Slightly slower than main cycle
        zAxisAmplitude: 0.008    // Very subtle twist
    },

    // Overall hand motion
    handMotion: {
        pitchAmplitude: 0.12,    // Forward/back tilt
        pitchFrequency: 0.5,
        yawAmplitude: 0.08,      // Left/right rotation
        yawFrequency: 0.3,
        rollAmplitude: 0.06,     // Roll with swim stroke
        rollFrequency: 0.4
    },

    // Easing functions for smooth transitions
    easing: {
        // Use smooth transitions between power and recovery phases
        powerTransition: 'smoothstep',
        jointTransition: 'cubic'
    }
};

// Expose globally for use in script.js
window.SWIM_ANIMATION_CONFIG = SWIM_ANIMATION_CONFIG;
