import React, { useEffect, useMemo, useState } from "react";
import DatePicker from "../common/DatePicker";
import type {
  ManualPaymentTemplate,
  ManualPaymentTemplateFormPayload,
  ManualPaymentTemplateOptionsResponse,
} from "../../api/manualPayments";
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

    const parsedAmount = Number(amount);
    const parsedBonusAmount = Number(bonusAmount || "0");
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
      <h2>Manual Templates</h2>
      <p className="small payments-panel__intro">
        Create recurring manual payment items inside the live Payments system so they can be opened,
        synced against SWC, and verified like any other transfer.
      </p>

      <div className="admin-card payments-card">
        <strong>Create Manual Payment Template</strong>

        <form onSubmit={handleCreateTemplate} className="payments-template-form">
          <div className="payments-form-grid">
            <label className="small payments-field">
              <strong>Template Name</strong>
              <input
                className="input"
                type="text"
                placeholder="Monthly logistics payment"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </label>

            <label className="small payments-field">
              <strong>Payer</strong>
              <select
                className="input"
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

            <label className="small payments-field">
              <strong>Payee</strong>
              <select
                className="input"
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

            <div className="payments-form-split">
              <label className="small payments-field">
                <strong>Base Amount</strong>
                <input
                  className="input"
                  type="number"
                  min="0"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="Amount"
                />
              </label>

              <label className="small payments-field">
                <strong>Bonus Amount</strong>
                <input
                  className="input"
                  type="number"
                  min="0"
                  value={bonusAmount}
                  onChange={(e) => setBonusAmount(e.target.value)}
                  placeholder="Bonus amount"
                />
              </label>
            </div>

            <div className="payments-form-split">
              <label className="small payments-field">
                <span className="payments-label-with-help">
                  <strong>Monthly Due Day</strong>
                  <span
                    className="payments-help"
                    tabIndex={0}
                    aria-label="Monthly due day help"
                  >
                    ?
                    <span className="payments-help__tooltip">
                      Pick the day this payment should be generated each month. Use <strong>1</strong> for the 1st of the month. The <strong>Start Date</strong> is when the template becomes active, and the due day controls which day of that month it should generate.
                    </span>
                  </span>
                </span>
                <input
                  className="input"
                  type="number"
                  min="1"
                  max="31"
                  value={dayOfMonth}
                  onChange={(e) => setDayOfMonth(e.target.value)}
                  placeholder="Day of month"
                />
              </label>

              <label className="small payments-field">
                <strong>Start Date</strong>
                <DatePicker
                  id="payments-template-start-date"
                  value={startDate}
                  onChange={setStartDate}
                  placeholder="Choose start date"
                />
              </label>
            </div>

            <label className="small payments-field">
              <strong>Communication Prefix</strong>
              <input
                className="input"
                type="text"
                placeholder="Monthly payment"
                value={communicationPrefix}
                onChange={(e) => setCommunicationPrefix(e.target.value)}
              />
              <span>This text appears before the `JOE-XFER-...` reference when the payment link is generated.</span>
            </label>

            <label className="small payments-field">
              <strong>Internal Notes</strong>
              <textarea
                className="input"
                placeholder="What this template is for"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                style={{ minHeight: 90 }}
              />
            </label>
          </div>

          {formError && (
            <p className="small payments-note payments-note--warn">
              {formError}
            </p>
          )}

          <div className="payments-actions">
            <button className="btn" type="submit" disabled={working}>
              {working ? "Saving..." : "Create Template"}
            </button>
          </div>
        </form>
      </div>

      {templates.length === 0 ? (
        <p className="small">No manual templates yet.</p>
      ) : (
        <>
          <div className="payments-toolbar">
            <label className="small payments-field payments-field--compact">
              <strong>Search Templates</strong>
              <input
                className="input"
                type="search"
                placeholder="Search template, payer, payee, or communication"
                value={templateQuery}
                onChange={(e) => setTemplateQuery(e.target.value)}
              />
            </label>

            <label className="small payments-field payments-field--compact">
              <strong>Filter By</strong>
              <select className="input" value={templateFilterBy} onChange={(e) => setTemplateFilterBy(e.target.value)}>
                <option value="all">Everything</option>
                <option value="name">Name</option>
                <option value="payer">Payer</option>
                <option value="payee">Payee</option>
                <option value="status">Status</option>
              </select>
            </label>

            {templateFilterBy !== "all" && (
              <label className="small payments-field payments-field--compact">
                <strong>Value</strong>
                <select className="input" value={templateFilterValue} onChange={(e) => setTemplateFilterValue(e.target.value)}>
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
              <label className="small payments-field payments-field--compact">
                <strong>Quick Reset</strong>
                <button
                  className="btn"
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

          <p className="small payments-panel__meta">
            Showing {pagedTemplates.length} of {filteredTemplates.length} template{filteredTemplates.length === 1 ? "" : "s"}.
          </p>

          {pagedTemplates.length === 0 && (
            <p className="small">No templates matched your search.</p>
          )}

          {pagedTemplates.map((template) => (
          <div key={template.id} className="admin-card payments-card">
            <div className="payments-card__header payments-card__header--split">
              <div className="payments-card__title-block">
                <p className="small payments-card__eyebrow">Template</p>
                <strong>{template.name}</strong>
              </div>
              <span className={`small payments-card__badge ${template.status === "active" ? "is-ok" : "is-warn"}`}>
                {template.status}
              </span>
            </div>
            <div className="payments-meta-list">
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
              <p className="small payments-note">Communication prefix: {template.communication_prefix}</p>
            )}
            {template.last_generated_period && (
              <p className="small payments-note">Last generated period: {template.last_generated_period}</p>
            )}

            <div className="payments-actions">
              <button
                className="btn"
                type="button"
                onClick={() => onGenerateTemplate(template.id)}
                disabled={working}
              >
                Generate Now
              </button>

              <button
                className="btn"
                type="button"
                onClick={() => onToggleTemplate(template.id)}
                disabled={working}
              >
                {template.status === "active" ? "Pause" : "Activate"}
              </button>

              <button
                className="btn"
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
            <div className="payments-pagination">
              <button className="btn" type="button" onClick={() => setTemplatePage((curr) => Math.max(1, curr - 1))} disabled={templatePage === 1}>
                Previous
              </button>
              <p className="small payments-pagination__label">
                Page {templatePage} of {templateTotalPages}
              </p>
              <button className="btn" type="button" onClick={() => setTemplatePage((curr) => Math.min(templateTotalPages, curr + 1))} disabled={templatePage === templateTotalPages}>
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
