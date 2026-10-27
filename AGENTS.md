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
- AI chat streams through `src/routes/api/chat.ts` (bearer-verified) using the OpenAI-compatible provider router in `src/lib/providers.server.ts`; providers are enabled purely by env secrets and fall back in order only before output starts, with the Lovable gateway last so chat always works.
- Chats/messages are read and written from the browser Supabase client under per-user RLS; signed-in pages live under `src/routes/_authenticated/`.
- The first account to sign up gets the `admin` role (owner) via the signup trigger; owner-only server checks use `has_role`.
