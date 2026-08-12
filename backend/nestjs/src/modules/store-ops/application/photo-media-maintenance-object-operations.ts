import {
  PhotoMediaObjectReference,
  PhotoMediaObjectStoragePort,
  PhotoMediaObjectVersionInventory,
} from "./photo-media-storage.ports";

export type PhotoMediaMaintenanceOperationReservation = (
  classAOperations: number,
  classBOperations: number,
  enforceHardLimits?: boolean,
) => Promise<void>;

export function createPhotoMediaMaintenanceObjectOperations(input: {
  provider: "r2" | "seaweedfs";
  reserve: PhotoMediaMaintenanceOperationReservation;
}) {
  const reserveAndInvoke = async <T>(
    classAOperations: number,
    classBOperations: number,
    operation: () => Promise<T>,
    enforceHardLimits = true,
  ): Promise<T> => {
    if (enforceHardLimits) {
      await input.reserve(classAOperations, classBOperations);
    } else {
      await input.reserve(classAOperations, classBOperations, false);
    }
    return operation();
  };

  return {
    put: (
      storage: PhotoMediaObjectStoragePort,
      object: {
        objectKey: string;
        body: Buffer;
        contentType: string;
        sha256: string;
        createOnly?: boolean;
      },
    ) => reserveAndInvoke(1, 0, () => storage.putObject(object)),
    head: (
      storage: PhotoMediaObjectStoragePort,
      reference: string | PhotoMediaObjectReference,
    ) => reserveAndInvoke(0, 1, () => storage.headObject(reference)),
    get: (
      storage: PhotoMediaObjectStoragePort,
      reference: string | PhotoMediaObjectReference,
    ) => reserveAndInvoke(0, 1, () => storage.getObject(reference)),
    delete: (
      storage: PhotoMediaObjectStoragePort,
      reference: string | PhotoMediaObjectReference,
    ) => {
      const exactLocal = input.provider !== "r2" &&
        typeof reference !== "string" && typeof reference.versionId === "string";
      return reserveAndInvoke(1, exactLocal ? 1 : 0, () => storage.deleteObject(reference), false);
    },
    listVersions: async (
      storage: PhotoMediaObjectStoragePort,
      object: { objectKey: string },
    ): Promise<PhotoMediaObjectVersionInventory> => {
      if (input.provider === "r2") {
        return reserveAndInvoke(1, 0, () => storage.listObjectVersions(object));
      }
      const listObjectVersionsByPrefix = storage.listObjectVersionsByPrefix;
      if (typeof listObjectVersionsByPrefix !== "function") {
        throw new Error("Photo media object version inventory is unavailable");
      }
      const versions: PhotoMediaObjectReference[] = [];
      const identities = new Set<string>();
      let cursor: { keyMarker?: string; versionIdMarker?: string } | undefined;
      do {
        await input.reserve(1, 0);
        const page = await listObjectVersionsByPrefix.call(storage, {
          prefix: object.objectKey,
          ...(cursor ? { cursor } : {}),
        });
        if (!page || !Array.isArray(page.versions) || !Array.isArray(page.deleteMarkers)) {
          throw new Error("Photo media object version inventory is unavailable");
        }
        if (page.deleteMarkers.some((reference) => reference?.objectKey === object.objectKey)) {
          throw new Error("Photo media object version inventory contains a delete marker");
        }
        if (page.versions.some((reference) => reference?.objectKey !== object.objectKey)) {
          throw new Error("Photo media object version inventory is ambiguous");
        }
        for (const reference of page.versions) {
          if (typeof reference.versionId !== "string" || reference.versionId.trim() === "") {
            throw new Error("Photo media object version inventory is ambiguous");
          }
          const identity = `${reference.objectKey}\u0000${reference.versionId}`;
          if (!identities.has(identity)) {
            identities.add(identity);
            versions.push({ objectKey: reference.objectKey, versionId: reference.versionId });
          }
        }
        if (page.nextCursor !== undefined) {
          if (
            !page.nextCursor ||
            typeof page.nextCursor.keyMarker !== "string" ||
            page.nextCursor.keyMarker.trim() === "" ||
            typeof page.nextCursor.versionIdMarker !== "string" ||
            page.nextCursor.versionIdMarker.trim() === ""
          ) {
            throw new Error("Photo media object version inventory is ambiguous");
          }
          cursor = {
            keyMarker: page.nextCursor.keyMarker,
            versionIdMarker: page.nextCursor.versionIdMarker,
          };
        } else {
          cursor = undefined;
        }
      } while (cursor);
      return { versions };
    },
  };
}
