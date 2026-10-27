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

- Keep Mushaf physical effects as pointer-inert CSS beneath the original SVG, sized to its exact object-contain bounds over the full-screen parchment; derive physical side from page parity so jumps and restored positions never change image or ayah geometry.
- Keep Arabic page-turn direction and completion rules in the tested page-turn module; animate decoded adjacent pages with Motion and carry the unchanged SVG-coordinate overlay with each leaf so dragging never reveals a blank page or detaches highlights.
- Reuse the permanent IndexedDB page cache through useMushafPages, with only nearby decoded layouts held in memory; commit the active page only after a completed turn to preserve progress and stopping-point semantics.
