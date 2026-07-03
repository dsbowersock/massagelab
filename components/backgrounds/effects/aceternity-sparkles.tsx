"use client"

import { useCallback, useId, useMemo, useState } from "react"
import Particles, { ParticlesProvider } from "@tsparticles/react"
import type { Container, Engine, ISourceOptions } from "@tsparticles/engine"
import { loadSlim } from "@tsparticles/slim"
import { cn } from "@/lib/utils"
import type { BackgroundEffectProps, SparklesBackgroundOptions } from "./css-backgrounds"
import styles from "@/components/backgrounds/BackgroundHost.module.css"

const DEFAULT_SPARKLES: Required<SparklesBackgroundOptions> = {
  maxSize: 2.8,
  minSize: 1,
  particleColor: "#EAF6FF",
  particleDensity: 84,
  speed: 2.2,
}

const initSparklesParticles = async (engine: Engine) => {
  await loadSlim(engine)
}

// Aceternity UI Sparkles by Manu Arora, adapted as an internal MassageLab premium visual effect.
export default function AceternitySparklesBackground({
  className,
  sparkles,
}: BackgroundEffectProps) {
  const generatedId = useId()
  const [hasLoaded, setHasLoaded] = useState(false)
  const sparklesMaxSize = sparkles?.maxSize
  const sparklesMinSize = sparkles?.minSize
  const sparklesParticleColor = sparkles?.particleColor
  const sparklesParticleDensity = sparkles?.particleDensity
  const sparklesSpeed = sparkles?.speed
  const resolved = useMemo(() => resolveSparklesOptions({
    maxSize: sparklesMaxSize,
    minSize: sparklesMinSize,
    particleColor: sparklesParticleColor,
    particleDensity: sparklesParticleDensity,
    speed: sparklesSpeed,
  }), [
    sparklesMaxSize,
    sparklesMinSize,
    sparklesParticleColor,
    sparklesParticleDensity,
    sparklesSpeed,
  ])
  const particleId = `ml-sparkles-${generatedId.replace(/[^a-zA-Z0-9_-]/g, "")}`
  const options = useMemo<ISourceOptions>(() => ({
    background: {
      color: {
        value: "transparent",
      },
    },
    detectRetina: true,
    fpsLimit: 45,
    fullScreen: {
      enable: false,
      zIndex: 0,
    },
    interactivity: {
      detectsOn: "canvas",
      events: {
        onClick: {
          enable: false,
        },
        onHover: {
          enable: false,
        },
        resize: {
          delay: 0.35,
          enable: true,
        },
      },
    },
    particles: {
      color: {
        value: resolved.particleColor,
      },
      links: {
        enable: false,
      },
      move: {
        direction: "none",
        enable: true,
        outModes: {
          default: "out",
        },
        random: false,
        speed: {
          min: 0.1,
          max: resolved.speed,
        },
        straight: false,
      },
      number: {
        density: {
          enable: true,
          height: 400,
          width: 400,
        },
        limit: {
          mode: "delete",
          value: 0,
        },
        value: resolved.particleDensity,
      },
      opacity: {
        animation: {
          count: 0,
          decay: 0,
          delay: 0,
          destroy: "none",
          enable: true,
          mode: "auto",
          speed: resolved.speed,
          startValue: "random",
          sync: false,
        },
        value: {
          min: 0.1,
          max: 1,
        },
      },
      shape: {
        type: "circle",
      },
      size: {
        animation: {
          enable: false,
        },
        value: {
          min: resolved.minSize,
          max: resolved.maxSize,
        },
      },
    },
    pauseOnBlur: true,
    pauseOnOutsideViewport: true,
  }), [resolved])

  const handleParticlesLoaded = useCallback(async (container?: Container) => {
    setHasLoaded(Boolean(container))
  }, [])

  return (
    <div
      className={cn(styles.effectLayer, styles.aceternitySparklesLayer, hasLoaded && styles.aceternitySparklesLoaded, className)}
      aria-hidden="true"
    >
      <ParticlesProvider init={initSparklesParticles}>
        <Particles
          id={particleId}
          className={styles.aceternitySparklesCanvas}
          options={options}
          particlesLoaded={handleParticlesLoaded}
        />
      </ParticlesProvider>
    </div>
  )
}

function resolveSparklesOptions(
  sparkles: SparklesBackgroundOptions | undefined,
): Required<SparklesBackgroundOptions> {
  const speed = clamp(Number(sparkles?.speed ?? DEFAULT_SPARKLES.speed), 0.4, 8)
  const density = clamp(Number(sparkles?.particleDensity ?? DEFAULT_SPARKLES.particleDensity), 20, 220)
  const maxSize = clamp(Number(sparkles?.maxSize ?? DEFAULT_SPARKLES.maxSize), 1, 6)
  const minSize = clamp(Number(sparkles?.minSize ?? DEFAULT_SPARKLES.minSize), 0.5, Math.max(0.75, maxSize))

  return {
    maxSize,
    minSize,
    particleColor: normalizeColor(sparkles?.particleColor, DEFAULT_SPARKLES.particleColor),
    particleDensity: Math.round(density),
    speed,
  }
}

function normalizeColor(value: string | undefined, fallback: string) {
  return typeof value === "string" && /^#[0-9a-fA-F]{6}$/.test(value) ? value : fallback
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, Number.isFinite(value) ? value : min))
}
