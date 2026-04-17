import { redirect } from "next/navigation";

/**
 * /business-pro → redirect to the overview dashboard.
 */
export default function BusinessProIndex() {
  redirect("/business-pro/overview");
}
