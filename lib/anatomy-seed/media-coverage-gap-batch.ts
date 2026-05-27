import type { AnatomySeedSection } from "./sections.ts"
import type { AnatomyEntityType, AnatomyMediaRole } from "../anatomy-foundation.ts"

const BODYPARTS3D_SOURCE = "bodyparts3d"
const BODYPARTS3D_ATTRIBUTION = "BodyParts3D, Database Center for Life Science licensed under CC BY 4.0."
const BODYPARTS3D_LICENSE_URL = "https://creativecommons.org/licenses/by/4.0/"
const BODYPARTS3D_LICENSE_PAGE = "https://dbarchive.biosciencedbc.jp/en/bodyparts3d/lic.html"
const BODYPARTS3D_API_DOCS = "https://lifesciencedb.jp/bp3d/info_en/webapi/index.html"
const BODYPARTS3D_PART_LIST = "https://dbarchive.biosciencedbc.jp/data/bodyparts3d/LATEST/isa_parts_list_e.txt"
const BODYPARTS3D_SKELETON_BACKGROUND_ID = "FMA5018"

const SERVIER_SOURCE = "servier-medical-art"
const SERVIER_ATTRIBUTION = "Image provided by Servier Medical Art (https://smart.servier.com/), licensed under CC BY 4.0."
const SERVIER_LICENSE_URL = "https://creativecommons.org/licenses/by/4.0/"
const SERVIER_LICENSE_PAGE = "https://smart.servier.com/using-smart-images-what-you-can-do/"
const SERVIER_CITATION_PAGE = "https://smart.servier.com/how-to-cite-servier-medical-art/"
const MEDIA_TYPE_IMAGE = "image" as const
const OPEN_REUSE = "open_reuse" as const
const REVIEWED = "reviewed" as const

type MediaEntityLinkSeed = {
  entityType: AnatomyEntityType
  entitySlug: string
  role: AnatomyMediaRole
  notes?: string
}

type BodyParts3dMediaSeed = {
  slug: string
  title: string
  description: string
  partIds: readonly string[]
  partNames: readonly string[]
  storagePath: string
  entityLinks: readonly MediaEntityLinkSeed[]
}

type ServierMediaSeed = {
  slug: string
  title: string
  description: string
  sourcePage: string
  sourceUrl: string
  storagePath: string
  entityLinks: readonly MediaEntityLinkSeed[]
}

function bodyParts3dImageUrl(partIds: readonly string[]): string {
  const config = {
    Common: {
      Version: "4.1",
      TreeName: "isa",
    },
    Window: {
      ImageWidth: 700,
      ImageHeight: 700,
    },
    Part: [
      {
        PartID: BODYPARTS3D_SKELETON_BACKGROUND_ID,
        PartOpacity: 0.15,
        UseForBoundingBoxFlag: false,
      },
      ...partIds.map((partId) => ({
        PartID: partId,
        PartColor: "D83A3A",
        PartOpacity: 1,
      })),
    ],
  }

  return `https://lifesciencedb.jp/bp3d/API/image?${encodeURIComponent(JSON.stringify(config))}`
}

const bodyParts3dMuscleImages: readonly BodyParts3dMediaSeed[] = [
  {
    slug: "bodyparts3d-biceps-brachii-anatomogram",
    title: "BodyParts3D Biceps Brachii Anatomogram",
    description: "Reviewed BodyParts3D 3D anatomogram render showing long and short heads of biceps brachii with low-opacity skeleton context.",
    partIds: ["FMA37682", "FMA37683"],
    partNames: ["short head of biceps brachii", "long head of biceps brachii"],
    storagePath: "anatomy/bodyparts3d/anatomograms/biceps-brachii.png",
    entityLinks: [
      { entityType: "muscle", entitySlug: "biceps-brachii", role: "primary", notes: "Overview render combines the modeled long and short heads of biceps brachii." },
    ],
  },
  {
    slug: "bodyparts3d-triceps-brachii-anatomogram",
    title: "BodyParts3D Triceps Brachii Anatomogram",
    description: "Reviewed BodyParts3D 3D anatomogram render showing long, medial, and lateral heads of triceps brachii.",
    partIds: ["FMA37692", "FMA37693", "FMA37694"],
    partNames: ["long head of triceps brachii", "medial head of triceps brachii", "lateral head of triceps brachii"],
    storagePath: "anatomy/bodyparts3d/anatomograms/triceps-brachii.png",
    entityLinks: [
      { entityType: "muscle", entitySlug: "triceps-brachii", role: "primary", notes: "Overview render combines the modeled heads of triceps brachii." },
    ],
  },
  {
    slug: "bodyparts3d-deltoid-anatomogram",
    title: "BodyParts3D Deltoid Anatomogram",
    description: "Reviewed BodyParts3D 3D anatomogram render showing clavicular, acromial, and spinal parts of deltoid.",
    partIds: ["FMA34677", "FMA34678", "FMA34679"],
    partNames: ["clavicular part of deltoid", "acromial part of deltoid", "spinal part of deltoid"],
    storagePath: "anatomy/bodyparts3d/anatomograms/deltoid.png",
    entityLinks: [
      { entityType: "muscle", entitySlug: "deltoid", role: "primary", notes: "Overview render combines the modeled deltoid parts." },
    ],
  },
  {
    slug: "bodyparts3d-upper-trapezius-anatomogram",
    title: "BodyParts3D Upper Trapezius Anatomogram",
    description: "Reviewed BodyParts3D 3D anatomogram render showing the descending part of trapezius as the upper trapezius region.",
    partIds: ["FMA32557"],
    partNames: ["descending part of trapezius"],
    storagePath: "anatomy/bodyparts3d/anatomograms/upper-trapezius.png",
    entityLinks: [
      { entityType: "muscle", entitySlug: "upper-trapezius", role: "primary", notes: "BodyParts3D uses descending part of trapezius for the modeled upper trapezius fibers." },
    ],
  },
  {
    slug: "bodyparts3d-middle-trapezius-anatomogram",
    title: "BodyParts3D Middle Trapezius Anatomogram",
    description: "Reviewed BodyParts3D 3D anatomogram render showing the transverse part of trapezius as the middle trapezius region.",
    partIds: ["FMA32556"],
    partNames: ["transverse part of trapezius"],
    storagePath: "anatomy/bodyparts3d/anatomograms/middle-trapezius.png",
    entityLinks: [
      { entityType: "muscle", entitySlug: "middle-trapezius", role: "primary", notes: "BodyParts3D uses transverse part of trapezius for the modeled middle trapezius fibers." },
    ],
  },
  {
    slug: "bodyparts3d-lower-trapezius-anatomogram",
    title: "BodyParts3D Lower Trapezius Anatomogram",
    description: "Reviewed BodyParts3D 3D anatomogram render showing the ascending part of trapezius as the lower trapezius region.",
    partIds: ["FMA32555"],
    partNames: ["ascending part of trapezius"],
    storagePath: "anatomy/bodyparts3d/anatomograms/lower-trapezius.png",
    entityLinks: [
      { entityType: "muscle", entitySlug: "lower-trapezius", role: "primary", notes: "BodyParts3D uses ascending part of trapezius for the modeled lower trapezius fibers." },
    ],
  },
  {
    slug: "bodyparts3d-sternocleidomastoid-anatomogram",
    title: "BodyParts3D Sternocleidomastoid Anatomogram",
    description: "Reviewed BodyParts3D 3D anatomogram render showing sternocleidomastoid with skeletal neck and thorax context.",
    partIds: ["FMA13407"],
    partNames: ["sternocleidomastoid"],
    storagePath: "anatomy/bodyparts3d/anatomograms/sternocleidomastoid.png",
    entityLinks: [
      { entityType: "muscle", entitySlug: "sternocleidomastoid", role: "primary", notes: "Primary sternocleidomastoid location render." },
    ],
  },
  {
    slug: "bodyparts3d-splenius-capitis-anatomogram",
    title: "BodyParts3D Splenius Capitis Anatomogram",
    description: "Reviewed BodyParts3D 3D anatomogram render showing splenius capitis with posterior neck context.",
    partIds: ["FMA22653"],
    partNames: ["splenius capitis"],
    storagePath: "anatomy/bodyparts3d/anatomograms/splenius-capitis.png",
    entityLinks: [
      { entityType: "muscle", entitySlug: "splenius-capitis", role: "primary", notes: "Posterior cervical muscle render for neck education." },
    ],
  },
  {
    slug: "bodyparts3d-splenius-cervicis-anatomogram",
    title: "BodyParts3D Splenius Cervicis Anatomogram",
    description: "Reviewed BodyParts3D 3D anatomogram render showing splenius cervicis with posterior neck context.",
    partIds: ["FMA22681"],
    partNames: ["splenius cervicis"],
    storagePath: "anatomy/bodyparts3d/anatomograms/splenius-cervicis.png",
    entityLinks: [
      { entityType: "muscle", entitySlug: "splenius-cervicis", role: "primary", notes: "Posterior cervical muscle render for neck education." },
    ],
  },
  {
    slug: "bodyparts3d-levator-scapulae-anatomogram",
    title: "BodyParts3D Levator Scapulae Anatomogram",
    description: "Reviewed BodyParts3D 3D anatomogram render showing levator scapulae with cervical and scapular context.",
    partIds: ["FMA32519"],
    partNames: ["levator scapulae"],
    storagePath: "anatomy/bodyparts3d/anatomograms/levator-scapulae.png",
    entityLinks: [
      { entityType: "muscle", entitySlug: "levator-scapulae", role: "primary", notes: "Primary levator scapulae location render." },
    ],
  },
  {
    slug: "bodyparts3d-rhomboid-major-anatomogram",
    title: "BodyParts3D Rhomboid Major Anatomogram",
    description: "Reviewed BodyParts3D 3D anatomogram render showing rhomboid major with scapular and thoracic context.",
    partIds: ["FMA13379"],
    partNames: ["rhomboid major"],
    storagePath: "anatomy/bodyparts3d/anatomograms/rhomboid-major.png",
    entityLinks: [
      { entityType: "muscle", entitySlug: "rhomboid-major", role: "primary", notes: "Primary rhomboid major location render." },
    ],
  },
  {
    slug: "bodyparts3d-rhomboid-minor-anatomogram",
    title: "BodyParts3D Rhomboid Minor Anatomogram",
    description: "Reviewed BodyParts3D 3D anatomogram render showing rhomboid minor with scapular and thoracic context.",
    partIds: ["FMA13380"],
    partNames: ["rhomboid minor"],
    storagePath: "anatomy/bodyparts3d/anatomograms/rhomboid-minor.png",
    entityLinks: [
      { entityType: "muscle", entitySlug: "rhomboid-minor", role: "primary", notes: "Primary rhomboid minor location render." },
    ],
  },
  {
    slug: "bodyparts3d-supraspinatus-anatomogram",
    title: "BodyParts3D Supraspinatus Anatomogram",
    description: "Reviewed BodyParts3D 3D anatomogram render showing supraspinatus with scapular and humeral context.",
    partIds: ["FMA9629"],
    partNames: ["supraspinatus"],
    storagePath: "anatomy/bodyparts3d/anatomograms/supraspinatus.png",
    entityLinks: [
      { entityType: "muscle", entitySlug: "supraspinatus", role: "primary", notes: "Rotator cuff muscle render for shoulder education." },
    ],
  },
  {
    slug: "bodyparts3d-infraspinatus-anatomogram",
    title: "BodyParts3D Infraspinatus Anatomogram",
    description: "Reviewed BodyParts3D 3D anatomogram render showing infraspinatus with scapular and humeral context.",
    partIds: ["FMA32546"],
    partNames: ["infraspinatus"],
    storagePath: "anatomy/bodyparts3d/anatomograms/infraspinatus.png",
    entityLinks: [
      { entityType: "muscle", entitySlug: "infraspinatus", role: "primary", notes: "Rotator cuff muscle render for shoulder education." },
    ],
  },
  {
    slug: "bodyparts3d-subscapularis-anatomogram",
    title: "BodyParts3D Subscapularis Anatomogram",
    description: "Reviewed BodyParts3D 3D anatomogram render showing subscapularis with scapular and humeral context.",
    partIds: ["FMA13413"],
    partNames: ["subscapularis"],
    storagePath: "anatomy/bodyparts3d/anatomograms/subscapularis.png",
    entityLinks: [
      { entityType: "muscle", entitySlug: "subscapularis", role: "primary", notes: "Rotator cuff muscle render for shoulder education." },
    ],
  },
  {
    slug: "bodyparts3d-teres-major-anatomogram",
    title: "BodyParts3D Teres Major Anatomogram",
    description: "Reviewed BodyParts3D 3D anatomogram render showing teres major with scapular and humeral context.",
    partIds: ["FMA32549"],
    partNames: ["teres major"],
    storagePath: "anatomy/bodyparts3d/anatomograms/teres-major.png",
    entityLinks: [
      { entityType: "muscle", entitySlug: "teres-major", role: "primary", notes: "Primary teres major location render." },
    ],
  },
  {
    slug: "bodyparts3d-teres-minor-anatomogram",
    title: "BodyParts3D Teres Minor Anatomogram",
    description: "Reviewed BodyParts3D 3D anatomogram render showing teres minor with scapular and humeral context.",
    partIds: ["FMA32550"],
    partNames: ["teres minor"],
    storagePath: "anatomy/bodyparts3d/anatomograms/teres-minor.png",
    entityLinks: [
      { entityType: "muscle", entitySlug: "teres-minor", role: "primary", notes: "Rotator cuff muscle render for shoulder education." },
    ],
  },
  {
    slug: "bodyparts3d-serratus-anterior-anatomogram",
    title: "BodyParts3D Serratus Anterior Anatomogram",
    description: "Reviewed BodyParts3D 3D anatomogram render showing serratus anterior with rib and scapular context.",
    partIds: ["FMA13397"],
    partNames: ["serratus anterior"],
    storagePath: "anatomy/bodyparts3d/anatomograms/serratus-anterior.png",
    entityLinks: [
      { entityType: "muscle", entitySlug: "serratus-anterior", role: "primary", notes: "Primary serratus anterior location render." },
    ],
  },
  {
    slug: "bodyparts3d-pectoralis-minor-anatomogram",
    title: "BodyParts3D Pectoralis Minor Anatomogram",
    description: "Reviewed BodyParts3D 3D anatomogram render showing pectoralis minor with thoracic and scapular context.",
    partIds: ["FMA13109"],
    partNames: ["pectoralis minor"],
    storagePath: "anatomy/bodyparts3d/anatomograms/pectoralis-minor.png",
    entityLinks: [
      { entityType: "muscle", entitySlug: "pectoralis-minor", role: "primary", notes: "Primary pectoralis minor location render." },
    ],
  },
  {
    slug: "bodyparts3d-pectoralis-major-clavicular-head-anatomogram",
    title: "BodyParts3D Pectoralis Major Clavicular Head Anatomogram",
    description: "Reviewed BodyParts3D 3D anatomogram render showing the clavicular part of pectoralis major.",
    partIds: ["FMA34687"],
    partNames: ["clavicular part of pectoralis major"],
    storagePath: "anatomy/bodyparts3d/anatomograms/pectoralis-major-clavicular-head.png",
    entityLinks: [
      { entityType: "muscle", entitySlug: "pectoralis-major-clavicular-head", role: "primary", notes: "BodyParts3D uses clavicular part of pectoralis major for this modeled head." },
    ],
  },
  {
    slug: "bodyparts3d-pectoralis-major-sternocostal-head-anatomogram",
    title: "BodyParts3D Pectoralis Major Sternocostal Head Anatomogram",
    description: "Reviewed BodyParts3D 3D anatomogram render showing the sternocostal part of pectoralis major.",
    partIds: ["FMA34696"],
    partNames: ["sternocostal part of pectoralis major"],
    storagePath: "anatomy/bodyparts3d/anatomograms/pectoralis-major-sternocostal-head.png",
    entityLinks: [
      { entityType: "muscle", entitySlug: "pectoralis-major-sternocostal-head", role: "primary", notes: "BodyParts3D uses sternocostal part of pectoralis major for this modeled head." },
    ],
  },
  {
    slug: "bodyparts3d-pectoralis-major-abdominal-head-anatomogram",
    title: "BodyParts3D Pectoralis Major Abdominal Head Anatomogram",
    description: "Reviewed BodyParts3D 3D anatomogram render showing the abdominal part of pectoralis major.",
    partIds: ["FMA34699"],
    partNames: ["abdominal part of pectoralis major"],
    storagePath: "anatomy/bodyparts3d/anatomograms/pectoralis-major-abdominal-head.png",
    entityLinks: [
      { entityType: "muscle", entitySlug: "pectoralis-major-abdominal-head", role: "primary", notes: "BodyParts3D uses abdominal part of pectoralis major for this modeled head." },
    ],
  },
  {
    slug: "bodyparts3d-brachialis-anatomogram",
    title: "BodyParts3D Brachialis Anatomogram",
    description: "Reviewed BodyParts3D 3D anatomogram render showing brachialis with upper-limb skeletal context.",
    partIds: ["FMA37667"],
    partNames: ["brachialis"],
    storagePath: "anatomy/bodyparts3d/anatomograms/brachialis.png",
    entityLinks: [
      { entityType: "muscle", entitySlug: "brachialis", role: "primary", notes: "Primary brachialis location render." },
    ],
  },
  {
    slug: "bodyparts3d-coracobrachialis-anatomogram",
    title: "BodyParts3D Coracobrachialis Anatomogram",
    description: "Reviewed BodyParts3D 3D anatomogram render showing coracobrachialis with shoulder and arm context.",
    partIds: ["FMA37664"],
    partNames: ["coracobrachialis"],
    storagePath: "anatomy/bodyparts3d/anatomograms/coracobrachialis.png",
    entityLinks: [
      { entityType: "muscle", entitySlug: "coracobrachialis", role: "primary", notes: "Primary coracobrachialis location render." },
    ],
  },
  {
    slug: "bodyparts3d-gluteus-maximus-anatomogram",
    title: "BodyParts3D Gluteus Maximus Anatomogram",
    description: "Reviewed BodyParts3D 3D anatomogram render showing gluteus maximus with pelvic and femoral context.",
    partIds: ["FMA22314"],
    partNames: ["gluteus maximus"],
    storagePath: "anatomy/bodyparts3d/anatomograms/gluteus-maximus.png",
    entityLinks: [
      { entityType: "muscle", entitySlug: "gluteus-maximus", role: "primary", notes: "Primary gluteus maximus location render." },
    ],
  },
  {
    slug: "bodyparts3d-gluteus-medius-anatomogram",
    title: "BodyParts3D Gluteus Medius Anatomogram",
    description: "Reviewed BodyParts3D 3D anatomogram render showing gluteus medius with pelvic and femoral context.",
    partIds: ["FMA22315"],
    partNames: ["gluteus medius"],
    storagePath: "anatomy/bodyparts3d/anatomograms/gluteus-medius.png",
    entityLinks: [
      { entityType: "muscle", entitySlug: "gluteus-medius", role: "primary", notes: "Primary gluteus medius location render." },
    ],
  },
  {
    slug: "bodyparts3d-gluteus-minimus-anatomogram",
    title: "BodyParts3D Gluteus Minimus Anatomogram",
    description: "Reviewed BodyParts3D 3D anatomogram render showing gluteus minimus with pelvic and femoral context.",
    partIds: ["FMA22317"],
    partNames: ["gluteus minimus"],
    storagePath: "anatomy/bodyparts3d/anatomograms/gluteus-minimus.png",
    entityLinks: [
      { entityType: "muscle", entitySlug: "gluteus-minimus", role: "primary", notes: "Primary gluteus minimus location render." },
    ],
  },
  {
    slug: "bodyparts3d-rectus-femoris-anatomogram",
    title: "BodyParts3D Rectus Femoris Anatomogram",
    description: "Reviewed BodyParts3D 3D anatomogram render showing rectus femoris with lower-limb skeletal context.",
    partIds: ["FMA22430"],
    partNames: ["rectus femoris"],
    storagePath: "anatomy/bodyparts3d/anatomograms/rectus-femoris.png",
    entityLinks: [
      { entityType: "muscle", entitySlug: "rectus-femoris", role: "primary", notes: "Primary rectus femoris location render." },
    ],
  },
  {
    slug: "bodyparts3d-vastus-lateralis-anatomogram",
    title: "BodyParts3D Vastus Lateralis Anatomogram",
    description: "Reviewed BodyParts3D 3D anatomogram render showing vastus lateralis with lower-limb skeletal context.",
    partIds: ["FMA22431"],
    partNames: ["vastus lateralis"],
    storagePath: "anatomy/bodyparts3d/anatomograms/vastus-lateralis.png",
    entityLinks: [
      { entityType: "muscle", entitySlug: "vastus-lateralis", role: "primary", notes: "Primary vastus lateralis location render." },
    ],
  },
  {
    slug: "bodyparts3d-vastus-medialis-anatomogram",
    title: "BodyParts3D Vastus Medialis Anatomogram",
    description: "Reviewed BodyParts3D 3D anatomogram render showing vastus medialis with lower-limb skeletal context.",
    partIds: ["FMA22432"],
    partNames: ["vastus medialis"],
    storagePath: "anatomy/bodyparts3d/anatomograms/vastus-medialis.png",
    entityLinks: [
      { entityType: "muscle", entitySlug: "vastus-medialis", role: "primary", notes: "Primary vastus medialis location render." },
    ],
  },
  {
    slug: "bodyparts3d-vastus-intermedius-anatomogram",
    title: "BodyParts3D Vastus Intermedius Anatomogram",
    description: "Reviewed BodyParts3D 3D anatomogram render showing vastus intermedius with lower-limb skeletal context.",
    partIds: ["FMA22433"],
    partNames: ["vastus intermedius"],
    storagePath: "anatomy/bodyparts3d/anatomograms/vastus-intermedius.png",
    entityLinks: [
      { entityType: "muscle", entitySlug: "vastus-intermedius", role: "primary", notes: "Primary vastus intermedius location render." },
    ],
  },
  {
    slug: "bodyparts3d-hamstrings-anatomogram",
    title: "BodyParts3D Hamstrings Anatomogram",
    description: "Reviewed BodyParts3D 3D anatomogram overview showing semitendinosus, semimembranosus, and long and short heads of biceps femoris.",
    partIds: ["FMA22357", "FMA22438", "FMA45887", "FMA45890"],
    partNames: ["semitendinosus", "semimembranosus", "long head of biceps femoris", "short head of biceps femoris"],
    storagePath: "anatomy/bodyparts3d/anatomograms/hamstrings.png",
    entityLinks: [
      { entityType: "muscle", entitySlug: "hamstrings", role: "primary", notes: "Overview/group image for the modeled hamstrings grouping." },
      { entityType: "muscle", entitySlug: "semitendinosus", role: "reference", notes: "Visible hamstrings component." },
      { entityType: "muscle", entitySlug: "semimembranosus", role: "reference", notes: "Visible hamstrings component." },
      { entityType: "muscle", entitySlug: "biceps-femoris", role: "reference", notes: "Visible hamstrings component." },
    ],
  },
  {
    slug: "bodyparts3d-semitendinosus-anatomogram",
    title: "BodyParts3D Semitendinosus Anatomogram",
    description: "Reviewed BodyParts3D 3D anatomogram render showing semitendinosus with posterior thigh context.",
    partIds: ["FMA22357"],
    partNames: ["semitendinosus"],
    storagePath: "anatomy/bodyparts3d/anatomograms/semitendinosus.png",
    entityLinks: [
      { entityType: "muscle", entitySlug: "semitendinosus", role: "primary", notes: "Primary semitendinosus location render." },
    ],
  },
  {
    slug: "bodyparts3d-semimembranosus-anatomogram",
    title: "BodyParts3D Semimembranosus Anatomogram",
    description: "Reviewed BodyParts3D 3D anatomogram render showing semimembranosus with posterior thigh context.",
    partIds: ["FMA22438"],
    partNames: ["semimembranosus"],
    storagePath: "anatomy/bodyparts3d/anatomograms/semimembranosus.png",
    entityLinks: [
      { entityType: "muscle", entitySlug: "semimembranosus", role: "primary", notes: "Primary semimembranosus location render." },
    ],
  },
  {
    slug: "bodyparts3d-biceps-femoris-anatomogram",
    title: "BodyParts3D Biceps Femoris Anatomogram",
    description: "Reviewed BodyParts3D 3D anatomogram render showing long and short heads of biceps femoris.",
    partIds: ["FMA45887", "FMA45890"],
    partNames: ["long head of biceps femoris", "short head of biceps femoris"],
    storagePath: "anatomy/bodyparts3d/anatomograms/biceps-femoris.png",
    entityLinks: [
      { entityType: "muscle", entitySlug: "biceps-femoris", role: "primary", notes: "Overview render combines the modeled biceps femoris heads." },
    ],
  },
  {
    slug: "bodyparts3d-gastrocnemius-anatomogram",
    title: "BodyParts3D Gastrocnemius Anatomogram",
    description: "Reviewed BodyParts3D 3D anatomogram render showing medial and lateral heads of gastrocnemius.",
    partIds: ["FMA45956", "FMA45959"],
    partNames: ["medial head of gastrocnemius", "lateral head of gastrocnemius"],
    storagePath: "anatomy/bodyparts3d/anatomograms/gastrocnemius.png",
    entityLinks: [
      { entityType: "muscle", entitySlug: "gastrocnemius", role: "primary", notes: "Overview render combines the modeled gastrocnemius heads." },
    ],
  },
  {
    slug: "bodyparts3d-soleus-anatomogram",
    title: "BodyParts3D Soleus Anatomogram",
    description: "Reviewed BodyParts3D 3D anatomogram render showing soleus with posterior leg context.",
    partIds: ["FMA22542"],
    partNames: ["soleus"],
    storagePath: "anatomy/bodyparts3d/anatomograms/soleus.png",
    entityLinks: [
      { entityType: "muscle", entitySlug: "soleus", role: "primary", notes: "Primary soleus location render." },
    ],
  },
  {
    slug: "bodyparts3d-tibialis-anterior-anatomogram",
    title: "BodyParts3D Tibialis Anterior Anatomogram",
    description: "Reviewed BodyParts3D 3D anatomogram render showing tibialis anterior with anterior leg context.",
    partIds: ["FMA22532"],
    partNames: ["tibialis anterior"],
    storagePath: "anatomy/bodyparts3d/anatomograms/tibialis-anterior.png",
    entityLinks: [
      { entityType: "muscle", entitySlug: "tibialis-anterior", role: "primary", notes: "Primary tibialis anterior location render." },
    ],
  },
  {
    slug: "bodyparts3d-fibularis-longus-anatomogram",
    title: "BodyParts3D Fibularis Longus Anatomogram",
    description: "Reviewed BodyParts3D 3D anatomogram render showing fibularis longus with lateral leg context.",
    partIds: ["FMA22539"],
    partNames: ["fibularis longus"],
    storagePath: "anatomy/bodyparts3d/anatomograms/fibularis-longus.png",
    entityLinks: [
      { entityType: "muscle", entitySlug: "fibularis-longus", role: "primary", notes: "Primary fibularis longus location render." },
    ],
  },
  {
    slug: "bodyparts3d-iliacus-anatomogram",
    title: "BodyParts3D Iliacus Anatomogram",
    description: "Reviewed BodyParts3D 3D anatomogram render showing iliacus with pelvic context.",
    partIds: ["FMA22310"],
    partNames: ["iliacus"],
    storagePath: "anatomy/bodyparts3d/anatomograms/iliacus.png",
    entityLinks: [
      { entityType: "muscle", entitySlug: "iliacus", role: "primary", notes: "Primary iliacus location render." },
    ],
  },
  {
    slug: "bodyparts3d-psoas-major-anatomogram",
    title: "BodyParts3D Psoas Major Anatomogram",
    description: "Reviewed BodyParts3D 3D anatomogram render showing psoas major with spine and pelvic context.",
    partIds: ["FMA18060"],
    partNames: ["psoas major"],
    storagePath: "anatomy/bodyparts3d/anatomograms/psoas-major.png",
    entityLinks: [
      { entityType: "muscle", entitySlug: "psoas-major", role: "primary", notes: "Primary psoas major location render." },
    ],
  },
  {
    slug: "bodyparts3d-external-oblique-anatomogram",
    title: "BodyParts3D External Oblique Anatomogram",
    description: "Reviewed BodyParts3D 3D anatomogram render showing external oblique with trunk context.",
    partIds: ["FMA13335"],
    partNames: ["external oblique"],
    storagePath: "anatomy/bodyparts3d/anatomograms/external-oblique.png",
    entityLinks: [
      { entityType: "muscle", entitySlug: "external-oblique", role: "primary", notes: "Primary external oblique location render." },
    ],
  },
] as const

const servierGapImages: readonly ServierMediaSeed[] = [
  {
    slug: "servier-eye-muscles-2d-illustration",
    title: "Servier Eye Muscles 2D Illustration",
    description: "Reviewed Servier Medical Art 2D extraocular muscle illustration for ocular movement education.",
    sourcePage: "https://smart.servier.com/smart_image/eye-muscles/",
    sourceUrl: "https://smart.servier.com/wp-content/uploads/2024/01/Eye-muscles.png",
    storagePath: "anatomy/servier/2d/eye-muscles.png",
    entityLinks: [
      { entityType: "joint", entitySlug: "ocular-functional-complex", role: "primary", notes: "Overview image for ocular movement muscle education." },
      { entityType: "muscle", entitySlug: "superior-rectus", role: "reference", notes: "Visible extraocular muscle." },
      { entityType: "muscle", entitySlug: "inferior-rectus", role: "reference", notes: "Visible extraocular muscle." },
      { entityType: "muscle", entitySlug: "medial-rectus", role: "reference", notes: "Visible extraocular muscle." },
      { entityType: "muscle", entitySlug: "lateral-rectus", role: "reference", notes: "Visible extraocular muscle." },
      { entityType: "muscle", entitySlug: "superior-oblique", role: "reference", notes: "Visible extraocular muscle." },
      { entityType: "muscle", entitySlug: "inferior-oblique", role: "reference", notes: "Visible extraocular muscle." },
    ],
  },
  {
    slug: "servier-paranasal-sinuses-2d-illustration",
    title: "Servier Paranasal Sinuses 2D Illustration",
    description: "Reviewed Servier Medical Art 2D paranasal sinus illustration linked to modeled nasal cavity and head-face anatomy.",
    sourcePage: "https://smart.servier.com/smart_image/paranasal-sinuses/",
    sourceUrl: "https://smart.servier.com/wp-content/uploads/2016/10/Sinus.png",
    storagePath: "anatomy/servier/2d/paranasal-sinuses.png",
    entityLinks: [
      { entityType: "anatomy_structure", entitySlug: "nasal-cavity", role: "primary", notes: "Overview image includes paranasal sinuses adjacent to the modeled nasal cavity." },
      { entityType: "region", entitySlug: "head-face-jaw", role: "region_context", notes: "Head and face context image." },
      { entityType: "anatomy_concept", entitySlug: "respiratory-system", role: "reference", notes: "Upper respiratory anatomy context." },
    ],
  },
  {
    slug: "servier-lymphatic-vessel-2d-illustration",
    title: "Servier Lymphatic Vessel 2D Illustration",
    description: "Reviewed Servier Medical Art 2D lymphatic vessel illustration for lymphatic drainage education.",
    sourcePage: "https://smart.servier.com/smart_image/lymphatic-circulation-4/",
    sourceUrl: "https://smart.servier.com/wp-content/uploads/2016/10/Vaisseau_lymphatique.png",
    storagePath: "anatomy/servier/2d/lymphatic-vessel.png",
    entityLinks: [
      { entityType: "anatomy_structure", entitySlug: "lymphatic-vessel", role: "primary", notes: "Primary 2D image for lymphatic vessel education." },
      { entityType: "anatomy_structure", entitySlug: "lymphatic-capillary", role: "reference", notes: "Lymphatic capillary drainage context." },
      { entityType: "anatomy_concept", entitySlug: "lymphatic-system", role: "client_education", notes: "Client-friendly lymphatic system image." },
    ],
  },
  {
    slug: "servier-healthy-bronchus-2d-illustration",
    title: "Servier Healthy Bronchus 2D Illustration",
    description: "Reviewed Servier Medical Art healthy bronchus cross-section illustration for respiratory anatomy education.",
    sourcePage: "https://smart.servier.com/smart_image/bronchi-section-ov/",
    sourceUrl: "https://smart.servier.com/wp-content/uploads/2016/10/bronche_saine.png",
    storagePath: "anatomy/servier/2d/healthy-bronchus.png",
    entityLinks: [
      { entityType: "anatomy_structure", entitySlug: "bronchus", role: "primary", notes: "Healthy bronchus section, not a pathology-specific image." },
      { entityType: "anatomy_concept", entitySlug: "respiratory-system", role: "reference", notes: "Respiratory-system airway context." },
    ],
  },
  {
    slug: "servier-capillary-cross-section-2d-illustration",
    title: "Servier Capillary Cross-Section 2D Illustration",
    description: "Reviewed Servier Medical Art 2D capillary cross-section illustration for microcirculation and vessel education.",
    sourcePage: "https://smart.servier.com/smart_image/capillary-cross-sectional/",
    sourceUrl: "https://smart.servier.com/wp-content/uploads/2016/10/vaisseau_28.png",
    storagePath: "anatomy/servier/2d/capillary-cross-section.png",
    entityLinks: [
      { entityType: "anatomy_structure", entitySlug: "capillary", role: "primary", notes: "Primary capillary structure image." },
      { entityType: "anatomy_structure", entitySlug: "blood-vessel", role: "reference", notes: "Blood-vessel structure context." },
      { entityType: "anatomy_concept", entitySlug: "cardiovascular-system", role: "reference", notes: "Cardiovascular-system context." },
    ],
  },
  {
    slug: "servier-vein-cross-section-2d-illustration",
    title: "Servier Vein Cross-Section 2D Illustration",
    description: "Reviewed Servier Medical Art 2D vein cross-section illustration for vessel wall and venous anatomy education.",
    sourcePage: "https://smart.servier.com/smart_image/vein-cross-sectional/",
    sourceUrl: "https://smart.servier.com/wp-content/uploads/2016/10/Veine_coupe.png",
    storagePath: "anatomy/servier/2d/vein-cross-section.png",
    entityLinks: [
      { entityType: "anatomy_structure", entitySlug: "vein", role: "primary", notes: "Primary vein structure image." },
      { entityType: "anatomy_structure", entitySlug: "blood-vessel", role: "reference", notes: "Blood-vessel structure context." },
      { entityType: "anatomy_concept", entitySlug: "venous-return", role: "client_education", notes: "Client-friendly venous return image." },
    ],
  },
  {
    slug: "servier-skeleton-cartilage-profile-2d-illustration",
    title: "Servier Skeleton and Cartilage Profile 2D Illustration",
    description: "Reviewed Servier Medical Art 2D profile skeleton and cartilage overview for skeletal and cartilage education.",
    sourcePage: "https://smart.servier.com/smart_image/skeleton-and-cartilage-profile/",
    sourceUrl: "https://smart.servier.com/wp-content/uploads/2016/10/squelette_05.png",
    storagePath: "anatomy/servier/2d/skeleton-cartilage-profile.png",
    entityLinks: [
      { entityType: "anatomy_structure", entitySlug: "articular-cartilage", role: "primary", notes: "Overview image includes skeletal cartilage regions; use as an orientation image, not a joint-specific cartilage diagram." },
      { entityType: "anatomy_concept", entitySlug: "musculoskeletal-system", role: "reference", notes: "Musculoskeletal-system overview context." },
      { entityType: "region", entitySlug: "trunk-spine-pelvis", role: "region_context", notes: "Whole-body skeletal orientation image." },
    ],
  },
  {
    slug: "servier-skeleton-cartilage-front-2d-illustration",
    title: "Servier Skeleton and Cartilage Front 2D Illustration",
    description: "Reviewed Servier Medical Art 2D anterior skeleton and cartilage overview for skeletal and cartilage education.",
    sourcePage: "https://smart.servier.com/smart_image/skeleton-and-cartilage-face/",
    sourceUrl: "https://smart.servier.com/wp-content/uploads/2016/10/squelette_01.png",
    storagePath: "anatomy/servier/2d/skeleton-cartilage-front.png",
    entityLinks: [
      { entityType: "anatomy_structure", entitySlug: "articular-cartilage", role: "primary", notes: "Overview image includes skeletal cartilage regions; use as an orientation image, not a joint-specific cartilage diagram." },
      { entityType: "anatomy_concept", entitySlug: "musculoskeletal-system", role: "reference", notes: "Musculoskeletal-system overview context." },
      { entityType: "region", entitySlug: "upper-limb", role: "region_context", notes: "Whole-body skeletal orientation image with visible upper-limb context." },
      { entityType: "region", entitySlug: "lower-limb", role: "region_context", notes: "Whole-body skeletal orientation image with visible lower-limb context." },
    ],
  },
] as const

export const MEDIA_COVERAGE_GAP_BATCH_SECTION = {
  mediaAssets: [
    ...bodyParts3dMuscleImages.map((asset) => ({
      id: `media-${asset.slug}`,
      slug: asset.slug,
      title: asset.title,
      mediaType: MEDIA_TYPE_IMAGE,
      description: asset.description,
      sourceRef: BODYPARTS3D_SOURCE,
      sourceUrl: bodyParts3dImageUrl(asset.partIds),
      storagePath: asset.storagePath,
      license: "CC BY 4.0",
      licenseUrl: BODYPARTS3D_LICENSE_URL,
      attribution: BODYPARTS3D_ATTRIBUTION,
      author: "Database Center for Life Science",
      usageScope: OPEN_REUSE,
      reviewStatus: REVIEWED,
      format: "png",
      metadata: {
        r2Upload: true,
        sourceKind: "bodyparts3d-anatomography-api-image",
        sourcePage: BODYPARTS3D_API_DOCS,
        partList: BODYPARTS3D_PART_LIST,
        bodyparts3dPartIds: asset.partIds,
        bodyparts3dPartNames: asset.partNames,
        backgroundPartId: BODYPARTS3D_SKELETON_BACKGROUND_ID,
        backgroundPartOpacity: 0.15,
        visualStyle: "3d-anatomogram-render",
        anatomogramVersion: "4.1",
        licenseVerifiedAt: "2026-05-26",
        licensePage: BODYPARTS3D_LICENSE_PAGE,
        ingestionStatus: "pending_r2_upload",
      },
    })),
    ...servierGapImages.map((asset) => ({
      id: `media-${asset.slug}`,
      slug: asset.slug,
      title: asset.title,
      mediaType: MEDIA_TYPE_IMAGE,
      description: asset.description,
      sourceRef: SERVIER_SOURCE,
      sourceUrl: asset.sourceUrl,
      storagePath: asset.storagePath,
      license: "CC BY 4.0",
      licenseUrl: SERVIER_LICENSE_URL,
      attribution: SERVIER_ATTRIBUTION,
      author: "Servier Medical Art",
      usageScope: OPEN_REUSE,
      reviewStatus: REVIEWED,
      format: "png",
      metadata: {
        r2Upload: true,
        sourceKind: "servier-2d-education-image",
        sourcePage: asset.sourcePage,
        licenseVerifiedAt: "2026-05-26",
        licensePage: SERVIER_LICENSE_PAGE,
        citationPage: SERVIER_CITATION_PAGE,
        visualStyle: "2d-medical-illustration",
        ingestionStatus: "pending_r2_upload",
      },
    })),
  ],
  mediaEntityLinks: [
    ...bodyParts3dMuscleImages.flatMap((asset) => asset.entityLinks.map((link) => ({
      id: `media-link-${asset.slug}-${link.entityType}-${link.entitySlug}-${link.role}`,
      assetSlug: asset.slug,
      entityType: link.entityType,
      entitySlug: link.entitySlug,
      role: link.role,
      notes: link.notes,
    }))),
    ...servierGapImages.flatMap((asset) => asset.entityLinks.map((link) => ({
      id: `media-link-${asset.slug}-${link.entityType}-${link.entitySlug}-${link.role}`,
      assetSlug: asset.slug,
      entityType: link.entityType,
      entitySlug: link.entitySlug,
      role: link.role,
      notes: link.notes,
    }))),
  ],
  citations: [
    ...bodyParts3dMuscleImages.flatMap((asset) => [
      {
        id: `citation-${asset.slug}-media-source`,
        slug: `citation-${asset.slug}-media-source`,
        entityType: asset.entityLinks[0].entityType,
        entitySlug: asset.entityLinks[0].entitySlug,
        factType: "media_source",
        factSlug: asset.slug,
        sourceRef: BODYPARTS3D_SOURCE,
        sourceLocator: bodyParts3dImageUrl(asset.partIds),
        citationNote: "BodyParts3D/Anatomography API image generated from reviewed FMA part IDs and selected for R2 ingestion with stored license, attribution, source URL, and upload path.",
        reviewStatus: REVIEWED,
      },
      {
        id: `citation-${asset.slug}-media-license`,
        slug: `citation-${asset.slug}-media-license`,
        entityType: asset.entityLinks[0].entityType,
        entitySlug: asset.entityLinks[0].entitySlug,
        factType: "media_license",
        factSlug: asset.slug,
        sourceRef: BODYPARTS3D_SOURCE,
        sourceLocator: BODYPARTS3D_LICENSE_PAGE,
        citationNote: "BodyParts3D official license page lists Creative Commons Attribution 4.0 International and required attribution wording.",
        reviewStatus: REVIEWED,
      },
    ]),
    ...servierGapImages.flatMap((asset) => [
      {
        id: `citation-${asset.slug}-media-source`,
        slug: `citation-${asset.slug}-media-source`,
        entityType: asset.entityLinks[0].entityType,
        entitySlug: asset.entityLinks[0].entitySlug,
        factType: "media_source",
        factSlug: asset.slug,
        sourceRef: SERVIER_SOURCE,
        sourceLocator: asset.sourcePage,
        citationNote: "Servier Medical Art image page selected for 2D education media ingestion with stored direct image URL, license, attribution, and R2 upload path.",
        reviewStatus: REVIEWED,
      },
      {
        id: `citation-${asset.slug}-media-license`,
        slug: `citation-${asset.slug}-media-license`,
        entityType: asset.entityLinks[0].entityType,
        entitySlug: asset.entityLinks[0].entitySlug,
        factType: "media_license",
        factSlug: asset.slug,
        sourceRef: SERVIER_SOURCE,
        sourceLocator: SERVIER_LICENSE_PAGE,
        citationNote: "Servier Medical Art states SMART images are available under CC BY 4.0 and provides attribution guidance for reuse.",
        reviewStatus: REVIEWED,
      },
    ]),
  ],
} satisfies AnatomySeedSection
