import { bn } from "@/i18n/bn";
import { MenuBack } from "../MenuBack";
import { LetterList } from "./LetterList";

export default function LettersPage() {
  return (
    <>
      <MenuBack />
      <h1 className="mb-2 font-serif text-3xl font-bold">{bn.letters.title}</h1>
      <p className="mb-4 text-sm text-muted">{bn.letters.intro}</p>
      <LetterList />
    </>
  );
}
