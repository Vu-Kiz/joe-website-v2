import React, { useRef, useState } from "react";
import BBCodeView from "./BBCodeView";

type ToolbarMode = "full" | "basic";

type Props = {
  value: string;
  onChange: (value: string) => void;
  rows?: number;
  showPreview?: boolean;
  toolbarMode?: ToolbarMode;
  spellCheck?: boolean;
  lang?: string;
};

const SIZE_OPTIONS = ["12px", "14px", "16px", "18px", "24px", "32px"];

const BBCodeEditor: React.FC<Props> = ({
  value,
  onChange,
  rows = 12,
  showPreview = true,
  toolbarMode = "full",
  spellCheck = false,
  lang,
}) => {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const [showColorTools, setShowColorTools] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [colorValue, setColorValue] = useState("#ff8800");
  const [sizeValue, setSizeValue] = useState("18px");

  const isBasic = toolbarMode === "basic";

  const wrapSelection = (openTag: string, closeTag: string) => {
    const el = textareaRef.current;
    if (!el) return;

    const start = el.selectionStart ?? 0;
    const end = el.selectionEnd ?? 0;
    const selected = value.slice(start, end);

    const next =
      value.slice(0, start) +
      openTag +
      selected +
      closeTag +
      value.slice(end);

    onChange(next);

    requestAnimationFrame(() => {
      el.focus();
      const cursorStart = start + openTag.length;
      const cursorEnd = cursorStart + selected.length;
      el.setSelectionRange(cursorStart, cursorEnd);
    });
  };

  const insertText = (text: string) => {
    const el = textareaRef.current;
    if (!el) return;

    const start = el.selectionStart ?? 0;
    const end = el.selectionEnd ?? 0;

    const next = value.slice(0, start) + text + value.slice(end);
    onChange(next);

    requestAnimationFrame(() => {
      el.focus();
      const pos = start + text.length;
      el.setSelectionRange(pos, pos);
    });
  };

  const insertLineWrapped = (
    openTag: string,
    closeTag: string,
    placeholder = ""
  ) => {
    const el = textareaRef.current;
    if (!el) return;

    const start = el.selectionStart ?? 0;
    const end = el.selectionEnd ?? 0;
    const selected = value.slice(start, end) || placeholder;

    const block = `${openTag}${selected}${closeTag}`;
    const next = value.slice(0, start) + block + value.slice(end);

    onChange(next);

    requestAnimationFrame(() => {
      el.focus();
      const selStart = start + openTag.length;
      const selEnd = selStart + selected.length;
      el.setSelectionRange(selStart, selEnd);
    });
  };

  const normalizeHex = (input: string): string | null => {
    const raw = input.trim();
    if (!raw) return null;

    const withHash = raw.startsWith("#") ? raw : `#${raw}`;
    if (
      /^#[0-9a-fA-F]{6}$/.test(withHash) ||
      /^#[0-9a-fA-F]{3}$/.test(withHash)
    ) {
      return withHash.toLowerCase();
    }

    return null;
  };

  const applyColor = () => {
    const hex = normalizeHex(colorValue);
    if (!hex) return;

    wrapSelection(`[color=${hex}]`, "[/color]");
    setShowColorTools(false);
  };

  const applySize = () => {
    wrapSelection(`[size=${sizeValue}]`, "[/size]");
  };

  const textarea = (
    <textarea
      ref={textareaRef}
      className="input bbcode-editor__textarea"
      rows={rows}
      value={value}
      spellCheck={spellCheck}
      lang={lang}
      autoCorrect={spellCheck ? "on" : "off"}
      autoCapitalize={spellCheck ? "sentences" : "off"}
      onChange={(e) => onChange(e.target.value)}
    />
  );

  return (
    <div className="bbcode-editor">
      <div className="bbcode-toolbar">
        <button
          type="button"
          className="btn btn--tiny bbcode-btn bbcode-btn--bold"
          title="Bold [b][/b]"
          onClick={() => wrapSelection("[b]", "[/b]")}
        >
          B
        </button>

        <button
          type="button"
          className="btn btn--tiny bbcode-btn bbcode-btn--italic"
          title="Italic [i][/i]"
          onClick={() => wrapSelection("[i]", "[/i]")}
        >
          I
        </button>

        <button
          type="button"
          className="btn btn--tiny bbcode-btn bbcode-btn--underline"
          title="Underline [u][/u]"
          onClick={() => wrapSelection("[u]", "[/u]")}
        >
          U
        </button>

        {!isBasic && (
          <button
            type="button"
            className="btn btn--tiny bbcode-btn bbcode-btn--strike"
            title="Strikethrough [s][/s]"
            onClick={() => wrapSelection("[s]", "[/s]")}
          >
            S
          </button>
        )}

        {!isBasic && (
          <button
            type="button"
            className="btn btn--tiny"
            title="Quote [quote][/quote]"
            onClick={() => insertLineWrapped("[quote]", "[/quote]", "Quoted text")}
          >
            “Quote”
          </button>
        )}

        {!isBasic && (
          <button
            type="button"
            className="btn btn--tiny"
            title="Code block [code][/code]"
            onClick={() => insertLineWrapped("[code]", "[/code]", "code here")}
          >
            {"</>"}
          </button>
        )}

        {!isBasic && (
          <button
            type="button"
            className="btn btn--tiny"
            title="Spoiler [spoiler][/spoiler]"
            onClick={() => insertLineWrapped("[spoiler]", "[/spoiler]", "spoiler")}
          >
            Spoiler
          </button>
        )}

        {!isBasic && (
          <button
            type="button"
            className="btn btn--tiny bbcode-btn bbcode-btn--center"
            title="Center [center][/center]"
            onClick={() => insertLineWrapped("[center]", "[/center]", "centered text")}
          >
            Center
          </button>
        )}

        {!isBasic && (
          <button
            type="button"
            className="btn btn--tiny"
            title="Horizontal rule [hr]"
            onClick={() => insertText("[hr]\n")}
          >
            ―
          </button>
        )}

        {!isBasic && (
          <button
            type="button"
            className="btn btn--tiny bbcode-btn bbcode-btn--link"
            title="Link [url=...][/url]"
            onClick={() =>
              insertLineWrapped("[url=https://example.com]", "[/url]", "link text")
            }
          >
            Link
          </button>
        )}

        {!isBasic && (
          <button
            type="button"
            className="btn btn--tiny"
            title="Image [img][/img]"
            onClick={() =>
              insertLineWrapped("[img]", "[/img]", "https://example.com/image.png")
            }
          >
            Img
          </button>
        )}

        <button
          type="button"
          className="btn btn--tiny bbcode-btn bbcode-btn--color"
          title="Colour [color=#xxxxxx][/color]"
          onClick={() => setShowColorTools((v) => !v)}
        >
          <span
            className="bbcode-btn__color-dot"
            style={{ backgroundColor: normalizeHex(colorValue) ?? "#ff8800" }}
          />
          Colour
        </button>

        <div className="bbcode-size-picker">
          <label className="small" htmlFor="bbcode-size-select">
            Size
          </label>
          <select
            id="bbcode-size-select"
            className="input bbcode-size-picker__select"
            value={sizeValue}
            onChange={(e) => setSizeValue(e.target.value)}
            title="Text size [size=x][/size]"
          >
            {SIZE_OPTIONS.map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>

          <button
            type="button"
            className="btn btn--tiny"
            onClick={applySize}
            title={`Apply size [size=${sizeValue}]`}
          >
            Apply Size
          </button>
        </div>

        <button
          type="button"
          className="btn btn--tiny"
          title="Show BBCode help"
          onClick={() => setShowHelp((v) => !v)}
        >
          Help
        </button>
      </div>

      {showColorTools && (
        <div className="bbcode-color-tools panel">
          <div className="bbcode-color-tools__row">
            <label className="small">Pick colour</label>
            <input
              type="color"
              value={normalizeHex(colorValue) ?? "#ff8800"}
              onChange={(e) => setColorValue(e.target.value)}
            />
          </div>

          <div className="bbcode-color-tools__row">
            <label className="small" htmlFor="bbcode-color-hex">
              Hex
            </label>
            <input
              id="bbcode-color-hex"
              type="text"
              className="input"
              value={colorValue}
              onChange={(e) => setColorValue(e.target.value)}
              placeholder="#ff8800"
            />
          </div>

          <div className="bbcode-color-tools__actions">
            <button
              type="button"
              className="btn btn--tiny"
              onClick={applyColor}
              disabled={!normalizeHex(colorValue)}
            >
              Apply Colour
            </button>

            <button
              type="button"
              className="btn btn--tiny"
              onClick={() => setShowColorTools(false)}
            >
              Cancel
            </button>
          </div>

          <div className="small">
            Wraps selected text as:{" "}
            <code>[color={normalizeHex(colorValue) ?? "#xxxxxx"}]...[/color]</code>
          </div>
        </div>
      )}

      {showHelp && (
        <div className="bbcode-help panel small">
          <div><strong>Supported BBCode</strong></div>

          {isBasic ? (
            <>
              <div>
                <code>[b]bold[/b]</code> <code>[i]italic[/i]</code>{" "}
                <code>[u]underline[/u]</code>
              </div>
              <div>
                <code>[color=#ff8800]colour[/color]</code>{" "}
                <code>[size=18px]size[/size]</code>
              </div>
            </>
          ) : (
            <>
              <div><code>[b]bold[/b]</code> <code>[i]italic[/i]</code> <code>[u]underline[/u]</code> <code>[s]strike[/s]</code></div>
              <div><code>[quote]quote[/quote]</code> <code>[code]code[/code]</code> <code>[spoiler]spoiler[/spoiler]</code></div>
              <div><code>[url=https://example.com]link[/url]</code> <code>[img]https://...[/img]</code></div>
              <div><code>[color=#ff8800]colour[/color]</code> <code>[size=18px]size[/size]</code></div>
              <div><code>[center]centered[/center]</code> <code>[hr]</code></div>
            </>
          )}
        </div>
      )}

      {textarea}

      {showPreview && (
        <div className="bbcode-editor__preview panel">
          <div className="small" style={{ marginBottom: "0.5rem", opacity: 0.8 }}>
            Preview
          </div>
          <BBCodeView value={value} className="small" />
        </div>
      )}
    </div>
  );
};

export default BBCodeEditor;
