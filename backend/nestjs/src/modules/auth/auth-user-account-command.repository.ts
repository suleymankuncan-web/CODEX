import { ConflictException, Injectable } from "@nestjs/common";
import { buildRequestAuditMetadata } from "../../shared/audit/audit-metadata.factory";
import { DatabaseService } from "../../shared/database/database.service";
import { IdentityLifecycleRepository } from "./identity-lifecycle.repository";

type RoleAssignmentCommandRow = {
  user_role_assignment_id: string;
  user_id: string;
  username?: string;
  email?: string;
  role_code: string;
  role_name?: string;
  scope_type: string;
  company_id: string | null;
  region_id: string | null;
  store_id: string | null;
  start_at: string;
  end_at: string | null;
  created_at: string;
};

type ActionStoreAssignmentCommandRow = {
  user_action_store_assignment_id: string;
  user_id: string;
  username?: string;
  email?: string;
  store_id: string;
  store_code: string;
  store_name: string;
  company_id: string;
  region_id: string;
  region_name: string;
  start_at: string;
  end_at: string | null;
  created_at: string;
};

type StoreLookupCommandRow = {
  store_id: string;
  store_code: string;
  store_name: string;
  company_id: string;
  region_id: string;
  region_name: string;
};

type ActiveEmployeeAccessContextCommandRow = {
  employee_id: string;
  external_employee_ref: string | null;
  first_name: string;
  last_name: string;
  store_id: string;
  store_code: string;
  store_name: string;
  company_id: string;
  region_id: string;
};

type UserAccountCommandRow = {
  user_id: string;
  employee_id: string | null;
  username: string;
  first_name: string | null;
  last_name: string | null;
  email: string;
  auth_provider: string;
  provider_subject: string | null;
  is_active: boolean;
  last_login_at: string | null;
  created_at: string;
  deactivated_at?: string | null;
  deactivation_reason?: string | null;
  deactivated_by_user_id?: string | null;
};

export type CreateUserAccountCommandInput = {
  employeeId?: string | null;
  username: string;
  firstName?: string | null;
  lastName?: string | null;
  email: string;
  authProvider: string;
  providerSubject?: string | null;
  actorUserId: string;
};

export type CreatePilotUserBindingCommandInput = {
  employeeId: string;
  authProvider: string;
  providerSubject: string;
  username: string;
  email: string;
  role: {
    role_id: string;
    role_code: string;
    role_scope_type: string;
    role_name: string;
  };
  stores: StoreLookupCommandRow[];
  employee: ActiveEmployeeAccessContextCommandRow;
  actorUserId: string;
};

export type ReactivateUserAccountCommandInput = {
  userId: string;
  actorUserId: string;
};

export type UpdateUserAccountCommandInput = {
  userId: string;
  employeeId?: string | null;
  username?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  actorUserId: string;
};

@Injectable()
export class AuthUserAccountCommandRepository {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly identityLifecycleRepository?: IdentityLifecycleRepository,
  ) {}

  async createUserAccount(input: CreateUserAccountCommandInput) {
    try {
      return await this.databaseService.withTransaction(async (client) => {
      const result = await client.query<UserAccountCommandRow>(
        `
          INSERT INTO ops.user_account (
            employee_id,
            username,
            first_name,
            last_name,
            email,
            auth_provider,
            provider_subject,
            is_active
          )
          VALUES ($1::uuid, LOWER(BTRIM($2)), $3, $4, LOWER(BTRIM($5)), $6, $7, $8)
          RETURNING
            user_id,
            employee_id,
            username,
            first_name,
            last_name,
            email,
            auth_provider,
            provider_subject,
            is_active,
            last_login_at,
            created_at
        `,
        [
          input.employeeId ?? null,
          input.username,
          input.firstName ?? null,
          input.lastName ?? null,
          input.email,
          input.authProvider,
          input.providerSubject ?? null,
          !(input.authProvider === "oidc" && !input.providerSubject),
        ],
      );

      const user = result.rows[0];

      if (user.auth_provider === "oidc" && !user.provider_subject) {
        await this.identityLifecycleRepository?.enqueueInTransaction(client, {
          userId: user.user_id,
          operation: "provision",
          actorUserId: input.actorUserId,
          idempotencyKey: `provision:${user.user_id}`,
        });
      }

      await client.query(
        `
          INSERT INTO audit.event_log (
            actor_user_id,
            event_type,
            entity_name,
            entity_id,
            scope_type,
            metadata_json
          )
          VALUES ($1::uuid, 'user_account.created', 'ops.user_account', $2::uuid, 'company', $3::jsonb)
        `,
        [
          input.actorUserId,
          user.user_id,
          JSON.stringify({
            ...buildRequestAuditMetadata({
              sourceContext: {
                module: "auth-admin",
                operation: "create-user-account",
              },
              changedFields: [
                "employeeId",
                "username",
                "firstName",
                "lastName",
                "email",
                "authProvider",
                "providerSubject",
                "isActive",
              ],
              details: {
                employeeId: user.employee_id,
                username: user.username,
                firstName: user.first_name,
                lastName: user.last_name,
                email: user.email,
                authProvider: user.auth_provider,
                providerSubject: user.provider_subject,
                isActive: user.is_active,
              },
            }),
          }),
        ],
      );

      return user;
      });
    } catch (error) {
      throw mapUserAccountUniqueError(error);
    }
  }

  async updateUserAccount(input: UpdateUserAccountCommandInput) {
    const setClauses: string[] = [];
    const changedFields: string[] = [];
    const details: Record<string, unknown> = {};
    const params: unknown[] = [];

    if (input.employeeId !== undefined) {
      params.push(input.employeeId);
      setClauses.push(`employee_id = $${params.length}::uuid`);
      changedFields.push("employeeId");
      details.employeeId = input.employeeId;
    }

    if (input.username !== undefined) {
      params.push(input.username);
      setClauses.push(`username = LOWER(BTRIM($${params.length}))`);
      changedFields.push("username");
      details.username = input.username;
    }

    if (input.firstName !== undefined) {
      params.push(input.firstName, input.lastName);
      setClauses.push(`first_name = $${params.length - 1}`, `last_name = $${params.length}`);
      changedFields.push("firstName", "lastName");
      details.firstName = input.firstName;
      details.lastName = input.lastName;
    }

    if (input.email !== undefined) {
      params.push(input.email);
      setClauses.push(`email = LOWER(BTRIM($${params.length}))`);
      changedFields.push("email");
      details.email = input.email;
    }

    if (setClauses.length === 0) {
      return null;
    }

    try {
      return await this.databaseService.withTransaction(async (client) => {
      params.push(input.userId);
      const userResult = await client.query<UserAccountCommandRow>(
        `
          /* auth_update_user_account */
          UPDATE ops.user_account
          SET ${setClauses.join(", ")},
              updated_at = NOW()
          WHERE user_id = $${params.length}::uuid
          RETURNING
            user_id,
            employee_id,
            username,
            first_name,
            last_name,
            email,
            auth_provider,
            provider_subject,
            is_active,
            last_login_at,
            created_at,
            deactivated_at,
            deactivation_reason,
            deactivated_by_user_id
        `,
        params,
      );

      const user = userResult.rows[0] ?? null;
      if (!user) {
        return null;
      }

      if (user.auth_provider === "oidc" && user.provider_subject) {
        await this.identityLifecycleRepository?.enqueueInTransaction(client, {
          userId: user.user_id,
          operation: "update_profile",
          actorUserId: input.actorUserId,
        });
      }

      await client.query(
        `
          INSERT INTO audit.event_log (
            actor_user_id,
            event_type,
            entity_name,
            entity_id,
            scope_type,
            metadata_json
          )
          VALUES ($1::uuid, 'user_account.updated', 'ops.user_account', $2::uuid, 'company', $3::jsonb)
        `,
        [
          input.actorUserId,
          input.userId,
          JSON.stringify({
            ...buildRequestAuditMetadata({
              sourceContext: {
                module: "auth-admin",
                operation: "update-user-account",
              },
              changedFields,
              details,
            }),
          }),
        ],
      );

      return user;
      });
    } catch (error) {
      throw mapUserAccountUniqueError(error);
    }
  }

  async createPilotUserBinding(input: CreatePilotUserBindingCommandInput) {
    return this.databaseService.withTransaction(async (client) => {
      const userResult = await client.query<UserAccountCommandRow>(
        `
          INSERT INTO ops.user_account (
            employee_id,
            username,
            email,
            auth_provider,
            provider_subject
          )
          VALUES ($1::uuid, $2, $3, $4, $5)
          RETURNING
            user_id,
            employee_id,
            username,
            email,
            auth_provider,
            provider_subject,
            is_active,
            last_login_at,
            created_at
        `,
        [
          input.employeeId,
          input.username,
          input.email,
          input.authProvider,
          input.providerSubject,
        ],
      );

      const user = userResult.rows[0];
      const roleAssignments: RoleAssignmentCommandRow[] = [];
      const actionStoreAssignments: ActionStoreAssignmentCommandRow[] = [];

      for (const store of input.stores) {
        const roleAssignmentResult = await client.query<RoleAssignmentCommandRow>(
          `
            INSERT INTO ops.user_role_assignment (
              user_id,
              role_id,
              scope_type,
              company_id,
              region_id,
              store_id,
              start_at
            )
            VALUES (
              $1::uuid,
              $2::uuid,
              'store',
              $3::uuid,
              $4::uuid,
              $5::uuid,
              NOW()
            )
            RETURNING
              user_role_assignment_id,
              user_id,
              $6::text AS role_code,
              scope_type,
              company_id,
              region_id,
              store_id,
              start_at,
              end_at,
              created_at
          `,
          [
            user.user_id,
            input.role.role_id,
            store.company_id,
            store.region_id,
            store.store_id,
            input.role.role_code,
          ],
        );
        roleAssignments.push(roleAssignmentResult.rows[0]);

        const actionStoreAssignmentResult = await client.query<ActionStoreAssignmentCommandRow>(
          `
            WITH inserted AS (
              INSERT INTO ops.user_action_store_assignment (
                user_id,
                store_id,
                start_at
              )
              VALUES ($1::uuid, $2::uuid, NOW())
              RETURNING
                user_action_store_assignment_id,
                user_id,
                store_id,
                start_at,
                end_at,
                created_at
            )
            SELECT
              inserted.user_action_store_assignment_id,
              inserted.user_id,
              ua.username,
              ua.email,
              inserted.store_id,
              s.store_code,
              s.store_name,
              s.company_id,
              s.region_id,
              r.region_name,
              inserted.start_at,
              inserted.end_at,
              inserted.created_at
            FROM inserted
            INNER JOIN ops.user_account ua
              ON ua.user_id = inserted.user_id
            INNER JOIN ops.store s
              ON s.store_id = inserted.store_id
            INNER JOIN ops.region r
              ON r.region_id = s.region_id
          `,
          [user.user_id, store.store_id],
        );
        actionStoreAssignments.push(actionStoreAssignmentResult.rows[0]);
      }

      await client.query(
        `
          INSERT INTO audit.event_log (
            actor_user_id,
            event_type,
            entity_name,
            entity_id,
            scope_type,
            company_id,
            region_id,
            store_id,
            metadata_json
          )
          VALUES (
            $1::uuid,
            'pilot_user_binding.created',
            'ops.user_account',
            $2::uuid,
            'store',
            $3::uuid,
            $4::uuid,
            $5::uuid,
            $6::jsonb
          )
        `,
        [
          input.actorUserId,
          user.user_id,
          input.stores[0]?.company_id ?? null,
          input.stores[0]?.region_id ?? null,
          input.stores[0]?.store_id ?? null,
          JSON.stringify({
            ...buildRequestAuditMetadata({
              sourceContext: {
                module: "auth-admin",
                operation: "create-pilot-user-binding",
              },
              changedFields: [
                "employeeId",
                "username",
                "email",
                "authProvider",
                "providerSubject",
                "roleCode",
                "storeIds",
              ],
              details: {
                employeeId: input.employeeId,
                username: input.username,
                email: input.email,
                authProvider: input.authProvider,
                providerSubject: input.providerSubject,
                roleCode: input.role.role_code,
                storeIds: input.stores.map((store) => store.store_id),
              },
            }),
          }),
        ],
      );

      return {
        user,
        roleAssignments,
        actionStoreAssignments,
        employee: input.employee,
      };
    });
  }

  async reactivateUserAccount(input: ReactivateUserAccountCommandInput) {
    return this.databaseService.withTransaction(async (client) => {
      const result = await client.query<UserAccountCommandRow>(
        `
          UPDATE ops.user_account
          SET is_active = CASE WHEN auth_provider = 'oidc' THEN FALSE ELSE TRUE END,
              updated_at = NOW(),
              deactivated_at = NULL,
              deactivation_reason = NULL,
              deactivated_by_user_id = NULL
          WHERE user_id = $1::uuid
            AND is_active = FALSE
          RETURNING
            user_id,
            employee_id,
            username,
            email,
            auth_provider,
            provider_subject,
            is_active,
            last_login_at,
            created_at
        `,
        [input.userId],
      );

      const user = result.rows[0] ?? null;

      if (user) {
        if (user.auth_provider === "oidc") {
          await this.identityLifecycleRepository?.enqueueInTransaction(client, {
            userId: user.user_id,
            operation: user.provider_subject ? "enable" : "provision",
            actorUserId: input.actorUserId,
            idempotencyKey: `${user.provider_subject ? "enable" : "provision"}:${user.user_id}:${Date.now()}`,
          });
        }
        await client.query(
          `
            INSERT INTO audit.event_log (
              actor_user_id,
              event_type,
              entity_name,
              entity_id,
              scope_type,
              metadata_json
            )
            VALUES ($1::uuid, 'user_account.reactivated', 'ops.user_account', $2::uuid, 'company', $3::jsonb)
          `,
          [
            input.actorUserId,
            input.userId,
            JSON.stringify({
              ...buildRequestAuditMetadata({
                sourceContext: {
                  module: "auth-admin",
                  operation: "reactivate-user-account",
                },
                changedFields: ["isActive"],
                details: {
                  username: user.username,
                  email: user.email,
                  isActive: user.is_active,
                },
              }),
            }),
          ],
        );
      }

      return user;
    });
  }
}

function mapUserAccountUniqueError(error: unknown): unknown {
  const constraint = (error as { code?: string; constraint?: string })?.constraint;
  if ((error as { code?: string })?.code === "23505") {
    if (constraint === "user_account_username_key") {
      return new ConflictException("Username is already in use");
    }
    if (constraint === "user_account_email_key") {
      return new ConflictException("Email is already in use");
    }
  }
  return error;
}
