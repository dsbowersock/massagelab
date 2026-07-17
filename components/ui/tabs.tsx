"use client"

import * as React from "react"
import * as TabsPrimitive from "@radix-ui/react-tabs"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const Tabs = TabsPrimitive.Root

const tabsListVariants = cva(
  "inline-flex items-center justify-center rounded-md p-1 text-muted-foreground",
  {
    variants: {
      variant: {
        default: "bg-muted",
        inset: "border border-border/80 bg-background/75 shadow-inner shadow-black/20",
      },
      density: {
        default: "h-10",
        compact: "h-9",
      },
      tone: {
        default: "",
        setup: "border-[#4AAAAA]/60",
        anatomime: "border-orange-500/50",
        attention: "border-fuchsia-500/50",
      },
    },
    defaultVariants: {
      variant: "default",
      density: "default",
      tone: "default",
    },
  },
)

const tabsTriggerVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded-sm text-sm font-medium ring-offset-background transition-[background-color,color,box-shadow,transform] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      density: {
        default: "px-3 py-1.5",
        compact: "px-2.5 py-1 text-xs",
      },
      tone: {
        default: "data-[state=active]:bg-[hsl(248_25%_40%)] data-[state=active]:text-white data-[state=active]:shadow-sm",
        setup: "data-[state=active]:bg-[#4AAAAA] data-[state=active]:text-white data-[state=active]:shadow-sm",
        anatomime: "data-[state=active]:bg-[hsl(var(--button-default-face))] data-[state=active]:text-white data-[state=active]:shadow-sm",
        attention: "data-[state=active]:bg-[hsl(var(--button-cta-face))] data-[state=active]:text-white data-[state=active]:shadow-sm",
      },
    },
    defaultVariants: {
      density: "default",
      tone: "default",
    },
  },
)

export interface TabsListProps
  extends React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>,
    VariantProps<typeof tabsListVariants> {}

const TabsList = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.List>,
  TabsListProps
>(({ className, variant, density, tone, ...props }, ref) => (
  <TabsPrimitive.List
    ref={ref}
    className={cn(tabsListVariants({ variant, density, tone, className }))}
    data-variant={variant ?? "default"}
    data-density={density ?? "default"}
    data-tone={tone ?? "default"}
    {...props}
  />
))
TabsList.displayName = TabsPrimitive.List.displayName

export interface TabsTriggerProps
  extends React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>,
    VariantProps<typeof tabsTriggerVariants> {}

const TabsTrigger = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Trigger>,
  TabsTriggerProps
>(({ className, density, tone, ...props }, ref) => (
  <TabsPrimitive.Trigger
    ref={ref}
    className={cn(tabsTriggerVariants({ density, tone, className }))}
    data-density={density ?? "default"}
    data-tone={tone ?? "default"}
    {...props}
  />
))
TabsTrigger.displayName = TabsPrimitive.Trigger.displayName

const TabsContent = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Content
    ref={ref}
    className={cn(
      "mt-2 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
      className,
    )}
    {...props}
  />
))
TabsContent.displayName = TabsPrimitive.Content.displayName

export { Tabs, TabsList, TabsTrigger, TabsContent, tabsListVariants, tabsTriggerVariants }
