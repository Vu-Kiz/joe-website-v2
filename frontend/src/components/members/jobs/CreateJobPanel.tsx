import React, { useState } from "react";
import type { PayableFaction } from "../../../api/factions/factions";
import { BTN, INPUT, SELECT_INPUT } from "../../../utils/ui";
import CreditInput from "../../common/CreditInput";

const CARD_CLS = "flex flex-col gap-3 p-[0.9rem] rounded-[12px] border border-white/[0.08] bg-white/[0.03]";
const FIELD_CLS = "grid gap-[0.4rem]";
const LABEL_WITH_HELP_CLS = "inline-flex items-center gap-[0.45rem] flex-wrap";
const HELP_CLS = "relative inline-flex items-center justify-center w-[18px] h-[18px] rounded-full border border-[rgba(245,213,70,0.35)] bg-[rgba(245,213,70,0.08)] text-[#f2c46f] text-[0.78rem] font-bold leading-none cursor-help outline-none group";
const HELP_TOOLTIP_CLS = "absolute left-0 top-[calc(100%+0.5rem)] z-[20] w-[min(260px,80vw)] p-[0.7rem_0.8rem] rounded-[10px] border border-[rgba(245,213,70,0.28)] bg-[rgba(12,12,12,0.96)] text-white/[0.86] shadow-[0_12px_28px_rgba(0,0,0,0.35)] opacity-0 translate-y-1 pointer-events-none transition-[opacity,transform] duration-[160ms] ease [&_strong]:text-[#f2c46f] group-hover:opacity-100 group-hover:translate-y-0 group-hover:pointer-events-auto group-focus-visible:opacity-100 group-focus-visible:translate-y-0 group-focus-visible:pointer-events-auto";
const FORM_GRID_CLS = "grid gap-3";
const FORM_SPLIT_CLS = "grid [grid-template-columns:repeat(2,minmax(0,1fr))] gap-3 max-[720px]:[grid-template-columns:1fr]";

type Props = {
  onCreate: (payload: {
    title: string;
    description: string;
    job_mode: "single" | "multi" | "open_ended";
    pay_type: "fixed" | "per_day_hyper";
    reward_amount: number;
    bonus_amount: number;
    payer_subject_type: "user" | "faction";
    payer_subject_id?: number | null;
  }) => Promise<void>;
  personalPayerLabel: string;
  payableFactions: PayableFaction[];
};

const CreateJobPanel: React.FC<Props> = ({
  onCreate,
  personalPayerLabel,
  payableFactions,
}) => {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [jobMode, setJobMode] = useState<"single" | "multi" | "open_ended">("single");
  const [payType, setPayType] = useState<"fixed" | "per_day_hyper">("fixed");
  const [rewardAmount, setRewardAmount] = useState("");
  const [bonusAmount, setBonusAmount] = useState("");
  const [payerKey, setPayerKey] = useState("user");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();

    try {
      setSaving(true);
      await onCreate({
        title,
        description,
        job_mode: jobMode,
        pay_type: payType,
        reward_amount: Number(rewardAmount.replace(/,/g, "") || 0),
        bonus_amount: Number(bonusAmount.replace(/,/g, "") || 0),
        payer_subject_type: payerKey === "user" ? "user" : "faction",
        payer_subject_id: payerKey === "user" ? null : Number(payerKey),
      });

      setTitle("");
      setDescription("");
      setRewardAmount("0");
      setBonusAmount("0");
      setPayerKey("user");
      setMessage("Job created.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="panel">
      <h2 className="h2">Create Job</h2>
      <p className="small">
        Fill out the job details below. When a worker completes the job, the payment will be created in the Payments screen from the payer you choose here.
      </p>

      {message && <p className="small">{message}</p>}

      <form onSubmit={submit} className="mt-3">
        <div className={CARD_CLS}>
          <div className={FORM_GRID_CLS}>
            <label className={"small " + FIELD_CLS}>
              <span className={LABEL_WITH_HELP_CLS}>
                <strong>Job Title</strong>
                <span className={HELP_CLS} tabIndex={0} aria-label="Job title help">
                  ?
                  <span className={HELP_TOOLTIP_CLS}>
                    Give the job a short clear name so people can spot it quickly in the list.
                  </span>
                </span>
              </span>
              <input
                className={INPUT}
                placeholder="Hyperlane scouting run"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </label>

            <label className={"small " + FIELD_CLS}>
              <span className={LABEL_WITH_HELP_CLS}>
                <strong>Description</strong>
                <span className={HELP_CLS} tabIndex={0} aria-label="Description help">
                  ?
                  <span className={HELP_TOOLTIP_CLS}>
                    Explain what needs doing, where it happens, and anything the worker should know before taking it.
                  </span>
                </span>
              </span>
              <textarea
                className={INPUT}
                placeholder="Explain what needs doing, where, and anything the worker should know."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </label>

            <div className={FORM_SPLIT_CLS}>
              <label className={"small " + FIELD_CLS}>
                <span className={LABEL_WITH_HELP_CLS}>
                  <strong>Job Type</strong>
                  <span className={HELP_CLS} tabIndex={0} aria-label="Job type help">
                    ?
                    <span className={HELP_TOOLTIP_CLS}>
                      <strong>Single</strong> is for one worker. <strong>Multi</strong> lets several people join. <strong>Open Ended</strong> stays open until you close it yourself.
                    </span>
                  </span>
                </span>
                <select className={SELECT_INPUT} value={jobMode} onChange={(e) => setJobMode(e.target.value as any)}>
                  <option value="single">Single</option>
                  <option value="multi">Multi</option>
                  <option value="open_ended">Open Ended</option>
                </select>
              </label>

              <label className={"small " + FIELD_CLS}>
                <span className={LABEL_WITH_HELP_CLS}>
                  <strong>Pay Type</strong>
                  <span className={HELP_CLS} tabIndex={0} aria-label="Pay type help">
                    ?
                    <span className={HELP_TOOLTIP_CLS}>
                      <strong>Fixed</strong> pays one set amount. <strong>Per Day Hyper</strong> multiplies the base reward by the days taken when the job is completed.
                    </span>
                  </span>
                </span>
                <select className={SELECT_INPUT} value={payType} onChange={(e) => setPayType(e.target.value as any)}>
                  <option value="fixed">Fixed</option>
                  <option value="per_day_hyper">Per Day Hyper</option>
                </select>
              </label>
            </div>

            <div className={FORM_SPLIT_CLS}>
              <label className={"small " + FIELD_CLS}>
                <span className={LABEL_WITH_HELP_CLS}>
                  <strong>Base Reward</strong>
                  <span className={HELP_CLS} tabIndex={0} aria-label="Base reward help">
                    ?
                    <span className={HELP_TOOLTIP_CLS}>
                      This is the main credit amount for the job before any optional bonus is added.
                    </span>
                  </span>
                </span>
                <CreditInput
                  className={INPUT}
                  placeholder="e.g. 1,000,000"
                  value={rewardAmount}
                  onChange={setRewardAmount}
                />
              </label>

              <label className={"small " + FIELD_CLS}>
                <span className={LABEL_WITH_HELP_CLS}>
                  <strong>Bonus Amount</strong>
                  <span className={HELP_CLS} tabIndex={0} aria-label="Bonus amount help">
                    ?
                    <span className={HELP_TOOLTIP_CLS}>
                      Optional extra credits added on top of the base reward when the payment item is created.
                    </span>
                  </span>
                </span>
                <CreditInput
                  className={INPUT}
                  placeholder="e.g. 500,000"
                  value={bonusAmount}
                  onChange={setBonusAmount}
                />
              </label>
            </div>

            <label className={"small " + FIELD_CLS}>
              <span className={LABEL_WITH_HELP_CLS}>
                <strong>Payer</strong>
                <span className={HELP_CLS} tabIndex={0} aria-label="Payer help">
                  ?
                  <span className={HELP_TOOLTIP_CLS}>
                    This controls who will fund the payment after the job is completed. Faction options only appear if they passed the same live permission check used by Payments.
                  </span>
                </span>
              </span>
              <select
                className={INPUT}
                value={payerKey}
                onChange={(e) => setPayerKey(e.target.value)}
              >
                <option value="user">Personal: {personalPayerLabel}</option>
                {payableFactions.map((faction) => (
                  <option key={faction.id} value={String(faction.id)}>
                    Faction: {faction.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>

        <button className={BTN} type="submit" disabled={saving}>
          {saving ? "Creating..." : "Create Job"}
        </button>
      </form>
    </div>
  );
};

export default CreateJobPanel;
