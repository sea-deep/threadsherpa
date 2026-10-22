# Discord Application & Bot Setup Guide

Follow this guide to register and configure your Discord bot for ThreadSherpa.

---

## 1. Create Discord Application

1. Open the [Discord Developer Portal](https://discord.com/developers/applications).
2. Click **New Application** in the top right.
3. Enter `ThreadSherpa` as the Name and agree to the terms.
4. On the **General Information** page, copy the **Application ID** (this is your `DISCORD_CLIENT_ID`).

---

## 2. Configure Bot User & Gateway Intents

1. Navigate to the **Bot** tab on the left sidebar.
2. Click **Reset Token** to generate a new bot token. Copy this value (this is your `DISCORD_BOT_TOKEN`).
3. Scroll down to **Privileged Gateway Intents**:
   - Enable **Message Content Intent** (Required to observe support questions in configured channels).
   - Enable **Server Members Intent** (Required to verify admin role memberships).
4. Save Changes.

---

## 3. Generate OAuth2 Invite URL

1. Navigate to **OAuth2** -> **URL Generator** on the left sidebar.
2. Under **Scopes**, select:
   - `bot`
   - `applications.commands`
3. Under **Bot Permissions**, select:
   - `Send Messages`
   - `Create Public Threads`
   - `Send Messages in Threads`
   - `Embed Links`
   - `Attach Files`
   - `Read Message History`
   - `Add Reactions`
   - `Use Slash Commands`
4. Copy the generated URL at the bottom and open it in a browser to invite the bot to your Discord server.

---

## 4. Server Configuration

Once the bot joins your server:
1. Run `/setup channel:#support-channel admin_role:@SupportLead autonomy_mode:supervised` in Discord.
2. ThreadSherpa will confirm configuration and begin monitoring the designated support channel.
