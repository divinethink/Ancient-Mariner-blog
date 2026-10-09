// Library-তে লোড-হওয়া লেখার (id, শিরোনাম) — palette অতিরিক্ত read ছাড়াই খুঁজতে পারে (শুধু memory, সর্বোচ্চ ২০০)
let titles: { id: string; title: string }[] = [];
export const setPaletteTitles = (x: { id: string; title: string }[]) => {
  titles = x.slice(0, 200);
};
export const getPaletteTitles = () => titles;
