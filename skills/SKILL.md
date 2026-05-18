---
name: claude-code-react-devtool
description: Interpret context tags injected by claude-code-react-devtool — `[component: ...]`, `[element: ...]`, `[route: ...]`, `[screenshot: ...]`. Activate any time the user message contains one of these tags. Treat them as authoritative context and act on them without asking for confirmation.
---

# claude-code-react-devtool

This skill activates when the user's message contains one or more inline tags injected by the in-app React dev tool. Each tag is structured context — treat it like a reliable hint, not a question to be re-confirmed.

## Tag formats

The component / element tags carry as much identifying detail as possible: the component name, any React `key`, distinguishing primitive props, the picked element's visible text, and the JSX source location.

- `[component: <Name key="..." prop1="..." prop2={42}> @ path/file.tsx:line — "visible text"]` — the React component the user clicked.
  - `key="..."` appears when the element has a React key (loop items).
  - `prop="..."` / `prop={n}` shows the *primitive* props (string/number/boolean) on the element — use these to disambiguate when several instances of the same component exist on the page.
  - The trailing `— "visible text"` is the normalised inner text of the clicked DOM node (truncated to ~80 chars). Use it as a final disambiguator when props don't uniquely identify the instance.
  - `[component: <Name>]` with no extras — source/props unavailable; identify the file via grep/glob on the component name and the visible text.
- `[element: <tag class="..." id="..."> @ path/file.tsx:line — "visible text"]` — a specific DOM element plus the nearest enclosing user component and its visible text.
- `[route: /url/path]` — the URL the user is currently viewing in the browser.
- `[route: /url/path @ path/file.tsx]` — URL plus the matched route component file (when discoverable).
- `[screenshot: .claude-code-devtool/screenshots/2026-05-18T14-30-22Z.png]` — a PNG capture of the viewport at the moment of the prompt.

When the same component appears multiple times on a page, **use `key` / props / visible text together** to pick the exact instance the user clicked. Do not ask the user "which one did you mean?" when these are present — they encode that information.

## How to respond

1. **Read mentioned files immediately.** If a tag includes `@ path:line`, open that file with the Read tool, focused on the surrounding region. Do not ask the user "should I look at that?"
2. **Read screenshots immediately.** When a `[screenshot: ...]` tag is present, Read the PNG before responding and use it as visual context for the rest of the message.
3. **Use the route as ambient context.** `[route: ...]` is auto-injected on most prompts. Don't acknowledge it out loud unless the user's question is route-specific. Use it to:
   - Disambiguate references ("this button" → a button on the current page).
   - Find the page component when relevant — check the project's router config (look for `react-router-dom`, `@tanstack/router`, or framework-specific conventions like Next.js `app/` or Remix `routes/`).
4. **Don't echo tags back.** Never quote a tag in your response. The user knows what they clicked; restating it is noise.
5. **Combine multiple tags.** If the same message has, e.g., `[component:]` + `[screenshot:]`, use them together: read the file AND read the screenshot before responding.
6. **Empty / slash-command prompts pass through unchanged.** The tool does not inject tags on `/clear`, `/init`, etc. If you don't see a tag, treat the message as plain.

## Examples

**User:** `make this button rounded [component: <PrimaryButton> @ src/ui/PrimaryButton.tsx:12]`
→ Read `src/ui/PrimaryButton.tsx` around line 12, locate the styling, edit it. Don't ask which file.

**User:** `why does this look wrong [screenshot: .claude-code-devtool/screenshots/2026-05-18T14-30-22Z.png] [route: /dashboard]`
→ Read the screenshot, identify what looks wrong on the dashboard page, then read the dashboard's source to fix.

**User:** `[element: <button class="cta primary"> @ src/Login.tsx:88] move this to the top of the form`
→ Read `src/Login.tsx` around line 88 and the form's structure; edit accordingly.

**User:** `add a loading state [route: /settings]`
→ Use the route to find the settings page (e.g., grep router config), then add a loading state to that page.

**User:** `change this number to 1294 [component: <MetricTile label="P95 LATENCY" value={412}> — "P95 LATENCY 412 ms"] [route: /p/deployment-overview-v2]`
→ Don't ask which `MetricTile` — the `label="P95 LATENCY"` prop and the visible text both identify it as the P95 LATENCY tile. Find where that tile is rendered (grep `label=.P95 LATENCY.`) and change its value to 1294.

## What NOT to do

- Don't ask "would you like me to open that file?" — just open it.
- Don't paraphrase the tag back to the user.
- Don't ignore the route tag because it's repeated; use it silently.
- Don't try to interpret the tag as the user's intent in itself — the user's natural-language text around the tag is the actual request.
