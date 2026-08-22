"use client";

import { CalendarDays } from "lucide-react";
import {
  type InputHTMLAttributes,
  useEffect,
  useRef,
  useState,
} from "react";

import { cn } from "@/lib/utils";

type DateInputProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "type" | "value" | "defaultValue" | "onChange" | "min" | "max"
> & {
  value: string;
  onChange: (value: string) => void;
  locale: "zh-CN" | "en-GB";
  min?: string;
  max?: string;
};

const ISO_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const FLEXIBLE_DATE_PATTERN = /^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/;

export function DateInput({
  value,
  onChange,
  locale,
  min,
  max,
  className,
  required,
  disabled,
  readOnly,
  "aria-label": ariaLabel,
  maxLength = 10,
  ...props
}: DateInputProps) {
  const [draft, setDraft] = useState(() => formatDateForDisplay(value));
  const [invalid, setInvalid] = useState(false);
  const textInputRef = useRef<HTMLInputElement>(null);
  const pickerInputRef = useRef<HTMLInputElement>(null);
  const lastCommittedValueRef = useRef(value);

  useEffect(() => {
    if (value === lastCommittedValueRef.current) return;
    lastCommittedValueRef.current = value;
    setDraft(formatDateForDisplay(value));
    setInvalid(false);
  }, [value]);

  const validationMessage =
    locale === "zh-CN"
      ? "请输入有效日期，例如 2001/01/01。"
      : "Enter a valid date, for example 2001/01/01.";

  function commitDraft() {
    const trimmed = draft.trim();
    if (!trimmed) {
      setInvalid(false);
      textInputRef.current?.setCustomValidity("");
      lastCommittedValueRef.current = "";
      onChange("");
      return;
    }

    const normalized = normalizeDateInput(trimmed);
    const withinRange =
      normalized && (!min || normalized >= min) && (!max || normalized <= max);
    if (!normalized || !withinRange) {
      setInvalid(true);
      textInputRef.current?.setCustomValidity(validationMessage);
      return;
    }

    setInvalid(false);
    textInputRef.current?.setCustomValidity("");
    lastCommittedValueRef.current = normalized;
    setDraft(formatDateForDisplay(normalized));
    onChange(normalized);
  }

  function openPicker() {
    const picker = pickerInputRef.current;
    if (!picker || disabled || readOnly) return;
    try {
      picker.showPicker();
    } catch {
      picker.click();
    }
  }

  return (
    <div className="relative w-full">
      <input
        {...props}
        ref={textInputRef}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        placeholder="YYYY/MM/DD"
        value={draft}
        required={required}
        disabled={disabled}
        readOnly={readOnly}
        aria-label={ariaLabel}
        maxLength={maxLength}
        aria-invalid={invalid || undefined}
        className={cn(className, "pr-10 tabular-nums", invalid && "border-rose-500")}
        onChange={(event) => {
          setDraft(event.target.value);
          setInvalid(false);
          event.target.setCustomValidity("");
        }}
        onBlur={commitDraft}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            commitDraft();
            textInputRef.current?.blur();
          }
        }}
      />
      <button
        type="button"
        aria-label={ariaLabel}
        title={ariaLabel}
        disabled={disabled || readOnly}
        className="absolute inset-y-0 right-0 grid w-10 place-items-center text-[var(--muted)] transition-colors hover:text-[var(--foreground)] disabled:cursor-not-allowed disabled:opacity-50"
        onClick={openPicker}
      >
        <CalendarDays className="size-4" />
      </button>
      <input
        ref={pickerInputRef}
        type="date"
        tabIndex={-1}
        aria-hidden="true"
        className="pointer-events-none absolute bottom-0 right-0 size-px opacity-0"
        value={normalizeDateInput(value) ?? ""}
        min={min}
        max={max}
        disabled={disabled || readOnly}
        onChange={(event) => {
          const nextValue = event.target.value;
          lastCommittedValueRef.current = nextValue;
          setDraft(formatDateForDisplay(nextValue));
          setInvalid(false);
          textInputRef.current?.setCustomValidity("");
          onChange(nextValue);
        }}
      />
    </div>
  );
}

export function normalizeDateInput(value: string | null | undefined) {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  const match = FLEXIBLE_DATE_PATTERN.exec(trimmed) ?? ISO_DATE_PATTERN.exec(trimmed);
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (year < 1 || month < 1 || month > 12 || day < 1) return null;
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  if (day > daysInMonth) return null;

  return `${match[1]}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function formatDateForDisplay(value: string) {
  const normalized = normalizeDateInput(value);
  return normalized ? normalized.replaceAll("-", "/") : value;
}
