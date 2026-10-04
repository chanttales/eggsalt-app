"use client";

import * as RadixSelect from "@radix-ui/react-select";
import { Check, ChevronDown } from "lucide-react";
import { inputClass } from "@/components/ui";

// Dropdown in the style of shadcn/ui: a list in a popover, the same on every phone.
// An option may use "" (e.g. "no customer yet"); Radix reserves that for "nothing chosen",
// so it travels as a stand-in value.

const EMPTY = "__empty__";

export interface SelectOption {
  value: string;
  label: string;
}

export function Select({
  value,
  onChange,
  options,
  placeholder,
  ariaLabel,
}: {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  ariaLabel?: string;
}) {
  const hasEmpty = options.some((o) => o.value === "");
  const wrap = (v: string) => (v === "" && hasEmpty ? EMPTY : v);
  return (
    <RadixSelect.Root value={wrap(value)} onValueChange={(v) => onChange(v === EMPTY ? "" : v)}>
      <RadixSelect.Trigger
        aria-label={ariaLabel}
        className={`${inputClass} flex items-center justify-between gap-2 text-left data-[placeholder]:text-muted-foreground`}
      >
        <span className="truncate">
          <RadixSelect.Value placeholder={placeholder} />
        </span>
        <RadixSelect.Icon>
          <ChevronDown aria-hidden size={18} className="shrink-0 text-muted-foreground" />
        </RadixSelect.Icon>
      </RadixSelect.Trigger>
      <RadixSelect.Portal>
        <RadixSelect.Content
          position="popper"
          sideOffset={6}
          collisionPadding={16}
          className="z-[60] max-h-[min(var(--radix-select-content-available-height),20rem)] w-[var(--radix-select-trigger-width)] overflow-hidden rounded-xl border border-border bg-surface shadow-lg"
        >
          <RadixSelect.Viewport className="p-1">
            {options.map((o) => (
              <RadixSelect.Item
                key={o.value || EMPTY}
                value={wrap(o.value)}
                className="relative flex min-h-touch cursor-pointer items-center rounded-md py-2 pr-3 pl-8 text-body outline-none select-none data-[highlighted]:bg-surface-muted data-[state=checked]:font-semibold"
              >
                <RadixSelect.ItemIndicator className="absolute left-2 text-primary">
                  <Check aria-hidden size={16} />
                </RadixSelect.ItemIndicator>
                <RadixSelect.ItemText>{o.label}</RadixSelect.ItemText>
              </RadixSelect.Item>
            ))}
          </RadixSelect.Viewport>
        </RadixSelect.Content>
      </RadixSelect.Portal>
    </RadixSelect.Root>
  );
}
