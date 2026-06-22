// @ts-check

export const MASSAGELAB_SOCIAL_LINKS = Object.freeze([
  {
    id: "instagram",
    label: "Instagram",
    handle: "@massagelab",
    url: "https://www.instagram.com/massagelab/",
    description: "MassageLab photos, updates, and behind-the-scenes work.",
  },
  {
    id: "youtube",
    label: "YouTube",
    handle: "@massagelabtv",
    url: "https://www.youtube.com/@massagelabtv",
    description: "MassageLab demos, education clips, and video updates.",
  },
  {
    id: "facebook",
    label: "Facebook",
    handle: "@massagewithderrick",
    url: "https://www.facebook.com/massagewithderrick",
    description: "Derrick's massage practice updates and community posts.",
  },
])

export const MASSAGELAB_SOCIAL_URLS = Object.freeze(MASSAGELAB_SOCIAL_LINKS.map((link) => link.url))
