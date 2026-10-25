import { Crown, Lightning, Sparkle } from "@phosphor-icons/react/dist/ssr";
import type { ModelChoice } from "@typeplay/shared";

const icons = { fast: Lightning, smart: Sparkle, best: Crown } as const;

/**
 * An AI's tile (DESIGN.md: the model rows' 44px tile at the icon radius, the home page's 56px settings tile at 16px): its
 * colour (Fast #2f9e44, Smart hot orange with an ink icon, Best Dusk Sky 4) and its fill-weight Phosphor icon.
 */
export function ModelTile({ model, big }: { model: ModelChoice; big?: boolean }) {
  const Glyph = icons[model];
  return (
    <span className={`aitile aitile--${model}${big ? " aitile--big" : ""}`} aria-hidden="true">
      <Glyph size={big ? 28 : 22} weight="fill" />
    </span>
  );
}
