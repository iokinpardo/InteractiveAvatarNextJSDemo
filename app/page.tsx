import InteractiveAvatar from "@/components/InteractiveAvatar";

type PageSearchParams = {
  systemPrompt?: string;
  system_prompt?: string;
};

type PageProps = {
  searchParams?: PageSearchParams;
};

export default function App({ searchParams }: PageProps) {
  const systemPrompt =
    searchParams?.systemPrompt ?? searchParams?.system_prompt ?? undefined;

  return (
    <div className="flex w-full justify-center px-4">
      <InteractiveAvatar systemPrompt={systemPrompt} />
    </div>
  );
}
