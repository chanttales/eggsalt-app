import { Select } from "@/components/select";
import { DatePicker } from "@/components/date-picker";
import { inputClass } from "@/components/ui";
import { t, tOr } from "@/lib/i18n";
import type { FieldDef } from "@/lib/queries";

// One custom field (text, number, money, date, select, yes/no). Numbers and rupiah are whole
// numbers with thousand separators; dates are calendar days (YYYY-MM-DD).
export function FieldInput({
  def,
  value,
  onChange,
}: {
  def: FieldDef;
  value: unknown;
  onChange: (value: unknown) => void;
}) {
  const label = (
    <span>
      {def.label}
      {def.required && <span className="text-danger"> *</span>}
    </span>
  );

  if (def.type === "boolean") {
    return (
      <label className="flex min-h-touch items-center gap-3 text-label font-medium">
        <input
          type="checkbox"
          checked={value === true}
          onChange={(e) => onChange(e.target.checked)}
          className="size-5 accent-[var(--primary)]"
        />
        {label}
      </label>
    );
  }

  let control;
  if (def.type === "number" || def.type === "money") {
    const n = typeof value === "number" ? value : undefined;
    control = (
      <span className="flex items-center gap-2">
        {def.type === "money" && <span className="text-muted-foreground">Rp</span>}
        <input
          inputMode="numeric"
          value={n === undefined ? "" : n.toLocaleString("id-ID")}
          onChange={(e) => {
            const digits = e.target.value.replace(/\D/g, "");
            onChange(digits === "" ? undefined : Number(digits));
          }}
          className={inputClass}
        />
      </span>
    );
  } else if (def.type === "date") {
    control = (
      <DatePicker
        value={typeof value === "string" ? value.slice(0, 10) : undefined}
        onChange={onChange}
      />
    );
  } else if (def.type === "select") {
    control = (
      <Select
        value={typeof value === "string" ? value : ""}
        onChange={(v) => onChange(v || undefined)}
        options={[
          { value: "", label: t("field.choose") },
          ...def.options.map((o) => ({ value: o, label: tOr(`method.${o}`, o) })),
        ]}
      />
    );
  } else {
    control = (
      <input
        value={typeof value === "string" ? value : ""}
        onChange={(e) => onChange(e.target.value || undefined)}
        className={inputClass}
      />
    );
  }

  return (
    <label className="flex flex-col gap-1 text-label font-medium">
      {label}
      {control}
    </label>
  );
}

/** Shows a stored field value for reading. */
export function fieldText(def: FieldDef | undefined, value: unknown): string {
  if (value === undefined || value === null || value === "") return "–";
  if (def?.type === "money" && typeof value === "number")
    return `Rp ${value.toLocaleString("id-ID")}`;
  if (typeof value === "number") return value.toLocaleString("id-ID");
  if (typeof value === "boolean") return value ? t("field.yes") : t("field.no");
  return String(value);
}
