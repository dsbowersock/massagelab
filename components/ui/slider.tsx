"use client"

import * as React from "react"
import * as SliderPrimitive from "@radix-ui/react-slider"

import { cn } from "@/lib/utils"

export interface SliderProps
  extends Omit<React.ComponentPropsWithoutRef<typeof SliderPrimitive.Root>, "style"> {
  trackClassName?: string
  rangeClassName?: string
  thumbClassName?: string
  splitThumbWidthRem?: number
  style?: SliderStyle
}

type SliderStyle = React.CSSProperties & {
  "--ml-slider-fill"?: string
  "--ml-slider-fill-shadow"?: string
  "--ml-slider-hue-color"?: string
  "--ml-slider-position"?: string
  "--ml-slider-thumb-center"?: string
  "--ml-slider-track-bg"?: string
}

function getSliderNumber(value: number[] | readonly number[] | undefined, fallback: number) {
  const firstValue = value?.[0]
  return typeof firstValue === "number" ? firstValue : fallback
}

function getSliderPercent(value: number, min: number, max: number) {
  if (max <= min) {
    return 0
  }

  return Math.min(100, Math.max(0, ((value - min) / (max - min)) * 100))
}

function getSliderSplitPosition(percent: number, thumbWidthRem: number) {
  const progress = percent / 100
  const thumbOffsetRem = (0.5 - progress) * thumbWidthRem

  return `calc(${percent}% + ${thumbOffsetRem.toFixed(4)}rem)`
}

const Slider = React.forwardRef<
  React.ElementRef<typeof SliderPrimitive.Root>,
  SliderProps
>(
  (
    {
      className,
      trackClassName,
      rangeClassName,
      thumbClassName,
      splitThumbWidthRem = 0.875,
      min = 0,
      max = 100,
      value,
      defaultValue,
      onValueChange,
      style,
      ...props
    },
    ref
  ) => {
    const isControlled = Array.isArray(value)
    const [localValue, setLocalValue] = React.useState(() => getSliderNumber(defaultValue, min))
    const currentValue = getSliderNumber(isControlled ? value : [localValue], min)
    const currentPercent = getSliderPercent(currentValue, min, max)
    const sliderStyle: SliderStyle = {
      ...style,
      "--ml-slider-position": getSliderSplitPosition(currentPercent, splitThumbWidthRem),
    }

    return (
      <SliderPrimitive.Root
        ref={ref}
        min={min}
        max={max}
        value={value}
        defaultValue={defaultValue}
        onValueChange={(nextValue) => {
          if (!isControlled) {
            setLocalValue(getSliderNumber(nextValue, min))
          }
          onValueChange?.(nextValue)
        }}
        style={sliderStyle}
        className={cn(
          "ml-slider relative flex w-full touch-none select-none items-center data-[disabled]:opacity-50",
          className
        )}
        {...props}
      >
        <SliderPrimitive.Track className={cn("ml-slider-track relative w-full grow overflow-hidden", trackClassName)}>
          <SliderPrimitive.Range className={cn("ml-slider-range absolute h-full", rangeClassName)} />
        </SliderPrimitive.Track>
        <SliderPrimitive.Thumb
          className={cn(
            "ml-slider-thumb block ring-offset-background transition-[background-color,border-color,box-shadow,filter,transform] focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50",
            thumbClassName
          )}
        />
      </SliderPrimitive.Root>
    )
  }
)
Slider.displayName = SliderPrimitive.Root.displayName

export { Slider }
