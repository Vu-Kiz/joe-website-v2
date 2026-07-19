import React, { useRef, useState } from "react";
import BBCodeView from "./BBCodeView";
import { BTN_SM, INPUT} from "../../utils/ui";

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
    const next = value.slice(0, start) + openTag + selected + closeTag + value.slice(end);
    onChange(next);
    requestAnimationFrame(() => {
      el.focus();
      const cursorStart = start + openTag.length;
      el.setSelectionRange(cursorStart, cursorStart + selected.length);
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

  const insertLineWrapped = (openTag: string, closeTag: string, placeholder = "") => {
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
      el.setSelectionRange(selStart, selStart + selected.length);
    });
  };

  const normalizeHex = (input: string): string | null => {
    const raw = input.trim();
    if (!raw) return null;
    const withHash = raw.startsWith("#") ? raw : `#${raw}`;
    if (/^#[0-9a-fA-F]{6}$/.test(withHash) || /^#[0-9a-fA-F]{3}$/.test(withHash)) {
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

  const applySize = () => wrapSelection(`[size=${sizeValue}]`, "[/size]");

  const tinyCls = BTN_SM;

  const textarea = (
    <textarea
      ref={textareaRef}
      className={INPUT + " min-h-65 resize-y leading-normal py-[0.85rem]"}
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
    <div className="flex flex-col gap-3 font-tektur">
      {/* Toolbar */}
      <div className="flex flex-wrap gap-[0.4rem] items-center">
        <button type="button" className={`${tinyCls} font-bold`} title="Bold [b][/b]" onClick={() => wrapSelection("[b]", "[/b]")}>B</button>
        <button type="button" className={`${tinyCls} italic`} title="Italic [i][/i]" onClick={() => wrapSelection("[i]", "[/i]")}>I</button>
        <button type="button" className={`${tinyCls} underline`} title="Underline [u][/u]" onClick={() => wrapSelection("[u]", "[/u]")}>U</button>

        {!isBasic && (
          <button type="button" className={`${tinyCls} line-through`} title="Strikethrough [s][/s]" onClick={() => wrapSelection("[s]", "[/s]")}>S</button>
        )}
        {!isBasic && (
          <button type="button" className={tinyCls} title="Quote [quote][/quote]" onClick={() => insertLineWrapped("[quote]", "[/quote]", "Quoted text")}>"Quote"</button>
        )}
        {!isBasic && (
          <button type="button" className={tinyCls} title="Code block [code][/code]" onClick={() => insertLineWrapped("[code]", "[/code]", "code here")}>{"</>"}</button>
        )}
        {!isBasic && (
          <button type="button" className={tinyCls} title="Spoiler [spoiler][/spoiler]" onClick={() => insertLineWrapped("[spoiler]", "[/spoiler]", "spoiler")}>Spoiler</button>
        )}
        {!isBasic && (
          <button type="button" className={`${tinyCls} text-center`} title="Center [center][/center]" onClick={() => insertLineWrapped("[center]", "[/center]", "centered text")}>Center</button>
        )}
        {!isBasic && (
          <button type="button" className={tinyCls} title="Horizontal rule [hr]" onClick={() => insertText("[hr]\n")}>―</button>
        )}
        {!isBasic && (
          <button type="button" className={`${tinyCls} underline`} title="Link [url=...][/url]" onClick={() => insertLineWrapped("[url=https://example.com]", "[/url]", "link text")}>Link</button>
        )}
        {!isBasic && (
          <button type="button" className={tinyCls} title="Image [img][/img]" onClick={() => insertLineWrapped("[img]", "[/img]", "https://example.com/image.png")}>Img</button>
        )}

        <button
          type="button"
          className={`${tinyCls} inline-flex items-center gap-[0.35rem]`}
          title="Colour [color=#xxxxxx][/color]"
          onClick={() => setShowColorTools((v) => !v)}
        >
          <span
            className="w-2.5 h-2.5 rounded-full inline-block border border-white/40"
            style={{ backgroundColor: normalizeHex(colorValue) ?? "#ff8800" }}
          />
          Colour
        </button>

        <div className="inline-flex items-center gap-[0.35rem] flex-wrap">
          <label className="small" htmlFor="bbcode-size-select">Size</label>
          <select
            id="bbcode-size-select"
            className={INPUT + " w-auto min-w-22.5 py-1 px-[0.4rem] min-h-0"}
            value={sizeValue}
            onChange={(e) => setSizeValue(e.target.value)}
            title="Text size [size=x][/size]"
          >
            {SIZE_OPTIONS.map((size) => (
              <option key={size} value={size}>{size}</option>
            ))}
          </select>
          <button type="button" className={tinyCls} onClick={applySize} title={`Apply size [size=${sizeValue}]`}>Apply Size</button>
        </div>

        <button type="button" className={tinyCls} title="Show BBCode help" onClick={() => setShowHelp((v) => !v)}>Help</button>
      </div>

      {/* Colour tools */}
      {showColorTools && (
        <div className="panel flex flex-col gap-3 p-3">
          <div className="flex flex-col gap-1">
            <label className="small">Pick colour</label>
            <input type="color" value={normalizeHex(colorValue) ?? "#ff8800"} onChange={(e) => setColorValue(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1">
            <label className="small" htmlFor="bbcode-color-hex">Hex</label>
            <input id="bbcode-color-hex" type="text" className={INPUT} value={colorValue} onChange={(e) => setColorValue(e.target.value)} placeholder="#ff8800" />
          </div>
          <div className="flex gap-2 flex-wrap">
            <button type="button" className={tinyCls} onClick={applyColor} disabled={!normalizeHex(colorValue)}>Apply Colour</button>
            <button type="button" className={tinyCls} onClick={() => setShowColorTools(false)}>Cancel</button>
          </div>
          <div className="small">
            Wraps selected text as: <code>[color={normalizeHex(colorValue) ?? "#xxxxxx"}]...[/color]</code>
          </div>
        </div>
      )}

      {/* Help */}
      {showHelp && (
        <div className="panel small flex flex-col gap-[0.35rem] p-3">
          <div><strong>Supported BBCode</strong></div>
          {isBasic ? (
            <>
              <div><code>[b]bold[/b]</code> <code>[i]italic[/i]</code> <code>[u]underline[/u]</code></div>
              <div><code>[color=#ff8800]colour[/color]</code> <code>[size=18px]size[/size]</code></div>
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
        <div className="panel p-3">
          <div className="small mb-2 opacity-80">Preview</div>
          <BBCodeView value={value} className="small" />
        </div>
      )}
    </div>
  );
};

export default BBCodeEditor;
