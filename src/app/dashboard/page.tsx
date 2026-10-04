import { bn } from "@/i18n/bn";
import { LogoutButton } from "./LogoutButton";

// P1a: শুধু সুরক্ষিত স্থানধারক; লাইব্রেরি P2a-তে
export default function DashboardPage() {
  return (
    <>
      <h1 className="font-serif text-3xl font-bold">{bn.dashboard.library}</h1>
      <p className="text-muted">{bn.dashboard.soon}</p>
      <LogoutButton />
    </>
  );
}
