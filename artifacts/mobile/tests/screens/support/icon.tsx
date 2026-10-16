// Test double for @expo/vector-icons glyph components.
import * as React from "react";

export default function Icon(props: { name?: string }) {
  return <span data-icon={props.name} />;
}
