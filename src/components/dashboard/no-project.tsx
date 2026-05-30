"use client";

import Link from "next/link";
import { FolderPlus } from "lucide-react";

// Shown on a dashboard page when the user has no active project yet. Points
// them back to the Overview tab where projects are created and selected.
export function NoProjectNotice({
  title = "No project selected",
  description = "Create or select a project on the Dashboard to get started.",
}: {
  title?: string;
  description?: string;
}) {
  return (
    <div className="max-w-3xl mx-auto text-center py-16">
      <FolderPlus className="w-12 h-12 mx-auto text-[#999] mb-4" />
      <h2 className="text-xl font-bold mb-2">{title}</h2>
      <p className="text-[#666] mb-4">{description}</p>
      <Link
        href="/dashboard"
        className="inline-flex items-center px-5 py-2.5 rounded-lg bg-[var(--ember)] text-white font-semibold border-2 border-black shadow-[3px_3px_0_0_#000] transition-[transform,box-shadow] duration-200 hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[2px_2px_0_0_#000]"
      >
        Go to Projects
      </Link>
    </div>
  );
}
