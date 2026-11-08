// Punto de entrada de Remotion: `npx remotion lambda sites create remotion/index.ts --site-name=markia`
import { registerRoot } from "remotion";
import { RemotionRoot } from "./Root";

registerRoot(RemotionRoot);
