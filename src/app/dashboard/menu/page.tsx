import { bn } from "@/i18n/bn";
import { LogoutButton } from "../LogoutButton";

// P2a-২ক: শুধু সাইন-আউট; বাকি মেনু-আইটেম পরের ধাপে
export default function MenuPage() {
  return (
    <>
      <h1 className="font-serif text-3xl font-bold">{bn.dashboard.menu}</h1>
      <LogoutButton />
    </>
  );
}
