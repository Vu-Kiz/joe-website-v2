import React, { useEffect, useMemo, useState } from "react";
import DatePicker from "../common/DatePicker";
import type {
  ManualPaymentTemplate,
  ManualPaymentTemplateFormPayload,
  ManualPaymentTemplateOptionsResponse,
} from "../../api/payments/manualPayments";
import { BTN, INPUT, SELECT_INPUT } from "../../utils/ui";
import CreditInput, { parseCreditInput } from "../common/CreditInput";

const CARD_CLS = "flex flex-col gap-3 p-[0.9rem] rounded-[12px] border border-white/[0.08] bg-white/[0.03]";
const cardBadgeCls = (variant?: "ok" | "warn") =>
  "inline-flex items-center min-h-[28px] px-[0.65rem] py-1 rounded-full border font-bold" +
  (variant === "ok" ? " border-[rgba(107,201,137,0.35)] bg-[rgba(107,201,137,0.12)] text-[#8fe1a8]" :
   variant === "warn" ? " border-[rgba(255,155,50,0.35)] bg-[rgba(255,155,50,0.12)] text-[#ffbf73]" :
   " border-[rgba(245,213,70,0.28)] bg-[rgba(245,213,70,0.1)] text-[#f2c46f]");
const CARD_HEADER_SPLIT_CLS = "flex flex-row justify-between items-start gap-3 flex-wrap";
const CARD_TITLE_BLOCK_CLS = "flex flex-col gap-1";
const CARD_EYEBROW_CLS = "m-0 opacity-[0.72] uppercase tracking-[0.06em]";
const META_LIST_CLS = "grid gap-[0.35rem] [&_p]:m-0";
const noteCls = (variant?: "warn") =>
  "m-0 p-[0.65rem_0.8rem] rounded-[10px] border border-white/[0.08] bg-white/[0.025]" +
  (variant === "warn" ? " !border-[rgba(255,120,120,0.28)] !bg-[rgba(255,120,120,0.08)] !text-[#ffb3b3]" : "");
const ACTIONS_CLS = "flex gap-2 flex-wrap mt-1";
const TOOLBAR_CLS = "flex gap-3 flex-wrap items-end mb-4";
const FIELD_CLS = "grid gap-[0.4rem]";
const FIELD_COMPACT_CLS = FIELD_CLS + " w-[min(100%,420px)]";
const LABEL_WITH_HELP_CLS = "inline-flex items-center gap-[0.45rem] flex-wrap";
const HELP_CLS = "relative inline-flex items-center justify-center w-[18px] h-[18px] rounded-full border border-[rgba(245,213,70,0.35)] bg-[rgba(245,213,70,0.08)] text-[#f2c46f] text-[0.78rem] font-bold leading-none cursor-help outline-none group";
const HELP_TOOLTIP_CLS = "absolute left-0 top-[calc(100%+0.5rem)] z-[20] w-[min(260px,80vw)] p-[0.7rem_0.8rem] rounded-[10px] border border-[rgba(245,213,70,0.28)] bg-[rgba(12,12,12,0.96)] text-white/[0.86] shadow-[0_12px_28px_rgba(0,0,0,0.35)] opacity-0 translate-y-1 pointer-events-none transition-[opacity,transform] duration-[160ms] ease [&_strong]:text-[#f2c46f] group-hover:opacity-100 group-hover:translate-y-0 group-hover:pointer-events-auto group-focus-visible:opacity-100 group-focus-visible:translate-y-0 group-focus-visible:pointer-events-auto";
const FORM_GRID_CLS = "grid gap-3";
const FORM_SPLIT_CLS = "grid [grid-template-columns:repeat(2,minmax(0,1fr))] gap-3 max-[720px]:[grid-template-columns:1fr]";
const PAGINATION_CLS = "flex gap-3 items-center justify-start flex-wrap mt-4";
const PAGINATION_LABEL_CLS = "m-0 min-w-[88px]";

type Props = {
  templates?: ManualPaymentTemplate[];
  options?: ManualPaymentTemplateOptionsResponse["data"] | null;
  onCreateTemplate: (payload: ManualPaymentTemplateFormPayload) => Promise<void>;
  onToggleTemplate: (id: number) => Promise<void>;
  onGenerateTemplate: (id: number) => Promise<void>;
  onDeleteTemplate: (id: number) => Promise<void>;
  working?: boolean;
};

const todayIso = () => new Date().toISOString().slice(0, 10);
const defaultMonthlyDueDay = () => 1;

function formatOrdinalDay(day: number): string {
  const absDay = Math.abs(day);
  const mod100 = absDay % 100;

  if (mod100 >= 11 && mod100 <= 13) {
    return `${day}th`;
  }

  switch (absDay % 10) {
    case 1:
      return `${day}st`;
    case 2:
      return `${day}nd`;
    case 3:
      return `${day}rd`;
    default:
      return `${day}th`;
  }
}

const PaymentsTemplatesPanel = ({
  templates = [],
  options,
  onCreateTemplate,
  onToggleTemplate,
  onGenerateTemplate,
  onDeleteTemplate,
  working = false,
}: Props) => {
  const payerOptions = useMemo(() => options?.payer_options ?? [], [options?.payer_options]);
  const userOptions = options?.users ?? [];
  const defaultPayeeId = options?.default_payee?.id ?? userOptions[0]?.id ?? null;
  const defaultPayer = payerOptions[0] ?? null;

  const [name, setName] = useState("");
  const [payerKey, setPayerKey] = useState(defaultPayer?.key ?? "");
  const [payeeUserId, setPayeeUserId] = useState<string>(defaultPayeeId ? String(defaultPayeeId) : "");
  const [amount, setAmount] = useState("1");
  const [bonusAmount, setBonusAmount] = useState("0");
  const [dayOfMonth, setDayOfMonth] = useState(String(defaultMonthlyDueDay()));
  const [startDate, setStartDate] = useState(todayIso());
  const [communicationPrefix, setCommunicationPrefix] = useState("");
  const [notes, setNotes] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [templateQuery, setTemplateQuery] = useState("");
  const [templateFilterBy, setTemplateFilterBy] = useState("all");
  const [templateFilterValue, setTemplateFilterValue] = useState("all");
  const [templatePage, setTemplatePage] = useState(1);
  const templatePageSize = 6;

  const templateNameOptions = useMemo(
    () => Array.from(new Set(templates.map((template) => template.name).filter(Boolean))).sort((a, b) => a.localeCompare(b)),
    [templates]
  );

  const templatePayerOptions = useMemo(
    () => Array.from(new Set(templates.map((template) => template.payer_label ?? "Unknown"))).sort((a, b) => a.localeCompare(b)),
    [templates]
  );

  const templatePayeeOptions = useMemo(
    () => Array.from(new Set(templates.map((template) => template.payee_handle ?? template.payee_label ?? "Unknown"))).sort((a, b) => a.localeCompare(b)),
    [templates]
  );

  const templateStatusOptions = useMemo(
    () => Array.from(new Set(templates.map((template) => template.status).filter(Boolean))).sort((a, b) => a.localeCompare(b)),
    [templates]
  );

  const activeTemplateFilterOptions = useMemo(() => {
    switch (templateFilterBy) {
      case "name":
        return templateNameOptions;
      case "payer":
        return templatePayerOptions;
      case "payee":
        return templatePayeeOptions;
      case "status":
        return templateStatusOptions;
      default:
        return [];
    }
  }, [
    templateFilterBy,
    templateNameOptions,
    templatePayerOptions,
    templatePayeeOptions,
    templateStatusOptions,
  ]);

  const selectedPayer = useMemo(
    () => payerOptions.find((option) => option.key === payerKey) ?? defaultPayer,
    [defaultPayer, payerKey, payerOptions]
  );

  useEffect(() => {
    if (!payerKey && defaultPayer?.key) {
      setPayerKey(defaultPayer.key);
    }
  }, [defaultPayer, payerKey]);

  useEffect(() => {
    if (!payeeUserId && defaultPayeeId) {
      setPayeeUserId(String(defaultPayeeId));
    }
  }, [defaultPayeeId, payeeUserId]);

  const filteredTemplates = useMemo(() => {
    const needle = templateQuery.trim().toLowerCase();

    return templates.filter((template) => {
      if (templateFilterBy !== "all" && templateFilterValue !== "all") {
        const currentValue =
          templateFilterBy === "name"
            ? template.name
            : templateFilterBy === "payer"
              ? template.payer_label ?? "Unknown"
              : templateFilterBy === "payee"
                ? template.payee_handle ?? template.payee_label ?? "Unknown"
                : template.status;

        if (currentValue !== templateFilterValue) {
          return false;
        }
      }

      const haystack = [
        template.name,
        template.payer_label,
        template.payee_handle,
        template.payee_label,
        template.communication_prefix,
        template.notes,
        template.status,
        template.last_generated_period,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return needle ? haystack.includes(needle) : true;
    });
  }, [templateFilterBy, templateFilterValue, templateQuery, templates]);

  const templateTotalPages = Math.max(1, Math.ceil(filteredTemplates.length / templatePageSize));
  const pagedTemplates = filteredTemplates.slice((templatePage - 1) * templatePageSize, templatePage * templatePageSize);

  useEffect(() => {
    setTemplatePage(1);
  }, [templateFilterBy, templateFilterValue, templateQuery]);

  useEffect(() => {
    setTemplateFilterValue("all");
  }, [templateFilterBy]);

  useEffect(() => {
    if (templatePage > templateTotalPages) {
      setTemplatePage(templateTotalPages);
    }
  }, [templatePage, templateTotalPages]);

  async function handleCreateTemplate(e: React.FormEvent) {
    e.preventDefault();

    if (!selectedPayer?.payer_subject_id) {
      setFormError("Choose a payer.");
      return;
    }

    if (!payeeUserId) {
      setFormError("Choose a payee.");
      return;
    }

    const parsedAmount = parseCreditInput(amount);
    const parsedBonusAmount = parseCreditInput(bonusAmount || "0");
    const parsedDayOfMonth = Number(dayOfMonth);

    if (!Number.isFinite(parsedAmount) || parsedAmount < 0) {
      setFormError("Amount must be 0 or greater.");
      return;
    }

    if (!Number.isFinite(parsedBonusAmount) || parsedBonusAmount < 0) {
      setFormError("Bonus amount must be 0 or greater.");
      return;
    }

    if (!Number.isFinite(parsedDayOfMonth) || parsedDayOfMonth < 1 || parsedDayOfMonth > 31) {
      setFormError("Day of month must be between 1 and 31.");
      return;
    }

    const trimmedName = name.trim();
    if (!trimmedName) {
      setFormError("Name is required.");
      return;
    }

    setFormError(null);

    await onCreateTemplate({
      name: trimmedName,
      payer_subject_type: selectedPayer.payer_subject_type,
      payer_subject_id: selectedPayer.payer_subject_id,
      payee_subject_type: "user",
      payee_subject_id: Number(payeeUserId),
      amount: parsedAmount,
      bonus_amount: parsedBonusAmount,
      frequency: "monthly",
      day_of_month: parsedDayOfMonth,
      start_date: startDate,
      communication_prefix: communicationPrefix.trim() || null,
      notes: notes.trim() || null,
      status: "active",
    });

    setName("");
    setAmount("1");
    setBonusAmount("0");
    setDayOfMonth(String(defaultMonthlyDueDay()));
    setStartDate(todayIso());
    setCommunicationPrefix("");
    setNotes("");
  }

  return (
    <div className="panel">
      <h2 className="h2">Manual Templates</h2>
      <p className="small mb-4 max-w-[68ch]">
        Create recurring manual payment items inside the live Payments system so they can be opened,
        synced against SWC, and verified like any other transfer.
      </p>

      <div className={CARD_CLS}>
        <strong>Create Manual Payment Template</strong>

        <form onSubmit={handleCreateTemplate} className="mt-3">
          <div className={FORM_GRID_CLS}>
            <label className={"small " + FIELD_CLS}>
              <strong>Template Name</strong>
              <input
                className={INPUT}
                type="text"
                placeholder="Monthly logistics payment"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </label>

            <label className={"small " + FIELD_CLS}>
              <strong>Payer</strong>
              <select
                className={INPUT}
                value={payerKey}
                onChange={(e) => setPayerKey(e.target.value)}
              >
                {payerOptions.map((option) => (
                  <option key={option.key} value={option.key}>
                    {option.label}
                  </option>
                ))}
              </select>
              <span>Only payers that passed the backend payment permission check are shown here.</span>
            </label>

            <label className={"small " + FIELD_CLS}>
              <strong>Payee</strong>
              <select
                className={INPUT}
                value={payeeUserId}
                onChange={(e) => setPayeeUserId(e.target.value)}
              >
                <option value="">Choose payee</option>
                {userOptions.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.handle ?? `User #${user.id}`}
                  </option>
                ))}
              </select>
              <span>The JOE member who should receive the payment.</span>
            </label>

            <div className={FORM_SPLIT_CLS}>
              <label className={"small " + FIELD_CLS}>
                <strong>Base Amount</strong>
                <CreditInput className={INPUT} value={amount} onChange={setAmount} placeholder="e.g. 1,000,000" />
              </label>

              <label className={"small " + FIELD_CLS}>
                <strong>Bonus Amount</strong>
                <CreditInput className={INPUT} value={bonusAmount} onChange={setBonusAmount} placeholder="e.g. 500,000" />
              </label>
            </div>

            <div className={FORM_SPLIT_CLS}>
              <label className={"small " + FIELD_CLS}>
                <span className={LABEL_WITH_HELP_CLS}>
                  <strong>Monthly Due Day</strong>
                  <span className={HELP_CLS} tabIndex={0} aria-label="Monthly due day help">
                    ?
                    <span className={HELP_TOOLTIP_CLS}>
                      Pick the day this payment should be generated each month. Use <strong>1</strong> for the 1st of the month. The <strong>Start Date</strong> is when the template becomes active, and the due day controls which day of that month it should generate.
                    </span>
                  </span>
                </span>
                <input
                  className={INPUT}
                  type="number"
                  min="1"
                  max="31"
                  value={dayOfMonth}
                  onChange={(e) => setDayOfMonth(e.target.value)}
                  placeholder="Day of month"
                />
              </label>

              <label className={"small " + FIELD_CLS}>
                <strong>Start Date</strong>
                <DatePicker
                  id="payments-template-start-date"
                  value={startDate}
                  onChange={setStartDate}
                  placeholder="Choose start date"
                />
              </label>
            </div>

            <label className={"small " + FIELD_CLS}>
              <strong>Communication Prefix</strong>
              <input
                className={INPUT}
                type="text"
                placeholder="Monthly payment"
                value={communicationPrefix}
                onChange={(e) => setCommunicationPrefix(e.target.value)}
              />
              <span>This text appears before the `JOE-XFER-...` reference when the payment link is generated.</span>
            </label>

            <label className={"small " + FIELD_CLS}>
              <strong>Internal Notes</strong>
              <textarea
                className={INPUT}
                placeholder="What this template is for"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                style={{ minHeight: 90 }}
              />
            </label>
          </div>

          {formError && (
            <p className={"small " + noteCls("warn")}>
              {formError}
            </p>
          )}

          <div className={ACTIONS_CLS}>
            <button className={BTN} type="submit" disabled={working}>
              {working ? "Saving..." : "Create Template"}
            </button>
          </div>
        </form>
      </div>

      {templates.length === 0 ? (
        <p className="small">No manual templates yet.</p>
      ) : (
        <>
          <div className={TOOLBAR_CLS}>
            <label className={"small " + FIELD_COMPACT_CLS}>
              <strong>Search Templates</strong>
              <input
                className={INPUT + " rounded-full pl-4"}
                type="search"
                placeholder="Search template, payer, payee, or communication"
                value={templateQuery}
                onChange={(e) => setTemplateQuery(e.target.value)}
              />
            </label>

            <label className={"small " + FIELD_COMPACT_CLS}>
              <strong>Filter By</strong>
              <select className={SELECT_INPUT} value={templateFilterBy} onChange={(e) => setTemplateFilterBy(e.target.value)}>
                <option value="all">Everything</option>
                <option value="name">Name</option>
                <option value="payer">Payer</option>
                <option value="payee">Payee</option>
                <option value="status">Status</option>
              </select>
            </label>

            {templateFilterBy !== "all" && (
              <label className={"small " + FIELD_COMPACT_CLS}>
                <strong>Value</strong>
                <select className={SELECT_INPUT} value={templateFilterValue} onChange={(e) => setTemplateFilterValue(e.target.value)}>
                  <option value="all">All {templateFilterBy}s</option>
                  {activeTemplateFilterOptions.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </label>
            )}

            {(templateQuery || templateFilterBy !== "all" || templateFilterValue !== "all") && (
              <label className={"small " + FIELD_COMPACT_CLS}>
                <strong>Quick Reset</strong>
                <button
                  className={BTN}
                  type="button"
                  onClick={() => {
                    setTemplateQuery("");
                    setTemplateFilterBy("all");
                    setTemplateFilterValue("all");
                  }}
                >
                  Clear Filters
                </button>
              </label>
            )}
          </div>

          <p className="small mb-4 opacity-[0.85]">
            Showing {pagedTemplates.length} of {filteredTemplates.length} template{filteredTemplates.length === 1 ? "" : "s"}.
          </p>

          {pagedTemplates.length === 0 && (
            <p className="small">No templates matched your search.</p>
          )}

          {pagedTemplates.map((template) => (
            <div key={template.id} className={CARD_CLS}>
              <div className={CARD_HEADER_SPLIT_CLS}>
                <div className={CARD_TITLE_BLOCK_CLS}>
                  <p className={"small " + CARD_EYEBROW_CLS}>Template</p>
                  <strong>{template.name}</strong>
                </div>
                <span className={"small " + cardBadgeCls(template.status === "active" ? "ok" : "warn")}>
                  {template.status}
                </span>
              </div>
              <div className={META_LIST_CLS}>
                <p className="small">
                  <strong>Payer:</strong> {template.payer_label ?? "Unknown"}
                </p>
                <p className="small">
                  <strong>Payee:</strong> {template.payee_handle ?? template.payee_label ?? "Unknown"}
                </p>
                <p className="small">
                  <strong>Total:</strong> {template.total_amount.toLocaleString()}
                </p>
                <p className="small">
                  <strong>Schedule:</strong> Monthly on the {formatOrdinalDay(template.day_of_month)} · Start: {template.start_date}
                  {template.end_date ? ` · End: ${template.end_date}` : ""}
                </p>
              </div>
              {template.communication_prefix && (
                <p className={"small " + noteCls()}>Communication prefix: {template.communication_prefix}</p>
              )}
              {template.last_generated_period && (
                <p className={"small " + noteCls()}>Last generated period: {template.last_generated_period}</p>
              )}

              <div className={ACTIONS_CLS}>
                <button
                  className={BTN}
                  type="button"
                  onClick={() => onGenerateTemplate(template.id)}
                  disabled={working}
                >
                  Generate Now
                </button>

                <button
                  className={BTN}
                  type="button"
                  onClick={() => onToggleTemplate(template.id)}
                  disabled={working}
                >
                  {template.status === "active" ? "Pause" : "Activate"}
                </button>

                <button
                  className={BTN}
                  type="button"
                  onClick={() => onDeleteTemplate(template.id)}
                  disabled={working}
                >
                  Delete
                </button>
              </div>
            </div>
          ))}

          {filteredTemplates.length > templatePageSize && (
            <div className={PAGINATION_CLS}>
              <button className={BTN} type="button" onClick={() => setTemplatePage((curr) => Math.max(1, curr - 1))} disabled={templatePage === 1}>
                Previous
              </button>
              <p className={"small " + PAGINATION_LABEL_CLS}>
                Page {templatePage} of {templateTotalPages}
              </p>
              <button className={BTN} type="button" onClick={() => setTemplatePage((curr) => Math.min(templateTotalPages, curr + 1))} disabled={templatePage === templateTotalPages}>
                Next
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default PaymentsTemplatesPanel;
