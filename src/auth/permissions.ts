import { createAccessControl } from "better-auth/plugins/access";

export const statement = {
  user: ["create", "list", "get", "update", "delete", "set-role", "ban"],
  patient: ["create", "list", "get", "update", "delete"],
  appointment: ["create", "list", "get", "update", "delete"],
  doctor: ["create", "list", "get", "update", "delete"],
  lab: ["create", "list", "get", "update", "collect", "assign"],
  report: ["create", "list", "get", "update", "verify", "approve", "deliver"],
  billing: ["create", "list", "get", "update", "collect"],
  inventory: ["create", "list", "get", "update", "delete", "adjust"],
  settings: ["get", "update"],
  analytics: ["get"],
} as const;

export const ac = createAccessControl(statement);

const all = {
  user: [...statement.user], patient: [...statement.patient], appointment: [...statement.appointment], doctor: [...statement.doctor],
  lab: [...statement.lab], report: [...statement.report], billing: [...statement.billing],
  inventory: [...statement.inventory], settings: [...statement.settings],
  analytics: [...statement.analytics],
};

export const superadmin = ac.newRole(all);
export const manager = ac.newRole({ ...all, user: ["list", "get", "update"], settings: ["get"] });
export const receptionist = ac.newRole({ patient: ["create", "list", "get", "update"], appointment: [...statement.appointment], doctor: ["list", "get"], billing: ["create", "list", "get", "collect"] });
export const doctor = ac.newRole({ patient: ["list", "get"], appointment: ["list", "get", "update"], lab: ["list", "get"], report: ["list", "get", "create", "update", "verify"] });
export const labTechnician = ac.newRole({ patient: ["list", "get"], lab: ["create", "list", "get", "update", "collect"], report: ["list", "get", "create", "update"] });
export const accountant = ac.newRole({ patient: ["list", "get"], billing: [...statement.billing] });
export const inventoryManager = ac.newRole({ inventory: [...statement.inventory] });

export const roles = { superadmin, manager, receptionist, doctor, lab_technician: labTechnician, accountant, inventory_manager: inventoryManager };
export type RoleName = keyof typeof roles;
