// 🔵 AEGIS — blue team (defense). Thin entry; the engine lives in ../engine/wraith.ts.
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { registerAgent } from "../engine/wraith";
export default (pi: ExtensionAPI) => registerAgent(pi, "blue");
