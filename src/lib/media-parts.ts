export function sdkImage(url: string) {
  return { type: "image", image: new URL(url) } as const;
}