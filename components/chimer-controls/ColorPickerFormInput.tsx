"use client"

import { useState } from "react"

import { ColorPickerInput } from "@/components/chimer-controls/GlobalColorPicker"

export interface ColorPickerFormInputProps {
  id: string
  name: string
  label: string
  defaultValue: string
  disabled?: boolean
  required?: boolean
}

/** Keeps native form submission while using the shared controlled color picker UI. */
export function ColorPickerFormInput({
  id,
  name,
  label,
  defaultValue,
  disabled,
  required,
}: ColorPickerFormInputProps) {
  const [value, setValue] = useState(defaultValue)

  return (
    <>
      <input
        type="hidden"
        name={name}
        value={value}
        disabled={disabled}
        required={required}
      />
      <ColorPickerInput
        id={id}
        label={label}
        value={value}
        fallback={defaultValue}
        disabled={disabled}
        onValueChange={setValue}
      />
    </>
  )
}
