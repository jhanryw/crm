export enum UserRole {
    ADMIN = 'admin',
    MANAGER = 'manager',
    SALESPERSON = 'salesperson',
}

export const ROLES = {
    admin: UserRole.ADMIN,
    manager: UserRole.MANAGER,
    salesperson: UserRole.SALESPERSON,
};

export function hasPermission(userRole: string, requiredRole: UserRole): boolean {
    if (userRole === UserRole.ADMIN) return true; // Admin can do everything
    if (userRole === UserRole.MANAGER && requiredRole !== UserRole.ADMIN) return true; // Manager can do everything except admin stuff
    if (userRole === UserRole.SALESPERSON && requiredRole === UserRole.SALESPERSON) return true;
    return false;
}
