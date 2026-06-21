import { describe, expect, it } from "vitest";

import {
  assertPublicHttpsUrl,
  BlockedUrlError,
  isBlockedAddress,
} from "./net-guard.ts";

describe("isBlockedAddress", () => {
  it.each([
    ["127.0.0.1", true], // loopback
    ["10.0.0.5", true], // 10/8 private
    ["172.16.0.1", true], // 172.16/12 private
    ["172.31.255.255", true],
    ["192.168.1.1", true], // 192.168/16 private
    ["169.254.169.254", true], // cloud metadata (link-local)
    ["100.64.0.1", true], // CGNAT
    ["0.0.0.0", true], // "this" network
    ["224.0.0.1", true], // multicast
    ["::1", true], // v6 loopback
    ["fc00::1", true], // unique-local
    ["fe80::1", true], // link-local
    ["::ffff:127.0.0.1", true], // v4-mapped loopback
    ["8.8.8.8", false], // public
    ["1.1.1.1", false], // public
    ["172.32.0.1", false], // just outside 172.16/12
    ["2606:4700:4700::1111", false], // public v6
    ["not-an-ip", true], // unparseable -> blocked
  ])("%s -> blocked=%s", (addr, blocked) => {
    expect(isBlockedAddress(addr)).toBe(blocked);
  });
});

describe("assertPublicHttpsUrl (literal IPs — no DNS)", () => {
  it("rejects non-https", async () => {
    await expect(assertPublicHttpsUrl("http://93.184.216.34/")).rejects.toBeInstanceOf(
      BlockedUrlError,
    );
  });
  it("rejects https to the metadata IP", async () => {
    await expect(
      assertPublicHttpsUrl("https://169.254.169.254/latest/meta-data/"),
    ).rejects.toBeInstanceOf(BlockedUrlError);
  });
  it("rejects https to a private literal", async () => {
    await expect(assertPublicHttpsUrl("https://10.0.0.1/hook")).rejects.toBeInstanceOf(
      BlockedUrlError,
    );
  });
  it("rejects a garbage url", async () => {
    await expect(assertPublicHttpsUrl("::::not a url")).rejects.toBeInstanceOf(
      BlockedUrlError,
    );
  });
  it("accepts https to a public literal IP", async () => {
    await expect(assertPublicHttpsUrl("https://93.184.216.34/hook")).resolves.toBeUndefined();
  });
});
