"use client";

import InteractiveAvatar from "@/components/InteractiveAvatar";
import { FilePdfIcon } from "@/components/Icons";

const DOCUMENTATION_LINK =
  "https://www.antennahouse.com/hubfs/xsl-fo-sample/pdf/basic-link-1.pdf";

export default function App() {
  return (
    <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-6 px-4 py-6 lg:flex-row lg:items-start">
      <aside className="flex w-full flex-col gap-4 rounded-3xl bg-zinc-900/70 p-6 text-zinc-100 shadow-lg lg:w-64">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-400">
          Documentation
        </h2>
        <a
          className="flex items-center gap-3 rounded-2xl border border-zinc-800/60 bg-zinc-900/60 px-4 py-3 text-sm font-medium text-zinc-200 transition hover:border-zinc-700 hover:bg-zinc-900"
          href={DOCUMENTATION_LINK}
          rel="noopener noreferrer"
          target="_blank"
        >
          <FilePdfIcon className="h-6 w-6 text-red-400" />
          <span>Basic report</span>
        </a>
      </aside>
      <div className="flex w-full justify-center lg:justify-start">
        <InteractiveAvatar />
      </div>
    </div>
  );
}
