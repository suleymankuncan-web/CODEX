import "reflect-metadata";
import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import { CreateFeedPostDto } from "./create-feed-post.dto";
import { UpdateFeedPostDto } from "./update-feed-post.dto";

const whitelistOptions = {
  whitelist: true,
  forbidNonWhitelisted: true,
};

describe("Feed post DTO validation", () => {
  it("accepts the region manager create payload used by the feed composer", async () => {
    const dto = plainToInstance(CreateFeedPostDto, {
      postType: "announcement",
      title: "Haftalik duyuru",
      body: "Yeni vitrin notlari paylasildi.",
      visibilityScopeType: "region",
      visibilityScopeIds: ["00000000-0000-0000-0000-000000000701"],
      isPinned: true,
      publishStatus: "published",
    });

    await expect(validate(dto, whitelistOptions)).resolves.toHaveLength(0);
  });

  it("rejects wrapped create payloads instead of silently accepting the wrong shape", async () => {
    const dto = plainToInstance(CreateFeedPostDto, {
      payload: {
        postType: "announcement",
        title: "Haftalik duyuru",
        body: "Yeni vitrin notlari paylasildi.",
        visibilityScopeType: "region",
      },
    });

    const errors = await validate(dto, whitelistOptions);

    expect(JSON.stringify(errors)).toContain("payload");
  });

  it("accepts the inline edit update payload", async () => {
    const dto = plainToInstance(UpdateFeedPostDto, {
      title: "Guncel duyuru",
      body: "Magaza ekipleri icin not guncellendi.",
    });

    await expect(validate(dto, whitelistOptions)).resolves.toHaveLength(0);
  });
});
