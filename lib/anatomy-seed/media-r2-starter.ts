import type { AnatomySeedSection } from "./sections.ts"

const BODYPARTS3D_SOURCE = "bodyparts3d"
const BODYPARTS3D_ATTRIBUTION = "BodyParts3D, © The Database Center for Life Science licensed under CC Attribution 4.0 International."
const BODYPARTS3D_LICENSE_URL = "https://creativecommons.org/licenses/by/4.0/"
const BODYPARTS3D_LICENSE_PAGE = "https://dbarchive.biosciencedbc.jp/en/bodyparts3d/lic.html"
const BODYPARTS3D_API_DOCS = "https://lifesciencedb.jp/bp3d/info_en/webapi/index.html"
const BODYPARTS3D_EXAMPLES_PAGE = "https://lifesciencedb.jp/bp3d/info_en/userGuide/application/index.html"

const starterImages = [
  {
    slug: "bodyparts3d-brain-anatomogram",
    title: "BodyParts3D Brain Anatomogram",
    description: "Reviewed BodyParts3D/Anatomography PNG source image for brain anatomy media ingestion into R2.",
    sourceUrl: "http://lifesciencedb.jp/bp3d/API/image.cgi?shorten=n8vamGbSjOzKuWvaiWeK55b8",
    storagePath: "anatomy/bodyparts3d/anatomograms/brain.png",
    entityLinks: [
      { entityType: "anatomy_structure", entitySlug: "brain", role: "primary", notes: "Starter gross anatomy media for nervous-system education." },
      { entityType: "anatomy_concept", entitySlug: "brain", role: "client_education", notes: "Client-friendly education image candidate for brain anatomy concepts." },
    ],
  },
  {
    slug: "bodyparts3d-heart-anatomogram",
    title: "BodyParts3D Heart Anatomogram",
    description: "Reviewed BodyParts3D/Anatomography PNG source image for heart anatomy media ingestion into R2.",
    sourceUrl: "http://lifesciencedb.jp/bp3d/API/image.cgi?shorten=rCK5vOCmiKDqiqmqm4Xfimua",
    storagePath: "anatomy/bodyparts3d/anatomograms/heart.png",
    entityLinks: [
      { entityType: "anatomy_structure", entitySlug: "heart", role: "primary", notes: "Starter gross anatomy media for cardiovascular education." },
      { entityType: "anatomy_concept", entitySlug: "heart", role: "client_education", notes: "Client-friendly education image candidate for heart anatomy concepts." },
    ],
  },
  {
    slug: "bodyparts3d-eye-anatomogram",
    title: "BodyParts3D Eye Anatomogram",
    description: "Reviewed BodyParts3D/Anatomography PNG source image for eye anatomy media ingestion into R2.",
    sourceUrl: "http://lifesciencedb.jp/bp3d/API/image.cgi?shorten=bKnS1jXXPDqWfaSDmaK5HbOD",
    storagePath: "anatomy/bodyparts3d/anatomograms/eye.png",
    entityLinks: [
      { entityType: "anatomy_structure", entitySlug: "eye", role: "primary", notes: "Starter gross anatomy media for special-sense anatomy education." },
      { entityType: "anatomy_concept", entitySlug: "eye", role: "client_education", notes: "Client-friendly education image candidate for eye anatomy concepts." },
    ],
  },
] as const

export const MEDIA_R2_STARTER_SECTION = {
  mediaAssets: starterImages.map((asset) => ({
    id: `media-${asset.slug}`,
    slug: asset.slug,
    title: asset.title,
    mediaType: "image",
    description: asset.description,
    sourceRef: BODYPARTS3D_SOURCE,
    sourceUrl: asset.sourceUrl,
    storagePath: asset.storagePath,
    license: "CC BY 4.0",
    licenseUrl: BODYPARTS3D_LICENSE_URL,
    attribution: BODYPARTS3D_ATTRIBUTION,
    author: "Database Center for Life Science",
    usageScope: "open_reuse",
    reviewStatus: "reviewed",
    format: "png",
    metadata: {
      r2Upload: true,
      sourceKind: "anatomography-api-image",
      sourcePage: BODYPARTS3D_EXAMPLES_PAGE,
      apiDocumentation: BODYPARTS3D_API_DOCS,
      licenseVerifiedAt: "2026-05-25",
      licensePage: BODYPARTS3D_LICENSE_PAGE,
      ingestionStatus: "pending_r2_upload",
    },
  })),
  mediaEntityLinks: starterImages.flatMap((asset) => asset.entityLinks.map((link) => ({
    id: `media-link-${asset.slug}-${link.entityType}-${link.entitySlug}-${link.role}`,
    assetSlug: asset.slug,
    entityType: link.entityType,
    entitySlug: link.entitySlug,
    role: link.role,
    notes: link.notes,
  }))),
  citations: starterImages.flatMap((asset) => [
    {
      id: `citation-${asset.slug}-media-source`,
      slug: `citation-${asset.slug}-media-source`,
      entityType: "anatomy_structure",
      entitySlug: asset.entityLinks[0].entitySlug,
      factType: "media_source",
      factSlug: asset.slug,
      sourceRef: BODYPARTS3D_SOURCE,
      sourceLocator: asset.sourceUrl,
      citationNote: "BodyParts3D/Anatomography API image selected for R2 ingestion with stored license, attribution, source URL, and upload path.",
      reviewStatus: "reviewed",
    },
    {
      id: `citation-${asset.slug}-media-license`,
      slug: `citation-${asset.slug}-media-license`,
      entityType: "anatomy_structure",
      entitySlug: asset.entityLinks[0].entitySlug,
      factType: "media_license",
      factSlug: asset.slug,
      sourceRef: BODYPARTS3D_SOURCE,
      sourceLocator: BODYPARTS3D_LICENSE_PAGE,
      citationNote: "BodyParts3D official license page lists Creative Commons Attribution 4.0 International and required attribution wording.",
      reviewStatus: "reviewed",
    },
  ]),
} satisfies AnatomySeedSection
