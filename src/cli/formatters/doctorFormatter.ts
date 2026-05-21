export interface DoctorCheck {
  name: string;
  status: "ok" | "warn";
  detail: string;
  fix?: string;
}

export function formatDoctorCheck(check: DoctorCheck): string {
  const prefix = check.status === "ok" ? "OK" : "WARN";
  return check.fix
    ? `${prefix} ${check.name}: ${check.detail}\n  fix: ${check.fix}`
    : `${prefix} ${check.name}: ${check.detail}`;
}
