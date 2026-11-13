import { requireTab } from "@/lib/auth/permissions";

export default async function Layout({ children }: { children: React.ReactNode }) {
  await requireTab("mantenimiento");
  return children;
}
