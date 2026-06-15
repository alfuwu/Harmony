interface RowProps {
  label: string;
  description?: string;
  disabled?: boolean;
  children: React.ReactNode;
}

export function SettingRow({ label, description, disabled = false, children }: RowProps) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: description ? "flex-start" : "center",
        justifyContent: "space-between",
        gap: 12,
        padding: "10px 0",
        opacity: disabled ? 0.45 : 1,
        transition: "opacity 120ms"
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 500, color: "var(--text-2)", lineHeight: 1.3 }}>
          {label}
        </div>
        {description && (
          <div style={{ fontSize: 12, color: "var(--text-4)", marginTop: 3, lineHeight: 1.5 }}>
            {description}
          </div>
        )}
      </div>
      <div style={{ flexShrink: 0 }}>{children}</div>
    </div>
  );
}

interface ToggleProps {
  label: string;
  description?: string;
  value: boolean;
  disabled?: boolean;
  onChange: (v: boolean) => void;
}

export function SettingToggle({ label, description, value, disabled = false, onChange }: ToggleProps) {
  return (
    <SettingRow label={label} description={description} disabled={disabled}>
      <Toggle value={value} disabled={disabled} onChange={onChange} />
    </SettingRow>
  );
}

interface ToggleWidgetProps {
  value: boolean;
  disabled?: boolean;
  onChange: (v: boolean) => void;
}

export function Toggle({ value, disabled = false, onChange }: ToggleWidgetProps) {
  return (
    <div
      onClick={() => !disabled && onChange(!value)}
      style={{
        width: 40,
        height: 22,
        borderRadius: 11,
        background: value ? "var(--accent-1)" : "var(--bg-4)",
        position: "relative",
        cursor: disabled ? "default" : "pointer",
        transition: "background 160ms",
        flexShrink: 0
      }}
    >
      <div
        style={{
          position: "absolute",
          top: 3,
          left: value ? 21 : 3,
          width: 16,
          height: 16,
          borderRadius: "50%",
          background: "#fff",
          boxShadow: "0 1px 3px rgba(0,0,0,0.35)",
          transition: "left 160ms cubic-bezier(0.34, 1.56, 0.64, 1)"
        }}
      />
    </div>
  );
}

interface SliderProps {
  label: string;
  description?: string;
  value: number;
  min?: number;
  max?: number;
  step?: number;
  disabled?: boolean;
  format?: (v: number) => string;
  onChange: (v: number) => void;
}

export function SettingSlider({
  label,
  description,
  value,
  min = 0,
  max = 100,
  step = 1,
  disabled = false,
  format = v => String(v),
  onChange
}: SliderProps) {
  return (
    <SettingRow label={label} description={description} disabled={disabled}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          disabled={disabled}
          onChange={e => onChange(Number(e.target.value))}
          style={{ width: 100, accentColor: "var(--accent-1)", cursor: disabled ? "default" : "pointer" }}
        />
        <span style={{ fontSize: 12, color: "var(--text-4)", minWidth: 36, textAlign: "right" }}>
          {format(value)}
        </span>
      </div>
    </SettingRow>
  );
}

interface SelectOption<T extends string | number> {
  value: T;
  label: string;
}

interface SelectProps<T extends string | number> {
  label: string;
  description?: string;
  value: T;
  options: SelectOption<T>[];
  disabled?: boolean;
  onChange: (v: T) => void;
}

export function SettingSelect<T extends string | number>({
  label,
  description,
  value,
  options,
  disabled = false,
  onChange
}: SelectProps<T>) {
  return (
    <SettingRow label={label} description={description} disabled={disabled}>
      <select
        value={String(value)}
        disabled={disabled}
        onChange={e => {
          const raw = e.target.value;
          const opt = options.find(o => String(o.value) === raw);
          if (opt != null)
            onChange(opt.value);
        }}
        style={{
          background: "var(--bg-1)",
          border: "1px solid var(--border)",
          borderRadius: 7,
          color: "var(--text-2)",
          fontSize: 13,
          padding: "5px 10px",
          cursor: disabled ? "default" : "pointer",
          minWidth: 120
        }}
      >
        {options.map(o => (
          <option key={String(o.value)} value={String(o.value)}>
            {o.label}
          </option>
        ))}
      </select>
    </SettingRow>
  );
}
