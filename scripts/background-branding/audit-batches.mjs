export const BACKGROUND_BRANDING_AUDIT_BATCHES = Object.freeze([
  { slug: "01-foundations", title: "Foundations and signature forms", ids: [
    "massage-lab-moving-gradient", "static-gradient", "massage-lab-retro-grid", "massage-lab-aerial-rays",
    "massage-lab-dna", "massage-lab-twisted-cubes", "massage-lab-tile-grid", "massage-lab-hex-grid",
    "massage-lab-gradient", "massage-lab-lamp-effect", "massage-lab-spotlight", "massage-lab-reveal-dots",
  ] },
  { slug: "02-flow-and-liquid", title: "Flow and liquid motion", ids: [
    "massage-lab-wave-current", "massage-lab-waves", "massage-lab-wavy-background", "massage-lab-silk",
    "massage-lab-floating-lines", "massage-lab-line-waves", "massage-lab-threads", "massage-lab-color-bends",
    "massage-lab-liquid-ether", "massage-lab-liquid-chrome", "massage-lab-ferrofluid", "massage-lab-iridescence",
  ] },
  { slug: "03-light-and-rays", title: "Light, rays, and beams", ids: [
    "massage-lab-light-speed", "massage-lab-lightfall", "massage-lab-light-pillar", "massage-lab-side-rays",
    "massage-lab-light-rays", "massage-lab-beams", "massage-lab-background-beams", "massage-lab-collision-beams",
    "massage-lab-background-lines", "massage-lab-photon-beam", "massage-lab-prismatic-burst", "massage-lab-prism",
  ] },
  { slug: "04-grids-and-pixels", title: "Grids, pixels, and geometry", ids: [
    "massage-lab-grid-bloom", "massage-lab-pixel-blast", "massage-lab-gradient-blinds", "massage-lab-grid-scan",
    "massage-lab-pixel-snow", "massage-lab-dither", "massage-lab-ripple-grid", "massage-lab-dot-field",
    "massage-lab-dot-grid", "massage-lab-grid-distortion", "massage-lab-grid-motion", "massage-lab-shape-grid",
  ] },
  { slug: "05-atmosphere-and-cosmos", title: "Atmosphere and cosmos", ids: [
    "massage-lab-electric-mist", "massage-lab-astral-flow", "massage-lab-deep-space-nebula", "massage-lab-dark-veil",
    "massage-lab-soft-aurora", "massage-lab-plasma", "massage-lab-plasma-wave", "massage-lab-particles",
    "massage-lab-galaxy", "massage-lab-aurora", "massage-lab-dotted-glow", "massage-lab-sparkles",
  ] },
  { slug: "06-digital-energy", title: "Digital and high-energy effects", ids: [
    "massage-lab-chrome-flow", "massage-lab-evil-eye", "massage-lab-radar", "massage-lab-synthesis",
    "massage-lab-lightning", "massage-lab-faulty-terminal", "massage-lab-letter-glitch", "massage-lab-balatro",
    "massage-lab-novatrix", "massage-lab-matrix-rain", "massage-lab-pixel-liquid", "massage-lab-vortex",
  ] },
  { slug: "07-fields-and-celestial", title: "Fields and celestial motion", ids: [
    "massage-lab-grainient", "massage-lab-orb", "massage-lab-gradient-animation", "massage-lab-glowing-stars",
    "massage-lab-meteors", "massage-lab-shooting-stars", "massage-lab-3d-globe", "massage-lab-aurora-bars",
    "massage-lab-bubble", "massage-lab-stars", "massage-lab-hole",
  ] },
].map((batch) => Object.freeze({ ...batch, ids: Object.freeze(batch.ids) })))
