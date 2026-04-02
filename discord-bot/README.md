# Discord Bot

First-pass Discord bot for the JOE website.

What it does:
- registers slash commands for Jobs and JEN
- lets a linked sysadmin set the Jobs/JEN announcement channel
- creates Jobs and JEN posts through the backend
- polls the backend Discord outbox and posts announcements through the bot

Required env:
- `DISCORD_BOT_TOKEN`
- `DISCORD_BOT_CLIENT_ID`
- `DISCORD_BOT_BACKEND_URL`
- `DISCORD_BOT_BACKEND_TOKEN`

Optional env:
- `DISCORD_BOT_GUILD_ID`
- `DISCORD_BOT_OUTBOX_POLL_MS`

Start:

```bash
npm install
npm start
```
