import React from "react";
import { PatientDetailWorkspace } from "@/features/medical-records/patient-detail/PatientDetailWorkspace";

export default async function DoctorPatientDetailPage({
  params,
}: {
  params: Promise<{ patientId: string }>;
}) {
  const { patientId } = await params;
  return <PatientDetailWorkspace patientId={patientId} />;
}
