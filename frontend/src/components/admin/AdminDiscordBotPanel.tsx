import React, { useEffect, useMemo, useState } from "react";
import {
  getAdminDiscordBotState,
  type AdminDiscordBotGuild,
  type AdminDiscordChannelConfig,
} from "../../api/adminDiscordBot";

const AdminDiscordBotPanel: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [guilds, setGuilds] = useState<AdminDiscordBotGuild[]>([]);
  const [configs, setConfigs] = useState<AdminDiscordChannelConfig[]>([]);
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);
  const [clientId, setClientId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        setLoading(true);
        const response = await getAdminDiscordBotState();
        if (cancelled) return;

        setGuilds(response.data.known_guilds ?? []);
        setConfigs(response.data.channel_configs ?? []);
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
