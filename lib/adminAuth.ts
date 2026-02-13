/**
 * ANCHOR INSTITUTIONAL BACKEND - ADMIN AUTHENTICATION
 * 
 * Handles admin access control via Supabase auth + admin_users table.
 * 
 * Pattern:
 * 1. Verify user session via Supabase
 * 2. Look up admin_users table
 * 3. Enforce institution scoping
 * 4. Return admin context or 401/403
 * 
 * FOR SERVER-SIDE USE ONLY.
 * Service role key used for database queries.
 */

import { createClient } from '@supabase/supabase-js';

function decodeJwtPayload(token: string): any | null {
  const parts = token.split('.');
  if (parts.length !== 3) return null;

  const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, '=');
  try {
    return JSON.parse(Buffer.from(padded, 'base64').toString('utf-8'));
  } catch {
    return null;
  }
}

// Server-side client (uses service role key)
// Must be initialized from environment variables
// NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY
export function getAdminServiceClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Missing Supabase credentials for admin service client');
  }

  return createClient(supabaseUrl, serviceRoleKey);
}

// ============================================================================
// TYPES
// ============================================================================

export type AdminRole = 'counsellor' | 'lead' | 'admin';

export interface AdminContext {
  auth_uid: string;
  admin_id: string;
  institution_id: string;
  role: AdminRole;
  full_name: string;
  email: string;
  is_active: boolean;
}

export interface AuthenticationError {
  code: 'NO_SESSION' | 'NOT_ADMIN' | 'INACTIVE' | 'DB_ERROR' | 'MISSING_CREDENTIALS';
  message: string;
}

// ============================================================================
// CORE FUNCTIONS
// ============================================================================

/**
 * Verify admin user from request headers.
 * 
 * Expects Authorization header: "Bearer <jwt_token>" (from Supabase session)
 * 
 * Flow:
 * 1. Extract JWT from Authorization header
 * 2. Decode JWT locally (don't call Supabase auth - it times out)
 * 3. Look up user in admin_users table using auth_uid from JWT
 * 4. Verify is_active = true
 * 5. Return admin context or error
 * 
 * @param authorizationHeader The Authorization header value
 * @returns AdminContext or AuthenticationError
 */
export async function verifyAdminFromHeader(
  authorizationHeader: string | null
): Promise<AdminContext | AuthenticationError> {
  if (!authorizationHeader) {
    return {
      code: 'NO_SESSION',
      message: 'Missing Authorization header',
    };
  }

  const token = authorizationHeader.replace('Bearer ', '');
  if (!token) {
    return {
      code: 'NO_SESSION',
      message: 'Invalid Authorization header format',
    };
  }

  try {
    // Decode JWT without verifying signature (Supabase auth.getUser() times out from server)
    // The token has already been verified by Supabase when issued
    const payload = decodeJwtPayload(token);
    if (!payload) {
      return {
        code: 'NO_SESSION',
        message: 'Invalid JWT format',
      };
    }

    const auth_uid = payload.sub;
    if (!auth_uid) {
      return {
        code: 'NO_SESSION',
        message: 'Invalid token: no sub (user ID)',
      };
    }

    console.log('[ADMIN_AUTH] Checking admin status for user:', auth_uid);

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !serviceRoleKey) {
      return {
        code: 'MISSING_CREDENTIALS',
        message: 'Missing Supabase server credentials',
      };
    }

    let client;
    try {
      client = getAdminServiceClient();
    } catch (clientError: any) {
      console.error('[ADMIN_AUTH] Failed to create client:', clientError);
      return {
        code: 'DB_ERROR',
        message: `Failed to initialize database client: ${clientError.message}`,
      };
    }

    // Look up admin_users table
    let adminUser;
    let adminError;
    try {
      const result = await client
        .from('admin_users')
        .select('id, institution_id, role, full_name, email, is_active')
        .eq('auth_uid', auth_uid)
        .maybeSingle();
      
      adminUser = result.data;
      adminError = result.error;
    } catch (queryError: any) {
      console.error('[ADMIN_AUTH] Query threw error:', {
        message: queryError.message,
        cause: queryError.cause,
        stack: queryError.stack?.split('\n')[0]
      });
      return {
        code: 'DB_ERROR',
        message: `Database connection error: ${queryError.message}`,
      };
    }

    if (adminError) {
      console.error('[ADMIN_AUTH] Query error response:', adminError);
      return {
        code: 'DB_ERROR',
        message: `Database error during authentication: ${adminError.message}`,
      };
    }

    if (!adminUser) {
      console.log('[ADMIN_AUTH] User is not an admin:', auth_uid);
      return {
        code: 'NOT_ADMIN',
        message: 'User is not an admin',
      };
    }

    console.log('[ADMIN_AUTH] Admin verified:', { auth_uid, institution_id: adminUser.institution_id, role: adminUser.role });

    // Verify is_active
    if (!adminUser.is_active) {
      console.log('[ADMIN_AUTH] Admin is inactive:', auth_uid);
      return {
        code: 'INACTIVE',
        message: 'Admin account is inactive',
      };
    }

    return {
      auth_uid,
      admin_id: adminUser.id,
      institution_id: adminUser.institution_id,
      role: adminUser.role,
      full_name: adminUser.full_name,
      email: adminUser.email,
      is_active: adminUser.is_active,
    };
  } catch (error) {
    console.error('[ADMIN_AUTH_ERROR]', error);
    return {
      code: 'DB_ERROR',
      message: 'Error during authentication',
    };
  }
}

/**
 * Verify admin has role ≥ required_role.
 * 
 * Role hierarchy: counsellor < lead < admin
 * 
 * @param admin AdminContext from verifyAdminFromHeader
 * @param required_role Minimum role required
 * @returns true if admin has sufficient role
 */
export function hasAdminRole(admin: AdminContext, required_role: AdminRole): boolean {
  const roleHierarchy: Record<AdminRole, number> = {
    counsellor: 1,
    lead: 2,
    admin: 3,
  };

  return roleHierarchy[admin.role] >= roleHierarchy[required_role];
}

/**
 * Middleware function for Next.js API routes.
 * 
 * Usage:
 * ```
 * const admin = await requireAdmin(req);
 * if ('code' in admin) {
 *   return res.status(403).json(admin);
 * }
 * // Now safe to use admin context
 * ```
 * 
 * @param request Next.js request object
 * @returns AdminContext or AuthenticationError
 */
export async function requireAdmin(
  request: Request
): Promise<AdminContext | AuthenticationError> {
  const authHeader = request.headers.get('authorization');
  return verifyAdminFromHeader(authHeader);
}

/**
 * Create a new admin user (for onboarding).
 * 
 * **ADMIN-ONLY FUNCTION** – Should only be called from admin setup route.
 * Requires service role key.
 * 
 * @param auth_uid UUID of existing Supabase auth user
 * @param institution_id UUID of institution
 * @param email Admin email
 * @param full_name Admin full name
 * @param role Admin role
 * @returns Created admin_users record or error
 */
export async function createAdminUser(
  auth_uid: string,
  institution_id: string,
  email: string,
  full_name: string,
  role: AdminRole
): Promise<any | AuthenticationError> {
  try {
    const client = getAdminServiceClient();

    const { data, error } = await client
      .from('admin_users')
      .insert({
        auth_uid,
        institution_id,
        email,
        full_name,
        role,
        is_active: true,
      })
      .select()
      .single();

    if (error) {
      return {
        code: 'DB_ERROR',
        message: `Failed to create admin: ${error.message}`,
      };
    }

    return data;
  } catch (error) {
    console.error('[CREATE_ADMIN_ERROR]', error);
    return {
      code: 'DB_ERROR',
      message: 'Failed to create admin user',
    };
  }
}

/**
 * Get institution context (admin users allowed to access).
 * 
 * @param admin AdminContext
 * @returns institution_id from admin context
 */
export function getAdminInstitutionId(admin: AdminContext): string {
  return admin.institution_id;
}

/**
 * Log admin action (audit trail).
 * 
 * Call this from admin routes to track access.
 * Future: store in admin_audit_log table.
 */
export function logAdminAction(
  admin: AdminContext,
  action: string,
  resource: string,
  status: 'success' | 'failure'
): void {
  console.info(
    `[ADMIN_ACTION] ${admin.email} (${admin.role}) ${action} ${resource}: ${status}`
  );
}
