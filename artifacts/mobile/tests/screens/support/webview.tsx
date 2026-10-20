// Test double for react-native-webview. The test reads the latest props to
// drive onLoadEnd and onMessage, and reads posted commands from postMessage.
import * as React from "react";
import { vi } from "vitest";

export interface WebViewPropsLike {
  onLoadEnd?: () => void;
  onMessage?: (event: { nativeEvent: { data: string } }) => unknown;
  source?: { html?: string };
}

export const webView: { props: WebViewPropsLike | null } = { props: null };
export const postMessage = vi.fn();

export default function WebView(
  props: WebViewPropsLike & { ref?: React.Ref<unknown> },
) {
  webView.props = props;
  React.useImperativeHandle(props.ref, () => ({ postMessage }));
  return <div data-testid="article-webview" />;
}
