/**
 * Runtime-owned acceptance map from each real slider to its concrete CSS
 * consumer. Browser tests use the coupling list as their only exception set;
 * the Node source contract asserts this entire table exactly.
 */
const freezeConsumerContract = (entry) => Object.freeze({
  ...entry,
  properties: Object.freeze([...entry.properties]),
  allowedCouplings: Object.freeze([...entry.allowedCouplings]),
})

export const COMPUTED_CONSUMER_CONTRACTS = Object.freeze([
  { effectId: "massage-lab-dna", label: "Node motion speed", key: "massageLabDnaNodeMotionSpeed", target: "strand > connector + [data-side]", properties: ["animationDuration", "animationDelay", "transform"], allowedCouplings: ["connectorTransform", "startNodeTransform", "endNodeTransform", "connectorDuration", "connectorDelay", "startNodeDuration", "startNodeDelay", "endNodeDuration", "endNodeDelay"] },
  { effectId: "massage-lab-dna", label: "Strand rotation speed", key: "massageLabDnaStrandRotationSpeed", target: ".scene > .composition", properties: ["animationDuration"], allowedCouplings: ["sceneDuration"] },
  { effectId: "massage-lab-dna", label: "Strand count", key: "massageLabDnaStrandCount", target: ".scene grid + [data-side]", properties: ["count", "height", "animationDelay", "transform"], allowedCouplings: ["strandCount", "nodeCount", "strandHeight", "connectorHeight", "startNodeWidth", "startNodeHeight", "endNodeWidth", "endNodeHeight", "connectorDelay", "startNodeDelay", "endNodeDelay", "connectorTransform", "startNodeTransform", "endNodeTransform"] },
  { effectId: "massage-lab-dna", label: "Strand angle", key: "massageLabDnaStrandAngle", target: ".scene > .composition", properties: ["rotate"], allowedCouplings: ["sceneRotate"] },
  { effectId: "massage-lab-dna", label: "Strand spacing", key: "massageLabDnaStrandSpacing", target: ".scene > .composition", properties: ["rowGap", "height", "transform"], allowedCouplings: ["sceneRowGap", "strandHeight", "connectorHeight", "startNodeWidth", "startNodeHeight", "endNodeWidth", "endNodeHeight", "connectorTransform", "startNodeTransform", "endNodeTransform"] },
  { effectId: "massage-lab-dna", label: "Scale", key: "massageLabDnaScale", target: ":scope > .scene", properties: ["transform"], allowedCouplings: ["sceneTransform"] },
  { effectId: "massage-lab-dna", label: "Position X", key: "massageLabDnaPositionX", target: ":scope > .scene", properties: ["transform"], allowedCouplings: ["sceneTransform"] },
  { effectId: "massage-lab-dna", label: "Position Y", key: "massageLabDnaPositionY", target: ":scope > .scene", properties: ["transform"], allowedCouplings: ["sceneTransform"] },
  { effectId: "massage-lab-dna", label: "Connector width", key: "massageLabDnaConnectorWidth", target: "strand > connector", properties: ["width", "transform"], allowedCouplings: ["connectorWidth", "connectorTransform"] },
  { effectId: "massage-lab-dna", label: "Connector thickness", key: "massageLabDnaConnectorThickness", target: "strand > connector", properties: ["height", "transform"], allowedCouplings: ["connectorHeight", "connectorTransform"] },
  { effectId: "massage-lab-dna", label: "Outline thickness", key: "massageLabDnaOutlineThickness", target: "connector + [data-side]", properties: ["borderTopWidth", "size", "transform"], allowedCouplings: ["connectorBorderWidth", "startNodeBorderWidth", "endNodeBorderWidth", "connectorHeight", "startNodeWidth", "startNodeHeight", "endNodeWidth", "endNodeHeight", "connectorTransform", "startNodeTransform", "endNodeTransform"] },
  { effectId: "massage-lab-twisted-cubes", label: "Rotation speed", key: "massageLabTwistedCubesRotationSpeed", target: "[style*='--ml-twisted-cubes-outline'] > .view > .cube", properties: ["animationDuration", "transform"], allowedCouplings: ["cubeTransform", "cubeDuration"] },
  { effectId: "massage-lab-twisted-cubes", label: "Layer stagger", key: "massageLabTwistedCubesLayerStagger", target: "[style*='--ml-twisted-cubes-outline'] > .view > .cube", properties: ["animationDelay", "transform"], allowedCouplings: ["cubeTransform", "cubeDelay"] },
  { effectId: "massage-lab-twisted-cubes", label: "View angle X", key: "massageLabTwistedCubesViewAngleX", target: ".layer > .view", properties: ["transform"], allowedCouplings: ["viewTransform"] },
  { effectId: "massage-lab-twisted-cubes", label: "View angle Y", key: "massageLabTwistedCubesViewAngleY", target: ".layer > .view", properties: ["transform"], allowedCouplings: ["viewTransform"] },
  { effectId: "massage-lab-twisted-cubes", label: "Layer count", key: "massageLabTwistedCubesLayerCount", target: "[style*='--ml-twisted-cubes-outline'] > .view > .cube > .cuboid > .face", properties: ["count", "depth", "size", "animationDelay", "transform", "opacity"], allowedCouplings: ["layerCount", "faceCount", "firstLayerTransform", "secondLayerTransform", "cubeTransform", "cubeDelay", "faceWidth", "faceHeight", "faceOpacity"] },
  { effectId: "massage-lab-twisted-cubes", label: "Layer depth", key: "massageLabTwistedCubesLayerDepthSpacing", target: "[style*='--ml-twisted-cubes-outline']", properties: ["transform"], allowedCouplings: ["firstLayerTransform", "secondLayerTransform"] },
  { effectId: "massage-lab-twisted-cubes", label: "Scale", key: "massageLabTwistedCubesScale", target: ":scope > .scene", properties: ["transform"], allowedCouplings: ["sceneTransform"] },
  { effectId: "massage-lab-twisted-cubes", label: "Position X", key: "massageLabTwistedCubesPositionX", target: ":scope > .scene", properties: ["transform"], allowedCouplings: ["sceneTransform"] },
  { effectId: "massage-lab-twisted-cubes", label: "Position Y", key: "massageLabTwistedCubesPositionY", target: ":scope > .scene", properties: ["transform"], allowedCouplings: ["sceneTransform"] },
  { effectId: "massage-lab-twisted-cubes", label: "Fade falloff", key: "massageLabTwistedCubesOpacityFalloff", target: "first .face", properties: ["opacity"], allowedCouplings: ["faceOpacity"] },
  { effectId: "massage-lab-twisted-cubes", label: "Relative outline thickness", key: "massageLabTwistedCubesOutlineThickness", target: "first .face", properties: ["borderTopWidth"], allowedCouplings: ["faceBorderWidth"] },
].map(freezeConsumerContract))
