export function flashUrl(path: string, message: string, kind: "success" | "error" = "success") {
  const qs = new URLSearchParams({ flash: message, flashKind: kind });
  return `${path}${path.includes("?") ? "&" : "?"}${qs.toString()}`;
}