"use client";

import React from "react";
import { ExamTab4Plan, ExamTab4PlanProps } from "@/features/medical-records/exam/ExamTab4Plan";
import {
  ExamTab5MedicoLegal,
  ExamTab5MedicoLegalProps,
  AVAILABLE_REFERRAL_FASKES,
  AVAILABLE_REFERRAL_DOCTORS,
} from "@/features/medical-records/exam/ExamTab5MedicoLegal";

export { AVAILABLE_REFERRAL_FASKES, AVAILABLE_REFERRAL_DOCTORS };

export interface ExamTabs4To5Props extends ExamTab4PlanProps, ExamTab5MedicoLegalProps {
  activeTab: 1 | 2 | 3 | 4 | 5;
}

export function ExamTabs4To5(props: ExamTabs4To5Props) {
  if (props.activeTab === 4) {
    return <ExamTab4Plan {...props} />;
  }
  if (props.activeTab === 5) {
    return <ExamTab5MedicoLegal {...props} />;
  }
  return null;
}
