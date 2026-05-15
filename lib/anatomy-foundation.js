// @ts-check

/**
 * @typedef {"primary" | "secondary" | "concentric" | "eccentric" | "reverse" | "isometric"} MuscleActionRole
 * @typedef {{ id: string, slug: string, name: string, sourceRef: string }} FoundationSource
 * @typedef {{ id: string, slug: string, name: string, sourceRefs: string[] }} BodyRegion
 * @typedef {{ id: string, slug: string, name: string, region: string, sourceRefs: string[] }} BodySubregion
 * @typedef {{ id: string, slug: string, name: string, regions: string[], subregions: string[], sourceRefs: string[] }} Bone
 * @typedef {{ action: string, role: MuscleActionRole, note?: string }} MuscleActionLink
 * @typedef {{ id: string, slug: string, name: string, regions: string[], subregions: string[], bones: string[], joints: string[], actions: MuscleActionLink[], nerves: string[], ligaments?: string[], sourceRefs: string[] }} Muscle
 * @typedef {{ id: string, slug: string, name: string, regions: string[], subregions: string[], bones: string[], muscles?: string[], joints: string[], sourceRefs: string[] }} Ligament
 * @typedef {{ id: string, slug: string, name: string, regions: string[], subregions: string[], muscles: string[], sourceRefs: string[] }} Nerve
 * @typedef {{ id: string, slug: string, name: string, plane?: string, sourceRefs: string[] }} Action
 * @typedef {{ id: string, slug: string, name: string, jointType: string, bones: string[], ligaments: string[], actions: string[], sourceRefs: string[] }} Joint
 * @typedef {{ id: string, slug: string, joint: string, action: string, typicalDegrees: number, plane?: string, measurementNotes: string, sourceRef: string }} RangeOfMotion
 * @typedef {{ id: string, slug: string, name: string, regions: string[], subregions: string[], likelyStructures: string[], sourceRefs: string[] }} PainMapRegion
 * @typedef {{ id: string, slug: string, label: string, likelyRegions: string[], likelyStructures: string[], clinicalUse: "non-diagnostic", therapistPrompt: string, sourceRefs: string[] }} ClientTermMapping
 * @typedef {{
 *   sources: FoundationSource[]
 *   bodyRegions: BodyRegion[]
 *   bodySubregions: BodySubregion[]
 *   bones: Bone[]
 *   muscles: Muscle[]
 *   joints: Joint[]
 *   ligaments: Ligament[]
 *   nerves: Nerve[]
 *   actions: Action[]
 *   rangesOfMotion: RangeOfMotion[]
 *   painMapRegions: PainMapRegion[]
 *   clientTerms: ClientTermMapping[]
 * }} AnatomyFoundationSeed
 */

export const ANATOMY_FOUNDATION_SEED = /** @type {const satisfies AnatomyFoundationSeed} */ ({
  sources: [
    {
      id: "source-massagelab-initial-anatomy-foundation",
      slug: "massagelab-initial-anatomy-foundation",
      name: "MassageLab initial anatomy foundation",
      sourceRef: "Internal starter model for review before citation lock-in.",
    },
    {
      id: "source-future-clinical-citation-needed",
      slug: "future-clinical-citation-needed",
      name: "Future clinical citation needed",
      sourceRef: "Placeholder requiring review against anatomy and ROM references before clinical release.",
    },
  ],
  bodyRegions: [
    { id: "region-head-neck", slug: "head-neck", name: "Head and Neck", sourceRefs: ["source-massagelab-initial-anatomy-foundation"] },
    { id: "region-shoulder-girdle", slug: "shoulder-girdle", name: "Shoulder Girdle", sourceRefs: ["source-massagelab-initial-anatomy-foundation"] },
    { id: "region-upper-back", slug: "upper-back", name: "Upper Back", sourceRefs: ["source-massagelab-initial-anatomy-foundation"] },
  ],
  bodySubregions: [
    { id: "subregion-base-of-skull", slug: "base-of-skull", name: "Base of Skull", region: "region-head-neck", sourceRefs: ["source-massagelab-initial-anatomy-foundation"] },
    { id: "subregion-posterior-neck", slug: "posterior-neck", name: "Posterior Neck", region: "region-head-neck", sourceRefs: ["source-massagelab-initial-anatomy-foundation"] },
    { id: "subregion-lateral-neck", slug: "lateral-neck", name: "Lateral Neck", region: "region-head-neck", sourceRefs: ["source-massagelab-initial-anatomy-foundation"] },
    { id: "subregion-upper-trapezius", slug: "upper-trapezius", name: "Upper Trapezius Area", region: "region-shoulder-girdle", sourceRefs: ["source-massagelab-initial-anatomy-foundation"] },
    { id: "subregion-scapular-region", slug: "scapular-region", name: "Scapular Region", region: "region-upper-back", sourceRefs: ["source-massagelab-initial-anatomy-foundation"] },
    { id: "subregion-glenohumeral-region", slug: "glenohumeral-region", name: "Glenohumeral Region", region: "region-shoulder-girdle", sourceRefs: ["source-massagelab-initial-anatomy-foundation"] },
  ],
  bones: [
    { id: "bone-occipital-bone", slug: "occipital-bone", name: "Occipital Bone", regions: ["region-head-neck"], subregions: ["subregion-base-of-skull"], sourceRefs: ["source-future-clinical-citation-needed"] },
    { id: "bone-temporal-bone", slug: "temporal-bone", name: "Temporal Bone", regions: ["region-head-neck"], subregions: ["subregion-base-of-skull"], sourceRefs: ["source-future-clinical-citation-needed"] },
    { id: "bone-cervical-vertebrae", slug: "cervical-vertebrae", name: "Cervical Vertebrae", regions: ["region-head-neck"], subregions: ["subregion-posterior-neck", "subregion-lateral-neck"], sourceRefs: ["source-future-clinical-citation-needed"] },
    { id: "bone-clavicle", slug: "clavicle", name: "Clavicle", regions: ["region-shoulder-girdle"], subregions: ["subregion-glenohumeral-region"], sourceRefs: ["source-future-clinical-citation-needed"] },
    { id: "bone-scapula", slug: "scapula", name: "Scapula", regions: ["region-shoulder-girdle", "region-upper-back"], subregions: ["subregion-scapular-region", "subregion-glenohumeral-region"], sourceRefs: ["source-future-clinical-citation-needed"] },
    { id: "bone-humerus", slug: "humerus", name: "Humerus", regions: ["region-shoulder-girdle"], subregions: ["subregion-glenohumeral-region"], sourceRefs: ["source-future-clinical-citation-needed"] },
    { id: "bone-sternum", slug: "sternum", name: "Sternum", regions: ["region-shoulder-girdle"], subregions: ["subregion-lateral-neck"], sourceRefs: ["source-future-clinical-citation-needed"] },
    { id: "bone-ribs", slug: "ribs", name: "Ribs", regions: ["region-upper-back", "region-shoulder-girdle"], subregions: ["subregion-scapular-region", "subregion-lateral-neck"], sourceRefs: ["source-future-clinical-citation-needed"] },
    { id: "bone-thoracic-vertebrae", slug: "thoracic-vertebrae", name: "Thoracic Vertebrae", regions: ["region-upper-back"], subregions: ["subregion-scapular-region"], sourceRefs: ["source-future-clinical-citation-needed"] },
  ],
  actions: [
    { id: "action-cervical-flexion", slug: "cervical-flexion", name: "Cervical Flexion", plane: "sagittal", sourceRefs: ["source-future-clinical-citation-needed"] },
    { id: "action-cervical-extension", slug: "cervical-extension", name: "Cervical Extension", plane: "sagittal", sourceRefs: ["source-future-clinical-citation-needed"] },
    { id: "action-cervical-rotation", slug: "cervical-rotation", name: "Cervical Rotation", plane: "transverse", sourceRefs: ["source-future-clinical-citation-needed"] },
    { id: "action-cervical-lateral-flexion", slug: "cervical-lateral-flexion", name: "Cervical Lateral Flexion", plane: "frontal", sourceRefs: ["source-future-clinical-citation-needed"] },
    { id: "action-scapular-elevation", slug: "scapular-elevation", name: "Scapular Elevation", plane: "frontal", sourceRefs: ["source-future-clinical-citation-needed"] },
    { id: "action-scapular-depression", slug: "scapular-depression", name: "Scapular Depression", plane: "frontal", sourceRefs: ["source-future-clinical-citation-needed"] },
    { id: "action-scapular-retraction", slug: "scapular-retraction", name: "Scapular Retraction", plane: "transverse", sourceRefs: ["source-future-clinical-citation-needed"] },
    { id: "action-scapular-protraction", slug: "scapular-protraction", name: "Scapular Protraction", plane: "transverse", sourceRefs: ["source-future-clinical-citation-needed"] },
    { id: "action-scapular-upward-rotation", slug: "scapular-upward-rotation", name: "Scapular Upward Rotation", plane: "frontal", sourceRefs: ["source-future-clinical-citation-needed"] },
    { id: "action-shoulder-abduction", slug: "shoulder-abduction", name: "Shoulder Abduction", plane: "frontal", sourceRefs: ["source-future-clinical-citation-needed"] },
    { id: "action-shoulder-external-rotation", slug: "shoulder-external-rotation", name: "Shoulder External Rotation", plane: "transverse", sourceRefs: ["source-future-clinical-citation-needed"] },
    { id: "action-rib-elevation", slug: "rib-elevation", name: "Rib Elevation", sourceRefs: ["source-future-clinical-citation-needed"] },
  ],
  ligaments: [
    { id: "ligament-nuchal-ligament", slug: "nuchal-ligament", name: "Nuchal Ligament", regions: ["region-head-neck"], subregions: ["subregion-posterior-neck", "subregion-base-of-skull"], bones: ["bone-occipital-bone", "bone-cervical-vertebrae"], muscles: ["muscle-trapezius"], joints: ["joint-cervical-spine"], sourceRefs: ["source-future-clinical-citation-needed"] },
    { id: "ligament-alar-ligament", slug: "alar-ligament", name: "Alar Ligament", regions: ["region-head-neck"], subregions: ["subregion-base-of-skull"], bones: ["bone-occipital-bone", "bone-cervical-vertebrae"], joints: ["joint-atlanto-occipital"], sourceRefs: ["source-future-clinical-citation-needed"] },
    { id: "ligament-transverse-ligament-of-atlas", slug: "transverse-ligament-of-atlas", name: "Transverse Ligament of Atlas", regions: ["region-head-neck"], subregions: ["subregion-base-of-skull"], bones: ["bone-cervical-vertebrae"], joints: ["joint-cervical-spine"], sourceRefs: ["source-future-clinical-citation-needed"] },
    { id: "ligament-acromioclavicular-ligament", slug: "acromioclavicular-ligament", name: "Acromioclavicular Ligament", regions: ["region-shoulder-girdle"], subregions: ["subregion-glenohumeral-region"], bones: ["bone-clavicle", "bone-scapula"], joints: ["joint-acromioclavicular"], sourceRefs: ["source-future-clinical-citation-needed"] },
    { id: "ligament-coracoclavicular-ligament", slug: "coracoclavicular-ligament", name: "Coracoclavicular Ligament", regions: ["region-shoulder-girdle"], subregions: ["subregion-glenohumeral-region"], bones: ["bone-clavicle", "bone-scapula"], joints: ["joint-acromioclavicular"], sourceRefs: ["source-future-clinical-citation-needed"] },
    { id: "ligament-glenohumeral-ligaments", slug: "glenohumeral-ligaments", name: "Glenohumeral Ligaments", regions: ["region-shoulder-girdle"], subregions: ["subregion-glenohumeral-region"], bones: ["bone-scapula", "bone-humerus"], joints: ["joint-glenohumeral"], sourceRefs: ["source-future-clinical-citation-needed"] },
  ],
  joints: [
    { id: "joint-cervical-spine", slug: "cervical-spine", name: "Cervical Spine", jointType: "regional intervertebral joint complex", bones: ["bone-cervical-vertebrae"], ligaments: ["ligament-nuchal-ligament", "ligament-transverse-ligament-of-atlas"], actions: ["action-cervical-flexion", "action-cervical-extension", "action-cervical-rotation", "action-cervical-lateral-flexion"], sourceRefs: ["source-future-clinical-citation-needed"] },
    { id: "joint-atlanto-occipital", slug: "atlanto-occipital", name: "Atlanto-Occipital Joint", jointType: "synovial condyloid", bones: ["bone-occipital-bone", "bone-cervical-vertebrae"], ligaments: ["ligament-alar-ligament"], actions: ["action-cervical-flexion", "action-cervical-extension"], sourceRefs: ["source-future-clinical-citation-needed"] },
    { id: "joint-acromioclavicular", slug: "acromioclavicular", name: "Acromioclavicular Joint", jointType: "synovial plane", bones: ["bone-clavicle", "bone-scapula"], ligaments: ["ligament-acromioclavicular-ligament", "ligament-coracoclavicular-ligament"], actions: ["action-scapular-upward-rotation", "action-scapular-retraction"], sourceRefs: ["source-future-clinical-citation-needed"] },
    { id: "joint-glenohumeral", slug: "glenohumeral", name: "Glenohumeral Joint", jointType: "synovial ball-and-socket", bones: ["bone-scapula", "bone-humerus"], ligaments: ["ligament-glenohumeral-ligaments"], actions: ["action-shoulder-abduction", "action-shoulder-external-rotation"], sourceRefs: ["source-future-clinical-citation-needed"] },
    { id: "joint-scapulothoracic", slug: "scapulothoracic", name: "Scapulothoracic Articulation", jointType: "functional articulation", bones: ["bone-scapula", "bone-ribs", "bone-thoracic-vertebrae"], ligaments: [], actions: ["action-scapular-elevation", "action-scapular-depression", "action-scapular-retraction", "action-scapular-protraction", "action-scapular-upward-rotation"], sourceRefs: ["source-future-clinical-citation-needed"] },
  ],
  nerves: [
    { id: "nerve-accessory-nerve", slug: "accessory-nerve", name: "Accessory Nerve (CN XI)", regions: ["region-head-neck", "region-shoulder-girdle"], subregions: ["subregion-lateral-neck", "subregion-upper-trapezius"], muscles: ["muscle-trapezius", "muscle-sternocleidomastoid"], sourceRefs: ["source-future-clinical-citation-needed"] },
    { id: "nerve-cervical-plexus", slug: "cervical-plexus", name: "Cervical Plexus", regions: ["region-head-neck"], subregions: ["subregion-lateral-neck", "subregion-posterior-neck"], muscles: ["muscle-levator-scapulae", "muscle-sternocleidomastoid", "muscle-scalenes"], sourceRefs: ["source-future-clinical-citation-needed"] },
    { id: "nerve-dorsal-scapular-nerve", slug: "dorsal-scapular-nerve", name: "Dorsal Scapular Nerve", regions: ["region-shoulder-girdle", "region-upper-back"], subregions: ["subregion-scapular-region"], muscles: ["muscle-levator-scapulae", "muscle-rhomboid-major"], sourceRefs: ["source-future-clinical-citation-needed"] },
    { id: "nerve-long-thoracic-nerve", slug: "long-thoracic-nerve", name: "Long Thoracic Nerve", regions: ["region-shoulder-girdle", "region-upper-back"], subregions: ["subregion-scapular-region"], muscles: ["muscle-serratus-anterior"], sourceRefs: ["source-future-clinical-citation-needed"] },
    { id: "nerve-suprascapular-nerve", slug: "suprascapular-nerve", name: "Suprascapular Nerve", regions: ["region-shoulder-girdle"], subregions: ["subregion-glenohumeral-region", "subregion-scapular-region"], muscles: ["muscle-supraspinatus", "muscle-infraspinatus"], sourceRefs: ["source-future-clinical-citation-needed"] },
    { id: "nerve-axillary-nerve", slug: "axillary-nerve", name: "Axillary Nerve", regions: ["region-shoulder-girdle"], subregions: ["subregion-glenohumeral-region"], muscles: ["muscle-deltoid"], sourceRefs: ["source-future-clinical-citation-needed"] },
  ],
  muscles: [
    {
      id: "muscle-trapezius",
      slug: "trapezius",
      name: "Trapezius",
      regions: ["region-head-neck", "region-shoulder-girdle", "region-upper-back"],
      subregions: ["subregion-base-of-skull", "subregion-posterior-neck", "subregion-upper-trapezius", "subregion-scapular-region"],
      bones: ["bone-occipital-bone", "bone-cervical-vertebrae", "bone-thoracic-vertebrae", "bone-clavicle", "bone-scapula"],
      joints: ["joint-cervical-spine", "joint-acromioclavicular", "joint-scapulothoracic"],
      ligaments: ["ligament-nuchal-ligament"],
      nerves: ["nerve-accessory-nerve", "nerve-cervical-plexus"],
      actions: [
        { action: "action-scapular-elevation", role: "primary" },
        { action: "action-scapular-retraction", role: "primary" },
        { action: "action-scapular-upward-rotation", role: "primary" },
        { action: "action-cervical-extension", role: "secondary" },
        { action: "action-scapular-elevation", role: "concentric" },
        { action: "action-scapular-depression", role: "eccentric", note: "Controls descent from elevation." },
        { action: "action-cervical-extension", role: "reverse", note: "Scapular fixation can assist neck extension." },
        { action: "action-scapular-retraction", role: "isometric", note: "Supports scapular positioning." },
      ],
      sourceRefs: ["source-future-clinical-citation-needed"],
    },
    { id: "muscle-levator-scapulae", slug: "levator-scapulae", name: "Levator Scapulae", regions: ["region-head-neck", "region-shoulder-girdle"], subregions: ["subregion-posterior-neck", "subregion-upper-trapezius", "subregion-scapular-region"], bones: ["bone-cervical-vertebrae", "bone-scapula"], joints: ["joint-cervical-spine", "joint-scapulothoracic"], nerves: ["nerve-dorsal-scapular-nerve", "nerve-cervical-plexus"], actions: [{ action: "action-scapular-elevation", role: "primary" }, { action: "action-cervical-lateral-flexion", role: "secondary" }, { action: "action-scapular-depression", role: "eccentric" }, { action: "action-scapular-elevation", role: "isometric" }], sourceRefs: ["source-future-clinical-citation-needed"] },
    { id: "muscle-sternocleidomastoid", slug: "sternocleidomastoid", name: "Sternocleidomastoid", regions: ["region-head-neck"], subregions: ["subregion-lateral-neck", "subregion-base-of-skull"], bones: ["bone-sternum", "bone-clavicle", "bone-temporal-bone"], joints: ["joint-cervical-spine", "joint-atlanto-occipital"], nerves: ["nerve-accessory-nerve", "nerve-cervical-plexus"], actions: [{ action: "action-cervical-flexion", role: "primary" }, { action: "action-cervical-rotation", role: "primary" }, { action: "action-cervical-extension", role: "eccentric" }, { action: "action-cervical-flexion", role: "isometric" }], sourceRefs: ["source-future-clinical-citation-needed"] },
    { id: "muscle-scalenes", slug: "scalenes", name: "Scalenes", regions: ["region-head-neck", "region-shoulder-girdle"], subregions: ["subregion-lateral-neck"], bones: ["bone-cervical-vertebrae", "bone-ribs"], joints: ["joint-cervical-spine"], nerves: ["nerve-cervical-plexus"], actions: [{ action: "action-cervical-lateral-flexion", role: "primary" }, { action: "action-rib-elevation", role: "secondary" }, { action: "action-cervical-lateral-flexion", role: "isometric" }], sourceRefs: ["source-future-clinical-citation-needed"] },
    { id: "muscle-rhomboid-major", slug: "rhomboid-major", name: "Rhomboid Major", regions: ["region-upper-back", "region-shoulder-girdle"], subregions: ["subregion-scapular-region"], bones: ["bone-thoracic-vertebrae", "bone-scapula"], joints: ["joint-scapulothoracic"], nerves: ["nerve-dorsal-scapular-nerve"], actions: [{ action: "action-scapular-retraction", role: "primary" }, { action: "action-scapular-protraction", role: "eccentric" }, { action: "action-scapular-retraction", role: "isometric" }], sourceRefs: ["source-future-clinical-citation-needed"] },
    { id: "muscle-serratus-anterior", slug: "serratus-anterior", name: "Serratus Anterior", regions: ["region-shoulder-girdle", "region-upper-back"], subregions: ["subregion-scapular-region"], bones: ["bone-ribs", "bone-scapula"], joints: ["joint-scapulothoracic"], nerves: ["nerve-long-thoracic-nerve"], actions: [{ action: "action-scapular-protraction", role: "primary" }, { action: "action-scapular-upward-rotation", role: "primary" }, { action: "action-scapular-retraction", role: "eccentric" }, { action: "action-scapular-protraction", role: "isometric" }], sourceRefs: ["source-future-clinical-citation-needed"] },
    { id: "muscle-supraspinatus", slug: "supraspinatus", name: "Supraspinatus", regions: ["region-shoulder-girdle"], subregions: ["subregion-glenohumeral-region", "subregion-scapular-region"], bones: ["bone-scapula", "bone-humerus"], joints: ["joint-glenohumeral"], nerves: ["nerve-suprascapular-nerve"], actions: [{ action: "action-shoulder-abduction", role: "primary" }, { action: "action-shoulder-abduction", role: "isometric" }], sourceRefs: ["source-future-clinical-citation-needed"] },
    { id: "muscle-infraspinatus", slug: "infraspinatus", name: "Infraspinatus", regions: ["region-shoulder-girdle", "region-upper-back"], subregions: ["subregion-glenohumeral-region", "subregion-scapular-region"], bones: ["bone-scapula", "bone-humerus"], joints: ["joint-glenohumeral"], nerves: ["nerve-suprascapular-nerve"], actions: [{ action: "action-shoulder-external-rotation", role: "primary" }, { action: "action-shoulder-external-rotation", role: "isometric" }], sourceRefs: ["source-future-clinical-citation-needed"] },
    { id: "muscle-deltoid", slug: "deltoid", name: "Deltoid", regions: ["region-shoulder-girdle"], subregions: ["subregion-glenohumeral-region"], bones: ["bone-clavicle", "bone-scapula", "bone-humerus"], joints: ["joint-glenohumeral", "joint-acromioclavicular"], nerves: ["nerve-axillary-nerve"], actions: [{ action: "action-shoulder-abduction", role: "primary" }, { action: "action-shoulder-abduction", role: "isometric" }], sourceRefs: ["source-future-clinical-citation-needed"] },
  ],
  rangesOfMotion: [
    { id: "rom-cervical-flexion", slug: "cervical-flexion", joint: "joint-cervical-spine", action: "action-cervical-flexion", typicalDegrees: 45, plane: "sagittal", measurementNotes: "Average active cervical flexion; verify against selected clinical reference before release.", sourceRef: "future-clinical-citation-needed" },
    { id: "rom-cervical-extension", slug: "cervical-extension", joint: "joint-cervical-spine", action: "action-cervical-extension", typicalDegrees: 45, plane: "sagittal", measurementNotes: "Average active cervical extension; verify against selected clinical reference before release.", sourceRef: "future-clinical-citation-needed" },
    { id: "rom-cervical-rotation", slug: "cervical-rotation", joint: "joint-cervical-spine", action: "action-cervical-rotation", typicalDegrees: 80, plane: "transverse", measurementNotes: "Average active rotation per side; verify measurement position before release.", sourceRef: "future-clinical-citation-needed" },
    { id: "rom-cervical-lateral-flexion", slug: "cervical-lateral-flexion", joint: "joint-cervical-spine", action: "action-cervical-lateral-flexion", typicalDegrees: 45, plane: "frontal", measurementNotes: "Average active lateral flexion per side; verify against selected clinical reference before release.", sourceRef: "future-clinical-citation-needed" },
    { id: "rom-shoulder-abduction", slug: "shoulder-abduction", joint: "joint-glenohumeral", action: "action-shoulder-abduction", typicalDegrees: 180, plane: "frontal", measurementNotes: "Average shoulder abduction with scapulohumeral rhythm; distinguish GH-only measurement later.", sourceRef: "future-clinical-citation-needed" },
    { id: "rom-shoulder-external-rotation", slug: "shoulder-external-rotation", joint: "joint-glenohumeral", action: "action-shoulder-external-rotation", typicalDegrees: 90, plane: "transverse", measurementNotes: "Average external rotation; document position when citation is selected.", sourceRef: "future-clinical-citation-needed" },
  ],
  painMapRegions: [
    { id: "painmap-base-of-skull", slug: "base-of-skull", name: "Base of Skull", regions: ["region-head-neck"], subregions: ["subregion-base-of-skull"], likelyStructures: ["muscle-trapezius", "muscle-sternocleidomastoid", "joint-atlanto-occipital", "nerve-cervical-plexus"], sourceRefs: ["source-massagelab-initial-anatomy-foundation"] },
    { id: "painmap-posterior-neck", slug: "posterior-neck", name: "Posterior Neck", regions: ["region-head-neck"], subregions: ["subregion-posterior-neck"], likelyStructures: ["muscle-trapezius", "muscle-levator-scapulae", "joint-cervical-spine", "ligament-nuchal-ligament"], sourceRefs: ["source-massagelab-initial-anatomy-foundation"] },
    { id: "painmap-upper-trapezius", slug: "upper-trapezius", name: "Upper Trapezius Area", regions: ["region-shoulder-girdle"], subregions: ["subregion-upper-trapezius"], likelyStructures: ["muscle-trapezius", "muscle-levator-scapulae", "nerve-accessory-nerve"], sourceRefs: ["source-massagelab-initial-anatomy-foundation"] },
    { id: "painmap-medial-scapular-border", slug: "medial-scapular-border", name: "Medial Scapular Border", regions: ["region-upper-back"], subregions: ["subregion-scapular-region"], likelyStructures: ["muscle-rhomboid-major", "muscle-levator-scapulae", "nerve-dorsal-scapular-nerve"], sourceRefs: ["source-massagelab-initial-anatomy-foundation"] },
    { id: "painmap-lateral-shoulder", slug: "lateral-shoulder", name: "Lateral Shoulder", regions: ["region-shoulder-girdle"], subregions: ["subregion-glenohumeral-region"], likelyStructures: ["muscle-deltoid", "muscle-supraspinatus", "joint-glenohumeral", "nerve-axillary-nerve"], sourceRefs: ["source-massagelab-initial-anatomy-foundation"] },
  ],
  clientTerms: [
    { id: "client-term-stiff-neck", slug: "stiff-neck", label: "stiff neck", likelyRegions: ["subregion-posterior-neck", "subregion-lateral-neck"], likelyStructures: ["joint-cervical-spine", "muscle-levator-scapulae", "muscle-sternocleidomastoid", "muscle-scalenes"], clinicalUse: "non-diagnostic", therapistPrompt: "Use as a conversation starter, then choose clinically relevant structures from assessment findings.", sourceRefs: ["source-massagelab-initial-anatomy-foundation"] },
    { id: "client-term-neck-tension", slug: "neck-tension", label: "neck tension", likelyRegions: ["subregion-posterior-neck", "subregion-upper-trapezius"], likelyStructures: ["muscle-trapezius", "muscle-levator-scapulae", "ligament-nuchal-ligament"], clinicalUse: "non-diagnostic", therapistPrompt: "Use as a conversation starter, then choose clinically relevant structures from assessment findings.", sourceRefs: ["source-massagelab-initial-anatomy-foundation"] },
    { id: "client-term-tech-neck", slug: "tech-neck", label: "tech neck", likelyRegions: ["subregion-posterior-neck", "subregion-upper-trapezius"], likelyStructures: ["joint-cervical-spine", "muscle-trapezius", "muscle-levator-scapulae"], clinicalUse: "non-diagnostic", therapistPrompt: "Use as a conversation starter, then choose clinically relevant structures from assessment findings.", sourceRefs: ["source-massagelab-initial-anatomy-foundation"] },
    { id: "client-term-knot-in-shoulder", slug: "knot-in-shoulder", label: "knot in shoulder", likelyRegions: ["subregion-upper-trapezius", "subregion-glenohumeral-region"], likelyStructures: ["muscle-trapezius", "muscle-deltoid", "joint-glenohumeral"], clinicalUse: "non-diagnostic", therapistPrompt: "Use as a conversation starter, then choose clinically relevant structures from assessment findings.", sourceRefs: ["source-massagelab-initial-anatomy-foundation"] },
    { id: "client-term-knot-by-shoulder-blade", slug: "knot-by-shoulder-blade", label: "knot by shoulder blade", likelyRegions: ["subregion-scapular-region"], likelyStructures: ["muscle-levator-scapulae", "muscle-rhomboid-major", "muscle-trapezius", "nerve-dorsal-scapular-nerve"], clinicalUse: "non-diagnostic", therapistPrompt: "Use as a conversation starter, then choose clinically relevant structures from assessment findings.", sourceRefs: ["source-massagelab-initial-anatomy-foundation"] },
    { id: "client-term-shoulder-blade-pain", slug: "shoulder-blade-pain", label: "shoulder blade pain", likelyRegions: ["subregion-scapular-region"], likelyStructures: ["bone-scapula", "muscle-rhomboid-major", "muscle-serratus-anterior", "joint-scapulothoracic"], clinicalUse: "non-diagnostic", therapistPrompt: "Use as a conversation starter, then choose clinically relevant structures from assessment findings.", sourceRefs: ["source-massagelab-initial-anatomy-foundation"] },
    { id: "client-term-base-of-skull-pain", slug: "base-of-skull-pain", label: "base of skull pain", likelyRegions: ["subregion-base-of-skull"], likelyStructures: ["bone-occipital-bone", "joint-atlanto-occipital", "muscle-trapezius", "nerve-cervical-plexus"], clinicalUse: "non-diagnostic", therapistPrompt: "Use as a conversation starter, then choose clinically relevant structures from assessment findings.", sourceRefs: ["source-massagelab-initial-anatomy-foundation"] },
    { id: "client-term-tension-headache", slug: "tension-headache", label: "tension headache", likelyRegions: ["subregion-base-of-skull", "subregion-posterior-neck"], likelyStructures: ["joint-atlanto-occipital", "muscle-sternocleidomastoid", "muscle-trapezius", "nerve-cervical-plexus"], clinicalUse: "non-diagnostic", therapistPrompt: "Use as a conversation starter, then choose clinically relevant structures from assessment findings.", sourceRefs: ["source-massagelab-initial-anatomy-foundation"] },
    { id: "client-term-tight-traps", slug: "tight-traps", label: "tight traps", likelyRegions: ["subregion-upper-trapezius"], likelyStructures: ["muscle-trapezius", "nerve-accessory-nerve", "ligament-nuchal-ligament"], clinicalUse: "non-diagnostic", therapistPrompt: "Use as a conversation starter, then choose clinically relevant structures from assessment findings.", sourceRefs: ["source-massagelab-initial-anatomy-foundation"] },
    { id: "client-term-rounded-shoulders", slug: "rounded-shoulders", label: "rounded shoulders", likelyRegions: ["subregion-glenohumeral-region", "subregion-scapular-region"], likelyStructures: ["joint-scapulothoracic", "muscle-serratus-anterior", "muscle-rhomboid-major", "muscle-trapezius"], clinicalUse: "non-diagnostic", therapistPrompt: "Use as a conversation starter, then choose clinically relevant structures from assessment findings.", sourceRefs: ["source-massagelab-initial-anatomy-foundation"] },
    { id: "client-term-limited-shoulder-mobility", slug: "limited-shoulder-mobility", label: "limited shoulder mobility", likelyRegions: ["subregion-glenohumeral-region", "subregion-scapular-region"], likelyStructures: ["joint-glenohumeral", "joint-scapulothoracic", "muscle-supraspinatus", "muscle-infraspinatus", "muscle-deltoid"], clinicalUse: "non-diagnostic", therapistPrompt: "Use as a conversation starter, then choose clinically relevant structures from assessment findings.", sourceRefs: ["source-massagelab-initial-anatomy-foundation"] },
    { id: "client-term-pain-when-turning-head", slug: "pain-when-turning-head", label: "pain when turning head", likelyRegions: ["subregion-posterior-neck", "subregion-lateral-neck"], likelyStructures: ["joint-cervical-spine", "muscle-sternocleidomastoid", "muscle-scalenes", "muscle-levator-scapulae"], clinicalUse: "non-diagnostic", therapistPrompt: "Use as a conversation starter, then choose clinically relevant structures from assessment findings.", sourceRefs: ["source-massagelab-initial-anatomy-foundation"] },
  ],
})

const COLLECTION_NAMES = /** @type {const} */ ([
  "sources",
  "bodyRegions",
  "bodySubregions",
  "bones",
  "muscles",
  "joints",
  "ligaments",
  "nerves",
  "actions",
  "rangesOfMotion",
  "painMapRegions",
  "clientTerms",
])

const ACTION_ROLES = new Set(["primary", "secondary", "concentric", "eccentric", "reverse", "isometric"])

/**
 * @param {AnatomyFoundationSeed} seed
 */
function collectIds(seed) {
  /** @type {Record<string, Set<string>>} */
  const ids = {}
  COLLECTION_NAMES.forEach((collectionName) => {
    ids[collectionName] = new Set(seed[collectionName].map((item) => item.id))
  })
  return ids
}

/**
 * @param {unknown} value
 * @param {Set<string>} allowed
 */
function refsAreValid(value, allowed) {
  return Array.isArray(value) && value.every((item) => typeof item === "string" && allowed.has(item))
}

/**
 * @param {AnatomyFoundationSeed} [seed]
 */
export function validateAnatomyFoundation(seed = ANATOMY_FOUNDATION_SEED) {
  /** @type {string[]} */
  const issues = []
  const allIds = new Set()
  const duplicateIds = new Set()

  COLLECTION_NAMES.forEach((collectionName) => {
    const collectionSlugs = new Set()
    const duplicateCollectionSlugs = new Set()
    seed[collectionName].forEach((item) => {
      if (!item.id) issues.push(`Missing id in ${collectionName}`)
      if (!item.slug) issues.push(`Missing slug for id: ${item.id}`)
      if (allIds.has(item.id)) duplicateIds.add(item.id)
      if (collectionSlugs.has(item.slug)) duplicateCollectionSlugs.add(item.slug)
      allIds.add(item.id)
      collectionSlugs.add(item.slug)
    })
    duplicateCollectionSlugs.forEach((slug) => issues.push(`Duplicate anatomy foundation slug in ${collectionName}: ${slug}`))
  })

  duplicateIds.forEach((id) => issues.push(`Duplicate anatomy foundation id: ${id}`))

  const ids = collectIds(seed)
  const sourceIds = ids.sources
  const regionIds = ids.bodyRegions
  const subregionIds = ids.bodySubregions
  const boneIds = ids.bones
  const muscleIds = ids.muscles
  const jointIds = ids.joints
  const ligamentIds = ids.ligaments
  const nerveIds = ids.nerves
  const actionIds = ids.actions
  const structureIds = new Set([...boneIds, ...muscleIds, ...jointIds, ...ligamentIds, ...nerveIds])

  seed.bodyRegions.forEach((region) => {
    if (!refsAreValid(region.sourceRefs, sourceIds)) issues.push(`Invalid sourceRefs for ${region.id}`)
  })
  seed.bodySubregions.forEach((subregion) => {
    if (!regionIds.has(subregion.region)) issues.push(`Invalid region for ${subregion.id}`)
    if (!refsAreValid(subregion.sourceRefs, sourceIds)) issues.push(`Invalid sourceRefs for ${subregion.id}`)
  })
  seed.bones.forEach((bone) => {
    if (!refsAreValid(bone.regions, regionIds)) issues.push(`Invalid regions for ${bone.id}`)
    if (!refsAreValid(bone.subregions, subregionIds)) issues.push(`Invalid subregions for ${bone.id}`)
    if (!refsAreValid(bone.sourceRefs, sourceIds)) issues.push(`Invalid sourceRefs for ${bone.id}`)
  })
  seed.actions.forEach((action) => {
    if (!refsAreValid(action.sourceRefs, sourceIds)) issues.push(`Invalid sourceRefs for ${action.id}`)
  })
  seed.joints.forEach((joint) => {
    if (!refsAreValid(joint.bones, boneIds)) issues.push(`Invalid bones for ${joint.id}`)
    if (!refsAreValid(joint.ligaments, ligamentIds)) issues.push(`Invalid ligaments for ${joint.id}`)
    if (!refsAreValid(joint.actions, actionIds)) issues.push(`Invalid actions for ${joint.id}`)
    if (!refsAreValid(joint.sourceRefs, sourceIds)) issues.push(`Invalid sourceRefs for ${joint.id}`)
  })
  seed.ligaments.forEach((ligament) => {
    if (!refsAreValid(ligament.regions, regionIds)) issues.push(`Invalid regions for ${ligament.id}`)
    if (!refsAreValid(ligament.subregions, subregionIds)) issues.push(`Invalid subregions for ${ligament.id}`)
    if (!refsAreValid(ligament.bones, boneIds)) issues.push(`Invalid bones for ${ligament.id}`)
    if (!refsAreValid(ligament.joints, jointIds)) issues.push(`Invalid joints for ${ligament.id}`)
    if (ligament.muscles && !refsAreValid(ligament.muscles, muscleIds)) issues.push(`Invalid muscles for ${ligament.id}`)
    if (!refsAreValid(ligament.sourceRefs, sourceIds)) issues.push(`Invalid sourceRefs for ${ligament.id}`)
  })
  seed.nerves.forEach((nerve) => {
    if (!refsAreValid(nerve.regions, regionIds)) issues.push(`Invalid regions for ${nerve.id}`)
    if (!refsAreValid(nerve.subregions, subregionIds)) issues.push(`Invalid subregions for ${nerve.id}`)
    if (!refsAreValid(nerve.muscles, muscleIds)) issues.push(`Invalid muscles for ${nerve.id}`)
    if (!refsAreValid(nerve.sourceRefs, sourceIds)) issues.push(`Invalid sourceRefs for ${nerve.id}`)
  })
  seed.muscles.forEach((muscle) => {
    if (!refsAreValid(muscle.regions, regionIds)) issues.push(`Invalid regions for ${muscle.id}`)
    if (!refsAreValid(muscle.subregions, subregionIds)) issues.push(`Invalid subregions for ${muscle.id}`)
    if (!refsAreValid(muscle.bones, boneIds)) issues.push(`Invalid bones for ${muscle.id}`)
    if (!refsAreValid(muscle.joints, jointIds)) issues.push(`Invalid joints for ${muscle.id}`)
    if (!refsAreValid(muscle.nerves, nerveIds)) issues.push(`Invalid nerves for ${muscle.id}`)
    if (muscle.ligaments && !refsAreValid(muscle.ligaments, ligamentIds)) issues.push(`Invalid ligaments for ${muscle.id}`)
    if (!refsAreValid(muscle.sourceRefs, sourceIds)) issues.push(`Invalid sourceRefs for ${muscle.id}`)
    muscle.actions.forEach((actionLink) => {
      if (!actionIds.has(actionLink.action)) issues.push(`Invalid action for ${muscle.id}`)
      if (!ACTION_ROLES.has(actionLink.role)) issues.push(`Invalid action role for ${muscle.id}`)
    })
  })
  seed.rangesOfMotion.forEach((range) => {
    if (!jointIds.has(range.joint)) issues.push(`Invalid joint for ${range.id}`)
    if (!actionIds.has(range.action)) issues.push(`Invalid action for ${range.id}`)
    if (!Number.isFinite(range.typicalDegrees) || range.typicalDegrees <= 0) issues.push(`Invalid typicalDegrees for ${range.id}`)
    if (!range.sourceRef) issues.push(`Missing sourceRef for ${range.id}`)
  })
  seed.painMapRegions.forEach((painMapRegion) => {
    if (!refsAreValid(painMapRegion.regions, regionIds)) issues.push(`Invalid regions for ${painMapRegion.id}`)
    if (!refsAreValid(painMapRegion.subregions, subregionIds)) issues.push(`Invalid subregions for ${painMapRegion.id}`)
    if (!refsAreValid(painMapRegion.likelyStructures, structureIds)) issues.push(`Invalid likelyStructures for ${painMapRegion.id}`)
    if (!refsAreValid(painMapRegion.sourceRefs, sourceIds)) issues.push(`Invalid sourceRefs for ${painMapRegion.id}`)
  })
  seed.clientTerms.forEach((clientTerm) => {
    if (!refsAreValid(clientTerm.likelyRegions, subregionIds)) issues.push(`Invalid likelyRegions for ${clientTerm.id}`)
    if (!refsAreValid(clientTerm.likelyStructures, structureIds)) issues.push(`Invalid likelyStructures for ${clientTerm.id}`)
    if (clientTerm.clinicalUse !== "non-diagnostic") issues.push(`Client term must be non-diagnostic for ${clientTerm.id}`)
    if (!refsAreValid(clientTerm.sourceRefs, sourceIds)) issues.push(`Invalid sourceRefs for ${clientTerm.id}`)
  })

  return issues
}

export function getAnatomyFoundationSummary() {
  return Object.fromEntries(COLLECTION_NAMES.map((collectionName) => [
    collectionName,
    ANATOMY_FOUNDATION_SEED[collectionName].length,
  ]))
}

/**
 * @param {string} label
 */
export function findClientTermMapping(label) {
  const normalized = label.trim().toLowerCase()
  return ANATOMY_FOUNDATION_SEED.clientTerms.find((term) => (
    term.label.toLowerCase() === normalized || term.slug === normalized.replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")
  ))
}
