import { Check, ChevronDown } from "lucide-react";
import { type KeyboardEvent, useEffect, useId, useMemo, useRef, useState } from "react";

type CustomSelectOption = {
  label: string;
  value: string;
};

type CustomSelectProps = {
  label: string;
  name?: string;
  options: Array<string | CustomSelectOption>;
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  className?: string;
};

function normalizeOption(option: string | CustomSelectOption): CustomSelectOption {
  return typeof option === "string" ? { label: option, value: option } : option;
}

export function CustomSelect({ label, name, options, value, defaultValue, onChange, className }: CustomSelectProps) {
  const selectId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const normalizedOptions = useMemo(() => options.map(normalizeOption), [options]);
  const fallbackValue = defaultValue ?? normalizedOptions[0]?.value ?? "";
  const [internalValue, setInternalValue] = useState(fallbackValue);
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(() => Math.max(0, normalizedOptions.findIndex((option) => option.value === fallbackValue)));

  const selectedValue = value ?? internalValue;
  const selectedIndex = Math.max(0, normalizedOptions.findIndex((option) => option.value === selectedValue));
  const selectedOption = normalizedOptions[selectedIndex] ?? normalizedOptions[0];

  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }

    function closeOnOutsideClick(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    function closeOnEscape(event: globalThis.KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    }

    document.addEventListener("pointerdown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);

    return () => {
      document.removeEventListener("pointerdown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) {
      setActiveIndex(selectedIndex);
    }
  }, [isOpen, selectedIndex]);

  function selectOption(nextValue: string) {
    if (value === undefined) {
      setInternalValue(nextValue);
    }

    onChange?.(nextValue);
    setIsOpen(false);
  }

  function onTriggerKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (!normalizedOptions.length) {
      return;
    }

    if (!isOpen && (event.key === "ArrowDown" || event.key === "ArrowUp" || event.key === "Enter" || event.key === " ")) {
      event.preventDefault();
      setIsOpen(true);
      setActiveIndex(selectedIndex);
      return;
    }

    if (isOpen && (event.key === "ArrowDown" || event.key === "ArrowUp")) {
      event.preventDefault();
      setActiveIndex((currentIndex) => {
        const direction = event.key === "ArrowDown" ? 1 : -1;
        return (currentIndex + direction + normalizedOptions.length) % normalizedOptions.length;
      });
      return;
    }

    if (isOpen && (event.key === "Home" || event.key === "End")) {
      event.preventDefault();
      setActiveIndex(event.key === "Home" ? 0 : normalizedOptions.length - 1);
      return;
    }

    if (isOpen && (event.key === "Enter" || event.key === " ")) {
      event.preventDefault();
      selectOption(normalizedOptions[activeIndex]?.value ?? selectedValue);
      return;
    }

    if (isOpen && event.key === "Escape") {
      event.preventDefault();
      setIsOpen(false);
    }
  }

  function onListKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (!normalizedOptions.length) {
      return;
    }

    if (event.key === "Escape") {
      event.preventDefault();
      setIsOpen(false);
      return;
    }

    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((currentIndex) => {
        const direction = event.key === "ArrowDown" ? 1 : -1;
        return (currentIndex + direction + normalizedOptions.length) % normalizedOptions.length;
      });
      return;
    }

    if (event.key === "Home" || event.key === "End") {
      event.preventDefault();
      setActiveIndex(event.key === "Home" ? 0 : normalizedOptions.length - 1);
      return;
    }

    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      selectOption(normalizedOptions[activeIndex]?.value ?? selectedValue);
    }
  }

  return (
    <div className={["custom-select", className].filter(Boolean).join(" ")} ref={rootRef}>
      {name && <input type="hidden" name={name} value={selectedValue} />}
      <span className="custom-select-label" id={`${selectId}-label`}>{label}</span>
      <button
        type="button"
        className="custom-select-trigger"
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        aria-labelledby={`${selectId}-label ${selectId}-value`}
        onClick={() => setIsOpen((current) => !current)}
        onKeyDown={onTriggerKeyDown}
      >
        <span id={`${selectId}-value`}>{selectedOption?.label}</span>
        <ChevronDown size={16} aria-hidden="true" />
      </button>
      {isOpen && (
        <div
          className="custom-select-menu"
          role="listbox"
          tabIndex={-1}
          aria-labelledby={`${selectId}-label`}
          onKeyDown={onListKeyDown}
        >
          {normalizedOptions.map((option, index) => {
            const isSelected = option.value === selectedValue;
            const isActive = index === activeIndex;

            return (
              <button
                key={option.value}
                type="button"
                role="option"
                aria-selected={isSelected}
                className={isActive ? "is-active" : undefined}
                onMouseEnter={() => setActiveIndex(index)}
                onClick={() => selectOption(option.value)}
              >
                <span>{option.label}</span>
                {isSelected && <Check size={15} aria-hidden="true" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
