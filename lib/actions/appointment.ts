export type { AppointmentActionResponse } from "@/features/appointments/booking-actions";
export {
  createAppointmentServerAction,
  getAppointmentsServerAction,
  updateAppointmentDetailsServerAction,
  deleteAppointmentServerAction,
} from "@/features/appointments/booking-actions";

export {
  assignDpjpServerAction,
  updateAppointmentStatusServerAction,
  checkInAppointmentServerAction,
  createWalkInAppointmentServerAction,
} from "@/features/appointments/workflow-actions";
