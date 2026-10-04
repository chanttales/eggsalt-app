"use client";

import * as Popover from "@radix-ui/react-popover";
import { CalendarDays } from "lucide-react";
import { useState, type ReactElement } from "react";
import { DayPicker } from "react-day-picker";
import { id } from "react-day-picker/locale";
import { inputClass } from "@/components/ui";
import { dayKey, longDate } from "@/lib/format";
import { t } from "@/lib/i18n";

// Date picker in the style of shadcn/ui: a calendar in a popover, the same on every phone.
// Values are calendar days (YYYY-MM-DD) in the business time zone.

const toDate = (day: string) => {
  const [y, m, d] = day.split("-").map(Number) as [number, number, number];
  return new Date(y, m - 1, d);
};
const toDay = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate(),
  ).padStart(2, "0")}`;

export function Calendar({
  value,
  onChange,
  max,
}: {
  value?: string;
  onChange: (day: string) => void;
  max?: string;
}) {
  const selected = value ? toDate(value) : undefined;
  return (
    <DayPicker
      mode="single"
      locale={id}
      weekStartsOn={1}
      selected={selected}
      defaultMonth={selected ?? toDate(dayKey())}
      today={toDate(dayKey())}
      onSelect={(date) => date && onChange(toDay(date))}
      disabled={max ? { after: toDate(max) } : undefined}
      endMonth={max ? toDate(max) : undefined}
      classNames={{
        root: "p-3",
        months: "relative",
        month: "flex flex-col gap-2",
        month_caption: "flex h-9 items-center justify-center",
        caption_label: "text-label font-semibold capitalize",
        nav: "absolute inset-x-0 top-0 flex h-9 items-center justify-between",
        button_previous:
          "grid size-9 place-items-center rounded-full text-muted-foreground disabled:opacity-30",
        button_next:
          "grid size-9 place-items-center rounded-full text-muted-foreground disabled:opacity-30",
        chevron: "size-5 fill-current",
        month_grid: "w-full border-collapse",
        weekdays: "flex",
        weekday: "w-10 text-caption font-medium text-muted-foreground capitalize",
        week: "mt-1 flex",
        day: "size-10 p-0 text-center",
        day_button:
          "grid size-10 place-items-center rounded-full text-body tabular-nums hover:bg-surface-muted",
        selected:
          "[&>button]:bg-primary [&>button]:font-semibold [&>button]:text-primary-foreground",
        today: "[&>button]:ring-2 [&>button]:ring-primary",
        outside: "text-muted-foreground opacity-40",
        disabled: "opacity-30 [&>button]:hover:bg-transparent",
        hidden: "invisible",
      }}
    />
  );
}

/**
 * A date field: shows the chosen day and opens the calendar. Pass `trigger` to open it from
 * another element (e.g. an icon button) instead of the default field.
 */
export function DatePicker({
  value,
  onChange,
  max,
  placeholder,
  trigger,
}: {
  value?: string;
  onChange: (day: string) => void;
  max?: string;
  placeholder?: string;
  trigger?: ReactElement;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        {trigger ?? (
          <button type="button" className={`${inputClass} flex items-center gap-2 text-left`}>
            <CalendarDays aria-hidden size={20} className="shrink-0 text-muted-foreground" />
            <span className={`truncate ${value ? "" : "text-muted-foreground"}`}>
              {value ? longDate(`${value}T12:00:00+07:00`) : (placeholder ?? t("date.choose"))}
            </span>
          </button>
        )}
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="start"
          sideOffset={6}
          collisionPadding={16}
          onKeyDown={(e) => e.key === "Escape" && e.stopPropagation()}
          className="z-[60] rounded-xl border border-border bg-surface shadow-lg"
        >
          <Calendar
            value={value}
            max={max}
            onChange={(day) => {
              onChange(day);
              setOpen(false);
            }}
          />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
