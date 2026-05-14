export type PanelUserPublic = {
  login: string;
  role: "superadmin" | "admin" | "user";
  displayName?: string;
  employeeId?: string;
};
