import { ConflictException, Injectable } from "@nestjs/common";
import {
  AccessLifecycleReason,
  AccessLifecycleRepository,
  AccessLifecycleSourceEntity,
  AccessLifecycleUserRow,
} from "./access-lifecycle.repository";

@Injectable()
export class AccessLifecycleService {
  constructor(private readonly accessLifecycleRepository: AccessLifecycleRepository) {}

  async deactivateUserAccess(input: {
    userId: string;
    actorUserId: string;
    reason: AccessLifecycleReason;
    sourceEntity?: AccessLifecycleSourceEntity;
  }): Promise<{
    user: AccessLifecycleUserRow;
    closedRoleAssignments: number;
    closedActionStoreAssignments: number;
    revokedMobileSessions: number;
  }> {
    const result = await this.accessLifecycleRepository.deactivateUserAccess(input);

    const user = result.user;
    if (!user) {
      throw new ConflictException("User account is already inactive");
    }

    return {
      ...result,
      user,
    };
  }
}
