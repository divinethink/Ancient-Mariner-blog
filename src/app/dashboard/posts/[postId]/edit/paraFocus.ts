// প্যারা-ফোকাস (P7b-১): caret-সহ top-level ব্লকে `pf-cur` class বসায় (শুধু decoration — doc/স্কিমা অপরিবর্তিত)।
// dimming CSS-এ: `[data-pf="1"] .pm > :not(.pf-cur)`; বন্ধ থাকলে class-টা নিরীহ।
import { Extension } from "@tiptap/react";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";

export const ParaFocus = Extension.create({
  name: "paraFocus",
  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey("paraFocus"),
        props: {
          decorations(state) {
            const { $from } = state.selection;
            if ($from.depth < 1) return DecorationSet.empty;
            const start = $from.before(1);
            const node = state.doc.nodeAt(start);
            if (!node) return DecorationSet.empty;
            return DecorationSet.create(state.doc, [
              Decoration.node(start, start + node.nodeSize, { class: "pf-cur" }),
            ]);
          },
        },
      }),
    ];
  },
});
