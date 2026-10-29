import { redirect } from "next/navigation";

export default function PatientReportsRedirect() {
  redirect("/login?view=patient-reports");
}
