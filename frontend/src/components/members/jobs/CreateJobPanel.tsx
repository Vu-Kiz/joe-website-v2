import React, { useState } from "react";

type Props = {
  onCreate: (payload: {
    title: string;
    description: string;
    job_mode: "single" | "multi" | "open_ended";
    pay_type: "fixed" | "per_day_hyper";
    reward_amount: number;
    bonus_amount: number;
    payer_subject_type: "user" | "faction";
  }) => Promise<void>;
};

const CreateJobPanel: React.FC<Props> = ({ onCreate }) => {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [jobMode, setJobMode] = useState<"single" | "multi" | "open_ended">("single");
  const [payType, setPayType] = useState<"fixed" | "per_day_hyper">("fixed");
  const [rewardAmount, setRewardAmount] = useState("0");
  const [bonusAmount, setBonusAmount] = useState("0");
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
        payer_subject_type: "user",
      });

      setTitle("");
      setDescription("");
      setRewardAmount("0");
      setBonusAmount("0");
      setMessage("Job created.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="panel">
      <h2>Create Job</h2>

      {message && <p className="small">{message}</p>}

      <form onSubmit={submit} style={{ display: "grid", gap: 12 }}>
        <input
          className="input"
          placeholder="Job title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />

        <textarea
          className="input"
          placeholder="Description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />

        <select className="input" value={jobMode} onChange={(e) => setJobMode(e.target.value as any)}>
          <option value="single">single</option>
          <option value="multi">multi</option>
          <option value="open_ended">open_ended</option>
        </select>

        <select className="input" value={payType} onChange={(e) => setPayType(e.target.value as any)}>
          <option value="fixed">fixed</option>
          <option value="per_day_hyper">per_day_hyper</option>
        </select>

        <input
          className="input"
          placeholder="Reward amount"
          value={rewardAmount}
          onChange={(e) => setRewardAmount(e.target.value)}
        />

        <input
          className="input"
          placeholder="Bonus amount"
          value={bonusAmount}
          onChange={(e) => setBonusAmount(e.target.value)}
        />

        <button className="btn" type="submit" disabled={saving}>
          {saving ? "Creating..." : "Create Job"}
        </button>
      </form>
    </div>
  );
};

export default CreateJobPanel;