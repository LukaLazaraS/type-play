// typeplay/ui-only: every UI piece exists once, as a shared component in src/components/ui (Luka, 10-24: a fix in one copy
// of a piece never reached the other; DESIGN.md "Components"). Everywhere else this fails a file that builds its own
// copy of a piece: a raw <button>, <input>, <textarea>, <select>, <dialog>, <label> or <fieldset>, a popover, or a
// class that belongs to a shared piece. Pages and feature components compose the pieces; a piece that is missing, or a
// new look of one, is made in components/ui first. Tested by eslint/ui-only.test.mjs (npm run check).

/** Raw elements, and the pieces that render them. */
const ELEMENTS = {
  button: "Button, InkPill, TextButton, IconButton, Chip, or Pressable (a card that is a button)",
  input: "TextField, SearchField, Checkbox, Segmented, ChoiceRows or FileButton",
  textarea: "TextArea",
  select: "Select",
  dialog: "Dialog",
  label: "the label of TextField, TextArea, Select, FieldLabel, Checkbox, Segmented, ChoiceRows or IconChoice",
  fieldset: "Segmented, ChoiceRows or IconChoice",
};

const POPOVER = new Set(["popover", "popoverTarget", "popoverTargetAction"]);

/** The classes each shared piece owns. A page may add its own classes for layout, never these. */
const OWNED = [
  [/^button(--[a-z-]+)?$/, "Button or ButtonLink"],
  [/^inkpill(--[a-z-]+|__[a-z-]+)?$/, "InkPill or InkPillLink"],
  [/^pill$/, "PillLink"],
  [/^link$/, "TextLink (or TextButton for an action)"],
  [/^textbutton(--[a-z-]+)?$/, "TextButton"],
  [/^iconbutton(--[a-z-]+)?$/, "IconButton"],
  [/^chip(--[a-z-]+)?$/, "Chip"],
  [/^pulse$/, "Pulse"],
  [/^toggle(__[a-z-]+)?$/, "Toggle"],
  [/^iconchoice(__[a-z-]+)?$/, "IconChoice"],
  [/^hintlines$/, "HintLines"],
  [/^(segmented|switch(--[a-z-]+|__[a-z-]+)?)$/, "Segmented"],
  [/^(choices|choice(--[a-z-]+|__[a-z-]+)?)$/, "ChoiceRows"],
  [/^checkbox(__[a-z-]+)?$/, "Checkbox"],
  [/^(field(--[a-z-]+)?|field-optional|field-count)$/, "TextField, TextArea or Select"],
  [/^error-line(--[a-z-]+)?$/, "ErrorLine"],
  [/^callout(--[a-z-]+)?$/, "Callout"],
  [/^panel$/, "Panel"],
  [/^ask(__[a-z-]+)?$/, "Ask"],
  [/^notestrip(--[a-z-]+)?$/, "Strip"],
  [/^card(__[a-z-]+)?$/, "Card or CardTitle"],
  [/^(make|make__title|make__lead|create|create__text)$/, "PageWidget"],
  [/^dialog(--[a-z-]+|__[a-z-]+)?$/, "Dialog and its parts"],
  [/^pop(--[a-z-]+)?$/, "Popover"],
  [/^menu(__[a-z-]+)?$/, "Menu, MenuItem, MenuGroup or MenuAsk"],
  [/^pillbar(--[a-z-]+|__[a-z-]+)?$/, "Tabs or PillChoice"],
  [/^searchfield(__[a-z-]+)?$/, "SearchField"],
  [/^plays(__[a-z-]+)?$/, "PlayCount"],
  [/^avatarbutton$/, "AvatarButton"],
  [/^(app|app__icon|app__name|app__stat)$/, "AppIcon, AppTile or AppIconSlot"],
  [/^gamecard(--[a-z-]+|__[a-z-]+)?$/, "GameCard or GameCardSlot"],
  [/^playchip(--[a-z-]+)?$/, "PlayChip"],
  [/^aitile(--[a-z-]+)?$/, "ModelTile"],
  [/^wordmark$/, "Wordmark"],
  [/^act$/, "ActionButton"],
  [/^toasts?(__[a-z-]+)?$/, "Toast or Toasts"],
];
const ownerOf = (cls) => OWNED.find(([re]) => re.test(cls))?.[1] ?? null;

/** Every class name written as text in a className value: strings, template literals, and strings inside expressions. */
function classesIn(value) {
  const words = [];
  const visit = (node) => {
    if (!node || typeof node !== "object") return;
    if (node.type === "Literal" && typeof node.value === "string") words.push(node.value);
    else if (node.type === "TemplateElement") words.push(node.value.cooked ?? node.value.raw);
    for (const [key, child] of Object.entries(node)) {
      if (key === "parent" || key === "loc" || key === "range") continue;
      if (Array.isArray(child)) child.forEach(visit);
      else if (child && typeof child.type === "string") visit(child);
    }
  };
  visit(value);
  return words.flatMap((w) => w.split(/\s+/)).filter(Boolean);
}

const rule = {
  meta: {
    type: "problem",
    docs: { description: "Every UI piece exists once, in src/components/ui: no copy of one outside it." },
    messages: {
      element: "<{{name}}> is built by the shared pieces: use {{use}} from components/ui (DESIGN.md \"Components\").",
      popover: "{{name}}: a popover is the shared Popover from components/ui.",
      owned: "The class \"{{cls}}\" belongs to {{use}} in components/ui: use the component, not its class.",
    },
    schema: [],
  },
  create(context) {
    return {
      JSXOpeningElement(node) {
        const n = node.name;
        const name = n.type === "JSXIdentifier" ? n.name : n.type === "JSXMemberExpression" && n.object.type === "JSXIdentifier" && n.object.name === "motion" ? n.property.name : null;
        if (name && Object.hasOwn(ELEMENTS, name)) context.report({ node, messageId: "element", data: { name: n.type === "JSXIdentifier" ? name : `motion.${name}`, use: ELEMENTS[name] } });
      },
      JSXAttribute(node) {
        const name = node.name.type === "JSXIdentifier" ? node.name.name : null;
        if (name && POPOVER.has(name)) context.report({ node, messageId: "popover", data: { name } });
        if (name !== "className" || !node.value) return;
        for (const cls of new Set(classesIn(node.value))) {
          const use = ownerOf(cls);
          if (use) context.report({ node, messageId: "owned", data: { cls, use } });
        }
      },
    };
  },
};

export default rule;
