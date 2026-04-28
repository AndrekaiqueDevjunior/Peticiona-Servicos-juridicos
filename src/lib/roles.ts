export type UserRole = "cliente" | "funcionario" | "admin";

let role: UserRole = "cliente";

export const setRole = (r: UserRole) => {
  role = r;
};

export const getRole = () => role;

export const roleFromBackend = (value?: string | null): UserRole => {
  if (value === "admin") return "admin";
  if (value === "staff") return "funcionario";
  return "cliente";
};

export const dashboardPathForRole = (r: UserRole): string => {
  switch (r) {
    case "admin":
      return "/admin";
    case "funcionario":
      return "/area-interna";
    default:
      return "/area-cliente";
  }
};
