import { SenderRulesSettings } from "@/components/sender-rules-settings";

export default async function SenderRulesPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { editRule } = await searchParams;
  return (
    <SenderRulesSettings
      initialEditRuleId={typeof editRule === "string" ? editRule : undefined}
    />
  );
}
