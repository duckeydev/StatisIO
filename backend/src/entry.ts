// Polyfill: Bun doesn't implement v8.isBuildingSnapshot, which bson uses in its static init
if (typeof process !== "undefined" && "getBuiltinModule" in process) {
  const origGetBuiltinModule = process.getBuiltinModule!.bind(process);
  process.getBuiltinModule = (name: string) => {
    if (name === "v8") {
      return { isBuildingSnapshot: () => false };
    }
    return origGetBuiltinModule(name);
  };
}

const { default: app } = await import("./index.ts");
export default app;
