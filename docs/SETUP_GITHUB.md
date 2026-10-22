# GitHub Integration Setup Guide

ThreadSherpa includes a GitHub Copilot that:
1. Searches existing issues and releases in connected repositories to prevent duplicate questions.
2. Converts messy Discord troubleshooting threads into clean, maintainer-ready GitHub issue drafts.
3. Gates all issue creation behind explicit administrator approval buttons.

---

## 1. Create a GitHub Personal Access Token

1. Go to **GitHub Settings** -> **Developer Settings** -> **Personal Access Tokens** -> **Fine-grained tokens** (or Tokens Classic).
2. Click **Generate new token**.
3. Name the token `ThreadSherpa Bot`.
4. Select the repository (e.g. `your-org/your-repo`).
5. Grant the following repository permissions:
   - **Issues**: Read and write (required for searching and creating issue drafts).
   - **Metadata**: Read-only (mandatory default).
6. Generate and copy the token.

---

## 2. Configure Environment Variable

Add the token to your `.env` file:

```env
GITHUB_TOKEN=github_pat_11A...
GITHUB_DEFAULT_REPO=owner/repo
```

---

## 3. Connect Repository in Discord

Run the setup command in your Discord server:

```
/setup repo:owner/repo
```

ThreadSherpa will add `owner/repo` to its verified repository allowlist. Subsequent `/issue` commands will search and draft issues against this repository.
