import type { MetadataRoute } from "next"
import { getRobotsRouteConfig } from "@/lib/seo"

export default function robots(): MetadataRoute.Robots {
  return getRobotsRouteConfig()
}
