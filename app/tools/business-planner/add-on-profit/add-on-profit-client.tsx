"use client"

import { useEffect, useMemo, useState } from "react"
import { PackagePlus, Plus, RotateCcw, Trash2 } from "lucide-react"
import { AppPageShell, AppSurface, appCalloutClassName } from "@/components/ui/app-surface"
import { Button } from "@/components/ui/button"
import {
  calculateAddOnProfitPlan,
  normalizeAddOnProfitInput,
} from "@/lib/business-plan-template-tools"
import {
  MetricTile,
  NumberField,
  TextField,
  formatMoney,
  formatNumber,
} from "../_components/business-tool-fields"

type AddOnInput = ReturnType<typeof normalizeAddOnProfitInput>
type ProductItem = AddOnInput["products"][number]

const STORAGE_KEY = "massagelab-business-planner-add-on-profit-v1"

export function AddOnProfitClient() {
  const [input, setInput] = useState<AddOnInput>(() => normalizeAddOnProfitInput({}))
  const [storageReady, setStorageReady] = useState(false)
  const plan = useMemo(() => calculateAddOnProfitPlan(input), [input])

  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY)
    if (stored) {
      try {
        setInput(normalizeAddOnProfitInput(JSON.parse(stored)))
      } catch {
        window.localStorage.removeItem(STORAGE_KEY)
      }
    }
    setStorageReady(true)
  }, [])

  useEffect(() => {
    if (!storageReady) return

    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(input))
  }, [input, storageReady])

  function updateProduct(index: number, field: keyof ProductItem, value: string | number) {
    setInput((current) => normalizeAddOnProfitInput({
      products: current.products.map((product, productIndex) => (
        productIndex === index ? { ...product, [field]: value } : product
      )),
    }))
  }

  function addProduct() {
    setInput((current) => normalizeAddOnProfitInput({
      products: [
        ...current.products,
        { name: "Product or add-on", wholesaleCost: 0, retailPrice: 0, estimatedMonthlySales: 0 },
      ],
    }))
  }

  function removeProduct(index: number) {
    setInput((current) => normalizeAddOnProfitInput({
      products: current.products.filter((_, productIndex) => productIndex !== index),
    }))
  }

  function resetWorksheet() {
    setInput(normalizeAddOnProfitInput({}))
  }

  return (
    <AppPageShell width="full" contentClassName="gap-6">
      <AppSurface
        title="Add-On Profit Calculator"
        description="Estimate wholesale cost, retail price, expected sales, and yearly profit for products, upgrades, or service add-ons."
        icon={<PackagePlus className="h-5 w-5" aria-hidden="true" />}
        badge="Browser worksheet"
        className={appCalloutClassName}
      >
        <div className="grid gap-3 md:grid-cols-3">
          <MetricTile label="Monthly profit" value={formatMoney(plan.monthlyProfitTotal)} />
          <MetricTile label="Yearly profit" value={formatMoney(plan.yearlyProfitTotal)} />
          <MetricTile label="Average margin" value={plan.averageMarginPercent === null ? "Add price" : `${formatNumber(plan.averageMarginPercent)}%`} />
        </div>
      </AppSurface>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(20rem,0.8fr)]">
        <AppSurface
          title="Products and add-ons"
          description="Use the template's other-income section for retail, upgrades, or add-on services."
        >
          <div className="space-y-3">
            {input.products.map((product, index) => (
              <div key={`product-${index}`} className="grid gap-3 rounded-md border border-border/80 bg-background/70 p-3 md:grid-cols-[minmax(0,1fr)_8rem_8rem_8rem_auto] md:items-end">
                <TextField
                  id={`product-${index}-name`}
                  label="Name"
                  value={product.name}
                  onChange={(value) => updateProduct(index, "name", value)}
                />
                <NumberField
                  id={`product-${index}-wholesale`}
                  label="Wholesale"
                  value={product.wholesaleCost}
                  onChange={(value) => updateProduct(index, "wholesaleCost", value)}
                />
                <NumberField
                  id={`product-${index}-retail`}
                  label="Retail"
                  value={product.retailPrice}
                  onChange={(value) => updateProduct(index, "retailPrice", value)}
                />
                <NumberField
                  id={`product-${index}-sales`}
                  label="Monthly sales"
                  value={product.estimatedMonthlySales}
                  onChange={(value) => updateProduct(index, "estimatedMonthlySales", value)}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-10 w-10"
                  aria-label={`Remove ${product.name || "product"}`}
                  onClick={() => removeProduct(index)}
                  disabled={input.products.length <= 1}
                >
                  <Trash2 className="h-4 w-4" aria-hidden="true" />
                </Button>
              </div>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="secondary" onClick={addProduct}>
              <Plus className="mr-2 h-4 w-4" aria-hidden="true" />
              Add row
            </Button>
            <Button type="button" variant="secondary" onClick={resetWorksheet}>
              <RotateCcw className="mr-2 h-4 w-4" aria-hidden="true" />
              Reset worksheet
            </Button>
          </div>
        </AppSurface>

        <AppSurface
          title="Profit summary"
          description="Use this to decide whether an additional product or service is worth the space, money, and attention."
        >
          <div className="space-y-3">
            {plan.rows.map((row, index) => (
              <div key={`${row.name || "row"}-${index}`} className="rounded-md border border-border/80 bg-background/70 p-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium">{row.name}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {formatMoney(row.profitPerSale)} profit per sale
                    </p>
                  </div>
                  <p className="text-sm font-semibold">{formatMoney(row.yearlyProfit)} / year</p>
                </div>
              </div>
            ))}
          </div>
        </AppSurface>
      </div>
    </AppPageShell>
  )
}
