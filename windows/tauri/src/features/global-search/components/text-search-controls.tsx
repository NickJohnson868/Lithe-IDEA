import { useState, type RefObject } from "react";
import { useTranslation } from "@/i18n/locale-provider";
import { Button } from "@/ui/button";
import { MagnifyingGlassIcon, CaretDownIcon, FunnelIcon, PushPinIcon, XIcon } from "@/ui/icons";
import type { ContentSearchOptions } from "../types/global-search.types";

export interface TextSearchControlsProps {
  query: string;
  onQueryChange: (query: string) => void;
  options: ContentSearchOptions;
  onOptionChange: <Key extends keyof ContentSearchOptions>(
    key: Key,
    value: ContentSearchOptions[Key],
  ) => void;
  inputRef: RefObject<HTMLTextAreaElement | null>;
  multiline: boolean;
  onMultilineChange: (value: boolean) => void;
  history: string[];
  pinned: boolean;
  onPinnedChange: (value: boolean) => void;
  activeDescendant?: string;
}

export function TextSearchControls({
  query,
  onQueryChange,
  options,
  onOptionChange,
  inputRef,
  multiline,
  onMultilineChange,
  history,
  pinned,
  onPinnedChange,
  activeDescendant,
}: TextSearchControlsProps) {
  const { t } = useTranslation();
  const [mask, setMask] = useState(options.fileMask || "*.java");
  const [historyOpen, setHistoryOpen] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const focus = () => inputRef.current?.focus();
  const contexts = [
    "anywhere",
    "comments",
    "strings",
    "except-comments",
    "except-strings",
    "code",
  ] as const;
  return (
    <>
      <div className="flex flex-wrap items-center justify-end gap-2 pb-2 ui-text-sm">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={options.fileMask !== undefined}
            onChange={(event) =>
              onOptionChange("fileMask", event.target.checked ? mask : undefined)
            }
          />
          {t("textSearch.fileMask")}
        </label>
        <input
          aria-label={t("textSearch.fileMask")}
          list="text-search-masks"
          disabled={options.fileMask === undefined}
          value={mask}
          onChange={(event) => {
            setMask(event.target.value);
            onOptionChange("fileMask", event.target.value);
          }}
          className="w-36 rounded border border-border bg-surface px-2 py-1 disabled:opacity-40"
        />
        <datalist id="text-search-masks">
          {[
            "*.java",
            "*.xml",
            "*.yaml,*.yml",
            "*.ts,*.tsx",
            "*.js,*.jsx",
            "*.json",
            "*.properties",
            "!*.test.*",
          ].map((value) => (
            <option key={value} value={value} />
          ))}
        </datalist>
        <div className="relative">
          <Button
            size="icon-xs"
            variant="ghost"
            aria-label={t("textSearch.filter")}
            title={t("textSearch.filter")}
            aria-expanded={filterOpen}
            aria-pressed={options.context !== undefined && options.context !== "anywhere"}
            onClick={() => setFilterOpen(!filterOpen)}
          >
            <FunnelIcon />
          </Button>
          {filterOpen && (
            <div
              className="absolute right-0 top-full z-20 w-52 rounded border border-border bg-surface p-2 shadow-xl"
              role="group"
              aria-label={t("textSearch.filter")}
            >
              {contexts.map((context) => (
                <label
                  key={context}
                  className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 hover:bg-accent"
                >
                  <input
                    type="radio"
                    name="search-context"
                    checked={(options.context ?? "anywhere") === context}
                    onChange={() => {
                      onOptionChange("context", context);
                      setFilterOpen(false);
                      focus();
                    }}
                  />
                  {t(`textSearch.context.${context}`)}
                </label>
              ))}
            </div>
          )}
        </div>
        <Button
          size="icon-xs"
          variant="ghost"
          aria-label={t("textSearch.pin")}
          title={t("textSearch.pin")}
          aria-pressed={pinned}
          onClick={() => onPinnedChange(!pinned)}
          className={pinned ? "bg-selected text-primary" : undefined}
        >
          <PushPinIcon />
        </Button>
      </div>
      <div className="relative flex items-start gap-2 rounded-md border border-border bg-surface px-2 py-1 focus-within:border-primary focus-within:ring-1 focus-within:ring-primary">
        <Button
          size="icon-sm"
          variant="ghost"
          aria-label={t("textSearch.history")}
          title={`${t("textSearch.history")} (Alt+↓)`}
          aria-expanded={historyOpen}
          onClick={() => setHistoryOpen(!historyOpen)}
        >
          <MagnifyingGlassIcon />
          <CaretDownIcon className="size-2" />
        </Button>
        <textarea
          ref={inputRef}
          value={query}
          rows={multiline || query.includes("\n") ? 3 : 1}
          onChange={(event) => onQueryChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.altKey && !event.ctrlKey && event.key === "ArrowDown") {
              event.preventDefault();
              event.stopPropagation();
              setHistoryOpen(!historyOpen);
            }
            if (event.key === "Escape" && (historyOpen || filterOpen)) {
              event.preventDefault();
              event.stopPropagation();
              setHistoryOpen(false);
              setFilterOpen(false);
            }
          }}
          aria-label={t("textSearch.placeholder")}
          placeholder={t("textSearch.placeholder")}
          role="combobox"
          aria-expanded={true}
          aria-autocomplete="list"
          aria-controls="text-search-results"
          aria-activedescendant={activeDescendant}
          autoComplete="off"
          spellCheck={false}
          className="min-w-0 flex-1 resize-none bg-transparent py-1 outline-none ui-text-base"
        />
        <div className="flex shrink-0 items-center gap-0.5">
          <Button
            size="icon-sm"
            variant="ghost"
            title={t("textSearch.clear")}
            aria-label={t("textSearch.clear")}
            disabled={!query}
            onClick={() => {
              onQueryChange("");
              focus();
            }}
          >
            <XIcon />
          </Button>
          <Button
            size="icon-sm"
            variant="ghost"
            title={t("textSearch.multiline")}
            aria-label={t("textSearch.multiline")}
            aria-pressed={multiline}
            className={multiline ? "bg-selected" : undefined}
            onClick={() => {
              onMultilineChange(!multiline);
              focus();
            }}
          >
            ↵
          </Button>
          {(
            [
              ["caseSensitive", "Cc", "textSearch.caseSensitive"],
              ["wholeWord", "W", "textSearch.wholeWord"],
              ["useRegex", ".*", "textSearch.regex"],
            ] as const
          ).map(([key, label, title]) => (
            <Button
              key={key}
              size="icon-sm"
              variant="ghost"
              title={t(title)}
              aria-label={t(title)}
              aria-pressed={options[key]}
              className={options[key] ? "bg-selected text-primary" : undefined}
              onClick={() => {
                onOptionChange(key, !options[key]);
                focus();
              }}
            >
              {label}
            </Button>
          ))}
        </div>
        {historyOpen && (
          <div
            className="absolute left-0 right-0 top-full z-20 max-h-56 overflow-auto rounded border border-border bg-surface p-1 shadow-xl"
            role="group"
            aria-label={t("textSearch.history")}
          >
            {!history.length && (
              <p className="p-2 text-subtle-foreground">{t("textSearch.noHistory")}</p>
            )}
            {history.map((value) => (
              <button
                key={value}
                type="button"
                className="block w-full truncate rounded px-3 py-1.5 text-left hover:bg-selected"
                onClick={() => {
                  onQueryChange(value);
                  setHistoryOpen(false);
                  focus();
                }}
              >
                {value.replace(/\n/g, " ↵ ")}
              </button>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
