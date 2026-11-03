<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Architecture rules
- AI chat uses bearer-verified server routes, environment-configured providers and the existing chat-completions protocol; explicit provider selection never falls back, and automatic fallback is limited to transient failures before output starts to avoid hiding access denials.
- Image generation forwards native Gateway SSE or wraps Pollinations image bytes as a completed frame through a bearer-verified server route; the saved private image is included in future native Gemini vision context.
- Mode chains preserve Auto's configured order; Speed/Smart have isolated ordered provider lists. Only transient failures before output may fall through; denial, refusal, balance and configuration failures remain terminal.
- Media and live-search preprocessing uses native Gemini streaming with validated private file bytes encoded as inlineData, then supplies untrusted grounding evidence to the selected mode chain without silently using Lovable AI.
- Chat personas persist per conversation; response language is an independent preference enforced by shared system instructions in every answer path.
- Forking uses a cryptographically random capability code stored only as a hash; authorized snapshot lookup copies media to the recipient and an invoker-rights RPC atomically imports independent messages under their RLS.
- Chat files live in private Storage under user/conversation paths, with references on message rows and owner-scoped policies so saved media remains private across reloads.
- Image viewing uses an in-site dialog and authenticated Storage blobs; downloads use object URLs rather than cross-origin download links so private media remains accessible without relying on expiring signed previews.
- Conversation deletion confirms the returned deleted row before local removal or navigation, preventing failed deletions from appearing successful.
- Persist AI access blocks in `ai_access_state`; every AI entry point checks it and only the owner can explicitly resume after restoring access, preventing retry loops across reloads.
- Chats/messages are read and written from the browser Supabase client under per-user RLS; signed-in pages live under `src/routes/_authenticated/`.
- The first account to sign up gets the `admin` role (owner) via the signup trigger; owner-only server checks use `has_role`.
