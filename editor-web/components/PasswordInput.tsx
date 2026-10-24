"use client";
import { useState } from "react";
import { Eye, EyeOff, Check } from "lucide-react";
import clsx from "clsx";

/**
 * Password field with a reveal toggle and, when `minLength` is set, a
 * live indicator. Typing into a box that silently rejects you at submit
 * time is the worst version of this, so the requirement is visible the
 * whole way and turns volt once it's met.
 */
export default function PasswordInput({
  value,
  onChange,
  label = "Password",
  autoComplete = "current-password",
  minLength,
  required = true,
}: {
  value: string;
  onChange: (v: string) => void;
  label?: string;
  autoComplete?: string;
  minLength?: number;
  required?: boolean;
}) {
  const [show, setShow] = useState(false);
  const met = minLength != null && value.length >= minLength;

  return (
    <div>
      <label className="text-mt text-xs font-semibold uppercase tracking-wide">{label}</label>
      <div className="relative mt-1">
        <input
          type={show ? "text" : "password"}
          autoComplete={autoComplete}
          className="input-select w-full pr-11"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          required={required}
          minLength={minLength}
        />
        <button
          type="button"
          onClick={() => setShow((s) => !s)}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-mt hover:text-white transition-colors"
          aria-label={show ? "Hide password" : "Show password"}
          tabIndex={-1}
        >
          {show ? <EyeOff size={17} /> : <Eye size={17} />}
        </button>
      </div>

      {minLength != null && (
        <div className="flex items-center gap-1.5 mt-1.5">
          <span
            className={clsx(
              "w-3.5 h-3.5 rounded-full flex items-center justify-center shrink-0 transition-colors",
              met ? "bg-volt2" : "bg-bd"
            )}
          >
            {met && <Check size={9} strokeWidth={4} className="text-bg" />}
          </span>
          <span className={clsx("text-[11px] transition-colors", met ? "text-volt2" : "text-mt")}>
            At least {minLength} characters
            {value.length > 0 && !met && ` (${value.length}/${minLength})`}
          </span>
        </div>
      )}
    </div>
  );
}
