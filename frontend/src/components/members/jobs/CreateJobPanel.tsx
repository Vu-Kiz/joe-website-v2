import React, { useState } from "react";
import type { PayableFaction } from "../../../api/factions";

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
  const [rewardAmount, setRewardAmount] = useState("0");
  const [bonusAmount, setBonusAmount] = useState("0");
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
        reward_amount: Number(rewardAmount || 0),
        bonus_amount: Number(bonusAmount || 0),
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
      <h2>Create Job</h2>
      <p className="small">
        Fill out the job details below. When a worker completes the job, the payment will be created in the Payments screen from the payer you choose here.
      </p>

      {message && <p className="small">{message}</p>}

      <form onSubmit={submit} className="payments-template-form">
        <div className="admin-card payments-card">
          <div className="payments-form-grid">
        <label className="small payments-field">
          <span className="payments-label-with-help">
            <strong>Job Title</strong>
            <span className="payments-help" tabIndex={0} aria-label="Job title help">
              ?
              <span className="payments-help__tooltip">
                Give the job a short clear name so people can spot it quickly in the list.
              </span>
            </span>
          </span>
          <input
            className="input"
            placeholder="Hyperlane scouting run"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </label>

        <label className="small payments-field">
          <span className="payments-label-with-help">
            <strong>Description</strong>
            <span className="payments-help" tabIndex={0} aria-label="Description help">
              ?
              <span className="payments-help__tooltip">
                Explain what needs doing, where it happens, and anything the worker should know before taking it.
              </span>
            </span>
          </span>
          <textarea
            className="input"
            placeholder="Explain what needs doing, where, and anything the worker should know."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </label>

        <div className="payments-form-split">
        <label className="small payments-field">
          <span className="payments-label-with-help">
            <strong>Job Type</strong>
            <span className="payments-help" tabIndex={0} aria-label="Job type help">
              ?
              <span className="payments-help__tooltip">
                <strong>Single</strong> is for one worker. <strong>Multi</strong> lets several people join. <strong>Open Ended</strong> stays open until you close it yourself.
              </span>
            </span>
          </span>
          <select className="input" value={jobMode} onChange={(e) => setJobMode(e.target.value as any)}>
            <option value="single">Single</option>
            <option value="multi">Multi</option>
            <option value="open_ended">Open Ended</option>
          </select>
        </label>

        <label className="small payments-field">
          <span className="payments-label-with-help">
            <strong>Pay Type</strong>
            <span className="payments-help" tabIndex={0} aria-label="Pay type help">
              ?
              <span className="payments-help__tooltip">
                <strong>Fixed</strong> pays one set amount. <strong>Per Day Hyper</strong> multiplies the base reward by the days taken when the job is completed.
              </span>
            </span>
          </span>
          <select className="input" value={payType} onChange={(e) => setPayType(e.target.value as any)}>
            <option value="fixed">Fixed</option>
            <option value="per_day_hyper">Per Day Hyper</option>
          </select>
        </label>
        </div>

        <div className="payments-form-split">
        <label className="small payments-field">
          <span className="payments-label-with-help">
            <strong>Base Reward</strong>
            <span className="payments-help" tabIndex={0} aria-label="Base reward help">
              ?
              <span className="payments-help__tooltip">
                This is the main credit amount for the job before any optional bonus is added.
              </span>
            </span>
          </span>
          <input
            className="input"
            type="number"
            min="0"
            placeholder="Reward amount"
            value={rewardAmount}
            onChange={(e) => setRewardAmount(e.target.value)}
          />
        </label>

        <label className="small payments-field">
          <span className="payments-label-with-help">
            <strong>Bonus Amount</strong>
            <span className="payments-help" tabIndex={0} aria-label="Bonus amount help">
              ?
              <span className="payments-help__tooltip">
                Optional extra credits added on top of the base reward when the payment item is created.
              </span>
            </span>
          </span>
          <input
            className="input"
            type="number"
            min="0"
            placeholder="Bonus amount"
            value={bonusAmount}
            onChange={(e) => setBonusAmount(e.target.value)}
          />
        </label>
        </div>

        <label className="small payments-field">
          <span className="payments-label-with-help">
            <strong>Payer</strong>
            <span className="payments-help" tabIndex={0} aria-label="Payer help">
              ?
              <span className="payments-help__tooltip">
                This controls who will fund the payment after the job is completed. Faction options only appear if they passed the same live permission check used by Payments.
              </span>
            </span>
          </span>
          <select
            className="input"
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

        <button className="btn" type="submit" disabled={saving}>
          {saving ? "Creating..." : "Create Job"}
        </button>
      </form>
    </div>
  );
};

export default CreateJobPanel;
