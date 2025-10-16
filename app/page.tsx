import InteractiveAvatar from "@/components/InteractiveAvatar";

type PageSearchParams = Record<string, string | string[] | undefined>;

type PageProps = {
  searchParams?: Promise<PageSearchParams> | PageSearchParams;
};

const extractParam = (value?: string | string[]): string | undefined => {
  if (Array.isArray(value)) {
    return value[0];
  }

  return value;
};

export default async function App({ searchParams }: PageProps) {
  const resolvedSearchParams = (await Promise.resolve(searchParams)) ?? {};
  const systemPrompt =
    extractParam(resolvedSearchParams.systemPrompt) ??
    extractParam(resolvedSearchParams.system_prompt);

  return (
    <div className="flex w-full justify-center px-4">
      <InteractiveAvatar systemPrompt={systemPrompt} />
    </div>
  );
}
