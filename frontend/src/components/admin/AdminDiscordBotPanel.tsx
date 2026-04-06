import React, { useEffect, useMemo, useState } from "react";
import {
  getAdminDiscordBotState,
  type AdminDiscordBotGuild,
  type AdminDiscordChannelConfig,
  type AdminDiscordRecipient,
  updateAdminDiscordContactRecipient,
} from "../../api/adminDiscordBot";

const AdminDiscordBotPanel: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [guilds, setGuilds] = useState<AdminDiscordBotGuild[]>([]);
  const [configs, setConfigs] = useState<AdminDiscordChannelConfig[]>([]);
  const [recipients, setRecipients] = useState<AdminDiscordRecipient[]>([]);
  const [selectedRecipientId, setSelectedRecipientId] = useState<string>("");
  const [recipientQuery, setRecipientQuery] = useState("");
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);
  const [clientId, setClientId] = useState<string | null>(null);
  const [savingRecipient, setSavingRecipient] = useState(false);
  const [recipientMessage, setRecipientMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        setLoading(true);
        const response = await getAdminDiscordBotState();
        if (cancelled) return;

        setGuilds(response.data.known_guilds ?? []);
        setConfigs(response.data.channel_configs ?? []);
        setRecipients(response.data.candidate_recipients ?? []);
        setSelectedRecipientId(response.data.default_recipient?.id ? String(response.data.default_recipient.id) : "");
        setRecipientQuery(
          response.data.default_recipient
            ? formatRecipient(response.data.default_recipient)
            : ""
        );
        setInviteUrl(response.data.invite_url ?? null);
        setClientId(response.data.client_id ?? null);
        setError(null);
      } catch (e: any) {
        if (!cancelled) {
          setError(e?.message ?? "Failed to load Discord bot admin state");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const configByKey = useMemo(() => {
    return configs.reduce<Record<string, AdminDiscordChannelConfig>>((acc, config) => {
      acc[config.notification_key] = config;
      return acc;
    }, {});
  }, [configs]);

  const selectedRecipient = useMemo(() => {
    return recipients.find((recipient) => String(recipient.id) === selectedRecipientId) ?? null;
  }, [recipients, selectedRecipientId]);

  const filteredRecipients = useMemo(() => {
    const query = recipientQuery.trim().toLowerCase();
    if (query === "") {
      return recipients.slice(0, 8);
    }

    return recipients
      .filter((recipient) => {
        const haystack = [
          recipient.swc_handle,
          recipient.discord_global_name,
          recipient.discord_username,
          recipient.discord_user_id,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        return haystack.includes(query);
      })
      .slice(0, 8);
  }, [recipients, recipientQuery]);

  const formatRecipient = (recipient: AdminDiscordRecipient) => {
    const swc = recipient.swc_handle?.trim() || "Unknown handle";
    const discord =
      recipient.discord_global_name?.trim()
      || recipient.discord_username?.trim()
      || recipient.discord_user_id?.trim()
      || "Unknown Discord";
    const role = recipient.is_sysadmin ? "Sysadmin" : recipient.is_admin ? "Admin" : "Linked user";

    return `${swc} · ${discord} · ${role}`;
  };

  const handleSaveRecipient = async () => {
    try {
      setSavingRecipient(true);
      setRecipientMessage(null);
      const recipientId = selectedRecipientId.trim() === "" ? null : Number(selectedRecipientId);
      const response = await updateAdminDiscordContactRecipient(
        Number.isFinite(recipientId as number) ? (recipientId as number) : null
      );

      setRecipients(response.data.candidate_recipients ?? []);
      setSelectedRecipientId(response.data.default_recipient?.id ? String(response.data.default_recipient.id) : "");
      setRecipientQuery(
        response.data.default_recipient
          ? formatRecipient(response.data.default_recipient)
          : ""
      );
      setRecipientMessage(response.message ?? "Recipient updated.");
      setError(null);
    } catch (e: any) {
      setRecipientMessage(e?.message ?? "Failed to update the contact recipient.");
    } finally {
      setSavingRecipient(false);
    }
  };

  return (
    <div className="panel">
      <h2 style={{ marginTop: 0 }}>Discord Bot</h2>
      <p className="small">
        Sysadmin view for Discord bot presence, invite setup, and announcement routing.
      </p>

      {loading && <p className="small">Loading Discord bot state…</p>}
      {error && (
        <p className="small" style={{ color: "salmon" }}>
          {error}
        </p>
      )}

      {!loading && !error && (
        <>
          <div className="admin-grid" style={{ marginBottom: "1rem" }}>
            <section className="panel admin-card">
              <div className="admin-card__header">
                <h3 className="admin-card__title">Bot Setup</h3>
                <p className="admin-card__desc">
                  Client ID: {clientId ?? "Unknown"}
                </p>
                {inviteUrl ? (
                  <p className="small">
                    <a href={inviteUrl} target="_blank" rel="noreferrer">
                      Invite bot to a server
                    </a>
                  </p>
                ) : (
                  <p className="small">Invite URL unavailable. Set `DISCORD_BOT_CLIENT_ID` in backend env.</p>
                )}
              </div>
            </section>

            <section className="panel admin-card">
              <div className="admin-card__header">
                <h3 className="admin-card__title">Announcement Channels</h3>
                <p className="admin-card__desc">
                  Jobs:{" "}
                  {configByKey.jobs
                    ? `${configByKey.jobs.channel_name || configByKey.jobs.channel_id}`
                    : "Not configured"}
                </p>
                <p className="admin-card__desc">
                  JEN:{" "}
                  {configByKey.jen
                    ? `${configByKey.jen.channel_name || configByKey.jen.channel_id}`
                    : "Not configured"}
                </p>
              </div>
            </section>

            <section className="panel admin-card">
              <div className="admin-card__header">
                <h3 className="admin-card__title">Contact Request Recipient</h3>
                <p className="admin-card__desc">
                  Default Discord DM recipient for website contact and diplomacy requests.
                </p>
              </div>

              <label className="members-universe__field" htmlFor="discord-contact-recipient">
                <span className="small">Default recipient</span>
              <input
                id="discord-contact-recipient"
                type="text"
                value={recipientQuery}
                onChange={(event) => {
                  setRecipientQuery(event.target.value);
                  if (event.target.value.trim() === "") {
                    setSelectedRecipientId("");
                  }
                }}
                className="input"
                disabled={savingRecipient}
                placeholder="Type a handle or Discord name…"
                autoComplete="off"
              />
              </label>

              <div className="members-hyperplanner__suggestions">
                <button
                  type="button"
                  className={`members-hyperplanner__suggestion${selectedRecipientId === "" ? " members-hyperplanner__suggestion--active" : ""}`}
                  onClick={() => {
                    setSelectedRecipientId("");
                    setRecipientQuery("");
                  }}
                  disabled={savingRecipient}
                >
                  <strong>No default recipient</strong>
                  <span className="small">Clear the contact and diplomacy DM target.</span>
                </button>

                {filteredRecipients.map((recipient) => (
                  <button
                    key={recipient.id}
                    type="button"
                    className={`members-hyperplanner__suggestion${selectedRecipientId === String(recipient.id) ? " members-hyperplanner__suggestion--active" : ""}`}
                    onClick={() => {
                      setSelectedRecipientId(String(recipient.id));
                      setRecipientQuery(formatRecipient(recipient));
                    }}
                    disabled={savingRecipient}
                  >
                    <strong>{recipient.swc_handle?.trim() || "Unknown handle"}</strong>
                    <span className="small">
                      {recipient.discord_global_name?.trim()
                        || recipient.discord_username?.trim()
                        || recipient.discord_user_id?.trim()
                        || "Unknown Discord"}
                      {" · "}
                      {recipient.is_sysadmin ? "Sysadmin" : recipient.is_admin ? "Admin" : "Linked user"}
                    </span>
                  </button>
                ))}

                {filteredRecipients.length === 0 && (
                  <p className="small">No matching recipients.</p>
                )}
              </div>

              {selectedRecipient && (
                <p className="small">
                  Selected: {formatRecipient(selectedRecipient)}
                </p>
              )}

              <div className="admin-card__actions">
                <button
                  type="button"
                  className="btn"
                  onClick={handleSaveRecipient}
                  disabled={savingRecipient}
                >
                  {savingRecipient ? "Saving…" : "Save Recipient"}
                </button>
              </div>

              {recipientMessage && (
                <p
                  className="small"
                  style={{ color: recipientMessage.toLowerCase().includes("failed") ? "salmon" : undefined }}
                >
                  {recipientMessage}
                </p>
              )}
            </section>
          </div>

          <section className="panel" style={{ marginBottom: "1rem" }}>
            <h3 style={{ marginTop: 0 }}>Known Servers</h3>
            {guilds.length === 0 ? (
              <p className="small">No Discord servers have been synced by the bot yet.</p>
            ) : (
              <div className="admin-table-wrap">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Guild ID</th>
                      <th>Members</th>
                      <th>Status</th>
                      <th>Last Seen</th>
                    </tr>
                  </thead>
                  <tbody>
                    {guilds.map((guild) => (
                      <tr key={guild.guild_id}>
                        <td>{guild.guild_name}</td>
                        <td>{guild.guild_id}</td>
                        <td>{guild.member_count ?? "Unknown"}</td>
                        <td>{guild.available ? "Active" : "Not currently joined"}</td>
                        <td>{guild.last_seen_at ? new Date(guild.last_seen_at).toLocaleString() : "Unknown"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section className="panel">
            <h3 style={{ marginTop: 0 }}>Channel Routing</h3>
            {configs.length === 0 ? (
              <p className="small">No Discord announcement channels configured yet.</p>
            ) : (
              <div className="admin-table-wrap">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Notification</th>
                      <th>Guild</th>
                      <th>Channel</th>
                      <th>Updated</th>
                    </tr>
                  </thead>
                  <tbody>
                    {configs.map((config) => (
                      <tr key={config.id}>
                        <td>{config.notification_key.toUpperCase()}</td>
                        <td>{config.guild_id ?? "Unknown"}</td>
                        <td>{config.channel_name || config.channel_id}</td>
                        <td>{config.updated_at ? new Date(config.updated_at).toLocaleString() : "Unknown"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
};

export default AdminDiscordBotPanel;
