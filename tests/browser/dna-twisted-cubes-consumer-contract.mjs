/**
 * Runtime-owned acceptance map from each real slider to its concrete CSS
 * consumer. Browser tests use the coupling list as their only exception set;
 * the Node source contract asserts this entire table exactly. The boolean
 * Show base letters control is intentionally outside this numeric slider map;
 * its add/remove label behavior is asserted directly in the browser matrix.
 */
const freezeConsumerContract = (entry) => Object.freeze({
  ...entry,
  properties: Object.freeze([...entry.properties]),
  allowedRenderChanges: Object.freeze([...entry.allowedRenderChanges]),
  allowedCouplings: Object.freeze([...entry.allowedCouplings]),
})

export const COMPUTED_CONSUMER_CONTRACTS = Object.freeze([
  { effectId: "massage-lab-dna", label: "Node motion speed", key: "massageLabDnaNodeMotionSpeed", target: "strand > connector + [data-side]", properties: ["animationDuration", "animationDelay", "transform"], allowedRenderChanges: ["firstNodeDuration", "firstNodeDelay"], allowedCouplings: ["connectorTransform", "startNodeTransform", "endNodeTransform", "connectorDuration", "connectorDelay", "startNodeDuration", "startNodeDelay", "endNodeDuration", "endNodeDelay"] },
  { effectId: "massage-lab-dna", label: "Strand rotation speed", key: "massageLabDnaStrandRotationSpeed", target: ".scene > .composition", properties: ["animationDuration"], allowedRenderChanges: ["rotationDuration"], allowedCouplings: ["sceneDuration"] },
  { effectId: "massage-lab-dna", label: "Strand count", key: "massageLabDnaStrandCount", target: ".scene grid + [data-side]", properties: ["count", "height", "animationDelay", "transform"], allowedRenderChanges: ["strandCount", "firstNodeDelay"], allowedCouplings: ["strandCount", "nodeCount", "strandHeight", "connectorHeight", "startNodeWidth", "startNodeHeight", "endNodeWidth", "endNodeHeight", "connectorDelay", "startNodeDelay", "endNodeDelay", "connectorTransform", "startNodeTransform", "endNodeTransform"] },
  { effectId: "massage-lab-dna", label: "Strand angle", key: "massageLabDnaStrandAngle", target: ".scene > .composition", properties: ["rotate"], allowedRenderChanges: ["strandAngle"], allowedCouplings: ["sceneRotate"] },
  { effectId: "massage-lab-dna", label: "Strand spacing", key: "massageLabDnaStrandSpacing", target: ".scene > .composition", properties: ["rowGap", "height", "transform"], allowedRenderChanges: ["strandSpacing"], allowedCouplings: ["sceneRowGap", "strandHeight", "connectorHeight", "startNodeWidth", "startNodeHeight", "endNodeWidth", "endNodeHeight", "connectorTransform", "startNodeTransform", "endNodeTransform"] },
  { effectId: "massage-lab-dna", label: "Scale", key: "massageLabDnaScale", target: ":scope > .scene", properties: ["transform"], allowedRenderChanges: ["scale"], allowedCouplings: ["sceneTransform"] },
  { effectId: "massage-lab-dna", label: "Position X", key: "massageLabDnaPositionX", target: ":scope > .scene", properties: ["transform"], allowedRenderChanges: ["positionX"], allowedCouplings: ["sceneTransform"] },
  { effectId: "massage-lab-dna", label: "Position Y", key: "massageLabDnaPositionY", target: ":scope > .scene", properties: ["transform"], allowedRenderChanges: ["positionY"], allowedCouplings: ["sceneTransform"] },
  { effectId: "massage-lab-dna", label: "Connector width", key: "massageLabDnaConnectorWidth", target: "strand > connector", properties: ["width", "transform"], allowedRenderChanges: ["connectorWidth"], allowedCouplings: ["connectorWidth", "connectorTransform"] },
  { effectId: "massage-lab-dna", label: "Connector thickness", key: "massageLabDnaConnectorThickness", target: "strand > connector", properties: ["height", "transform"], allowedRenderChanges: ["connectorThickness"], allowedCouplings: ["connectorHeight", "connectorTransform"] },
  { effectId: "massage-lab-dna", label: "Outline thickness", key: "massageLabDnaOutlineThickness", target: "connector + [data-side]", properties: ["borderTopWidth", "size", "transform"], allowedRenderChanges: ["outlineThickness"], allowedCouplings: ["connectorBorderWidth", "startNodeBorderWidth", "endNodeBorderWidth", "connectorHeight", "startNodeWidth", "startNodeHeight", "endNodeWidth", "endNodeHeight", "connectorTransform", "startNodeTransform", "endNodeTransform"] },
  { effectId: "massage-lab-twisted-cubes", label: "Rotation speed", key: "massageLabTwistedCubesRotationSpeed", target: "[style*='--ml-twisted-cubes-outline'] > .view > .cube", properties: ["animationDuration", "transform"], allowedRenderChanges: ["cycle"], allowedCouplings: ["cubeTransform", "cubeDuration"] },
  { effectId: "massage-lab-twisted-cubes", label: "Layer stagger", key: "massageLabTwistedCubesLayerStagger", target: "[style*='--ml-twisted-cubes-outline'] > .view > .cube", properties: ["animationDelay", "transform"], allowedRenderChanges: ["firstDelay"], allowedCouplings: ["cubeTransform", "cubeDelay"] },
  { effectId: "massage-lab-twisted-cubes", label: "View angle X", key: "massageLabTwistedCubesViewAngleX", target: ".layer > .view", properties: ["transform"], allowedRenderChanges: ["viewAngleX"], allowedCouplings: ["viewTransform"] },
  { effectId: "massage-lab-twisted-cubes", label: "View angle Y", key: "massageLabTwistedCubesViewAngleY", target: ".layer > .view", properties: ["transform"], allowedRenderChanges: ["viewAngleY"], allowedCouplings: ["viewTransform"] },
  { effectId: "massage-lab-twisted-cubes", label: "Layer count", key: "massageLabTwistedCubesLayerCount", target: "[style*='--ml-twisted-cubes-outline'] > .view > .cube > .cuboid > .face", properties: ["count", "depth", "size", "animationDelay", "transform", "opacity"], allowedRenderChanges: ["layerCount", "middleOutline", "firstAlpha", "firstDelay", "firstSize", "secondDepth"], allowedCouplings: ["layerCount", "faceCount", "firstLayerTransform", "secondLayerTransform", "cubeTransform", "cubeDelay", "faceWidth", "faceHeight", "faceOpacity"] },
  { effectId: "massage-lab-twisted-cubes", label: "Layer depth", key: "massageLabTwistedCubesLayerDepthSpacing", target: "[style*='--ml-twisted-cubes-outline']", properties: ["transform"], allowedRenderChanges: ["secondDepth"], allowedCouplings: ["firstLayerTransform", "secondLayerTransform"] },
  { effectId: "massage-lab-twisted-cubes", label: "Scale", key: "massageLabTwistedCubesScale", target: "inner cube faces", properties: ["size", "transform"], allowedRenderChanges: ["scale", "firstSize"], allowedCouplings: ["cubeTransform", "faceWidth", "faceHeight"] },
  { effectId: "massage-lab-twisted-cubes", label: "Position X", key: "massageLabTwistedCubesPositionX", target: ":scope > .scene", properties: ["transform"], allowedRenderChanges: ["positionX"], allowedCouplings: ["sceneTransform"] },
  { effectId: "massage-lab-twisted-cubes", label: "Position Y", key: "massageLabTwistedCubesPositionY", target: ":scope > .scene", properties: ["transform"], allowedRenderChanges: ["positionY"], allowedCouplings: ["sceneTransform"] },
  { effectId: "massage-lab-twisted-cubes", label: "Fade falloff", key: "massageLabTwistedCubesOpacityFalloff", target: "first .face", properties: ["opacity"], allowedRenderChanges: ["firstAlpha"], allowedCouplings: ["faceOpacity"] },
  { effectId: "massage-lab-twisted-cubes", label: "Relative outline thickness", key: "massageLabTwistedCubesOutlineThickness", target: "first .face", properties: ["borderTopWidth"], allowedRenderChanges: ["firstOutlineThickness"], allowedCouplings: ["faceBorderWidth"] },
].map(freezeConsumerContract))
