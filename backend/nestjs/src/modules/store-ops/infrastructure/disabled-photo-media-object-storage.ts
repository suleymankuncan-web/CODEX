import { ServiceUnavailableException } from "@nestjs/common";
import { PhotoMediaObjectStoragePort } from "../application/photo-media-storage.ports";

export class DisabledPhotoMediaObjectStorage implements PhotoMediaObjectStoragePort {
  async createSignedRead(): Promise<never> { return this.unavailable(); }
  private unavailable(): never {
    throw new ServiceUnavailableException("Photo media storage is disabled");
  }

  async getObject(): Promise<never> { return this.unavailable(); }
  async putObject(): Promise<never> { return this.unavailable(); }
  async headObject(): Promise<never> { return this.unavailable(); }
  async deleteObject(): Promise<never> { return this.unavailable(); }
  async listObjectKeys(): Promise<never> { return this.unavailable(); }
  async listObjectVersions(): Promise<never> { return this.unavailable(); }
}
