import { redirect } from "next/navigation";

/** Legacy community templates — replaced by hook template library. */
export default function CommunityTemplatesRedirect() {
  redirect("/dashboard/templates");
}
