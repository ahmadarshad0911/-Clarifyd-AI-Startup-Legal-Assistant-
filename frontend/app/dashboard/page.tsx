"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { AppShell } from "../../components/shell/app-shell";
import { ContractReportCard } from "../../components/findings/contract-report-card";
import { FindingsList } from "../../components/findings/findings-list";
import { VerdictCard } from "../../components/findings/verdict-card";
import { ProcessingStatus } from "../../components/upload/processing-status";
import { RecentDrafts } from "../../components/upload/recent-drafts";
import { UploadCard } from "../../components/upload/upload-card";
import type { AnalyzeContractResponse } from "../../lib/contracts";
import { pushAnalysis } from "../../lib/analyses";

export default function DashboardPage() {
  const router = useRouter();
  const [analysis, setAnalysis] = useState<AnalyzeContractResponse | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);

  return (
    <AppShell>
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        <div className="lg:col-span-8 flex flex-col gap-8 min-w-0">
          <UploadCard
            onAnalyzed={(res, sourceName) => {
              setAnalysis(res);
              setFileName(sourceName);
              pushAnalysis(res, sourceName);
              router.push(`/findings?draft=${encodeURIComponent(res.draft_id)}`);
            }}
          />
          <ProcessingStatus result={analysis} fileName={fileName} />
        </div>
        <div className="lg:col-span-4 min-w-0">
          <RecentDrafts key={analysis?.draft_id ?? "empty"} />
        </div>
      </div>

      {analysis ? <VerdictCard analysis={analysis} fileName={fileName} /> : null}
      {analysis?.report ? <ContractReportCard report={analysis.report} /> : null}
      {analysis ? <FindingsList findings={analysis.findings} /> : null}
    </AppShell>
  );
}
