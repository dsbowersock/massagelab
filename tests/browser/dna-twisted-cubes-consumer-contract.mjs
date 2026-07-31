/**
 * Runtime-owned acceptance map from each real slider to its concrete CSS
 * consumer. Browser tests use the coupling list as their only exception set;
 * the Node source contract asserts this entire table exactly.
 */
export const COMPUTED_CONSUMER_CONTRACTS = Object.freeze([
  { effectId: "massage-lab-dna", label: "Node motion speed", key: "massageLabDnaNodeMotionSpeed", target: "strand > connector + [data-side]", properties: ["animationDuration", "animationDelay", "transform"], allowedCouplings: ["connectorTransform", "startNodeTransform", "endNodeTransform", "connectorDuration", "connectorDelay", "startNodeDuration", "startNodeDelay", "endNodeDuration", "endNodeDelay"] },
  { effectId: "massage-lab-dna", label: "Strand rotation speed", key: "massageLabDnaStrandRotationSpeed", target: "[style*='--ml-dna-start-color']", properties: ["animationDuration"], allowedCouplings: ["strandDuration"] },
  { effectId: "massage-lab-dna", label: "Strand count", key: "massageLabDnaStrandCount", target: "[style*='--ml-dna-start-color'] + [data-side]", properties: ["count", "top", "animationDelay", "transform"], allowedCouplings: ["strandCount", "nodeCount", "firstTop", "lastTop", "connectorDelay", "startNodeDelay", "endNodeDelay", "connectorTransform", "startNodeTransform", "endNodeTransform"] },
  { effectId: "massage-lab-dna", label: "Strand angle", key: "massageLabDnaStrandAngle", target: "[style*='--ml-dna-start-color']", properties: ["transform"], allowedCouplings: ["strandTransform"] },
  { effectId: "massage-lab-dna", label: "Strand spacing", key: "massageLabDnaStrandSpacing", target: "first/last [style*='--ml-dna-start-color']", properties: ["top"], allowedCouplings: ["firstTop", "lastTop"] },
  { effectId: "massage-lab-dna", label: "Scale", key: "massageLabDnaScale", target: ":scope > .scene", properties: ["transform"], allowedCouplings: ["sceneTransform"] },
  { effectId: "massage-lab-dna", label: "Position X", key: "massageLabDnaPositionX", target: ":scope > .scene", properties: ["transform"], allowedCouplings: ["sceneTransform"] },
  { effectId: "massage-lab-dna", label: "Position Y", key: "massageLabDnaPositionY", target: ":scope > .scene", properties: ["transform"], allowedCouplings: ["sceneTransform"] },
  { effectId: "massage-lab-dna", label: "Connector width", key: "massageLabDnaConnectorWidth", target: "strand > connector + [data-side]", properties: ["width", "marginLeft", "transform"], allowedCouplings: ["strandWidth", "strandMarginLeft", "connectorWidth", "connectorTransform", "startNodeTransform", "endNodeTransform"] },
  { effectId: "massage-lab-dna", label: "Connector thickness", key: "massageLabDnaConnectorThickness", target: "strand > connector + [data-side]", properties: ["height", "width", "marginTop", "transform"], allowedCouplings: ["strandHeight", "strandMarginTop", "connectorHeight", "startNodeWidth", "startNodeHeight", "endNodeWidth", "endNodeHeight", "connectorTransform", "startNodeTransform", "endNodeTransform"] },
  { effectId: "massage-lab-dna", label: "Outline thickness", key: "massageLabDnaOutlineThickness", target: "connector + [data-side]", properties: ["borderTopWidth"], allowedCouplings: ["connectorBorderWidth", "startNodeBorderWidth", "endNodeBorderWidth"] },
  { effectId: "massage-lab-twisted-cubes", label: "Rotation speed", key: "massageLabTwistedCubesRotationSpeed", target: "[style*='--ml-twisted-cubes-outline'] > .cube", properties: ["animationDuration", "transform"], allowedCouplings: ["cubeTransform", "cubeDuration"] },
  { effectId: "massage-lab-twisted-cubes", label: "Layer stagger", key: "massageLabTwistedCubesLayerStagger", target: "[style*='--ml-twisted-cubes-outline'] > .cube", properties: ["animationDelay", "transform"], allowedCouplings: ["cubeTransform", "cubeDelay"] },
  { effectId: "massage-lab-twisted-cubes", label: "View angle X", key: "massageLabTwistedCubesViewAngleX", target: ".scene > .view", properties: ["transform"], allowedCouplings: ["viewTransform"] },
  { effectId: "massage-lab-twisted-cubes", label: "View angle Y", key: "massageLabTwistedCubesViewAngleY", target: ".scene > .view", properties: ["transform"], allowedCouplings: ["viewTransform"] },
  { effectId: "massage-lab-twisted-cubes", label: "Layer count", key: "massageLabTwistedCubesLayerCount", target: "[style*='--ml-twisted-cubes-outline'] > cube > cuboid > face", properties: ["count", "animationDelay", "transform", "opacity"], allowedCouplings: ["layerCount", "faceCount", "cubeTransform", "cubeDelay", "faceOpacity"] },
  { effectId: "massage-lab-twisted-cubes", label: "Layer depth", key: "massageLabTwistedCubesLayerDepthSpacing", target: "second [style*='--ml-twisted-cubes-outline']", properties: ["transform"], allowedCouplings: ["secondLayerTransform"] },
  { effectId: "massage-lab-twisted-cubes", label: "Scale", key: "massageLabTwistedCubesScale", target: ":scope > .scene", properties: ["transform"], allowedCouplings: ["sceneTransform"] },
  { effectId: "massage-lab-twisted-cubes", label: "Position X", key: "massageLabTwistedCubesPositionX", target: ":scope > .scene", properties: ["transform"], allowedCouplings: ["sceneTransform"] },
  { effectId: "massage-lab-twisted-cubes", label: "Position Y", key: "massageLabTwistedCubesPositionY", target: ":scope > .scene", properties: ["transform"], allowedCouplings: ["sceneTransform"] },
  { effectId: "massage-lab-twisted-cubes", label: "Fade falloff", key: "massageLabTwistedCubesOpacityFalloff", target: "first .face", properties: ["opacity"], allowedCouplings: ["faceOpacity"] },
  { effectId: "massage-lab-twisted-cubes", label: "Relative outline thickness", key: "massageLabTwistedCubesOutlineThickness", target: "first .face", properties: ["borderTopWidth"], allowedCouplings: ["faceBorderWidth"] },
])
