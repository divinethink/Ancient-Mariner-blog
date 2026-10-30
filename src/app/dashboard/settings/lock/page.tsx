import { MenuBack } from "../../MenuBack";
import { bn } from "@/i18n/bn";
import { LockPanel } from "./LockPanel";

export default function LockPage() {
  return (
    <>
      <MenuBack />
      <h1 className="mb-6 font-serif text-3xl font-bold">{bn.appLock.menu}</h1>
      <LockPanel />
    </>
  );
}
