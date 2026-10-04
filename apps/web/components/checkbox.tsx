"use client";

import * as RadixCheckbox from "@radix-ui/react-checkbox";
import * as RadixRadio from "@radix-ui/react-radio-group";
import * as RadixSwitch from "@radix-ui/react-switch";
import { Check } from "lucide-react";

// Checkbox, switch and radio in the style of shadcn/ui. Wrap each in a <label> with its text.

export function Checkbox({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <RadixCheckbox.Root
      checked={checked}
      onCheckedChange={(v) => onChange(v === true)}
      className="grid size-5 shrink-0 place-items-center rounded-md border-2 border-border bg-surface data-[state=checked]:border-primary data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground"
    >
      <RadixCheckbox.Indicator>
        <Check aria-hidden size={14} strokeWidth={3} />
      </RadixCheckbox.Indicator>
    </RadixCheckbox.Root>
  );
}

export function Switch({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <RadixSwitch.Root
      checked={checked}
      onCheckedChange={onChange}
      className="relative inline-flex h-6 w-11 shrink-0 items-center rounded-full bg-border transition-colors data-[state=checked]:bg-primary"
    >
      <RadixSwitch.Thumb className="block size-5 translate-x-0.5 rounded-full bg-surface shadow transition-transform data-[state=checked]:translate-x-[22px]" />
    </RadixSwitch.Root>
  );
}

/** One radio of a choice whose options sit apart on the page (e.g. "first stage" on each stage). */
export function Radio({
  value,
  selected,
  onSelect,
}: {
  value: string;
  selected: string;
  onSelect: (value: string) => void;
}) {
  return (
    <RadixRadio.Root value={selected} onValueChange={onSelect} className="flex">
      <RadixRadio.Item
        value={value}
        className="grid size-5 shrink-0 place-items-center rounded-full border-2 border-border bg-surface data-[state=checked]:border-primary"
      >
        <RadixRadio.Indicator className="size-2.5 rounded-full bg-primary" />
      </RadixRadio.Item>
    </RadixRadio.Root>
  );
}
