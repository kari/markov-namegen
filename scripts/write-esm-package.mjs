import { writeFile } from "node:fs/promises";

await writeFile(
	"dist/esm/package.json",
	JSON.stringify({ type: "module" }, null, 2) + "\n",
);
