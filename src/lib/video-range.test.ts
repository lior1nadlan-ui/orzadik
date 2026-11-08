import { describe, expect, it } from "vitest";
import { parseByteRange, rangeableVideoSrc, rangedResponse, videoAssetPath } from "./video-range";

describe("rangeableVideoSrc", () => {
  it("maps a built video asset to the /v/ range path", () => {
    expect(rangeableVideoSrc("/assets/store-tour-B697asnA.mp4")).toBe("/v/store-tour-B697asnA.mp4");
    expect(rangeableVideoSrc("/assets/reel-1-Ab_c.webm")).toBe("/v/reel-1-Ab_c.webm");
  });

  it("leaves dev-server URLs, other files and absolute URLs alone", () => {
    expect(rangeableVideoSrc("/src/assets/video/store-tour.mp4")).toBe(
      "/src/assets/video/store-tour.mp4",
    );
    expect(rangeableVideoSrc("/assets/store-tour-poster-x.webp")).toBe(
      "/assets/store-tour-poster-x.webp",
    );
    expect(rangeableVideoSrc("https://cdn.example.com/assets/a.mp4")).toBe(
      "https://cdn.example.com/assets/a.mp4",
    );
    expect(rangeableVideoSrc("/assets/nested/a.mp4")).toBe("/assets/nested/a.mp4");
  });
});

describe("videoAssetPath", () => {
  it("maps /v/<video> back to its static asset path", () => {
    expect(videoAssetPath("/v/store-tour-B697asnA.mp4")).toBe("/assets/store-tour-B697asnA.mp4");
  });

  it("rejects anything that is not a single plain video file name", () => {
    expect(videoAssetPath("/v/../server.js")).toBeNull();
    expect(videoAssetPath("/v/a/b.mp4")).toBeNull();
    expect(videoAssetPath("/v/.hidden.mp4")).toBeNull();
    expect(videoAssetPath("/v/poster.webp")).toBeNull();
    expect(videoAssetPath("/v/")).toBeNull();
    expect(videoAssetPath("/assets/a.mp4")).toBeNull();
  });
});

describe("parseByteRange", () => {
  const size = 1000;

  it("returns null when there is no usable range", () => {
    expect(parseByteRange(null, size)).toBeNull();
    expect(parseByteRange("", size)).toBeNull();
    expect(parseByteRange("items=0-1", size)).toBeNull();
    expect(parseByteRange("bytes=-", size)).toBeNull();
    expect(parseByteRange("bytes=0-1,5-9", size)).toBeNull();
    expect(parseByteRange("bytes=9-5", size)).toBeNull();
  });

  it("parses the probe Safari opens with", () => {
    expect(parseByteRange("bytes=0-1", size)).toEqual({ start: 0, end: 1 });
  });

  it("parses open-ended and suffix ranges", () => {
    expect(parseByteRange("bytes=100-", size)).toEqual({ start: 100, end: 999 });
    expect(parseByteRange("bytes=-200", size)).toEqual({ start: 800, end: 999 });
    expect(parseByteRange("bytes=-5000", size)).toEqual({ start: 0, end: 999 });
  });

  it("clamps an end past the body and flags a start past it", () => {
    expect(parseByteRange("bytes=900-5000", size)).toEqual({ start: 900, end: 999 });
    expect(parseByteRange("bytes=1000-", size)).toBe("unsatisfiable");
    expect(parseByteRange("bytes=-0", size)).toBe("unsatisfiable");
  });
});

describe("rangedResponse", () => {
  const body = new Uint8Array(Array.from({ length: 10 }, (_, i) => i)).buffer;
  const base = { "Content-Type": "video/mp4", "Cache-Control": "public, max-age=31536000" };

  it("answers a range with 206 and just those bytes", async () => {
    const res = rangedResponse(body, "bytes=2-5", "GET", base);
    expect(res.status).toBe(206);
    expect(res.headers.get("Content-Range")).toBe("bytes 2-5/10");
    expect(res.headers.get("Content-Length")).toBe("4");
    expect(res.headers.get("Accept-Ranges")).toBe("bytes");
    expect(res.headers.get("Content-Type")).toBe("video/mp4");
    expect([...new Uint8Array(await res.arrayBuffer())]).toEqual([2, 3, 4, 5]);
  });

  it("answers no range with 200 and the whole body", async () => {
    const res = rangedResponse(body, null, "GET", base);
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Length")).toBe("10");
    expect((await res.arrayBuffer()).byteLength).toBe(10);
  });

  it("answers an unsatisfiable range with 416", () => {
    const res = rangedResponse(body, "bytes=50-60", "GET", base);
    expect(res.status).toBe(416);
    expect(res.headers.get("Content-Range")).toBe("bytes */10");
  });

  it("sends headers but no body for HEAD", async () => {
    const res = rangedResponse(body, "bytes=0-1", "HEAD", base);
    expect(res.status).toBe(206);
    expect(res.headers.get("Content-Length")).toBe("2");
    expect((await res.arrayBuffer()).byteLength).toBe(0);
  });
});
