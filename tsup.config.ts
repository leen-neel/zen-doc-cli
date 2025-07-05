import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  outDir: "dist",
  format: ["esm"],
  target: "node20",
  banner: {
    js: "#!/usr/bin/env node",
  },
  splitting: false,
  clean: true,
  dts: true, // optional, generates types
  noExternal: ["chalk"], // Ensure chalk is bundled
  treeshake: false, // Disable tree shaking to ensure all functions are included
});
