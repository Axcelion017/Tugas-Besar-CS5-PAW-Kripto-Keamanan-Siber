import React from "react";
import { ExamWorkspace } from "@/features/medical-records/exam/ExamWorkspace";

export default async function ClinicalExaminationPage({
  params,
}: {
  params: Promise<{ bookingId: string }>;
}) {
  const { bookingId } = await params;
  return <ExamWorkspace bookingId={bookingId} />;
}
