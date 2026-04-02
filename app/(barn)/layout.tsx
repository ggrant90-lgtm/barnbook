import { BarnProvider } from "@/components/BarnContext";
import { BarnLayoutClient } from "@/components/BarnLayoutClient";

export default function BarnLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <BarnProvider>
      <BarnLayoutClient>{children}</BarnLayoutClient>
    </BarnProvider>
  );
}
