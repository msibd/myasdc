export const rolePermissions = {
  superadmin: { user: ["create", "list", "get", "update", "delete", "set-role", "ban"], patient: ["create", "list", "get", "update", "delete"], appointment: ["create", "list", "get", "update", "delete"], doctor: ["create", "list", "get", "update", "delete"], lab: ["create", "list", "get", "update", "collect", "assign"], report: ["create", "list", "get", "update", "verify", "approve", "deliver"], billing: ["create", "list", "get", "update", "collect"], inventory: ["create", "list", "get", "update", "delete", "adjust"], settings: ["get", "update"], analytics: ["get"] },
  manager: { user: ["list", "get", "update"], patient: ["create", "list", "get", "update", "delete"], appointment: ["create", "list", "get", "update", "delete"], doctor: ["create", "list", "get", "update", "delete"], lab: ["create", "list", "get", "update", "collect", "assign"], report: ["create", "list", "get", "update", "verify", "approve", "deliver"], billing: ["create", "list", "get", "update", "collect"], inventory: ["create", "list", "get", "update", "delete", "adjust"], settings: ["get"], analytics: ["get"] },
  receptionist: { patient: ["create", "list", "get", "update"], appointment: ["create", "list", "get", "update", "delete"], doctor: ["list", "get"], billing: ["create", "list", "get", "collect"] },
  doctor: { patient: ["list", "get"], appointment: ["list", "get", "update"], lab: ["list", "get"], report: ["list", "get", "create", "update", "verify"] },
  lab_technician: { patient: ["list", "get"], lab: ["create", "list", "get", "update", "collect"], report: ["list", "get", "create", "update"] },
  accountant: { patient: ["list", "get"], billing: ["create", "list", "get", "update", "collect"] },
  inventory_manager: { inventory: ["create", "list", "get", "update", "delete", "adjust"] },
} as const;

export const roleLabels: Record<keyof typeof rolePermissions, string> = {
  superadmin: "Super administrator", manager: "Centre manager", receptionist: "Receptionist", doctor: "Doctor", lab_technician: "Lab technician", accountant: "Accountant", inventory_manager: "Inventory manager",
};

export const permissionResources = ["user", "patient", "appointment", "doctor", "lab", "report", "billing", "inventory", "settings", "analytics"] as const;
