import {
  shareContentAsMessage,
  type ShareContent,
} from "@workspace/share-intent";

export type NativeSharePayload = {
  message: string;
  url?: string;
};

export function buildNativeSharePayload(
  content: ShareContent,
  platform: string,
): NativeSharePayload {
  return platform === "ios"
    ? { message: content.text, url: content.url }
    : { message: shareContentAsMessage(content) };
}
